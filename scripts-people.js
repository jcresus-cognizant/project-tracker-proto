// ── Shared state (populated from app-data.js) ─────────────────────────────
let projects = [], teams = [], checkins = {}, wellbeing = {};
function loadPersisted() {
  const s = loadData();
  projects = s.projects; teams = s.teams; checkins = s.checkins;
  wellbeing = loadWellbeing();
}

    // ── Local presentation constants ──────────────────────────────────
    const STATUS_COLOR = { "on-track": "#2DB81F", "at-risk": "#D4A017", "critical": "#B81F2D" };
    const STATUS_LABEL = { "on-track": "On Track", "at-risk": "At Risk", "critical": "Critical" };
    const CI_BG    = { good: "#e8f8e6", okay: "#fdf5dc", struggling: "#fce8ea" };
    const CI_TEXT  = { good: "#1a6e12", okay: "#7a5800", struggling: "#7a1219" };
    const CI_LABEL = { good: "Good", okay: "Okay", struggling: "Struggling" };
    const CI_EMOJI = { good: "😊", okay: "😐", struggling: "😟" };
    const AVATAR_PALETTE = ["#7373D8","#2F78C4","#06C7CC","#2E308E","#26C4AB","#B56AC4","#4A90D9","#D4A017"];

    function initials(name) { return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
    function avatarColor(name) {
      let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_PALETTE.length;
      return AVATAR_PALETTE[h];
    }
    function formatDate(iso) {
      if (!iso) return "—";
      return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
    function entryFeeling(e) {
      if (e.feeling) return e.feeling;
      const vals = [e.delivery, e.morale, e.satisfaction].filter(Boolean);
      if (vals.includes("struggling")) return "struggling";
      if (vals.length && vals.every(v => v === "good")) return "good";
      return "okay";
    }

    let selectedPerson = null;

    function render() { renderRoster(); renderDetail(); }

    // Synthesises 1:1 prep material from data that already exists elsewhere in
    // the app (capacity flag, assigned item health/trends, check-in history) —
    // no new data model, just surfacing what's already tracked in one place.
    // Severity: 3 = raise this, 2 = worth mentioning, 1 = minor context.
    function personConcerns(name) {
      const concerns = [];

      const wb = wellbeing[name];
      if (wb?.level === "at-capacity") concerns.push({ severity: 3, text: `Flagged themselves at capacity on ${formatDate(wb.date)}` });
      else if (wb?.level === "stretched") concerns.push({ severity: 2, text: `Flagged themselves stretched on ${formatDate(wb.date)}` });

      const mine = personItems(name, projects, teams);
      [...mine.projects, ...mine.teams].forEach(it => {
        const overall = overallStatus(it);
        if (overall === "critical") concerns.push({ severity: 3, text: `${it.name} is critical` });
        else if (overall === "at-risk") concerns.push({ severity: 2, text: `${it.name} is at risk` });
        DIMENSIONS.forEach(dim => {
          if (dimensionTrend(it.history, dim) === "declining") {
            concerns.push({ severity: 2, text: `${dimLabel(dim)} declining on ${it.name}` });
          }
        });
      });

      const history = personCheckinHistory(checkins, name);
      if (!history.length) {
        concerns.push({ severity: 1, text: "Hasn't submitted a check-in yet" });
      } else {
        const recent = history.slice(0, 3);
        DIMENSIONS.forEach(dim => {
          const strugglingCount = recent.filter(c => c[dim] === "struggling").length;
          if (strugglingCount >= 2) {
            concerns.push({ severity: 3, text: `Repeated concern: ${dimLabel(dim)} rated struggling in ${strugglingCount} of their last ${recent.length} check-ins` });
          } else if (recent[0][dim] === "struggling") {
            concerns.push({ severity: 2, text: `${dimLabel(dim)} rated struggling in their most recent check-in` });
          }
        });
        if (recent[0].note) concerns.push({ severity: 1, text: `Last note: "${recent[0].note}"` });
      }

      const seen = new Set();
      return concerns
        .filter(c => (seen.has(c.text) ? false : (seen.add(c.text), true)))
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 5);
    }
    function worstSeverity(concerns) { return concerns.reduce((m, c) => Math.max(m, c.severity), 0); }

    function rankedRosterPeople() {
      return rosterPeople(projects, teams)
        .map(person => ({ ...person, _severity: worstSeverity(personConcerns(person.name)) }))
        .sort((a, b) => b._severity - a._severity || a.name.localeCompare(b.name));
    }

    function renderRoster() {
      const el = document.getElementById("roster");
      // Roster leads with who most needs your attention (same triage principle
      // as the dashboard's "Needs attention" feed), not alphabetical order.
      const people = rankedRosterPeople();
      const ACCENT = { 3: "#B81F2D", 2: "#D4A017" };
      el.innerHTML = people.map(p => {
        const wb = wellbeing[p.name];
        const lvl = wb ? wellbeingLevel(wb.level) : null;
        const active = selectedPerson === p.name;
        const accent = ACCENT[p._severity] || "transparent";
        return `<button type="button" class="roster-item" aria-pressed="${active}" onclick="selectPerson('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:9px 11px 9px 9px;border-radius:10px;border:1px solid ${active ? "var(--primary)" : "var(--grey-light)"};border-left:4px solid ${accent};background:${active ? "#f0f1f8" : "#fff"};margin-bottom:7px;">
          <div class="avatar-sm" style="background:${avatarColor(p.name)};width:30px;height:30px;font-size:0.7rem;flex-shrink:0;">${initials(p.name)}</div>
          <div style="min-width:0;flex:1;">
            <div style="font-weight:600;font-size:0.84rem;color:var(--primary);">${p.name}</div>
            <div style="font-size:0.68rem;color:var(--grey-dark);">${p.roles.join(" · ")} · ${p.items.length} assignment${p.items.length === 1 ? "" : "s"}</div>
          </div>
          ${lvl ? `<span title="Capacity: ${lvl.label}" style="width:10px;height:10px;border-radius:50%;background:${lvl.color};flex-shrink:0;"></span>` : ""}
        </button>`;
      }).join("");
    }

    function selectPerson(name) {
      selectedPerson = name;
      render();
      if (window.innerWidth < 768) {
        setTimeout(() => document.getElementById("personDetailColumn")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      }
    }

    function renderDetail() {
      const el = document.getElementById("personDetail");
      if (!selectedPerson) {
        el.innerHTML = `<div style="color:var(--grey-dark);font-size:0.9rem;padding:2rem;text-align:center;">Select a person to prep for your 1:1.</div>`;
        return;
      }
      const name = selectedPerson;
      const person = rosterPeople(projects, teams).find(p => p.name === name) || { roles: [] };
      const mine = personItems(name, projects, teams);
      const wb = wellbeing[name];
      const lvl = wb ? wellbeingLevel(wb.level) : null;
      const history = personCheckinHistory(checkins, name);
      const concerns = personConcerns(name);

      const talkingPoints = concerns.length
        ? `<div style="background:#fff;border:1px solid var(--grey-light);border-left:4px solid ${concerns[0].severity === 3 ? "#B81F2D" : "#D4A017"};border-radius:12px;padding:12px 14px;margin-bottom:12px;">
            <div style="font-size:0.7rem;font-weight:700;color:var(--grey-dark);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:8px;">Talking points for this 1:1</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${concerns.map(c => `<div style="display:flex;gap:8px;align-items:flex-start;font-size:0.84rem;color:var(--grey-very-dark);">
                <span style="width:7px;height:7px;border-radius:50%;background:${c.severity === 3 ? "#B81F2D" : c.severity === 2 ? "#D4A017" : "#97999B"};margin-top:6px;flex-shrink:0;"></span>
                <span>${c.text}</span>
              </div>`).join("")}
            </div>
          </div>`
        : `<div style="background:#e8f8e6;border:1px solid #bce8b4;border-radius:12px;padding:12px 14px;margin-bottom:12px;">
            <div style="font-size:0.84rem;color:#1a6e12;font-weight:700;">Nothing flagged right now</div>
            <div style="font-size:0.78rem;color:#2a7e22;margin-top:2px;">Good moment to check in on growth, career goals, or just say thanks.</div>
          </div>`;

      const capacity = lvl
        ? `<span style="display:inline-flex;align-items:center;gap:6px;font-weight:700;color:${lvl.color};"><span style="width:10px;height:10px;border-radius:50%;background:${lvl.color};"></span>${lvl.label}</span> <span style="font-size:0.72rem;color:var(--grey-dark);">· self-reported ${formatDate(wb.date)}</span>`
        : `<p style="font-size:0.8rem;color:var(--grey-dark);font-style:italic;line-height:1.45;margin:0;">No capacity shared yet. Capacity is how stretched someone feels by their current workload — team members set it privately from their own check-in view, and it appears here to help you prepare for 1:1s.</p>`;

      const itemChip = it => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:0.76rem;background:var(--grey-very-light);border:1px solid var(--grey-light);border-radius:50px;padding:2px 10px;margin:2px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${STATUS_COLOR[overallStatus(it)]};"></span>${it.name}</span>`;

      const historyHtml = history.length
        ? history.map(c => {
            const f = entryFeeling(c);
            return `<div style="border:1px solid var(--grey-light);border-radius:10px;padding:9px 11px;margin-bottom:7px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span style="font-weight:600;font-size:0.8rem;color:var(--primary);">${itemNameForKey(c.key, projects, teams)}</span>
                <span style="font-size:0.68rem;color:var(--grey-dark);">${formatDate(c.date)}</span>
              </div>
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;">
                ${["delivery", "morale", "satisfaction"].map(d => c[d] ? `<span style="font-size:0.66rem;font-weight:600;background:${CI_BG[c[d]]};color:${CI_TEXT[c[d]]};border-radius:50px;padding:1px 8px;">${d[0].toUpperCase() + d.slice(1)}: ${CI_LABEL[c[d]]}</span>` : "").join("")}
                ${!c.delivery && c.feeling ? `<span style="font-size:0.66rem;font-weight:600;background:${CI_BG[f]};color:${CI_TEXT[f]};border-radius:50px;padding:1px 8px;">${CI_EMOJI[f]} ${CI_LABEL[f]}</span>` : ""}
              </div>
              ${c.note ? `<div style="font-size:0.76rem;color:var(--grey-very-dark);margin-top:5px;">"${c.note}"</div>` : ""}
            </div>`;
          }).join("")
        : `<p style="font-size:0.82rem;color:var(--grey-dark);margin:0;">No check-ins from ${name.split(" ")[0]} yet.</p>`;

      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;">
          <div class="avatar-lg" style="background:${avatarColor(name)};width:48px;height:48px;font-size:1rem;">${initials(name)}</div>
          <div>
            <div style="font-weight:800;font-size:1.1rem;color:var(--primary);">${name}</div>
            <div style="font-size:0.76rem;color:var(--grey-dark);">${person.roles.join(" · ")}</div>
          </div>
        </div>
        ${talkingPoints}
        <div style="background:#fff;border:1px solid var(--grey-light);border-radius:12px;padding:12px 14px;margin-bottom:12px;">
          <div style="font-size:0.7rem;font-weight:700;color:var(--grey-dark);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:6px;">Capacity</div>
          <div style="font-size:0.88rem;">${capacity}</div>
        </div>
        <div style="background:#fff;border:1px solid var(--grey-light);border-radius:12px;padding:12px 14px;margin-bottom:12px;">
          <div style="font-size:0.7rem;font-weight:700;color:var(--grey-dark);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:8px;">On ${mine.projects.length + mine.teams.length} assignment(s)</div>
          <div>${mine.projects.map(itemChip).join("")}${mine.teams.map(itemChip).join("")}</div>
        </div>
        <div style="background:#fff;border:1px solid var(--grey-light);border-radius:12px;padding:12px 14px;">
          <div style="font-size:0.7rem;font-weight:700;color:var(--grey-dark);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:8px;">Check-in history (${history.length})</div>
          ${historyHtml}
        </div>`;
    }

    // ── Init ──────────────────────────────────────────────────────────
    loadPersisted();
    const _first = rankedRosterPeople()[0];
    selectedPerson = _first ? _first.name : null;
    render();
