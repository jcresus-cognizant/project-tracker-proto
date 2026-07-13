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

    function renderRoster() {
      const el = document.getElementById("roster");
      el.innerHTML = rosterPeople(projects, teams).map(p => {
        const wb = wellbeing[p.name];
        const lvl = wb ? wellbeingLevel(wb.level) : null;
        const active = selectedPerson === p.name;
        return `<div onclick="selectPerson('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;border:1px solid ${active ? "var(--primary)" : "var(--grey-light)"};background:${active ? "#f0f1f8" : "#fff"};margin-bottom:7px;">
          <div class="avatar-sm" style="background:${avatarColor(p.name)};width:30px;height:30px;font-size:0.7rem;flex-shrink:0;">${initials(p.name)}</div>
          <div style="min-width:0;flex:1;">
            <div style="font-weight:600;font-size:0.84rem;color:var(--primary);">${p.name}</div>
            <div style="font-size:0.68rem;color:var(--grey-dark);">${p.roles.join(" · ")} · ${p.items.length} assignment${p.items.length === 1 ? "" : "s"}</div>
          </div>
          ${lvl ? `<span title="Capacity: ${lvl.label}" style="width:10px;height:10px;border-radius:50%;background:${lvl.color};flex-shrink:0;"></span>` : ""}
        </div>`;
      }).join("");
    }

    function selectPerson(name) { selectedPerson = name; render(); }

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
    const _first = rosterPeople(projects, teams)[0];
    selectedPerson = _first ? _first.name : null;
    render();
