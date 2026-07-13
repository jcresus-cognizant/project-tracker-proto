// ── Shared state (populated from app-data.js) ─────────────────────────────
let projects = [], teams = [], checkins = {};
function loadPersisted() { const s = loadData(); projects = s.projects; teams = s.teams; checkins = s.checkins; }
function persist() { saveData({ projects, teams, checkins }); }

    const TODAY = new Date();

    // ── Data ──────────────────────────────────────────────────────────────────


    // ── Helpers ───────────────────────────────────────────────────────────────
    const STATUS_LABEL = { "on-track": "On Track", "at-risk": "At Risk", "critical": "Critical" };
    const STATUS_COLOR = { "on-track": "#2DB81F", "at-risk": "#D4A017", "critical": "#B81F2D" };
    const STATUS_BG    = { "on-track": "#e8f8e6", "at-risk": "#fdf5dc", "critical": "#fce8ea" };
    const STATUS_TEXT  = { "on-track": "#1a6e12", "at-risk": "#7a5800", "critical": "#7a1219" };
    const AVATAR_COLORS = ["#7373D8","#2F78C4","#06C7CC","#2E308E","#26C4AB","#B56AC4","#4A90D9","#D4A017"];


    function ragPill(label, status) {
      return `<span class="rag-pill" style="background:${STATUS_BG[status]};color:${STATUS_TEXT[status]};">
        <span class="rag-dot" style="background:${STATUS_COLOR[status]};"></span>${label}
      </span>`;
    }

    function isStale(item) {
      const d = new Date(item.updated);
      return (TODAY - d) / (1000*60*60*24) > STALE_DAYS;
    }

    function formatDate(iso) {
      return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }

    function relativeDate(iso) {
      const d = new Date(iso);
      const days = Math.round((TODAY - d) / (1000*60*60*24));
      const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      if (days === 0) return `today at ${time}`;
      if (days === 1) return `yesterday at ${time}`;
      return `${days} days ago`;
    }

    function avatarColor(name) {
      let hash = 0;
      for (let c of name) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
      return AVATAR_COLORS[Math.abs(hash)];
    }

    function initials(name) {
      const parts = name.trim().split(" ");
      return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
    }

    function avatarStack(people, max = 4) {
      const shown = people.slice(0, max);
      const rest  = people.length - max;
      return `<div class="avatar-stack">
        ${shown.map(p => `<div class="avatar-bubble" style="background:${avatarColor(p.name)};" title="${p.name} — ${p.role}">${initials(p.name)}</div>`).join("")}
        ${rest > 0 ? `<div class="avatar-bubble avatar-more" title="${rest} more people">+${rest}</div>` : ""}
      </div>`;
    }

    function statusScore(s) {
      return s === "on-track" ? 100 : s === "at-risk" ? 50 : 0;
    }

    // ── Nav ───────────────────────────────────────────────────────────────────
    function setNavActive(page) {
      document.querySelectorAll(".nav-lnk").forEach(el => el.classList.remove("active"));
      const map = { dashboard: "navDashboard", projects: "navProjects", teams: "navTeams" };
      if (map[page]) document.getElementById(map[page]).classList.add("active");
    }

    function navTo(page) {
      setNavActive(page);
      if (page === "dashboard") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const tabBtns = document.querySelectorAll(".tab-btn");
      const btn = page === "projects" ? tabBtns[0] : tabBtns[1];
      switchView(page, btn, true);
      setTimeout(() => document.getElementById("cardsContainer").scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }

    // ── View state ────────────────────────────────────────────────────────────
    let currentView = "projects";
    let activeStatusFilter = "";

    function switchView(view, btn, fromNav = false) {
      currentView = view;
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (!fromNav) setNavActive(view);
      renderView();
      updateChart();
    }

    // ── Summary strip ─────────────────────────────────────────────────────────
    function renderSummary(data) {
      const counts = { "on-track": 0, "at-risk": 0, "critical": 0 };
      data.forEach(item => counts[overallStatus(item)]++);
      const unit = currentView === "teams" ? "team" : "project";
      const plural = n => n === 1 ? unit : unit + "s";
      const isTimeline = currentView === "timeline";

      // Last updated label
      const latestIso = data.reduce((best, i) => i.updated > best ? i.updated : best, "0000");
      document.getElementById("lastUpdatedLabel").textContent = latestIso !== "0000"
        ? `· Last updated ${relativeDate(latestIso)}` : "";

      const items = [
        { key: "on-track", label: "on track"           },
        { key: "at-risk",  label: "need attention"      },
        { key: "critical", label: "need urgent help"    }
      ];

      document.getElementById("summaryCards").innerHTML = `
        <div class="health-summary">
          ${items.map(({ key, label }) => `
            <div class="hs-item py-2 ${activeStatusFilter === key && !isTimeline ? "hs-active" : ""}" ${isTimeline ? 'style="cursor:default;"' : 'onclick="toggleSummaryFilter(\''+key+'\')"'}>
              <div class="hs-light" style="background:${STATUS_COLOR[key]};color:${STATUS_COLOR[key]};"></div>
              <div class="hs-text">
                <div class="hs-count" style="color:${STATUS_COLOR[key]};">${counts[key]}</div>
                <div class="hs-label">${plural(counts[key])} ${label}</div>
              </div>
            </div>`).join("")}
        </div>
        ${activeStatusFilter && !isTimeline ? `
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:0.8rem;opacity:0.85;color:white;">Filtering: <strong>${STATUS_LABEL[activeStatusFilter]}</strong></span>
          <button onclick="toggleSummaryFilter('${activeStatusFilter}')" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.35);color:white;border-radius:50px;padding:2px 10px;font-size:0.74rem;cursor:pointer;font-family:inherit;">× Clear</button>
        </div>` : ""}`;
    }

    function toggleSummaryFilter(key) {
      activeStatusFilter = activeStatusFilter === key ? "" : key;
      renderSummary(projects);
      renderAccounts();
    }

    // ── Cards ─────────────────────────────────────────────────────────────────
    function renderCard(item, type) {
      const overall = overallStatus(item);
      const stale   = isStale(item);
      const meta    = type === "team" ? `${item.people.length} members` : `${item.people.length} people`;

      return `
        <div class="col-md-6 col-lg-4 health-card">
          <div class="card h-100" style="border-radius:12px;cursor:pointer;background:white;" onclick="openDetail(${item.id},'${type}')">
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
                ${avatarStack(item.people)}
                <small class="text-muted ms-1" style="font-size:0.72rem;">Led by ${item.lead}</small>
              </div>

              <div class="d-flex justify-content-between align-items-center mt-auto pt-2" style="border-top:1px solid var(--grey-light);">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  <small class="text-muted">Updated ${relativeDate(item.updated)}</small>
                  ${stale ? `<span class="stale-badge" style="cursor:pointer;" onclick="event.stopPropagation();openCheckinModal(${item.id},'${type}')">⚠ Overdue update</span>` : ""}
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }

    // ── Render view ───────────────────────────────────────────────────────────
    function attentionAction(item) {
      const firstReason = (item.reasons && item.reasons[0]) || "";
      if (firstReason.includes("No check-in")) return "Ask for an update";
      if (firstReason.includes("declining")) return "Review the trend";
      if (item.overall === "critical") return "Create a follow-up";
      if (item.overall === "at-risk") return "Check the detail";
      return "Open detail";
    }

    function renderAttention() {
      const el = document.getElementById("attentionFeed");
      if (!el) return;
      const items = attentionItems(projects, teams);
      const shown = items.slice(0, 5);
      const SEV = { 3: "#B81F2D", 2: "#D4A017", 1: "#97999B" };
      const SEV_LABEL = { 3: "Urgent", 2: "Watch", 1: "Stale" };
      if (!items.length) {
        el.innerHTML = "";
        return;
      }
      el.innerHTML = `
        <div class="focus-panel">
          <div class="focus-head">
            <div>
              <div class="section-title focus-title">Needs attention</div>
              <div class="focus-sub">${items.length} item${items.length === 1 ? "" : "s"} with a risk signal or overdue update</div>
            </div>
            <button class="focus-clear" onclick="activeStatusFilter='';renderSummary(projects);renderAccounts();">Show all accounts</button>
          </div>
          <div class="focus-list">
            ${shown.map(a => `
              <button class="focus-row" onclick="openDetail(${a.id},'${a.type}')" style="border-left-color:${SEV[a.severity]};">
                <span class="focus-priority" style="background:${SEV[a.severity]};">${SEV_LABEL[a.severity]}</span>
                <span class="focus-main">
                  <span class="focus-name">${a.name}</span>
                  <span class="focus-meta">${a.type === "team" ? "Team" : "Project"} · ${a.lead}</span>
                  <span class="focus-reasons">
                    ${a.reasons.slice(0, 3).map(r => `<span>${r}</span>`).join("")}
                  </span>
                </span>
                <span class="focus-next">${attentionAction(a)}</span>
              </button>`).join("")}
          </div>
          ${items.length > shown.length ? `<div class="focus-more">${items.length - shown.length} more item${items.length - shown.length === 1 ? "" : "s"} in the account list below</div>` : ""}
        </div>`;
    }

    // Accounts render as collapsible group headers with the project cards nested
    // underneath. The summary stats filter which cards show within each group;
    // a group with no matching projects under an active filter is hidden.
    let collapsedAccounts = {};

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
            <div class="acct-head" onclick="toggleAccount('${safeAcct}')" role="button" tabindex="0"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleAccount('${safeAcct}')}"
                 aria-expanded="${!collapsed}">
              <span class="acct-caret ${collapsed ? "collapsed" : ""}">▾</span>
              <span class="acct-name">${g.account}</span>
              <span class="status-badge acct-badge" style="background:${STATUS_BG[g.overall]};color:${STATUS_TEXT[g.overall]};">${STATUS_LABEL[g.overall]}</span>
              <span class="acct-meta">${g.projects.length} project${g.projects.length > 1 ? "s" : ""} · ${g.counts["at-risk"]} at risk · ${g.counts.critical} critical${activeStatusFilter ? ` · ${shown.length} shown` : ""}</span>
            </div>
            ${collapsed ? "" : `<div class="acct-body row g-3">${shown.map(p => renderCard(p, "project")).join("")}</div>`}
          </div>`;
      }).join("");
      el.innerHTML = html || `<div class="empty-state" style="padding:2rem 1rem;"><p style="font-size:0.9rem;margin:0;">No projects match this filter.</p></div>`;
    }

    // Role-aware: leads get the full portfolio dashboard, members get a
    // simplified check-in-focused landing.
    function renderView() {
      if (loadRole() === "member") { renderMemberView(); return; }
      document.getElementById("memberView").style.display = "none";
      document.getElementById("leadView").style.display = "";
      const leadActions = document.getElementById("leadHeaderActions");
      if (leadActions) leadActions.style.display = "";
      renderSummary(projects);
      renderAttention();
      renderAccounts();
      renderEmptyState();
    }

    // ── Positive empty state ────────────────────────────────────────────────
    // Shown when nothing needs attention (no at-risk/critical and nothing stale).
    function renderEmptyState() {
      const el = document.getElementById("emptyState");
      if (!el) return;
      const needing = attentionItems(projects, teams).length;
      el.innerHTML = needing === 0 ? `
        <div class="all-clear">
          <span class="ac-dot"></span>
          <div>
            <div class="ac-title">All projects are on track</div>
            <div class="ac-sub">Nothing needs your attention right now — nice work.</div>
          </div>
        </div>` : "";
    }

    // ── Member landing ──────────────────────────────────────────────────────
    function renderMemberView() {
      document.getElementById("leadView").style.display = "none";
      const leadActions = document.getElementById("leadHeaderActions");
      if (leadActions) leadActions.style.display = "none";
      const summary = document.getElementById("summaryCards");
      if (summary) summary.innerHTML = "";
      const title = document.getElementById("dashTitle");
      if (title) title.textContent = "Your check-in";
      document.getElementById("lastUpdatedLabel").textContent = "";

      const me = CURRENT_USER;
      const firstName = me.split(" ")[0];
      const mine = personItems(me, projects, teams);
      const all = [
        ...mine.projects.map(p => ({ it: p, type: "project" })),
        ...mine.teams.map(t => ({ it: t, type: "team" }))
      ];

      const rows = all.map(({ it, type }) => {
        const key = type + "-" + it.id;
        const myCI = (checkins[key] || []).filter(c => (c.name || c.person) === me);
        const last = myCI[myCI.length - 1];
        const overall = overallStatus(it);
        return `<div class="member-item-row">
          <span class="mi-dot" style="background:${STATUS_COLOR[overall]};"></span>
          <div class="mi-main">
            <div class="mi-name">${it.name}</div>
            <div class="mi-meta">${type === "team" ? "Team" : "Project"} · ${last ? "your last check-in " + relativeDate(last.date) : "you haven't checked in yet"}</div>
          </div>
          <button class="btn-add" onclick="openCheckinModal(${it.id},'${type}')">Check in</button>
        </div>`;
      }).join("");

      const mv = document.getElementById("memberView");
      mv.style.display = "";
      mv.innerHTML = `
        <div class="member-hero">
          <h2>Hi ${firstName} 👋</h2>
          <p>Take a minute to share how your work is going. Your check-in helps your leads see where support is needed.</p>
          <button class="btn-checkin-hero big" onclick="openCheckinModal()"><span class="cih-icon">＋</span> Submit a check-in</button>
          <a class="member-fullview" href="member.html">Open my full check-in view ↗</a>
        </div>
        <div class="section-title">Your projects &amp; teams</div>
        ${all.length
          ? `<div class="member-items">${rows}</div>`
          : `<p style="color:var(--grey-dark);">You're not assigned to any projects or teams yet.</p>`}`;
    }

    // ── Timeline view ─────────────────────────────────────────────────────────
    function renderTimeline() {
      const container = document.getElementById("cardsContainer");

      // Determine the global date range across all projects
      const allStarts = projects.map(p => new Date(p.start));
      const allEnds   = projects.map(p => new Date(p.end));
      const minDate   = new Date(Math.min(...allStarts));
      const maxDate   = new Date(Math.max(...allEnds));

      // Expand range slightly for padding (2 weeks each side)
      const rangeStart = new Date(minDate); rangeStart.setDate(rangeStart.getDate() - 14);
      const rangeEnd   = new Date(maxDate); rangeEnd.setDate(rangeEnd.getDate() + 14);
      const totalMs    = rangeEnd - rangeStart;

      function pct(d) {
        return Math.max(0, Math.min(100, ((new Date(d) - rangeStart) / totalMs) * 100));
      }

      // Build month tick marks
      const months = [];
      const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      while (cur <= rangeEnd) {
        months.push({ label: cur.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), pct: pct(cur) });
        cur.setMonth(cur.getMonth() + 1);
      }

      const todayPct = pct(TODAY);

      const rows = projects.map(p => {
        const overall  = overallStatus(p);
        const barStart = pct(p.start);
        const barWidth = Math.max(1, pct(p.end) - barStart);

        const milestoneMarkers = (p.milestones || []).map(m => {
          const mp = pct(m.date);
          return `
            <div class="tl-milestone" style="left:${mp}%;" title="${m.label} — ${formatDate(m.date)}${m.done ? " ✓" : ""}">
              <div class="tl-ms-dot ${m.done ? "tl-ms-done" : "tl-ms-todo"}"></div>
              <div class="tl-ms-label">${m.label}</div>
            </div>`;
        }).join("");

        return `
          <div class="tl-row" onclick="openDetail(${p.id},'project')" title="Click to view details">
            <div class="tl-label">
              <div class="tl-name">${p.name}</div>
              <div class="tl-lead text-muted">${p.lead}</div>
            </div>
            <div class="tl-track">
              <div class="tl-bar" style="left:${barStart}%;width:${barWidth}%;background:${STATUS_COLOR[overall]};opacity:0.85;"></div>
              ${milestoneMarkers}
            </div>
            <div class="tl-status">
              <span class="status-badge" style="background:${STATUS_BG[overall]};color:${STATUS_TEXT[overall]};font-size:0.7rem;">${STATUS_LABEL[overall]}</span>
            </div>
          </div>`;
      }).join("");

      const monthTicks = months.map(m => `
        <div class="tl-month" style="left:${m.pct}%">${m.label}</div>`).join("");

      container.innerHTML = `
        <div class="col-12">
          <div class="tl-wrap">
            <!-- Header -->
            <div class="tl-header">
              <div class="tl-label-col"></div>
              <div class="tl-chart-col" style="position:relative;height:28px;">
                ${monthTicks}
                <!-- Today line header marker -->
                <div class="tl-today-head" style="left:${todayPct}%;" title="Today"></div>
              </div>
              <div class="tl-status-col"></div>
            </div>

            <!-- Rows -->
            <div class="tl-body" style="position:relative;">
              ${rows}
              <!-- Today line -->
              <div class="tl-today-line" style="left:${todayPct}%;"></div>
            </div>

            <!-- Legend -->
            <div class="tl-legend d-flex align-items-center gap-4 flex-wrap mt-3 pt-3" style="border-top:1px solid var(--grey-light);font-size:0.75rem;color:var(--grey-very-dark);">
              <span><span class="tl-ms-dot tl-ms-done d-inline-block me-1"></span>Milestone complete</span>
              <span><span class="tl-ms-dot tl-ms-todo d-inline-block me-1"></span>Milestone upcoming</span>
              <span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:2px;height:14px;background:var(--accent2-dark);border-radius:2px;"></span>Today</span>
              <span class="ms-auto text-muted">Click any row to view details</span>
            </div>
          </div>
        </div>`;
    }

    function clearFilters() {
      document.getElementById("searchInput").value = "";
      document.getElementById("statusFilter").value = "";
      activeStatusFilter = "";
      renderView();
    }

    // ── Detail drawer ─────────────────────────────────────────────────────────
    function openDetail(id, type) {
      const data = type === "project" ? projects : teams;
      const item = data.find(i => i.id === id);
      if (!item) return;
      const overall = overallStatus(item);
      const stale   = isStale(item);
      const key     = type + "-" + id;

      document.getElementById("drawerTitle").textContent = item.name;
      const detailPage = type === "project" ? "projects.html" : "teams.html";
      document.getElementById("drawerBadge").innerHTML =
        `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:0.72rem;opacity:0.75;">${type === "team" ? "Team" : "Project"} · Led by ${item.lead}</span>
          <a href="${detailPage}" onclick="sessionStorage.setItem('openDrawer',JSON.stringify({id:${id},type:'${type}'}))"
            style="font-size:0.72rem;color:rgba(255,255,255,0.85);text-decoration:none;border:1px solid rgba(255,255,255,0.35);border-radius:50px;padding:1px 9px;white-space:nowrap;">View details ↗</a>
        </div>`;

      const dims = DIMENSIONS.map(d => [d, dimLabel(d)]);
      let body = `
        <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span class="status-badge" style="background:${STATUS_BG[overall]};color:${STATUS_TEXT[overall]};">${STATUS_LABEL[overall]}</span>
          ${stale ? `<span class="stale-badge" style="cursor:pointer;" onclick="closeDrawer();setTimeout(()=>openCheckinModal(${item.id},'${type}'),50)">⚠ Overdue update</span>` : ""}
          ${type === "project" && item.end ? `<span style="font-size:0.75rem;color:var(--grey-dark);">Due ${formatDate(item.end)}</span>` : ""}
        </div>
        <div class="row g-2 mb-3">
          ${dims.map(([d, label]) => `
            <div class="col-4">
              <div class="dim-card" style="background:${STATUS_BG[item[d]]};">
                <div style="width:10px;height:10px;border-radius:50%;background:${STATUS_COLOR[item[d]]};margin:0 auto 4px;"></div>
                <div style="font-size:0.72rem;font-weight:700;color:${STATUS_TEXT[item[d]]};">${STATUS_LABEL[item[d]]}</div>
                <div style="font-size:0.62rem;color:var(--grey-very-dark);margin-top:1px;">${label}</div>
              </div>
            </div>`).join("")}
        </div>
        <div class="mb-3">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--grey-dark);margin-bottom:6px;">4-week trend</div>
          <div style="background:var(--grey-very-light);border-radius:10px;padding:10px 10px 6px;overflow:hidden;">${trendChart(item)}</div>
        </div>`;

      if (item.notes) body += `
        <div class="p-3 rounded-3 mb-3" style="background:var(--grey-very-light);border-left:3px solid var(--accent2-dark);">
          <div style="font-size:0.7rem;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Notes</div>
          <p style="font-size:0.85rem;color:var(--grey-very-dark);margin:0;">${item.notes}</p>
        </div>`;

      if (type === "project" && item.milestones && item.milestones.length) {
        const done = item.milestones.filter(m => m.done).length;
        body += `<div class="section-title">Milestones — ${done}/${item.milestones.length} done</div>
          <div class="d-flex flex-column gap-1 mb-3">
            ${item.milestones.map(m => {
              const overdue = !m.done && new Date(m.date) < TODAY;
              const dot = m.done ? "var(--primary)" : overdue ? "#B81F2D" : "var(--grey-light)";
              return `<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;padding:4px 0;">
                <span style="width:14px;height:14px;border-radius:50%;flex-shrink:0;background:${dot};display:inline-flex;align-items:center;justify-content:center;">
                  ${m.done ? `<svg width="8" height="8" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="1.5" fill="none"/></svg>` : overdue ? `<span style="color:white;font-size:8px;font-weight:700;line-height:1;">!</span>` : ""}
                </span>
                <span style="flex:1;${m.done ? "color:var(--grey-dark);text-decoration:line-through;" : "color:var(--grey-very-dark);"}">${m.label}</span>
                <span style="font-size:0.7rem;color:var(--grey-dark);">${formatDate(m.date)}</span>
              </div>`;
            }).join("")}
          </div>`;
      }

      body += itemTrendHTML(item);
      body += actionsSectionHTML(item, type);
      body += `<div class="section-title">${type === "team" ? "Team wellbeing" : "People"} (${item.people.length})</div>`;
      body += item.people.map(p => {
        const personCI = (checkins[key] || []).filter(c => (c.name || c.person) === p.name);
        const last = personCI[personCI.length - 1];
        const f = last ? (last.feeling || ([last.delivery, last.morale, last.satisfaction].includes("struggling") ? "struggling" : [last.delivery, last.morale, last.satisfaction].every(v => v === "good") ? "good" : "okay")) : null;
        return `<div class="person-row">
          <div class="avatar-md" style="background:${avatarColor(p.name)};">${initials(p.name)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:0.83rem;color:var(--primary);">${p.name}</div>
            <div style="font-size:0.7rem;color:var(--grey-dark);">${p.role}</div>
          </div>
          ${f ? `<span class="ci-bubble" style="background:${CI_BG[f]};color:${CI_TEXT[f]};">${CI_EMOJI[f]} ${CI_LABEL[f]}</span>` : `<span style="font-size:0.7rem;color:var(--grey-dark);">No check-in</span>`}
        </div>`;
      }).join("");

      const allCI = (checkins[key] || []).slice().reverse().slice(0, 5);
      body += `<div class="section-title" style="margin-top:1.25rem;display:flex;align-items:center;justify-content:space-between;">
        <span>Check-ins (${(checkins[key] || []).length})</span>
        <button style="background:none;border:1px solid var(--grey-light);border-radius:50px;padding:1px 10px;font-size:0.7rem;color:var(--primary);cursor:pointer;" onclick="openCheckinFromDetail('${type}',${id})">+ Add</button>
      </div>`;
      body += voteDistributionHTML(checkins[key] || []);
      body += allCI.length === 0
        ? `<p style="font-size:0.82rem;color:var(--grey-dark);text-align:center;padding:1rem 0;">No check-ins yet.</p>`
        : allCI.map(c => {
            const name = c.name || c.person || "Anonymous";
            const f = c.feeling || ([c.delivery, c.morale, c.satisfaction].includes("struggling") ? "struggling" : [c.delivery, c.morale, c.satisfaction].every(v => v === "good") ? "good" : "okay");
            return `<div class="checkin-item">
              <span style="font-size:1.1rem;">${CI_EMOJI[f]}</span>
              <div>
                <div style="font-size:0.8rem;font-weight:600;color:var(--grey-very-dark);">${name} — <span style="background:${CI_BG[f]};color:${CI_TEXT[f]};padding:1px 7px;border-radius:50px;font-size:0.7rem;">${CI_LABEL[f]}</span></div>
                ${c.note ? `<div style="font-size:0.78rem;color:var(--grey-dark);margin-top:2px;">"${c.note}"</div>` : ""}
                <div style="font-size:0.68rem;color:var(--grey-dark);margin-top:2px;">${formatDate(c.date)}${c.by ? ` · recorded by ${c.by}` : ""}</div>
              </div>
            </div>`;
          }).join("");

      document.getElementById("drawerBody").innerHTML = body;
      document.getElementById("drawerDeleteBtn").textContent = `Delete ${type}`;
      document.getElementById("drawerDeleteBtn").onclick = () => deleteItem(id, type);
      document.getElementById("drawerEditBtn").onclick   = () => { closeDrawer(); setTimeout(() => openEditModal(id, type), 50); };
      document.getElementById("drawerUpdateBtn").onclick = () => { closeDrawer(); setTimeout(() => openCheckinModal(id, type), 50); };

      document.getElementById("drawer").classList.add("open");
      document.getElementById("drawerBackdrop").classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
      document.getElementById("drawer").classList.remove("open");
      document.getElementById("drawerBackdrop").classList.remove("open");
      document.body.style.overflow = "";
    }

    function openCheckinFromDetail(type, id) {
      closeDrawer();
      setTimeout(() => {
        openCheckinModal();
        document.getElementById("checkinItem").value = type + "-" + id;
      }, 300);
    }


    // ── Sparklines ────────────────────────────────────────────────────────────
    function sparkline(item) {
      const W = 80, H = 28, PAD = 2;
      // One series per active dimension: history points + current score
      const series = DIMENSIONS.map(d => {
        const pts = [...(item.history[d] || []), statusScore(item[d])];
        return { pts, color: DIM_COLOR[d] };
      });

      const allVals = series.flatMap(s => s.pts);
      const min = Math.min(...allVals) - 5;
      const max = Math.max(...allVals) + 5;
      const scaleY = v => PAD + (H - PAD*2) * (1 - (v - min) / (max - min));
      const scaleX = (i, n) => PAD + (W - PAD*2) * (i / (n - 1));

      const paths = series.map(({ pts, color }) => {
        const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(i, pts.length).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" ");
        return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
      }).join("");

      // Dots at the last point only
      const dots = series.map(({ pts, color }) => {
        const x = scaleX(pts.length - 1, pts.length).toFixed(1);
        const y = scaleY(pts[pts.length - 1]).toFixed(1);
        return `<circle cx="${x}" cy="${y}" r="2.2" fill="${color}"/>`;
      }).join("");

      return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" title="4-week health trend">${paths}${dots}</svg>`;
    }

    function trendChart(item) {
      const W = 480, H = 80;
      const PAD = { t: 6, r: 58, b: 22, l: 10 };
      const dims   = ["delivery","morale","satisfaction"];
      const colors = ["#2f78c4","#7373D8","#06C7CC"];
      const wkLabels = ["W−3","W−2","W−1","Now"];

      const series = dims.map((d, i) => {
        const pts = [...item.history[d], statusScore(item[d])];
        return { pts, color: colors[i] };
      });
      const allVals = series.flatMap(s => s.pts);
      const vMin = Math.max(0,  Math.min(...allVals) - 12);
      const vMax = Math.min(100, Math.max(...allVals) + 12);
      const cw = W - PAD.l - PAD.r;
      const ch = H - PAD.t - PAD.b;
      const sx = (i, n) => PAD.l + cw * (i / (n - 1));
      const sy = v => PAD.t + ch * (1 - (v - vMin) / (vMax - vMin));

      const grid = [25,50,75].filter(v => v > vMin && v < vMax).map(v =>
        `<line x1="${PAD.l}" y1="${sy(v).toFixed(1)}" x2="${W - PAD.r}" y2="${sy(v).toFixed(1)}" stroke="#E8E8E6" stroke-width="1"/>`
      ).join("");

      const paths = series.map(({ pts, color }) => {
        const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${sx(i, pts.length).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
        return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      }).join("");

      const dots = series.map(({ pts, color }) => pts.map((v, i) => {
        const last = i === pts.length - 1;
        return `<circle cx="${sx(i, pts.length).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="${last ? 3.5 : 2.2}" fill="${color}" ${last ? "" : 'opacity="0.45"'}/>`;
      }).join("")).join("");

      const xLabels = wkLabels.map((l, i) =>
        `<text x="${sx(i, wkLabels.length).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="9" fill="#97999B" font-family="sans-serif">${l}</text>`
      ).join("");

      // Value labels at "Now" endpoint — sort by y position and enforce min 13px gap to prevent overlap
      const endPts = series.map(({ pts, color }) => ({
        val: pts[pts.length - 1],
        color,
        y: sy(pts[pts.length - 1])
      })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < endPts.length; i++) {
        if (endPts[i].y - endPts[i - 1].y < 13) endPts[i].y = endPts[i - 1].y + 13;
      }
      const labelX = W - PAD.r + 8;
      const valueLabels = endPts.map(({ val, color, y }) =>
        `<text x="${labelX}" y="${(y + 3.5).toFixed(1)}" font-size="10" fill="${color}" font-family="sans-serif" font-weight="700">${val}</text>`
      ).join("");

      return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${grid}${paths}${dots}${xLabels}${valueLabels}</svg>`;
    }

    function initChart() {
      const el = document.getElementById("portfolioTrend");
      if (el) el.innerHTML = trendChartHTML(portfolioHistory(projects));
    }
    function updateChart() { initChart(); }

    // ── Check-in data ─────────────────────────────────────────────────────────
    // keyed by "project-1", "team-2" etc.

    const CI_LABEL = { good: "Good", okay: "Okay", struggling: "Struggling" };
    const CI_EMOJI = { good: "😊", okay: "😐", struggling: "😟" };
    const CI_COLOR = { good: "#2DB81F", okay: "#D4A017", struggling: "#B81F2D" };
    const CI_BG    = { good: "#e8f8e6", okay: "#fdf5dc", struggling: "#fce8ea" };
    const CI_TEXT  = { good: "#1a6e12", okay: "#7a5800", struggling: "#7a1219" };

    let ciSelections = {};



    function ciRowHTML(dim) {
      return `<div class="checkin-row">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="fw-bold mb-0" style="font-size:0.9rem;">${dimLabel(dim)}</label>
                <small class="text-muted">${dimHint(dim)}</small>
              </div>
              <div class="d-flex gap-2">
                <button class="ci-btn" data-field="${dim}" data-val="good"       onclick="setCi('${dim}','good')">Good</button>
                <button class="ci-btn" data-field="${dim}" data-val="okay"       onclick="setCi('${dim}','okay')">Okay</button>
                <button class="ci-btn" data-field="${dim}" data-val="struggling" onclick="setCi('${dim}','struggling')">Struggling</button>
              </div>
            </div>`;
    }

    function openCheckinModal(preId, preType) {
      ciSelections = {};
      document.getElementById("ciRows").innerHTML = DIMENSIONS.map(ciRowHTML).join("");
      document.querySelectorAll(".ci-btn").forEach(b => b.className = "ci-btn");
      document.getElementById("checkinNote").value = "";
      document.getElementById("checkinError").style.display = "none";
      document.getElementById("checkinOnBehalf").checked = false;
      document.getElementById("checkinBehalfOf").style.display = "none";

      // Populate combined project + team list
      const sel = document.getElementById("checkinItem");
      sel.innerHTML = [
        ...projects.map(p => `<option value="project-${p.id}">${p.name}</option>`),
        ...teams.map(t => `<option value="team-${t.id}">${t.name} (team)</option>`)
      ].join("");

      // Pre-select if called from a specific item
      if (preId && preType) sel.value = `${preType}-${preId}`;

      updateBehalfDropdown();
      refreshCheckinSubmit(ciSelections); // start disabled until every area is rated
      new bootstrap.Modal(document.getElementById("checkinModal")).show();
    }

    function toggleBehalfDropdown() {
      const checked = document.getElementById("checkinOnBehalf").checked;
      document.getElementById("checkinBehalfOf").style.display = checked ? "block" : "none";
    }

    function updateBehalfDropdown() {
      const val = document.getElementById("checkinItem").value;
      if (!val) return;
      const [type, id] = val.split("-");
      const item = type === "project"
        ? projects.find(p => p.id == id)
        : teams.find(t => t.id == id);
      const people = (item?.people || []).filter(p => p.name !== CURRENT_USER);
      const sel = document.getElementById("checkinBehalfOf");
      sel.innerHTML = people.map(p => `<option value="${p.name}">${p.name} — ${p.role}</option>`).join("");
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

      const key  = document.getElementById("checkinItem").value;
      const [itemType, itemId] = key.split("-");
      const onBehalf = document.getElementById("checkinOnBehalf").checked;
      const name = onBehalf ? (document.getElementById("checkinBehalfOf").value || CURRENT_USER) : CURRENT_USER;
      const note = document.getElementById("checkinNote").value.trim();

      // Update the official project/team record (a lead check-in directly sets status).
      const dataArr = itemType === "project" ? projects : teams;
      const item = dataArr.find(x => x.id == itemId);
      if (item) {
        DIMENSIONS.forEach(d => {
          item[d] = ciToStatus(ciSelections[d]);
          if (item.history && Array.isArray(item.history[d])) item.history[d].push(statusToScore(item[d]));
        });
        if (note) item.notes = note;
        item.updated = TODAY.toISOString().split("T")[0];
      }

      // Log check-in entry
      if (!checkins[key]) checkins[key] = [];
      const entry = { name, by: onBehalf ? CURRENT_USER : null, note, date: TODAY.toISOString().split("T")[0] };
      DIMENSIONS.forEach(d => { entry[d] = ciSelections[d]; });
      checkins[key].unshift(entry);

      persist();
      bootstrap.Modal.getInstance(document.getElementById("checkinModal")).hide();
      renderView();
      updateChart();

      showToast(`Check-in submitted. Thanks, ${name.split(" ")[0]}!`);
    }

    let _undoFn = null;
    function showToast(msg, undoFn) {
      let toast = document.getElementById("appToast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "appToast";
        toast.style.cssText = "position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(0);background:var(--primary);color:white;padding:0.65rem 1.4rem;border-radius:50px;font-size:0.88rem;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,72,0.25);transition:opacity 0.3s;display:flex;align-items:center;gap:10px;";
        document.body.appendChild(toast);
      }
      _undoFn = undoFn || null;
      if (undoFn) {
        toast.innerHTML = `<span>${msg}</span><button class="toast-undo" onclick="_undoFn&&_undoFn();_undoFn=null;document.getElementById('appToast').style.opacity='0';">Undo</button>`;
        toast.style.pointerEvents = "auto";
      } else {
        toast.textContent = msg;
        toast.style.pointerEvents = "none";
      }
      toast.style.opacity = "1";
      clearTimeout(toast._t);
      toast._t = setTimeout(() => { toast.style.opacity = "0"; _undoFn = null; }, undoFn ? 4500 : 3000);
    }

    function renderCheckins(key) {
      const items = checkins[key] || [];
      if (items.length === 0) return `<p class="text-muted mb-0" style="font-size:0.85rem;">No check-ins yet.</p>`;
      return items.slice(0, 5).map(c => `
        <div class="p-3 rounded-3 mb-2" style="background:var(--grey-very-light);border:1px solid var(--grey-light);">
          <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2">
              <div class="avatar-lg" style="background:${avatarColor(c.name)};width:30px;height:30px;font-size:0.62rem;">${c.name === "Anonymous" ? "?" : initials(c.name)}</div>
              <div>
                <div style="font-weight:600;font-size:0.83rem;color:var(--primary);">${c.name}</div>
                <div style="font-size:0.7rem;color:var(--grey-dark);">${formatDate(c.date)}${c.by ? ` · recorded by ${c.by}` : ""}</div>
              </div>
            </div>
            <div class="d-flex gap-1 flex-wrap">
              ${DIMENSIONS.map(dim => c[dim] ? `
                <span style="background:${CI_BG[c[dim]]};color:${CI_TEXT[c[dim]]};border-radius:50px;padding:2px 9px;font-size:0.7rem;font-weight:600;">${CI_EMOJI[c[dim]]} ${CI_LABEL[c[dim]]}</span>
              ` : "").join("")}
            </div>
          </div>
          ${c.note ? `<p class="mb-0" style="font-size:0.8rem;color:var(--grey-very-dark);padding-left:38px;">"${c.note}"</p>` : ""}
        </div>`).join("");
    }

    // ── Add modal ─────────────────────────────────────────────────────────────
    let addType = "project";

    function openAddModal() {
      addType = currentView === "teams" ? "team" : "project";
      setAddType(addType);
      document.getElementById("addName").value = "";
      document.getElementById("addLead").value = "";
      document.getElementById("addNotes").value = "";
      document.getElementById("addPeopleList").innerHTML = "";
      document.getElementById("addError").style.display = "none";
      addPersonRow();
      new bootstrap.Modal(document.getElementById("addModal")).show();
    }

    function setAddType(type) {
      addType = type;
      document.querySelectorAll(".add-type-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.type === type);
      });
      document.getElementById("addModalTitle").textContent = `Add new ${type}`;
      document.getElementById("addTypeLabelBtn").textContent = type;
    }

    function addPersonRow() {
      const list = document.getElementById("addPeopleList");
      const row = document.createElement("div");
      row.className = "person-row d-flex gap-2 align-items-center";
      row.innerHTML = `
        <input type="text" placeholder="Full name" style="flex:1.2;">
        <input type="text" placeholder="Role (e.g. UX Designer)" style="flex:1.5;">
        <button type="button" onclick="this.closest('.person-row').remove()" style="background:none;border:none;color:var(--grey-dark);font-size:1.1rem;cursor:pointer;padding:0 4px;">✕</button>`;
      list.appendChild(row);
      row.querySelector("input").focus();
    }

    function submitAdd() {
      const name = document.getElementById("addName").value.trim();
      const lead = document.getElementById("addLead").value.trim();
      const err  = document.getElementById("addError");

      if (!name || !lead) {
        err.textContent = "Please fill in both name and lead fields.";
        err.style.display = "block";
        return;
      }
      err.style.display = "none";

      const people = Array.from(document.querySelectorAll("#addPeopleList .person-row")).reduce((acc, row) => {
        const inputs = row.querySelectorAll("input");
        const n = inputs[0].value.trim();
        const r = inputs[1].value.trim();
        if (n && r) acc.push({ name: n, role: r });
        return acc;
      }, []);

      if (people.length === 0) people.push({ name: lead, role: addType === "team" ? "Team Lead" : "Project Lead" });

      const data  = addType === "project" ? projects : teams;
      const maxId = data.reduce((m, i) => Math.max(m, i.id), 0);

      const newItem = {
        id: maxId + 1,
        name,
        lead,
        updated: TODAY.toISOString().split("T")[0],
        notes:   document.getElementById("addNotes").value.trim(),
        people,
        history: {}
      };
      DIMENSIONS.forEach(d => { newItem[d] = "on-track"; newItem.history[d] = []; });

      if (addType === "team") newItem.members = people.length;
      data.push(newItem);
      persist();

      bootstrap.Modal.getInstance(document.getElementById("addModal")).hide();

      // Switch to matching tab (only if this layout has tabs; the dashboard
      // doesn't — it shows the portfolio directly).
      const tabs = document.querySelectorAll(".tab-btn");
      if (addType !== currentView && tabs.length) {
        switchView(addType === "project" ? "projects" : "teams",
          tabs[addType === "project" ? 0 : 1]);
      } else {
        renderView();
        updateChart();
      }
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    let _detailCtx = null; // { id, type } for the currently open detail modal

    function showDeleteConfirm(onConfirm) {
      const btn = document.getElementById("drawerDeleteBtn");
      if (!btn) return;
      const origText  = btn.textContent;
      const origClick = btn.onclick;
      // Hide sibling buttons while confirming
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

    function deleteItem(id, type) {
      showDeleteConfirm(() => {
        const data = type === "project" ? projects : teams;
        const idx  = data.findIndex(i => i.id === id);
        if (idx === -1) return;
        const snapshot   = JSON.parse(JSON.stringify(data[idx]));
        const ciKey      = type + "-" + id;
        const ciSnapshot = checkins[ciKey] ? JSON.parse(JSON.stringify(checkins[ciKey])) : null;
        data.splice(idx, 1);
        delete checkins[ciKey];
        persist();
        closeDrawer();
        renderView();
        showToast(`${type === "project" ? "Project" : "Team"} deleted.`, () => {
          data.push(snapshot);
          if (ciSnapshot) checkins[ciKey] = ciSnapshot;
          persist();
          renderView();
        });
      });
    }

    // ── Edit details ──────────────────────────────────────────────────────────
    function openEditModal(id, type) {
      const data = type === "project" ? projects : teams;
      const item = data.find(i => i.id === id);
      if (!item) return;

      document.getElementById("editModalTitle").textContent = `Edit ${type}`;
      document.getElementById("editName").value  = item.name;
      document.getElementById("editLead").value  = item.lead;
      document.getElementById("editNotes").value = item.notes || "";
      document.getElementById("editError").style.display = "none";

      const list = document.getElementById("editPeopleList");
      list.innerHTML = "";
      item.people.forEach(p => addEditPersonRow(p.name, p.role));

      document.getElementById("editModal")._editCtx = { id, type };
      bootstrap.Modal.getInstance(document.getElementById("detailModal"))?.hide();
      setTimeout(() => new bootstrap.Modal(document.getElementById("editModal")).show(), 300);
    }

    function addEditPersonRow(name = "", role = "") {
      const list = document.getElementById("editPeopleList");
      const row  = document.createElement("div");
      row.className = "person-row d-flex gap-2 align-items-center";
      row.innerHTML = `
        <input type="text" placeholder="Full name" value="${name}" style="flex:1.2;">
        <input type="text" placeholder="Role" value="${role}" style="flex:1.5;">
        <button type="button" onclick="this.closest('.person-row').remove()" style="background:none;border:none;color:var(--grey-dark);font-size:1.1rem;cursor:pointer;padding:0 4px;">✕</button>`;
      list.appendChild(row);
    }

    function submitEdit() {
      const modal = document.getElementById("editModal");
      const { id, type } = modal._editCtx;
      const name = document.getElementById("editName").value.trim();
      const lead = document.getElementById("editLead").value.trim();
      const err  = document.getElementById("editError");

      if (!name || !lead) { err.textContent = "Name and lead are required."; err.style.display = "block"; return; }
      err.style.display = "none";

      const data = type === "project" ? projects : teams;
      const item = data.find(i => i.id === id);
      if (!item) return;

      item.name  = name;
      item.lead  = lead;
      item.notes = document.getElementById("editNotes").value.trim();
      item.people = Array.from(document.querySelectorAll("#editPeopleList .person-row")).reduce((acc, row) => {
        const inputs = row.querySelectorAll("input");
        const n = inputs[0].value.trim(), r = inputs[1].value.trim();
        if (n && r) acc.push({ name: n, role: r });
        return acc;
      }, []);
      if (item.people.length === 0) item.people = [{ name: lead, role: type === "team" ? "Team Lead" : "Project Lead" }];
      if (type === "team") item.members = item.people.length;

      persist();
      bootstrap.Modal.getInstance(modal).hide();
      renderView();
      showToast("Changes saved.");
    }

    // ── Per-person check-in history ────────────────────────────────────────────
    function personHistory(personName, itemKey) {
      const all = checkins[itemKey] || [];
      return all.filter(c => c.name.toLowerCase() === personName.toLowerCase());
    }

    function renderPersonHistory(personName, itemKey) {
      const history = personHistory(personName, itemKey);
      if (history.length === 0) return `<span style="font-size:0.75rem;color:var(--grey-dark);">No check-ins yet</span>`;
      return history.slice(0, 3).map(c => `
        <span title="${formatDate(c.date)}" style="display:inline-flex;align-items:center;gap:3px;background:var(--grey-very-light);border:1px solid var(--grey-light);border-radius:50px;padding:2px 8px;font-size:0.7rem;margin:2px;">
          ${CI_EMOJI[c.delivery]}${CI_EMOJI[c.morale]}${CI_EMOJI[c.satisfaction]}
          <span style="color:var(--grey-dark);">${relativeDate(c.date)}</span>
        </span>`).join("");
    }

    // ── CSV Export ────────────────────────────────────────────────────────────
    function exportCSV() {
      const data = currentView === "projects" ? projects : teams;
      const rows = [
        ["Name", "Lead", "Overall", ...DIMENSIONS.map(dimLabel), "Last Updated", "Notes"]
      ];
      data.forEach(item => {
        rows.push([
          item.name, item.lead,
          STATUS_LABEL[overallStatus(item)],
          ...DIMENSIONS.map(d => STATUS_LABEL[item[d]]),
          formatDate(item.updated),
          (item.notes || "").replace(/,/g, ";")
        ]);
      });
      const csv  = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a    = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `health-${currentView}-${TODAY.toISOString().split("T")[0]}.csv` });
      a.click();
      showToast(`Exported ${data.length} ${currentView} to CSV.`);
    }

    // ── Persistence ───────────────────────────────────────────────────────────



    // ── Reset ─────────────────────────────────────────────────────────────────
    function resetDemoData() {
      if (!confirm("Reset all data back to the demo defaults?")) return;
      localStorage.removeItem("cpt_data");
      location.reload();
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function addItemAction(type, id) {
      const input = document.getElementById(`actionInput-${type}-${id}`);
      const text = ((input && input.value) || "").trim();
      if (!text) return;
      const item = (type === "project" ? projects : teams).find(x => x.id === id);
      if (!item) return;
      pushAction(item, text, CURRENT_USER);
      persist();
      openDetail(id, type);
    }
    function resolveItemAction(type, id, actionId) {
      const item = (type === "project" ? projects : teams).find(x => x.id === id);
      if (!item) return;
      resolveAction(item, actionId);
      persist();
      openDetail(id, type);
    }

    document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });
    loadPersisted();
    renderView();
    initChart();
