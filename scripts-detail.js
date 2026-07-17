const urlParams = new URLSearchParams(window.location.search);
const itemType = urlParams.get('type') || 'project';
const itemId = parseInt(urlParams.get('id') || '1', 10);

let projects = [], teams = [], checkins = {};
function loadPersisted() { const s = loadData(); projects = s.projects; teams = s.teams; checkins = s.checkins; }
loadPersisted();

const TODAY = new Date();
function isStale(item) { return (TODAY - new Date(item.updated)) / 86400000 > STALE_DAYS; }

const STATUS_LABEL = { "on-track": "On track", "at-risk": "At risk", "critical": "Critical" };
const STATUS_COLOR = { "on-track": "#2DB81F", "at-risk": "#D4A017", "critical": "#B81F2D" };
const STATUS_BG    = { "on-track": "#e8f8e6", "at-risk": "#fdf5dc", "critical": "#fce8ea" };
const STATUS_TEXT  = { "on-track": "#1a6e12", "at-risk": "#7a5800", "critical": "#7a1219" };

const CI_LABEL = { good: "Good", okay: "Okay", struggling: "Struggling" };
const CI_EMOJI = { good: "😊", okay: "😐", struggling: "😟" };
const CI_COLOR = { good: "#2DB81F", okay: "#D4A017", struggling: "#B81F2D" };
const CI_BG    = { good: "#e8f8e6", okay: "#fdf5dc", struggling: "#fce8ea" };
const CI_TEXT  = { good: "#1a6e12", okay: "#7a5800", struggling: "#7a1219" };

let currentItem = null;

const AVATAR_COLORS = ["#7373D8","#2F78C4","#06C7CC","#2E308E","#26C4AB","#B56AC4","#4A90D9","#D4A017"];
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

function renderDetail() {
  const data = itemType === "project" ? projects : teams;
  currentItem = data.find(i => i.id === itemId);
  
  if (!currentItem) {
    document.getElementById("detailTitle").textContent = "Item not found";
    return;
  }

  const overall = overallStatus(currentItem);
  const stale = isStale(currentItem);
  const key = itemType + "-" + itemId;

  // Header
  document.getElementById("detailTitle").textContent = currentItem.name;
  
  let subtitleHTML = `<span class="status-badge" style="background:${STATUS_BG[overall]};color:${STATUS_TEXT[overall]};">${STATUS_LABEL[overall]}</span>`;
  subtitleHTML += `<span style="opacity:0.8;">${itemType === "team" ? "Team" : "Project"} · Led by ${currentItem.lead}</span>`;
  if (stale) subtitleHTML += `<span class="stale-badge" style="cursor:pointer;" onclick="openCheckinModal(${itemId}, '${itemType}')">⚠ Overdue update</span>`;
  if (itemType === "project" && currentItem.end) subtitleHTML += `<span style="font-size:0.85rem;color:rgba(255,255,255,0.7);">Due ${formatDate(currentItem.end)}</span>`;
  document.getElementById("detailSubtitle").innerHTML = subtitleHTML;

  // Header buttons
  document.getElementById("detailDeleteBtn").onclick = () => deleteItem(itemId, itemType);
  document.getElementById("detailEditBtn").onclick = () => openEditModal(itemId, itemType);
  document.getElementById("detailUpdateBtn").onclick = () => openCheckinModal(itemId, itemType);

  // RAG Cards
  const dims = DIMENSIONS.map(d => [d, dimLabel(d)]);
  document.getElementById("detailRagCards").innerHTML = dims.map(([d, label]) => `
    <div class="col-4">
      <div class="dim-card" style="background:${STATUS_BG[currentItem[d]]}; border:1px solid rgba(0,0,0,0.05);">
        <div style="width:12px;height:12px;border-radius:50%;background:${STATUS_COLOR[currentItem[d]]};margin:0 auto 8px;"></div>
        <div style="font-size:0.85rem;font-weight:700;color:${STATUS_TEXT[currentItem[d]]};">${STATUS_LABEL[currentItem[d]]}</div>
        <div style="font-size:0.75rem;color:var(--grey-very-dark);margin-top:2px;">${label}</div>
      </div>
    </div>`).join("");

  // Trend Chart
  document.getElementById("detailTrendChart").innerHTML = trendChartHTML(currentItem.history, {
    labels: ["6w ago", "", "4w ago", "", "2w ago", "Now"],
    showLegend: false
  });

  // Milestones
  let milestonesHTML = "";
  if (itemType === "project" && currentItem.milestones && currentItem.milestones.length) {
    const done = currentItem.milestones.filter(m => m.done).length;
    milestonesHTML = `<div class="card p-4 mb-4" style="border-radius:12px;">
      <h5 style="font-size:0.9rem;font-weight:700;color:var(--primary);margin-bottom:1rem;">Milestones (${done}/${currentItem.milestones.length} done)</h5>
      <div class="d-flex flex-column gap-2">
        ${currentItem.milestones.map(m => {
          const overdue = !m.done && new Date(m.date) < TODAY;
          const dot = m.done ? "var(--primary)" : overdue ? "#B81F2D" : "var(--grey-light)";
          return `<div style="display:flex;align-items:center;gap:12px;font-size:0.85rem;padding:6px 0;border-bottom:1px solid var(--grey-light);">
            <span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;background:${dot};display:inline-flex;align-items:center;justify-content:center;">
              ${m.done ? `<svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" fill="none"/></svg>` : overdue ? `<span style="color:white;font-size:10px;font-weight:700;line-height:1;">!</span>` : ""}
            </span>
            <span style="flex:1;${m.done ? "color:var(--grey-dark);text-decoration:line-through;" : "color:var(--grey-very-dark);font-weight:600;"}">${m.label}</span>
            <span style="font-size:0.75rem;color:var(--grey-dark);">${formatDate(m.date)}</span>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }
  document.getElementById("detailMilestonesContainer").innerHTML = milestonesHTML;

  // Notes
  let notesHTML = "";
  if (currentItem.notes) {
    notesHTML = `
      <div class="card p-3 mb-4" style="border-radius:12px;background:var(--grey-very-light);border-left:4px solid var(--accent2-dark);">
        <h5 style="font-size:0.8rem;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Notes</h5>
        <p style="font-size:0.85rem;color:var(--grey-very-dark);margin:0;line-height:1.5;">${currentItem.notes}</p>
      </div>`;
  }
  document.getElementById("detailNotesContainer").innerHTML = notesHTML;

  // People List
  document.getElementById("detailPeopleTitle").textContent = `${itemType === "team" ? "Team wellbeing" : "People"} (${currentItem.people.length})`;
  document.getElementById("detailPeopleList").innerHTML = currentItem.people.map(p => {
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

  // Check-ins Feed
  const itemCheckins = checkins[key] || [];
  const allCI = itemCheckins.slice().reverse();
  
  document.getElementById("detailCheckinsTitle").textContent = `Check-ins (${itemCheckins.length})`;
  document.getElementById("detailAddCheckinBtn").onclick = () => openCheckinModal(itemId, itemType);
  
  document.getElementById("detailVoteDistribution").innerHTML = voteDistributionHTML(itemCheckins);
  
  document.getElementById("detailCheckinsFeed").innerHTML = allCI.length === 0
    ? `<p style="font-size:0.85rem;color:var(--grey-dark);text-align:center;padding:1rem 0;">No check-ins yet.</p>`
    : allCI.map(c => {
        const name = c.name || c.person || "Anonymous";
        const f = c.feeling || ([c.delivery, c.morale, c.satisfaction].includes("struggling") ? "struggling" : [c.delivery, c.morale, c.satisfaction].every(v => v === "good") ? "good" : "okay");
        return `<div class="checkin-item mb-2 p-2">
          <span style="font-size:1.2rem;padding-top:2px;">${CI_EMOJI[f]}</span>
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div style="font-size:0.85rem;font-weight:600;color:var(--grey-very-dark);">${name}</div>
              <span style="background:${CI_BG[f]};color:${CI_TEXT[f]};padding:1px 8px;border-radius:50px;font-size:0.7rem;font-weight:600;">${CI_LABEL[f]}</span>
            </div>
            ${c.note ? `<div style="font-size:0.85rem;color:var(--grey-dark);margin-top:4px;line-height:1.4;">"${c.note}"</div>` : ""}
            <div style="font-size:0.7rem;color:var(--grey-dark);margin-top:6px;">${formatDate(c.date)}${c.by ? ` · recorded by ${c.by}` : ""}</div>
          </div>
        </div>`;
      }).join("");
}

// Ensure the page renders on load
document.addEventListener("DOMContentLoaded", () => {
  renderDetail();
});

// Implement dummy delete / edit overrides since we're on a detail page
function deleteItem(id, type) {
  if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
  if (type === "project") {
    const idx = projects.findIndex(x => x.id === id);
    if (idx > -1) projects.splice(idx, 1);
  } else {
    const idx = teams.findIndex(x => x.id === id);
    if (idx > -1) teams.splice(idx, 1);
  }
  persist();
  window.location.href = type === "project" ? "projects.html" : "teams.html";
}

// Override ui-modals post-submission behavior to just refresh the detail page
let ciSelections = {};
function ciRowHTML(dim) {
  return `<div class="checkin-row">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <label class="fw-bold mb-0" style="font-size:0.9rem;">${dimLabel(dim)}</label>
            <small class="text-muted">${dimHint(dim)}</small>
          </div>
          <div class="d-flex gap-2">
            <button class="ci-btn" data-field="${dim}" data-val="good"       onclick="setCi('${dim}','good')"><span class="ci-dot ci-dot-good"></span>Good</button>
            <button class="ci-btn" data-field="${dim}" data-val="okay"       onclick="setCi('${dim}','okay')"><span class="ci-dot ci-dot-okay"></span>Okay</button>
            <button class="ci-btn" data-field="${dim}" data-val="struggling" onclick="setCi('${dim}','struggling')"><span class="ci-dot ci-dot-struggling"></span>Struggling</button>
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

  const sel = document.getElementById("checkinItem");
  sel.innerHTML = [
    ...projects.map(p => `<option value="project-${p.id}">${p.name}</option>`),
    ...teams.map(t => `<option value="team-${t.id}">${t.name} (team)</option>`)
  ].join("");

  if (preId && preType) sel.value = `${preType}-${preId}`;

  updateBehalfDropdown();
  refreshCheckinSubmit(ciSelections);
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
  const item = type === "project" ? projects.find(p => p.id == id) : teams.find(t => t.id == id);
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

function refreshCheckinSubmit(sel) {
  document.getElementById("checkinSubmitBtn").disabled = !DIMENSIONS.every(d => sel[d]);
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
  const [cType, cId] = key.split("-");
  const onBehalf = document.getElementById("checkinOnBehalf").checked;
  const name = onBehalf ? (document.getElementById("checkinBehalfOf").value || CURRENT_USER) : CURRENT_USER;
  const note = document.getElementById("checkinNote").value.trim();

  const dataArr = cType === "project" ? projects : teams;
  const item = dataArr.find(x => x.id == cId);
  if (item) {
    DIMENSIONS.forEach(d => {
      item[d] = ciToStatus(ciSelections[d]);
      if (item.history && Array.isArray(item.history[d])) item.history[d].push(statusToScore(item[d]));
    });
    if (note) item.notes = note;
    item.updated = TODAY.toISOString().split("T")[0];
  }

  if (!checkins[key]) checkins[key] = [];
  const entry = { name, by: onBehalf ? CURRENT_USER : null, note, date: TODAY.toISOString().split("T")[0] };
  DIMENSIONS.forEach(d => { entry[d] = ciSelections[d]; });
  checkins[key].unshift(entry);

  persist();
  bootstrap.Modal.getInstance(document.getElementById("checkinModal")).hide();
  renderDetail();
}

function openEditModal() {
  if (!currentItem) return;
  document.getElementById("editModalTitle").textContent = "Edit " + itemType;
  document.getElementById("editId").value = currentItem.id;
  document.getElementById("editName").value = currentItem.name;
  document.getElementById("editLead").value = currentItem.lead;
  document.getElementById("editNotes").value = currentItem.notes || "";
  
  const pList = document.getElementById("editPeopleList");
  pList.innerHTML = "";
  currentItem.people.forEach(p => {
    pList.insertAdjacentHTML("beforeend", `<div class="d-flex gap-2 person-edit-row">
      <input type="text" class="form-control form-control-sm flex-grow-1 p-name" value="${p.name}" placeholder="Name">
      <input type="text" class="form-control form-control-sm flex-grow-1 p-role" value="${p.role}" placeholder="Role">
      <button class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
    </div>`);
  });
  
  document.getElementById("editError").style.display = "none";
  new bootstrap.Modal(document.getElementById("editModal")).show();
}

function addEditPersonRow() {
  document.getElementById("editPeopleList").insertAdjacentHTML("beforeend", `<div class="d-flex gap-2 person-edit-row">
    <input type="text" class="form-control form-control-sm flex-grow-1 p-name" placeholder="Name" list="knownPeopleList">
    <input type="text" class="form-control form-control-sm flex-grow-1 p-role" placeholder="Role">
    <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
  </div>`);
}

function submitEdit() {
  const err = document.getElementById("editError");
  const name = document.getElementById("editName").value.trim();
  const lead = document.getElementById("editLead").value.trim();
  if (!name || !lead) {
    err.textContent = "Name and Lead are required.";
    err.style.display = "block";
    return;
  }
  
  const people = [];
  document.querySelectorAll(".person-edit-row").forEach(row => {
    const n = row.querySelector(".p-name").value.trim();
    const r = row.querySelector(".p-role").value.trim();
    if (n) people.push({ name: n, role: r || "Member" });
  });

  currentItem.name = name;
  currentItem.lead = lead;
  currentItem.notes = document.getElementById("editNotes").value.trim();
  currentItem.people = people;
  
  persist();
  bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();
  renderDetail();
}
