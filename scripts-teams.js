// ── Shared state (populated from app-data.js) ─────────────────────────────
let projects = [], teams = [], checkins = {};
function loadPersisted() { const s = loadData(); projects = s.projects; teams = s.teams; checkins = s.checkins; }
function persist() { saveData({ projects, teams, checkins }); }

    const TODAY = new Date();
    const STATUS_LABEL = { "on-track": "On Track", "at-risk": "At Risk", "critical": "Critical" };
    const STATUS_COLOR = { "on-track": "#2DB81F", "at-risk": "#D4A017", "critical": "#B81F2D" };
    const STATUS_BG    = { "on-track": "#e8f8e6", "at-risk": "#fdf5dc", "critical": "#fce8ea" };
    const STATUS_TEXT  = { "on-track": "#1a6e12", "at-risk": "#7a5800", "critical": "#7a1219" };
    const CI_EMOJI = { good: "😊", okay: "😐", struggling: "😟" };
    const CI_LABEL = { good: "Good", okay: "Okay", struggling: "Struggling" };
    const CI_BG    = { good: "#e8f8e6", okay: "#fdf5dc", struggling: "#fce8ea" };
    const CI_TEXT  = { good: "#1a6e12", okay: "#7a5800", struggling: "#7a1219" };
    const AVATAR_PALETTE = ["#7373D8","#2F78C4","#06C7CC","#2E308E","#26C4AB","#B56AC4","#4A90D9","#D4A017"];



    function isStale(item) { return (TODAY - new Date(item.updated)) / 86400000 > STALE_DAYS; }
    function formatDate(iso) {
      if (!iso) return "—";
      return new Date(iso).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"2-digit"});
    }
    function relativeDate(iso) {
      const diff = Math.floor((TODAY - new Date(iso)) / 86400000);
      if (diff === 0) return "today";
      if (diff === 1) return "yesterday";
      if (diff < 7)  return `${diff}d ago`;
      if (diff < 14) return "last week";
      return formatDate(iso);
    }
    function initials(name) { return name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase(); }
    function avatarColor(name) {
      let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))%AVATAR_PALETTE.length;
      return AVATAR_PALETTE[h];
    }
    function ragPill(label, s) {
      return `<span class="rag-pill" style="background:${STATUS_BG[s]};color:${STATUS_TEXT[s]};"><span class="rag-dot" style="background:${STATUS_COLOR[s]};"></span>${label || STATUS_LABEL[s]}</span>`;
    }
    function healthSparkline(item) {
      const W=72, H=24, PAD=2;
      const series = DIMENSIONS.map(d => ({
        pts: [...(item.history[d]||[]), statusScore(item[d])],
        color: DIM_COLOR[d]
      }));
      const allPts = series.flatMap(s => s.pts);
      if (allPts.length < 2) return "<span style='color:var(--grey-dark);'>—</span>";
      const lo=Math.min(...allPts)-5, hi=Math.max(...allPts)+5, range=hi-lo||1;
      const lines = series.map(({pts,color}) => {
        if (pts.length < 2) return "";
        const coords = pts.map((v,i) => {
          const x = PAD+(i/(pts.length-1))*(W-PAD*2);
          const y = PAD+(1-(v-lo)/range)*(H-PAD*2);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");
        return `<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
      }).join("");
      return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${lines}</svg>`;
    }
    function avatarStackSmall(people, max=4) {
      const show = people.slice(0, max);
      const rest = people.length - show.length;
      return show.map(p => `<span class="avatar-sm" style="background:${avatarColor(p.name)}" title="${p.name}">${initials(p.name)}</span>`).join("")
        + (rest > 0 ? `<span class="avatar-sm" style="background:var(--grey-dark)">+${rest}</span>` : "");
    }
    let _undoFn = null;
    function showToast(msg, undoFn) {
      const t = document.getElementById("toast");
      _undoFn = undoFn || null;
      if (undoFn) {
        t.innerHTML = `<span>${msg}</span><button class="toast-undo" onclick="_undoFn&&_undoFn();_undoFn=null;document.getElementById('toast').classList.remove('show','has-undo');">Undo</button>`;
        t.classList.add("show", "has-undo");
      } else {
        t.textContent = msg;
        t.classList.add("show");
        t.classList.remove("has-undo");
      }
      clearTimeout(t._timer);
      t._timer = setTimeout(() => { t.classList.remove("show","has-undo"); _undoFn = null; }, undoFn ? 4500 : 2800);
    }
    function statusScore(s) { return s==="on-track"?90:s==="at-risk"?55:20; }

    function moraleSparkline(item) {
      const pts = [...(item.history?.morale || []), statusScore(item.morale)];
      if (pts.length < 2) return "<span style='color:var(--grey-dark);'>—</span>";
      const W=64, H=22, PAD=2;
      const min=Math.min(...pts), max=Math.max(...pts), range=max-min||1;
      const coords = pts.map((v,i) => {
        const x = PAD + (i/(pts.length-1))*(W-PAD*2);
        const y = PAD + (1-(v-min)/range)*(H-PAD*2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      const color = STATUS_COLOR[item.morale];
      return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><polyline points="${coords}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    // ── Sort ──────────────────────────────────────────────────────────
    // Default view leads with what needs action: critical first, then at-risk,
    // with stale (overdue) items bumped up within each band. Clicking any column
    // header switches to a normal ascending/descending sort on that column.
    let sortCol = "priority", sortDir = -1;
    const RANK = { "on-track":0, "at-risk":1, "critical":2 };
    function priorityScore(item) { return RANK[overallStatus(item)] * 2 + (isStale(item) ? 1 : 0); }

    function setSort(col) {
      sortDir = (sortCol === col) ? -sortDir : 1;
      sortCol = col;
      renderTable();
    }

    function sortedTeams(arr) {
      return [...arr].sort((a,b) => {
        let av, bv;
        if (sortCol === "priority") { av=priorityScore(a); bv=priorityScore(b); }
        else if (sortCol === "status") { av=RANK[overallStatus(a)]; bv=RANK[overallStatus(b)]; }
        else if (["delivery","morale","satisfaction"].includes(sortCol)) { av=RANK[a[sortCol]]; bv=RANK[b[sortCol]]; }
        else if (sortCol === "updated") { av=a.updated||""; bv=b.updated||""; }
        else { av=(a[sortCol]||"").toLowerCase(); bv=(b[sortCol]||"").toLowerCase(); }
        return (av<bv?-1:av>bv?1:0)*sortDir;
      });
    }

    // ── Render ────────────────────────────────────────────────────────
    function renderTable() {
      const search = document.getElementById("searchInput").value.toLowerCase();
      const status = document.getElementById("statusFilter").value;

      let filtered = teams.filter(t => {
        const ms = t.name.toLowerCase().includes(search) || t.lead.toLowerCase().includes(search)
          || t.people.some(x => x.name.toLowerCase().includes(search));
        return ms && (!status || overallStatus(t) === status);
      });
      filtered = sortedTeams(filtered);

      // Sort arrows
      document.querySelectorAll(".tbl thead th").forEach(th => {
        const id = th.id.replace("th-","");
        const arrow = th.querySelector(".sort-arrow");
        if (!arrow) return;
        th.classList.toggle("sort-active", sortCol === id);
        th.setAttribute("aria-sort", sortCol === id ? (sortDir === 1 ? "ascending" : "descending") : "none");
        arrow.textContent = sortCol === id ? (sortDir===1?" ↑":" ↓") : " ↕";
        arrow.style.opacity = sortCol === id ? "1" : "0.3";
      });

      // Stat chips
      const counts = {"on-track":0,"at-risk":0,"critical":0};
      teams.forEach(t => counts[overallStatus(t)]++);
      document.getElementById("statChips").innerHTML = `
        <div class="stat-chip"><span class="stat-chip-num">${teams.length}</span> total</div>
        <div class="stat-chip" style="background:rgba(45,184,31,0.15);border-color:rgba(45,184,31,0.3);"><span class="stat-chip-num" style="color:#2DB81F;">${counts["on-track"]}</span> healthy</div>
        <div class="stat-chip" style="background:rgba(212,160,23,0.15);border-color:rgba(212,160,23,0.3);"><span class="stat-chip-num" style="color:#D4A017;">${counts["at-risk"]}</span> at risk</div>
        <div class="stat-chip" style="background:rgba(184,31,45,0.15);border-color:rgba(184,31,45,0.3);"><span class="stat-chip-num" style="color:#B81F2D;">${counts["critical"]}</span> critical</div>`;

      const lbl = document.getElementById("lastUpdatedLabel");
      if (lbl) {
        const latest = teams.reduce((best, t) => t.updated > best ? t.updated : best, "");
        lbl.textContent = latest ? `Last updated ${relativeDate(latest)}` : "";
      }

      const tbody = document.getElementById("tableBody");
      const empty = document.getElementById("emptyState");
      if (filtered.length === 0) { tbody.innerHTML=""; empty.style.display=""; return; }
      empty.style.display = "none";

      tbody.innerHTML = filtered.map(t => {
        const overall = overallStatus(t);
        const stale   = isStale(t);
        const key     = "team-" + t.id;
        const allCI   = checkins[key] || [];
        const membersWithCI = new Set(allCI.map(c => c.person)).size;
        const ciPct   = t.people.length > 0 ? Math.round((membersWithCI/t.people.length)*100) : 0;

        return `<tr onclick="openDrawer(${t.id})">
          <td>
            <div class="cell-name">${t.name}</div>
            <div class="cell-lead">${t.lead}</div>
          </td>
          <td class="hide-mobile">
            <span class="status-badge" style="background:${STATUS_BG[overall]};color:${STATUS_TEXT[overall]};">${STATUS_LABEL[overall]}</span>
          </td>
          <td class="hide-mobile">${ragPill("", t.delivery)}</td>
          <td class="hide-mobile">${ragPill("", t.morale)}</td>
          <td class="hide-mobile">${ragPill("", t.satisfaction)}</td>
          <td>
            <div style="display:flex;align-items:center;">${avatarStackSmall(t.people)}</div>
            <div style="font-size:0.68rem;color:var(--grey-dark);margin-top:2px;">${t.people.length} members</div>
          </td>
          <td class="hide-mobile">
            <div style="font-size:0.78rem;font-weight:600;color:var(--primary);">${allCI.length} logged</div>
            <div class="ci-bar-wrap"><div class="ci-bar-fill" style="width:${ciPct}%;"></div></div>
            <div style="font-size:0.65rem;color:var(--grey-dark);margin-top:2px;">${membersWithCI}/${t.people.length} members</div>
          </td>
          <td>
            <span style="${stale?"color:#D4A017;font-weight:600;":""}">${relativeDate(t.updated)}</span>
            ${stale?`<div style="font-size:0.68rem;color:#D4A017;cursor:pointer;" onclick="event.stopPropagation();openCheckinModal(${t.id})">⚠ Overdue update</div>`:""}
          </td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="action-btn" title="Edit" onclick="openEditModal(${t.id})">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="action-btn" title="Update status" onclick="openCheckinModal(${t.id})">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"/></svg>
            </button>
          </td>
        </tr>`;
      }).join("");
    }

    function clearFilters() {
      document.getElementById("searchInput").value = "";
      document.getElementById("statusFilter").value = "";
      renderTable();
    }

    // ── Drawer ────────────────────────────────────────────────────────
    function openDrawer(id) {
      const t = teams.find(x => x.id === id);
      if (!t) return;
      const overall = overallStatus(t);
      const key = "team-" + id;

      document.getElementById("drawerTitle").textContent = t.name;
      document.getElementById("drawerBadge").innerHTML =
        `<span class="status-badge" style="background:rgba(255,255,255,0.18);color:white;font-size:0.75rem;">${STATUS_LABEL[overall]}</span>`;

      const dims = DIMENSIONS.map(d => [d, dimLabel(d)]);
      let body = `<div class="row g-2 mb-1">
        ${dims.map(([d,label]) => `
          <div class="col-4">
            <div class="dim-card" style="background:${STATUS_BG[t[d]]};">
              <div style="width:10px;height:10px;border-radius:50%;background:${STATUS_COLOR[t[d]]};margin:0 auto 4px;"></div>
              <div style="font-size:0.72rem;font-weight:700;color:${STATUS_TEXT[t[d]]};">${STATUS_LABEL[t[d]]}</div>
              <div style="font-size:0.62rem;color:var(--grey-very-dark);margin-top:1px;">${label}</div>
            </div>
          </div>`).join("")}
      </div>`;

      if (t.notes) body += `
        <div class="p-3 rounded-3 my-3" style="background:var(--grey-very-light);border-left:3px solid var(--accent2-dark);">
          <div style="font-size:0.7rem;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Notes</div>
          <p style="font-size:0.85rem;color:var(--grey-very-dark);margin:0;">${t.notes}</p>
        </div>`;

      body += itemTrendHTML(t);
      body += actionsSectionHTML(t, "team");

      // Team wellbeing — each member + their last check-in
      body += `<div class="section-title">Team wellbeing (${t.people.length} members)</div>`;
      body += t.people.map(person => {
        const personCI = (checkins[key]||[]).filter(c => (c.person || c.name) === person.name);
        const last = personCI[personCI.length-1];
        const lastFeeling = checkinFeeling(last);
        return `<div class="person-row">
          <div class="avatar-md" style="background:${avatarColor(person.name)};">${initials(person.name)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:0.83rem;color:var(--primary);">${person.name}</div>
            <div style="font-size:0.7rem;color:var(--grey-dark);">${person.role}</div>
          </div>
          ${last
            ? `<div style="text-align:right;">
                <span class="ci-bubble" style="background:${CI_BG[lastFeeling]};color:${CI_TEXT[lastFeeling]};">${CI_EMOJI[lastFeeling]} ${CI_LABEL[lastFeeling]}</span>
                <div style="font-size:0.65rem;color:var(--grey-dark);margin-top:2px;">${relativeDate(last.date)}</div>
               </div>`
            : `<span style="font-size:0.7rem;color:var(--grey-dark);">No check-in yet</span>`}
        </div>`;
      }).join("");

      // Check-in log
      const allCI = (checkins[key]||[]).slice().reverse().slice(0,5);
      body += `<div class="section-title" style="margin-top:1.25rem;display:flex;align-items:center;justify-content:space-between;">
        <span>Recent check-ins (${(checkins[key]||[]).length})</span>
        <button style="background:none;border:1px solid var(--grey-light);border-radius:50px;padding:1px 10px;font-size:0.7rem;color:var(--primary);cursor:pointer;" onclick="openCheckinModal(${id})">+ Add</button>
      </div>`;
      body += voteDistributionHTML(checkins[key] || []);
      if (allCI.length === 0) {
        body += `<p style="font-size:0.82rem;color:var(--grey-dark);text-align:center;padding:1rem 0;">No check-ins recorded yet.</p>`;
      } else {
        body += allCI.map(c => {
          const feeling = checkinFeeling(c);
          return `
          <div class="checkin-item">
            <span style="font-size:1.1rem;">${CI_EMOJI[feeling]}</span>
            <div>
              <div style="font-size:0.8rem;font-weight:600;color:var(--grey-very-dark);">${c.person || c.name || "Anonymous"} — <span style="background:${CI_BG[feeling]};color:${CI_TEXT[feeling]};padding:1px 7px;border-radius:50px;font-size:0.7rem;">${CI_LABEL[feeling]}</span></div>
              ${c.note?`<div style="font-size:0.78rem;color:var(--grey-dark);margin-top:2px;">"${c.note}"</div>`:""}
              <div style="font-size:0.68rem;color:var(--grey-dark);margin-top:2px;">${formatDate(c.date)}${c.by ? ` · recorded by ${c.by}` : ""}</div>
            </div>
          </div>`;
        }).join("");
      }

      document.getElementById("drawerBody").innerHTML = body;
      document.getElementById("drawerDeleteBtn").onclick = () => deleteTeam(id);
      document.getElementById("drawerEditBtn").onclick   = () => { closeDrawer(); setTimeout(()=>openEditModal(id),50); };
      document.getElementById("drawerUpdateBtn").onclick = () => { closeDrawer(); setTimeout(()=>openCheckinModal(id),50); };

      // Highlight active row
      document.querySelectorAll(".tbl tbody tr").forEach(r => r.classList.remove("row-active"));
      const activeRow = document.querySelector(`tr[onclick="openDrawer(${id})"]`);
      if (activeRow) activeRow.classList.add("row-active");

      document.getElementById("drawer").classList.add("open");
      document.getElementById("drawerBackdrop").classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
      document.getElementById("drawer").classList.remove("open");
      document.getElementById("drawerBackdrop").classList.remove("open");
      document.body.style.overflow = "";
      document.querySelectorAll(".tbl tbody tr").forEach(r => r.classList.remove("row-active"));
    }

    function showDeleteConfirm(onConfirm) {
      const btn = document.getElementById("drawerDeleteBtn");
      if (!btn) return;
      const origText  = btn.textContent;
      const origClick = btn.onclick;
      const siblings = [...btn.parentElement.children].filter(el => el !== btn);
      siblings.forEach(el => el.style.display = "none");
      const warning = document.createElement("span");
      warning.style.cssText = "font-size:0.78rem;color:#B81F2D;flex:1;";
      warning.textContent   = "This can't be undone.";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn-sm-outline";
      cancelBtn.textContent = "Keep it";
      cancelBtn.onclick = () => {
        btn.textContent = origText;
        btn.onclick     = origClick;
        warning.remove();
        cancelBtn.remove();
        siblings.forEach(el => el.style.display = "");
      };
      btn.textContent = "Yes, delete";
      btn.onclick = () => { warning.remove(); cancelBtn.remove(); siblings.forEach(el => el.style.display = ""); btn.textContent = origText; btn.onclick = origClick; onConfirm(); };
      btn.parentElement.insertBefore(warning, btn);
      btn.insertAdjacentElement("afterend", cancelBtn);
    }

    function deleteTeam(id) {
      showDeleteConfirm(() => {
        const idx = teams.findIndex(t => t.id === id);
        if (idx === -1) return;
        const snapshot   = JSON.parse(JSON.stringify(teams[idx]));
        const ciKey      = "team-" + id;
        const ciSnapshot = checkins[ciKey] ? JSON.parse(JSON.stringify(checkins[ciKey])) : null;
        teams.splice(idx, 1);
        delete checkins[ciKey];
        persist();
        closeDrawer();
        renderTable();
        showToast("Team deleted.", () => {
          teams.push(snapshot);
          if (ciSnapshot) checkins[ciKey] = ciSnapshot;
          persist();
          renderTable();
        });
      });
    }


    function openEditModal(id) {
      const t = teams.find(x => x.id === id);
      if (!t) return;
      document.getElementById("editId").value    = id;
      document.getElementById("editName").value  = t.name;
      document.getElementById("editLead").value  = t.lead;
      document.getElementById("editNotes").value = t.notes || "";
      document.getElementById("editPeopleList").innerHTML = "";
      t.people.forEach(p => addEditPersonRow(p.name, p.role));
      document.getElementById("editError").style.display = "none";
      new bootstrap.Modal(document.getElementById("editModal")).show();
    }

    function addEditPersonRow(name="", role="") {
      const div = document.createElement("div");
      div.className = "d-flex gap-2 align-items-center person-edit-row";
      div.innerHTML = `
        <input type="text" class="edit-person-name" placeholder="Name" value="${name}" list="knownPeopleList" style="flex:1;border-radius:8px!important;font-size:0.85rem;">
        <input type="text" class="edit-person-role" placeholder="Role" value="${role}" style="flex:1;border-radius:8px!important;font-size:0.85rem;">
        <button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--grey-dark);cursor:pointer;padding:4px;font-size:1rem;">✕</button>`;
      document.getElementById("editPeopleList").appendChild(div);
    }

    // Suggests existing people by name as you type in an "Add person" field —
    // pure autocomplete convenience, not a real directory (typing a new name
    // still just creates a new person, same as before).
    function renderPeopleDatalist() {
      const dl = document.getElementById("knownPeopleList");
      if (!dl) return;
      const names = new Set();
      [...projects, ...teams].forEach(it => (it.people || []).forEach(p => names.add(p.name)));
      dl.innerHTML = [...names].sort().map(n => `<option value="${n}">`).join("");
    }

    function submitEdit() {
      const id    = parseInt(document.getElementById("editId").value);
      const t     = teams.find(x => x.id === id);
      const name  = document.getElementById("editName").value.trim();
      const lead  = document.getElementById("editLead").value.trim();
      const errEl = document.getElementById("editError");
      if (!name || !lead) { errEl.textContent="Name and lead are required."; errEl.style.display=""; return; }
      errEl.style.display = "none";
      t.name  = name;
      t.lead  = lead;
      t.notes = document.getElementById("editNotes").value.trim();
      t.people = [...document.querySelectorAll(".person-edit-row")].map(row => ({
        name: row.querySelector(".edit-person-name").value.trim(),
        role: row.querySelector(".edit-person-role").value.trim()
      })).filter(x => x.name);
      persist();
      renderPeopleDatalist();
      bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();
      renderTable();
      showToast("Team updated.");
    }

    function openAddModal() {
      document.getElementById("addName").value  = "";
      document.getElementById("addLead").value  = "";
      document.getElementById("addNotes").value = "";
      document.getElementById("addPeopleList").innerHTML = "";
      document.getElementById("addError").style.display = "none";
      new bootstrap.Modal(document.getElementById("addModal")).show();
    }

    function addAddPersonRow() {
      const div = document.createElement("div");
      div.className = "d-flex gap-2 align-items-center add-person-row";
      div.innerHTML = `
        <input type="text" class="add-person-name" placeholder="Name" list="knownPeopleList" style="flex:1;border-radius:8px!important;font-size:0.85rem;">
        <input type="text" class="add-person-role" placeholder="Role" style="flex:1;border-radius:8px!important;font-size:0.85rem;">
        <button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--grey-dark);cursor:pointer;padding:4px;font-size:1rem;">✕</button>`;
      document.getElementById("addPeopleList").appendChild(div);
    }

    function submitAdd() {
      const name  = document.getElementById("addName").value.trim();
      const lead  = document.getElementById("addLead").value.trim();
      const errEl = document.getElementById("addError");
      if (!name || !lead) { errEl.textContent="Name and lead are required."; errEl.style.display=""; return; }
      errEl.style.display = "none";
      const newId = Math.max(0, ...teams.map(t=>t.id)) + 1;
      const newItem = {
        id: newId, name, lead,
        notes:   document.getElementById("addNotes").value.trim(),
        updated: TODAY.toISOString().split("T")[0],
        people: [...document.querySelectorAll(".add-person-row")].map(row => ({
          name: row.querySelector(".add-person-name").value.trim(),
          role: row.querySelector(".add-person-role").value.trim()
        })).filter(x => x.name),
        history: {}
      };
      DIMENSIONS.forEach(d => { newItem[d] = "on-track"; newItem.history[d] = []; });
      teams.push(newItem);
      persist();
      renderPeopleDatalist();
      bootstrap.Modal.getInstance(document.getElementById("addModal")).hide();
      renderTable();
      showToast("Team added.");
    }

    function exportCSV() {
      const rows = [["Name","Lead","Overall", ...DIMENSIONS.map(dimLabel), "Members","Last Updated","Notes"]];
      teams.forEach(t => rows.push([t.name,t.lead,STATUS_LABEL[overallStatus(t)], ...DIMENSIONS.map(d => STATUS_LABEL[t[d]]), t.people.length,t.updated,t.notes||""]));
      const csv  = rows.map(r => r.map(c=>`"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv],{type:"text/csv"});
      Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:`teams-${TODAY.toISOString().split("T")[0]}.csv`}).click();
      showToast(`Exported ${teams.length} teams.`);
    }

    // ── Check-in ──────────────────────────────────────────────────────
    let ciSelections = {};



    function openCheckinModal(teamId) {
      ciSelections = {};
      document.querySelectorAll(".ci-btn").forEach(b => b.className = "ci-btn");
      document.getElementById("checkinTargetId").value = teamId;
      const t = teams.find(x => x.id === teamId);
      const lastCI = (checkins["team-" + teamId] || []).slice(-1)[0];
      document.getElementById("checkinSubtitle").textContent = t
        ? t.name + (lastCI ? ` · last check-in ${relativeDate(lastCI.date)}` : " · no check-ins yet")
        : "Share how you're feeling";
      document.getElementById("checkinNote").value = "";
      document.getElementById("checkinError").style.display = "none";
      document.getElementById("checkinOnBehalf").checked = false;
      document.getElementById("checkinBehalfOf").style.display = "none";
      const people = (t?.people || []).filter(x => x.name !== CURRENT_USER);
      document.getElementById("checkinBehalfOf").innerHTML = people.map(x => `<option value="${x.name}">${x.name} — ${x.role}</option>`).join("");
      refreshCheckinSubmit(ciSelections); // start disabled until every area is rated
      new bootstrap.Modal(document.getElementById("checkinModal")).show();
    }

    function toggleBehalfDropdown() {
      const checked = document.getElementById("checkinOnBehalf").checked;
      document.getElementById("checkinBehalfOf").style.display = checked ? "block" : "none";
    }

    function setCi(field, val) {
      ciSelections[field] = val;
      document.querySelectorAll(`.ci-btn[data-field="${field}"]`).forEach(b => {
        b.className = "ci-btn" + (b.dataset.val === val ? ` ci-active-${val}` : "");
      });
      refreshCheckinSubmit(ciSelections);
    }

    function submitCheckin() {
      const err = document.getElementById("checkinError");
      if (!DIMENSIONS.every(d => ciSelections[d])) {
        err.textContent = "Please rate every area before submitting.";
        err.style.display = "block";
        return;
      }
      err.style.display = "none";
      const id   = parseInt(document.getElementById("checkinTargetId").value);
      const onBehalf = document.getElementById("checkinOnBehalf").checked;
      const name = onBehalf ? (document.getElementById("checkinBehalfOf").value || CURRENT_USER) : CURRENT_USER;
      const note = document.getElementById("checkinNote").value.trim();
      const vals = DIMENSIONS.map(d => ciSelections[d]);
      const feeling = vals.includes("struggling") ? "struggling" : vals.every(v => v === "good") ? "good" : "okay";
      const key  = "team-" + id;

      // Update the official team record (a lead check-in directly sets status).
      const t = teams.find(x => x.id === id);
      if (t) {
        DIMENSIONS.forEach(d => {
          t[d] = ciToStatus(ciSelections[d]);
          if (Array.isArray(t.history[d])) t.history[d].push(statusToScore(t[d]));
        });
        if (note) t.notes = note;
        t.updated = TODAY.toISOString().split("T")[0];
      }

      const entry = { person: name, by: onBehalf ? CURRENT_USER : null, feeling, note, date: TODAY.toISOString().split("T")[0] };
      DIMENSIONS.forEach(d => { entry[d] = ciSelections[d]; });
      if (!checkins[key]) checkins[key] = [];
      checkins[key].push(entry);
      persist();
      bootstrap.Modal.getInstance(document.getElementById("checkinModal")).hide();
      renderTable();
      setTimeout(() => openDrawer(id), 300);
      showToast(`Check-in submitted. Thanks, ${name.split(" ")[0]}!`);
    }

    // ── Reset ─────────────────────────────────────────────────────────
    function resetDemoData() {
      if (!confirm("Reset all data back to the demo defaults?")) return;
      localStorage.removeItem(STORE_KEY);
      location.reload();
    }

    function addItemAction(type, id) {
      const input = document.getElementById(`actionInput-${type}-${id}`);
      const text = ((input && input.value) || "").trim();
      if (!text) return;
      const item = (type === "project" ? projects : teams).find(x => x.id === id);
      if (!item) return;
      pushAction(item, text, CURRENT_USER);
      persist();
      openDrawer(id);
    }
    function resolveItemAction(type, id, actionId) {
      const item = (type === "project" ? projects : teams).find(x => x.id === id);
      if (!item) return;
      resolveAction(item, actionId);
      persist();
      openDrawer(id);
    }

    document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });
    // Keyboard support for sortable table headers (Enter / Space).
    document.addEventListener("keydown", e => {
      const th = e.target && e.target.closest ? e.target.closest('.tbl thead th[role="button"]') : null;
      if (th && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); th.click(); }
    });
    loadPersisted();
    renderTable();
    renderPeopleDatalist();
    // Open drawer if arriving from dashboard deep-link
    try {
      const pending = sessionStorage.getItem("openDrawer");
      if (pending) {
        const { id, type } = JSON.parse(pending);
        sessionStorage.removeItem("openDrawer");
        if (type === "team") setTimeout(() => openDrawer(id), 150);
      }
    } catch(e) {}
