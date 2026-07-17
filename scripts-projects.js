// ── Shared state (populated from app-data.js) ─────────────────────────────
let projects = [], teams = [], checkins = {};
function loadPersisted() { const s = loadData(); projects = s.projects; teams = s.teams; checkins = s.checkins; }
function persist() { saveData({ projects, teams, checkins }); }

    // ── Constants ─────────────────────────────────────────────────────
    const TODAY = new Date();
    const STATUS_LABEL = { "on-track": "On Track", "at-risk": "At Risk", "critical": "Critical" };
    const STATUS_COLOR = { "on-track": "#2DB81F", "at-risk": "#D4A017", "critical": "#B81F2D" };
    const STATUS_BG    = { "on-track": "#e8f8e6", "at-risk": "#fdf5dc", "critical": "#fce8ea" };
    const STATUS_TEXT  = { "on-track": "#1a6e12", "at-risk": "#7a5800", "critical": "#7a1219" };
    const CI_EMOJI     = { good: "😊", okay: "😐", struggling: "😟" };
    const CI_LABEL     = { good: "Good", okay: "Okay", struggling: "Struggling" };
    const CI_BG        = { good: "#e8f8e6", okay: "#fdf5dc", struggling: "#fce8ea" };
    const CI_TEXT      = { good: "#1a6e12", okay: "#7a5800", struggling: "#7a1219" };
    const AVATAR_PALETTE = ["#7373D8","#2F78C4","#06C7CC","#2E308E","#26C4AB","#B56AC4","#4A90D9","#D4A017"];

    // ── Default data ─────────────────────────────────────────────────

    // ── Persistence ───────────────────────────────────────────────────

    // ── Helpers ───────────────────────────────────────────────────────
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
      return `<span class="rag-pill" title="${STATUS_LABEL[s]}" aria-label="${STATUS_LABEL[s]}" style="background:${STATUS_BG[s]};color:${STATUS_TEXT[s]};"><span class="rag-dot" style="background:${STATUS_COLOR[s]};"></span>${label || STATUS_LABEL[s]}</span>`;
    }
    function statusScore(s) { return s==="on-track"?90:s==="at-risk"?55:20; }
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
    function avatarStackSmall(people) {
      const show = people.slice(0, 3);
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

    // ── Sort state ────────────────────────────────────────────────────
    // Default view leads with what needs action: critical first, then at-risk,
    // with stale (overdue) items bumped up within each band. Clicking any column
    // header switches to a normal ascending/descending sort on that column.
    let sortCol = "priority", sortDir = -1;
    const RANK = { "on-track": 0, "at-risk": 1, "critical": 2 };
    function priorityScore(item) { return RANK[overallStatus(item)] * 2 + (isStale(item) ? 1 : 0); }

    function setSort(col) {
      sortDir = (sortCol === col) ? -sortDir : 1;
      sortCol = col;
      renderTable();
    }

    function sortedProjects(arr) {
      return [...arr].sort((a, b) => {
        let av, bv;
        if (sortCol === "priority") { av = priorityScore(a); bv = priorityScore(b); }
        else if (sortCol === "status")   { av = RANK[overallStatus(a)]; bv = RANK[overallStatus(b)]; }
        else if (sortCol === "delivery" || sortCol === "morale" || sortCol === "satisfaction") { av = RANK[a[sortCol]]; bv = RANK[b[sortCol]]; }
        else if (sortCol === "end" || sortCol === "updated") { av = a[sortCol] || ""; bv = b[sortCol] || ""; }
        else { av = (a[sortCol]||"").toLowerCase(); bv = (b[sortCol]||"").toLowerCase(); }
        return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
      });
    }

    // ── Render table ──────────────────────────────────────────────────
    function renderTable() {
      const search = document.getElementById("searchInput").value.toLowerCase();
      const status = document.getElementById("statusFilter").value;

      let filtered = projects.filter(p => {
        const ms = p.name.toLowerCase().includes(search) || p.lead.toLowerCase().includes(search)
          || p.people.some(x => x.name.toLowerCase().includes(search));
        return ms && (!status || overallStatus(p) === status);
      });
      filtered = sortedProjects(filtered);

      // Update sort arrows
      document.querySelectorAll(".tbl thead th").forEach(th => {
        const id = th.id.replace("th-","");
        const arrow = th.querySelector(".sort-arrow");
        if (!arrow) return;
        th.classList.toggle("sort-active", sortCol === id);
        th.setAttribute("aria-sort", sortCol === id ? (sortDir === 1 ? "ascending" : "descending") : "none");
        arrow.textContent = sortCol === id ? (sortDir === 1 ? " ↑" : " ↓") : " ↕";
        arrow.style.opacity = sortCol === id ? "1" : "0.3";
      });

      // Update stat chips
      const counts = { "on-track":0, "at-risk":0, "critical":0 };
      projects.forEach(p => counts[overallStatus(p)]++);
      document.getElementById("statChips").innerHTML = `
        <div class="stat-chip"><span class="stat-chip-num">${projects.length}</span> total</div>
        <div class="stat-chip" style="background:rgba(45,184,31,0.15);border-color:rgba(45,184,31,0.3);"><span class="stat-chip-num" style="color:#2DB81F;">${counts["on-track"]}</span> on track</div>
        <div class="stat-chip" style="background:rgba(212,160,23,0.15);border-color:rgba(212,160,23,0.3);"><span class="stat-chip-num" style="color:#D4A017;">${counts["at-risk"]}</span> at risk</div>
        <div class="stat-chip" style="background:rgba(184,31,45,0.15);border-color:rgba(184,31,45,0.3);"><span class="stat-chip-num" style="color:#B81F2D;">${counts["critical"]}</span> critical</div>`;

      const lbl = document.getElementById("lastUpdatedLabel");
      if (lbl) {
        const latest = projects.reduce((best, p) => p.updated > best ? p.updated : best, "");
        lbl.textContent = latest ? `Last updated ${relativeDate(latest)}` : "";
      }

      const tbody = document.getElementById("tableBody");
      const empty = document.getElementById("emptyState");

      if (filtered.length === 0) {
        tbody.innerHTML = "";
        empty.style.display = "";
        return;
      }
      empty.style.display = "none";

      tbody.innerHTML = filtered.map(p => {
        const overall = overallStatus(p);
        const stale   = isStale(p);
        const done    = (p.milestones || []).filter(m => m.done).length;
        const total   = (p.milestones || []).length;
        const progress = total > 0 ? Math.round((done/total)*100) : 0;
        const endDate  = p.end ? new Date(p.end) : null;
        const overdue  = endDate && endDate < TODAY;

        return `<tr onclick="openDrawer(${p.id})" id="row-${p.id}">
          <td>
            <div class="cell-name">${p.name}</div>
            <div class="cell-lead">${p.lead}</div>
          </td>
          <td class="hide-mobile">
            <div style="font-weight: 500; color: var(--grey-very-dark);">${p.account || 'Unassigned'}</div>
          </td>
          <td class="hide-mobile">
            <span class="status-badge" style="background:${STATUS_BG[overall]};color:${STATUS_TEXT[overall]};">${STATUS_LABEL[overall]}</span>
          </td>
          <td class="hide-mobile">${ragPill("", p.delivery)}</td>
          <td class="hide-mobile">${ragPill("", p.morale)}</td>
          <td class="hide-mobile">${ragPill("", p.satisfaction)}</td>
          <td>
            <div style="display:flex;align-items:center;">${avatarStackSmall(p.people)}</div>
            <div style="font-size:0.68rem;color:var(--grey-dark);margin-top:2px;">${p.people.length} people</div>
          </td>
          <td class="hide-mobile">
            ${total > 0 ? `<div style="font-size:0.78rem;font-weight:600;color:var(--primary);">${done}/${total} done</div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${progress}%;"></div></div>` : "<span style='color:var(--grey-dark);'>—</span>"}
          </td>
          <td class="hide-mobile">
            <span style="${overdue ? "color:#B81F2D;font-weight:600;" : ""}">${formatDate(p.end)}</span>
            ${overdue ? `<div style="font-size:0.68rem;color:#B81F2D;">Overdue</div>` : ""}
          </td>
          <td>
            <span style="${stale ? "color:#D4A017;font-weight:600;" : ""}">${relativeDate(p.updated)}</span>
            ${stale ? `<div style="font-size:0.68rem;color:#D4A017;cursor:pointer;" onclick="event.stopPropagation();openCheckinModal(${p.id})">⚠ Overdue update</div>` : ""}
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
    let activeDrawerId = null;

    function openDrawer(id) {
      const p = projects.find(x => x.id === id);
      if (!p) return;
      activeDrawerId = id;
      const overall = overallStatus(p);
      const key = "project-" + id;

      document.getElementById("drawerTitle").textContent = p.name;
      document.getElementById("drawerBadge").innerHTML =
        `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span class="status-badge" style="background:rgba(255,255,255,0.18);color:white;font-size:0.75rem;">${STATUS_LABEL[overall]}</span>
          <span style="font-size:0.72rem;opacity:0.75;">Project · Led by ${p.lead}</span>
          <a href="detail.html?type=project&id=${id}"
            style="font-size:0.72rem;color:rgba(255,255,255,0.85);text-decoration:none;border:1px solid rgba(255,255,255,0.35);border-radius:50px;padding:1px 9px;white-space:nowrap;">View details ↗</a>
        </div>`;

      // Removed RAG cards and notes
      let body = ``;

      // Less details: Removed milestones and trend chart from drawer
      body += actionsSectionHTML(p, "project");

      // People + check-in history
      body += `<div class="section-title">People (${p.people.length})</div>`;
      body += p.people.map(person => {
        const personCheckins = (checkins[key] || []).filter(c => (c.person || c.name) === person.name);
        const last = personCheckins[personCheckins.length - 1];
        const lastFeeling = checkinFeeling(last);
        return `<div class="person-row">
          <div class="avatar-md" style="background:${avatarColor(person.name)};">${initials(person.name)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:0.83rem;color:var(--primary);">${person.name}</div>
            <div style="font-size:0.7rem;color:var(--grey-dark);">${person.role}</div>
          </div>
          ${last ? `<span class="ci-bubble" style="background:${CI_BG[lastFeeling]};color:${CI_TEXT[lastFeeling]};">${CI_EMOJI[lastFeeling]} ${CI_LABEL[lastFeeling]}</span>` : `<span style="font-size:0.7rem;color:var(--grey-dark);">No check-in</span>`}
        </div>`;
      }).join("");

      // Check-in log
      const allCI = (checkins[key] || []).slice().reverse().slice(0, 5);
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
              ${c.note ? `<div style="font-size:0.78rem;color:var(--grey-dark);margin-top:2px;">"${c.note}"</div>` : ""}
              <div style="font-size:0.68rem;color:var(--grey-dark);margin-top:2px;">${formatDate(c.date)}${c.by ? ` · recorded by ${c.by}` : ""}</div>
            </div>
          </div>`;
        }).join("");
      }

      document.getElementById("drawerBody").innerHTML = body;

      document.getElementById("drawerDeleteBtn").onclick = () => deleteProject(id);
      document.getElementById("drawerUpdateBtn").onclick = () => { closeDrawer(); setTimeout(() => openCheckinModal(id), 50); };

      // Highlight active row
      document.querySelectorAll(".tbl tbody tr").forEach(r => r.classList.remove("row-active"));
      const activeRow = document.getElementById("row-" + id);
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
      activeDrawerId = null;
    }

    // ── Delete ────────────────────────────────────────────────────────
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

    function deleteProject(id) {
      showDeleteConfirm(() => {
        const idx = projects.findIndex(p => p.id === id);
        if (idx === -1) return;
        const snapshot   = JSON.parse(JSON.stringify(projects[idx]));
        const ciKey      = "project-" + id;
        const ciSnapshot = checkins[ciKey] ? JSON.parse(JSON.stringify(checkins[ciKey])) : null;
        projects.splice(idx, 1);
        delete checkins[ciKey];
        persist();
        closeDrawer();
        renderTable();
        showToast("Project deleted.", () => {
          projects.push(snapshot);
          if (ciSnapshot) checkins[ciKey] = ciSnapshot;
          persist();
          renderTable();
        });
      });
    }


    // ── Edit modal ────────────────────────────────────────────────────
    function openEditModal(id) {
      const p = projects.find(x => x.id === id);
      if (!p) return;
      document.getElementById("editId").value    = id;
      document.getElementById("editName").value  = p.name;
      document.getElementById("editLead").value  = p.lead;
      document.getElementById("editNotes").value = p.notes || "";
      const list = document.getElementById("editPeopleList");
      list.innerHTML = "";
      p.people.forEach(person => addEditPersonRow(person.name, person.role));
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
      const p     = projects.find(x => x.id === id);
      const name  = document.getElementById("editName").value.trim();
      const lead  = document.getElementById("editLead").value.trim();
      const errEl = document.getElementById("editError");
      if (!name || !lead) { errEl.textContent = "Name and lead are required."; errEl.style.display = ""; return; }
      errEl.style.display = "none";
      p.name  = name;
      p.lead  = lead;
      p.notes = document.getElementById("editNotes").value.trim();
      p.people = [...document.querySelectorAll(".person-edit-row")].map(row => ({
        name: row.querySelector(".edit-person-name").value.trim(),
        role: row.querySelector(".edit-person-role").value.trim()
      })).filter(x => x.name);
      persist();
      renderPeopleDatalist();
      bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();
      renderTable();
      showToast("Project updated.");
    }

    // ── Add modal ─────────────────────────────────────────────────────
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
      if (!name || !lead) { errEl.textContent = "Name and lead are required."; errEl.style.display = ""; return; }
      errEl.style.display = "none";
      const newId = Math.max(0, ...projects.map(p=>p.id)) + 1;
      const newItem = {
        id: newId, name, lead,
        notes:   document.getElementById("addNotes").value.trim(),
        updated: TODAY.toISOString().split("T")[0],
        start: TODAY.toISOString().split("T")[0], end: "",
        milestones: [],
        people: [...document.querySelectorAll(".add-person-row")].map(row => ({
          name: row.querySelector(".add-person-name").value.trim(),
          role: row.querySelector(".add-person-role").value.trim()
        })).filter(x => x.name),
        history: {}
      };
      DIMENSIONS.forEach(d => { newItem[d] = "on-track"; newItem.history[d] = []; });
      projects.push(newItem);
      persist();
      renderPeopleDatalist();
      bootstrap.Modal.getInstance(document.getElementById("addModal")).hide();
      renderTable();
      showToast("Project added.");
    }

    // ── Export CSV ────────────────────────────────────────────────────
    function exportCSV() {
      const rows = [["Name","Lead","Overall", ...DIMENSIONS.map(dimLabel), "People","Milestones Done","End Date","Last Updated","Notes"]];
      projects.forEach(p => {
        const done = (p.milestones||[]).filter(m=>m.done).length;
        rows.push([p.name, p.lead, STATUS_LABEL[overallStatus(p)], ...DIMENSIONS.map(d => STATUS_LABEL[p[d]]), p.people.length, `${done}/${(p.milestones||[]).length}`, p.end||"", p.updated, p.notes||""]);
      });
      const csv  = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], {type:"text/csv"});
      Object.assign(document.createElement("a"), {href: URL.createObjectURL(blob), download:`projects-${TODAY.toISOString().split("T")[0]}.csv`}).click();
      showToast(`Exported ${projects.length} projects.`);
    }

    // ── Check-in ──────────────────────────────────────────────────────
    let ciSelections = {};



    function openCheckinModal(projectId) {
      ciSelections = {};
      document.querySelectorAll(".ci-btn").forEach(b => b.className = "ci-btn");
      document.getElementById("checkinTargetId").value = projectId;
      const p = projects.find(x => x.id === projectId);
      const lastCI = (checkins["project-" + projectId] || []).slice(-1)[0];
      document.getElementById("checkinSubtitle").textContent = p
        ? p.name + (lastCI ? ` · last check-in ${relativeDate(lastCI.date)}` : " · no check-ins yet")
        : "Share how you're feeling";
      document.getElementById("checkinNote").value = "";
      document.getElementById("checkinError").style.display = "none";
      document.getElementById("checkinOnBehalf").checked = false;
      document.getElementById("checkinBehalfOf").style.display = "none";
      const people = (p?.people || []).filter(x => x.name !== CURRENT_USER);
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
      const key  = "project-" + id;

      // Update the official project record (a lead check-in directly sets status).
      const p = projects.find(x => x.id === id);
      if (p) {
        DIMENSIONS.forEach(d => {
          p[d] = ciToStatus(ciSelections[d]);
          if (Array.isArray(p.history[d])) p.history[d].push(statusToScore(p[d]));
        });
        if (note) p.notes = note;
        p.updated = TODAY.toISOString().split("T")[0];
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

    // ── Init ──────────────────────────────────────────────────────────
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
    // Open drawer if arriving from dashboard deep-link
    try {
      const pending = sessionStorage.getItem("openDrawer");
      if (pending) {
        const { id, type } = JSON.parse(pending);
        sessionStorage.removeItem("openDrawer");
        if (type === "project") setTimeout(() => openDrawer(id), 150);
      }
    } catch(e) {}

    // ── View Mode & Account Rollup ───────────────────────────────────────────
    let currentViewMode = "list"; // 'list' | 'grouped'
    let activeStatusFilter = "";
    let collapsedAccounts = {};
    let currentView = "projects";

    function switchView(mode) {
      currentViewMode = mode;
      
      const listBtn = document.getElementById("viewListBtn");
      const groupBtn = document.getElementById("viewGroupedBtn");
      const listContainer = document.getElementById("listViewContainer");
      const groupContainer = document.getElementById("groupedViewContainer");
      const tableToolbar = document.getElementById("tableToolbar");

      if (mode === "list") {
        listBtn.style.background = "white";
        listBtn.style.border = "1px solid var(--grey-light)";
        listBtn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
        listBtn.style.color = "var(--primary)";
        
        groupBtn.style.background = "transparent";
        groupBtn.style.border = "1px solid transparent";
        groupBtn.style.boxShadow = "none";
        groupBtn.style.color = "var(--grey-dark)";

        listContainer.style.display = "";
        groupContainer.style.display = "none";
        tableToolbar.style.display = "flex";
        
        renderTable();
      } else {
        groupBtn.style.background = "white";
        groupBtn.style.border = "1px solid var(--grey-light)";
        groupBtn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
        groupBtn.style.color = "var(--primary)";
        
        listBtn.style.background = "transparent";
        listBtn.style.border = "1px solid transparent";
        listBtn.style.boxShadow = "none";
        listBtn.style.color = "var(--grey-dark)";

        listContainer.style.display = "none";
        groupContainer.style.display = "block";
        tableToolbar.style.display = "none";

        renderSummary(projects);
        renderAccounts();
      }
    }

    function toggleSummaryFilter(key) {
      activeStatusFilter = activeStatusFilter === key ? "" : key;
      renderSummary(projects);
      renderAccounts();
    }

    function renderSummary(data) {
      const counts = { "on-track": 0, "at-risk": 0, "critical": 0 };
      data.forEach(item => counts[overallStatus(item)]++);
      const unit = currentView === "teams" ? "team" : "project";
      const plural = n => n === 1 ? unit : unit + "s";
      const isTimeline = currentView === "timeline";

      // Last updated label
      const latestIso = data.reduce((best, i) => i.updated > best ? i.updated : best, "0000");
      const updatedEl = document.getElementById("lastUpdatedLabel");
      if (updatedEl) {
        updatedEl.textContent = latestIso !== "0000" ? `· Last updated ${relativeDate(latestIso)}` : "";
      }

      const items = [
        { key: "on-track", label: "on track"           },
        { key: "at-risk",  label: "need attention"      },
        { key: "critical", label: "need urgent action"  }
      ];

      const summaryEl = document.getElementById("summaryCards");
      if (summaryEl) {
        summaryEl.innerHTML = `
          <div class="summary-metrics-row d-flex flex-wrap gap-2">
            ${items.map(({ key, label }) => {
              const num = counts[key];
              const verbLabel = (num === 1 && key !== "on-track") ? label.replace("need", "needs") : label;
              return `
              <button type="button" class="sm-item d-flex align-items-center gap-2 ${activeStatusFilter === key && !isTimeline ? "sm-active" : ""}"
                      style="background:white;border:1px solid ${activeStatusFilter === key ? STATUS_COLOR[key] : 'var(--grey-light)'};border-radius:50px;padding:4px 12px;color:var(--grey-very-dark);cursor:pointer;font-family:inherit;transition:all 0.15s;box-shadow:${activeStatusFilter === key ? '0 0 0 1px '+STATUS_COLOR[key] : 'none'};"
                      ${isTimeline ? "disabled" : `onclick="toggleSummaryFilter('${activeStatusFilter === key ? "" : key}')" aria-pressed="${activeStatusFilter === key}"`}>
                <div class="sm-light" style="width:10px;height:10px;border-radius:50%;background:${STATUS_COLOR[key]};"></div>
                <div class="sm-text" style="font-size:0.75rem;">
                  <strong style="color:${STATUS_COLOR[key]};font-size:0.85rem;">${num}</strong> ${plural(num)} ${verbLabel}
                </div>
                ${activeStatusFilter === key && !isTimeline ? `<span style="margin-left:4px;font-size:1.1rem;line-height:1;color:${STATUS_COLOR[key]};">&times;</span>` : ""}
              </button>`;
            }).join("")}
          </div>`;
      }
    }

    function toggleAccount(account) {
      collapsedAccounts[account] = !collapsedAccounts[account];
      renderAccounts();
    }

    function renderAccounts() {
      const el = document.getElementById("accountGroups");
      if (!el) return;
      const html = accountRollup(projects).map(g => {
        const shown = g.projects.filter(p => !activeStatusFilter || overallStatus(p) === activeStatusFilter);
        if (activeStatusFilter && shown.length === 0) return ""; // nothing matches the filter here
        const collapsed = !!collapsedAccounts[g.account];
        const safeAcct = g.account.replace(/'/g, "\\'");
        return `
          <div class="acct-group">
            <button type="button" class="acct-head" onclick="toggleAccount('${safeAcct}')" aria-expanded="${!collapsed}">
              <span class="acct-caret ${collapsed ? "collapsed" : ""}">▾</span>
              <span class="acct-name">${g.account}</span>
              <span class="status-badge acct-badge" style="background:${STATUS_BG[g.overall]};color:${STATUS_TEXT[g.overall]};">${STATUS_LABEL[g.overall]}</span>
              <span class="acct-meta">${g.projects.length} project${g.projects.length > 1 ? "s" : ""} · ${g.counts["at-risk"]} at risk · ${g.counts.critical} critical${activeStatusFilter ? ` · ${shown.length} shown` : ""}</span>
            </button>
            ${collapsed ? "" : `<div class="acct-body row g-3">${shown.map(p => renderCard(p, "project")).join("")}</div>`}
          </div>`;
      }).join("");
      el.innerHTML = html || `<div class="empty-state" style="padding:2rem 1rem;"><p style="font-size:0.9rem;margin:0;">No projects match this filter.</p></div>`;
    }

    function renderCard(item, type) {
      const overall = overallStatus(item);
      const stale   = isStale(item);
      const meta    = type === "team" ? `${item.people.length} members` : `${item.people.length} people`;

      return `
        <div class="col-md-6 col-lg-4 health-card">
          <div class="card h-100" style="border-radius:12px;cursor:pointer;background:white;" onclick="openDrawer(${item.id})">
            <div class="card-body p-4 d-flex flex-column">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div style="min-width:0;">
                  <h5 class="card-title mb-0" style="color:var(--primary);font-weight:700;font-size:0.97rem;line-height:1.3;">${item.name}</h5>
                  <small class="text-muted">${meta}</small>
                </div>
                <span class="status-badge ms-2 flex-shrink-0" style="background:${STATUS_BG[overall]};color:${STATUS_TEXT[overall]};">${STATUS_LABEL[overall]}</span>
              </div>

              <div class="d-flex gap-2 flex-wrap mt-3 mb-2">
                ${ragPill("Delivery", item.delivery)}
                ${ragPill("Morale", item.morale)}
                ${ragPill("Satisfaction", item.satisfaction)}
              </div>

              <div class="d-flex align-items-center gap-2 mb-3">
                ${avatarStackSmall(item.people)}
                <small class="text-muted ms-1" style="font-size:0.72rem;">Led by ${item.lead}</small>
              </div>

              <div class="d-flex justify-content-between align-items-center mt-auto pt-2" style="border-top:1px solid var(--grey-light);">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  <small class="text-muted">Updated ${relativeDate(item.updated)}</small>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }

    // ── Initialization ────────────────────────────────────────────────────────
    loadPersisted();
    switchView('list');
    renderPeopleDatalist();
