// ── Shared state (populated from app-data.js) ─────────────────────────────
let projects = [], teams = [], checkins = {};
function loadSharedData() { const s = loadData(); projects = s.projects; teams = s.teams; checkins = s.checkins; }
function persistShared() { saveData({ projects, teams, checkins }); }

    // ── Design tokens ────────────────────────────────────────────────
    const STATUS_COLOR = { "on-track": "#2DB81F", "at-risk": "#D4A017", "critical": "#B81F2D" };
    const STATUS_BG    = { "on-track": "#e8f8e6", "at-risk": "#fdf5dc", "critical": "#fce8ea" };
    const STATUS_TEXT  = { "on-track": "#1a6e12", "at-risk": "#7a5800", "critical": "#7a1219" };
    const STATUS_LABEL = { "on-track": "On Track",  "at-risk": "At Risk",  "critical": "Critical" };

    const CI_EMOJI = { good: "😊", okay: "😐", struggling: "😟" };
    const CI_LABEL = { good: "Good", okay: "Okay", struggling: "Struggling" };
    const CI_COLOR = { good: "#2DB81F", okay: "#D4A017", struggling: "#B81F2D" };
    const CI_BG    = { good: "#e8f8e6", okay: "#fdf5dc", struggling: "#fce8ea" };
    const CI_TEXT  = { good: "#1a6e12", okay: "#7a5800", struggling: "#7a1219" };

    const AVATAR_PALETTE = ["#7373D8","#2F78C4","#06C7CC","#2E308E","#26C4AB","#B56AC4","#4A90D9","#D4A017"];

    function initials(name) {
      return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    }
    function avatarColor(name) {
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_PALETTE.length;
      return AVATAR_PALETTE[h];
    }
    function formatDate(iso) {
      if (!iso) return "—";
      return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
    function relativeDate(iso) {
      if (!iso) return "—";
      const diff = Math.floor((Date.now() - new Date(iso)) / 86400000);
      if (diff === 0) return "today";
      if (diff === 1) return "yesterday";
      if (diff < 7)  return `${diff} days ago`;
      if (diff < 14) return "last week";
      if (diff < 30) return `${Math.floor(diff/7)} weeks ago`;
      return formatDate(iso);
    }

    function showToast(msg) {
      const t = document.getElementById("toast");
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 2800);
    }

    // ── Shared localStorage (same key as index.html) ─────────────────

    // Default data (mirrors index.html defaults — loaded if no localStorage)



    // ── All unique people across projects & teams ─────────────────────
    function getAllPeople() {
      const seen = new Set();
      const all  = [];
      [...projects, ...teams].forEach(item => {
        item.people.forEach(p => {
          if (!seen.has(p.name)) {
            seen.add(p.name);
            all.push(p.name);
          }
        });
      });
      return all.sort();
    }

    // ── App state ─────────────────────────────────────────────────────
    let selectedVotes = {}; // { "project-1": { delivery, morale, satisfaction }, ... }
    let wellbeing = {};     // { "Alex Morgan": { level, date }, ... } — private capacity flags
    let currentWizardStep = 0; // index of the active project/team in the wizard
    let sessionSubmitted = new Set(); // keys checked in during this visit

    // An item counts as "completed" once the current user has a check-in on it
    // (either from a previous visit or submitted just now).
    function isCompleted(key) {
      if (sessionSubmitted.has(key)) return true;
      const myCheckins = (checkins[key] || []).filter(e => entryPerson(e) === CURRENT_USER);
      if (myCheckins.length === 0) return false;
      const lastCI = myCheckins[myCheckins.length - 1];
      const daysSince = (Date.now() - new Date(lastCI.date)) / 86400000;
      return daysSince < 7; // Resets weekly
    }

    // ── Routing ───────────────────────────────────────────────────────
    function render() {
      renderMemberDashboard();
    }

    // ── Member dashboard ──────────────────────────────────────────────
    function renderMemberDashboard() {
      const app = document.getElementById("app");
      const mine = personItems(CURRENT_USER, projects, teams);
      const items = [
        ...mine.projects.map(p => ({ it: p, type: "project" })),
        ...mine.teams.map(t => ({ it: t, type: "team" }))
      ];
      const total     = items.length;
      const completed = items.filter(({ it, type }) => isCompleted(type + "-" + it.id)).length;
      const pct       = total ? Math.round((completed / total) * 100) : 0;

      app.innerHTML = `
        <!-- Hero header -->
        <div class="page-header">
          <div class="container" style="max-width:720px;">
            <h1 style="font-size:1.6rem;font-weight:800;margin:0 0 0.25rem;">How are things going?</h1>
            <p style="opacity:0.65;font-size:0.88rem;margin:0;">Share how you're feeling about each project and team.</p>
          </div>
        </div>

        <div class="container py-4" style="max-width:720px;">

          ${renderWorkloadSection()}

          <!-- Progress -->
          <div class="checkin-progress">
            <div class="cp-top">
              <span class="cp-label">Sharing helps your lead support you</span>
              <span class="cp-count">${completed} of ${total} shared</span>
            </div>
            <div class="cp-bar"><div class="cp-fill" style="width:${pct}%;"></div></div>
          </div>

          <!-- Wizard Check-in flow -->
          <div class="section-label mt-4">Your check-ins</div>
          <div class="wizard-container bg-white p-4" style="border-radius:16px; border:1px solid var(--grey-light); box-shadow:0 4px 12px rgba(0,0,0,0.03);">
            ${items.length === 0 
              ? `<p style="color:var(--grey-dark);font-size:0.85rem;margin:0;">You're not assigned to any projects or teams yet.</p>`
              : renderWizardStep(items)
            }
          </div>

        </div>`;
    }

    function renderWizardStep(items) {
      if (currentWizardStep >= items.length) {
        return `
          <div style="text-align:center; padding: 2rem 0;">
            <div style="font-size:3rem; margin-bottom:1rem;">🎉</div>
            <h4 style="color:var(--primary); font-weight:800;">You're all caught up!</h4>
            <p style="color:var(--grey-very-dark);">Thanks for sharing your updates. Your lead appreciates it.</p>
            <button onclick="currentWizardStep=0; renderMemberDashboard();" class="btn-sm-outline mt-3">Review my check-ins</button>
          </div>`;
      }
      
      const { it, type } = items[currentWizardStep];
      const key  = type + "-" + it.id;
      const done = isCompleted(key);

      return `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <span style="font-size:0.75rem; font-weight:700; color:var(--grey-dark); text-transform:uppercase; letter-spacing:0.5px;">
            Step ${currentWizardStep + 1} of ${items.length}
          </span>
          ${currentWizardStep < items.length - 1 ? `<button onclick="nextWizardStep()" class="btn btn-link btn-sm text-decoration-none" style="font-size:0.8rem;">Skip for now</button>` : ""}
        </div>
        
        <div class="mb-4">
          <h3 style="margin:0 0 4px; font-weight:800; font-size:1.3rem; color:var(--primary);">${it.name}</h3>
          <div style="font-size:0.85rem; color:var(--grey-very-dark);">${type === "team" ? "Team" : "Project"} · Led by ${it.lead}</div>
        </div>
        
        <div id="checkinCard-${key}">
          ${done ? `
            <div style="background:var(--grey-very-light); border-radius:12px; padding:1.5rem; text-align:center;">
              <span style="font-size:1.2rem;">✅</span>
              <p style="margin:8px 0 0; font-weight:600; color:var(--grey-very-dark);">You've already checked in here.</p>
            </div>
            <div class="d-flex justify-content-end mt-4">
              <button onclick="nextWizardStep()" class="btn-primary-action">Next item ➔</button>
            </div>
          ` : renderCheckinBody(it, type)}
        </div>
      `;
    }

    function nextWizardStep() {
      currentWizardStep++;
      renderMemberDashboard();
    }

    // The rating UI shown inside an expanded accordion row.
    function renderCheckinBody(item, type) {
      const key       = type + "-" + item.id;
      const votes     = selectedVotes[key] || {};
      const allChosen = DIMENSIONS.every(d => votes[d]);

      const myCheckins = (checkins[key] || []).filter(e => entryPerson(e) === CURRENT_USER);
      let historyText = "";
      if (myCheckins.length > 0) {
        const lastCI = myCheckins[myCheckins.length - 1];
        const parts = DIMENSIONS.map(d => lastCI[d] ? `${dimLabel(d)} was ${CI_EMOJI[lastCI[d]]} ${CI_LABEL[lastCI[d]]}` : null).filter(Boolean);
        if (parts.length > 0) {
          historyText = `<div style="background:var(--grey-very-light); padding:10px 12px; border-radius:8px; font-size:0.8rem; color:var(--grey-very-dark); margin-bottom:1rem; border:1px dashed #ccc;">
            <strong style="color:var(--primary);">💡 Last time (${relativeDate(lastCI.date)}), you said:</strong><br>
            <span style="opacity:0.85;">${parts.join(" · ")}</span>
          </div>`;
        }
      }

      return `
        <p style="font-size:0.82rem;color:var(--grey-very-dark);margin-bottom:0.85rem;">
          How is this ${type === "team" ? "team" : "project"} going right now? Rate each area.
        </p>
        ${historyText}
        <div class="d-flex flex-column gap-3 mb-3">
          ${DIMENSIONS.map(dim => `
            <div data-dim="${dim}">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="fw-bold mb-0" style="font-size:0.85rem;">${dimLabel(dim)}</label>
                <small class="text-muted" style="font-size:0.72rem;">${dimHint(dim)}</small>
              </div>
              <div class="d-flex gap-2">
                ${["good","okay","struggling"].map(f => `
                  <button class="feel-btn ${votes[dim] === f ? "feel-"+f : ""}" onclick="selectVote('${key}','${dim}','${f}')">
                    <span class="feel-emoji">${CI_EMOJI[f]}</span>
                    ${CI_LABEL[f]}
                  </button>`).join("")}
              </div>
            </div>`).join("")}
        </div>
        <div id="voteFooter-${key}" style="${allChosen ? "" : "display:none;"}">
          <label class="d-flex align-items-center gap-2 mb-2" style="font-size:0.78rem;color:var(--grey-dark);cursor:pointer;">
            <input type="checkbox" id="anon-${key}"> Submit anonymously
          </label>
          <textarea id="noteInput-${key}" rows="2" placeholder="What's changed since last time? (optional)"
            style="width:100%;border-radius:10px;border:1px solid var(--grey-light);padding:0.6rem 0.85rem;font-size:0.85rem;resize:none;"></textarea>
          <div class="d-flex justify-content-end mt-2">
            <button onclick="submitVote('${key}','${type}',${item.id})" class="btn-primary-action">
              Submit health update
            </button>
          </div>
        </div>
        <div id="doneArea-${key}" style="display:none;text-align:center;padding:0.5rem;">
          <span style="font-size:1.2rem;">✅</span>
          <span style="font-size:0.85rem;color:var(--grey-very-dark);margin-left:6px;">Check-in recorded</span>
        </div>`;
    }

    // (toggleAccordion removed)

    function renderProjectCard(item, type, myName) {
      const overall = overallStatus(item);
      const me = item.people.find(p => p.name === myName);
      const myRole = me ? me.role : "Team member";

      // Count my check-ins for this item
      const key = type + "-" + item.id;
      const myCI = (checkins[key] || []).filter(e => entryPerson(e) === myName);
      const lastCI = myCI[myCI.length - 1];

      return `
        <div class="project-card status-${overall}">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div style="min-width:0;">
              <div style="font-weight:700;color:var(--primary);font-size:0.88rem;">${item.name}</div>
              <div style="font-size:0.72rem;color:var(--grey-dark);margin-top:2px;">
                ${myRole}
                ${type === "team" ? " · team" : " · project"}
                · Led by ${item.lead}
              </div>
            </div>
            <span class="status-label-sm flex-shrink-0" style="background:${STATUS_BG[overall]};color:${STATUS_TEXT[overall]};">
              ${STATUS_LABEL[overall]}
            </span>
          </div>
          ${lastCI ? `
          <div class="mt-2" style="font-size:0.72rem;color:var(--grey-dark);">
            Last check-in: ${CI_EMOJI[entryFeeling(lastCI)]} ${CI_LABEL[entryFeeling(lastCI)]} · ${relativeDate(lastCI.date)}
          </div>` : `
          <div class="mt-2" style="font-size:0.72rem;color:var(--grey-dark);">No check-ins yet</div>`}
          <div class="mt-2 d-flex gap-2 flex-wrap">
            ${["delivery","morale","satisfaction"].map(dim => `
              <span style="font-size:0.67rem;font-weight:600;border-radius:50px;padding:2px 9px;
                background:${STATUS_BG[item[dim]]};color:${STATUS_TEXT[item[dim]]};">
                ${dim.charAt(0).toUpperCase()+dim.slice(1)}: ${STATUS_LABEL[item[dim]]}
              </span>`).join("")}
          </div>
        </div>`;
    }

    function renderHistoryRow(entry) {
      const f = entryFeeling(entry);
      const itemName = getItemName(entry.key);
      return `
        <div class="history-row">
          <div class="history-emoji">${CI_EMOJI[f]}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.82rem;font-weight:700;color:var(--primary);">
              <span style="padding:1px 9px;border-radius:50px;font-size:0.72rem;background:${CI_BG[f]};color:${CI_TEXT[f]};">${CI_LABEL[f]}</span>
              <span class="ms-2" style="font-weight:400;color:var(--grey-very-dark);">${itemName}</span>
            </div>
            ${entry.note ? `<div class="history-note">"${entry.note}"</div>` : ""}
            <div class="history-meta mt-1">${formatDate(entry.date)}</div>
          </div>
        </div>`;
    }

    function getItemName(key) {
      const [type, id] = key.split("-");
      const data = type === "project" ? projects : teams;
      const item = data.find(i => i.id === parseInt(id));
      return item ? item.name : key;
    }

    // Normalises a check-in entry regardless of which page created it.
    // Votes store per-dimension { delivery, morale, satisfaction }; older entries
    // may carry a single { feeling }. entryFeeling collapses either to one value.
    function entryPerson(e) { return e.person || e.name || "Anonymous"; }
    function entryFeeling(e) {
      if (e.feeling) return e.feeling;
      const vals = [e.delivery, e.morale, e.satisfaction].filter(Boolean);
      if (vals.includes("struggling")) return "struggling";
      if (vals.every(v => v === "good")) return "good";
      return "okay";
    }

    // ── Interactions ──────────────────────────────────────────────────
    function selectVote(key, dim, val) {
      if (!selectedVotes[key]) selectedVotes[key] = {};
      selectedVotes[key][dim] = val;

      const card = document.getElementById("checkinCard-" + key);
      if (!card) return;
      const row = card.querySelector(`[data-dim="${dim}"]`);
      if (row) {
        row.querySelectorAll(".feel-btn").forEach(btn => btn.classList.remove("feel-good","feel-okay","feel-struggling"));
        const sel = row.querySelectorAll(".feel-btn")[["good","okay","struggling"].indexOf(val)];
        if (sel) sel.classList.add("feel-" + val);
      }

      // Reveal the submit footer once all three areas are rated.
      if (DIMENSIONS.every(d => selectedVotes[key][d])) {
        const footer = document.getElementById("voteFooter-" + key);
        if (footer) footer.style.display = "";
      }
    }

    function submitVote(key, type, itemId) {
      const votes = selectedVotes[key] || {};
      if (!DIMENSIONS.every(d => votes[d])) { showToast("Please rate all three areas first."); return; }
      const noteEl = document.getElementById("noteInput-" + key);
      const note   = noteEl ? noteEl.value.trim() : "";
      const anonEl = document.getElementById("anon-" + key);
      const anonymous = !!(anonEl && anonEl.checked);

      const vote = {
        person:    anonymous ? "Anonymous" : CURRENT_USER,
        anonymous,
        note,
        date: new Date().toISOString().split("T")[0]
      };
      DIMENSIONS.forEach(d => { vote[d] = votes[d]; });

      // applyVote appends the vote and re-derives the item's status from recent votes.
      const item = (type === "project" ? projects : teams).find(x => x.id === itemId);
      if (item) applyVote(item, checkins, key, vote);
      else { if (!checkins[key]) checkins[key] = []; checkins[key].push(vote); }
      persistShared();

      const footer   = document.getElementById("voteFooter-" + key);
      const doneArea = document.getElementById("doneArea-" + key);
      if (footer)   footer.style.display = "none";
      if (doneArea) doneArea.style.display = "";

      showToast(anonymous ? "Thanks — your anonymous check-in is in! 🎉" : "Thanks — your check-in is in! 🎉");

      sessionSubmitted.add(key);   // counts toward the progress indicator
      delete selectedVotes[key];
      setTimeout(() => { nextWizardStep(); }, 1000);
    }


    // ── Workload + wellbeing ──────────────────────────────────────────
    function renderWorkloadSection() {
      const mine  = personItems(CURRENT_USER, projects, teams);
      const total = mine.projects.length + mine.teams.length;
      const wb    = wellbeing[CURRENT_USER];
      const itemRow = (it, type) => {
        return `<div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--grey-very-dark);">
          <span style="width:8px;height:8px;border-radius:50%;background:${type === "project" ? "var(--accent1-medium)" : "var(--accent3-dark)"};flex-shrink:0;"></span>
          ${it.name} <span style="font-size:0.7rem;color:var(--grey-dark);">· ${type}</span></div>`;
      };
      return `
        <div class="checkin-card" style="background:linear-gradient(135deg,#f7f8ff,#eef0fb);">
          <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
            <h6 style="margin:0;">Your workload</h6>
            <span style="font-size:0.72rem;color:var(--grey-dark);">${CURRENT_USER}</span>
          </div>
          <p style="font-size:0.82rem;color:var(--grey-very-dark);margin:0 0 0.7rem;">
            You're on <strong>${mine.projects.length}</strong> project${mine.projects.length === 1 ? "" : "s"} and
            <strong>${mine.teams.length}</strong> team${mine.teams.length === 1 ? "" : "s"}.
          </p>
          ${total ? `<div class="d-flex flex-column gap-1 mb-3">
            ${mine.projects.map(p => itemRow(p, "project")).join("")}
            ${mine.teams.map(t => itemRow(t, "team")).join("")}
          </div>` : `<p style="font-size:0.8rem;color:var(--grey-dark);">You're not assigned to anything right now.</p>`}
          <div style="border-top:1px solid var(--grey-light);padding-top:0.7rem;">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <label class="fw-bold mb-0" style="font-size:0.85rem;">How's your capacity?</label>
              <small style="font-size:0.68rem;color:var(--grey-dark);">🔒 Private to your manager</small>
            </div>
            <div class="d-flex gap-2">
              ${WELLBEING_LEVELS.map(l => `
                <button onclick="setWellbeing('${l.key}')"
                  style="flex:1;border:1px solid ${wb && wb.level === l.key ? l.color : "var(--grey-light)"};background:${wb && wb.level === l.key ? l.color : "#fff"};color:${wb && wb.level === l.key ? "#fff" : "var(--grey-very-dark)"};border-radius:8px;padding:7px 6px;font-size:0.8rem;font-weight:600;cursor:pointer;">
                  ${l.label}</button>`).join("")}
            </div>
            ${wb ? `<div style="font-size:0.7rem;color:var(--grey-dark);margin-top:6px;">You flagged yourself <strong>${(wellbeingLevel(wb.level) || {}).label || wb.level}</strong> on ${formatDate(wb.date)}.</div>` : ""}
          </div>
        </div>`;
    }

    function setWellbeing(level) {
      wellbeing[CURRENT_USER] = { level, date: new Date().toISOString().split("T")[0] };
      saveWellbeing(wellbeing);
      showToast("Capacity updated — shared privately with your manager.");
      renderMemberDashboard();
    }

    // ── Init ──────────────────────────────────────────────────────────
    loadSharedData();
    wellbeing = loadWellbeing();
    render();
