// ─────────────────────────────────────────────────────────────────────────────
// Cognizant ProjectTracker — shared data + persistence
//
// Single source of truth for every page. Each page loads this BEFORE its own
// scripts-*.js, then reads `projects` / `teams` / `checkins` via loadData() and
// writes back via saveData(). Status roll-up logic lives here too so the lead
// view and the member view agree on how a check-in maps to a RAG status.
// ─────────────────────────────────────────────────────────────────────────────

const STORE_KEY = "cpt_data";

// Who the current session is acting as. (No real auth in the prototype.)
const CURRENT_USER = "Alex Morgan";

// Which role the dashboard renders for. Chosen on the login/role screen and
// persisted here so the dashboard can show a lead vs. member landing state.
// (Still no real auth — this only drives which view is shown.)
const ROLE_KEY = "cpt_role";
function loadRole() { try { return localStorage.getItem(ROLE_KEY) || "lead"; } catch (e) { return "lead"; } }
function saveRole(role) { try { localStorage.setItem(ROLE_KEY, role); } catch (e) {} }

// ── Status vocabulary ────────────────────────────────────────────────────────
// Two scales exist by design:
//   • RAG status on an item:  on-track / at-risk / critical
//   • A single check-in feeling: good / okay / struggling
// CI_TO_STATUS is the ONE place that maps between them.
const STATUS_RANK   = { "on-track": 0, "at-risk": 1, "critical": 2 };
const CI_TO_STATUS  = { good: "on-track", okay: "at-risk", struggling: "critical" };

function ciToStatus(feeling) {
  return CI_TO_STATUS[feeling] || "at-risk";
}

// Older seed entries use a single `feeling`; newer check-ins store one value
// per health area. Collapse both shapes to a dependable summary for lists.
function checkinFeeling(entry) {
  if (!entry) return "okay";
  if (entry.feeling && CI_TO_STATUS[entry.feeling]) return entry.feeling;
  const values = [entry.delivery, entry.morale, entry.satisfaction].filter(Boolean);
  if (values.includes("struggling")) return "struggling";
  if (values.length && values.every(value => value === "good")) return "good";
  return "okay";
}

function toggleMobileNav(button) {
  const nav = button.closest(".cog-nav");
  const links = nav && nav.querySelector(".nav-links");
  if (!links) return;
  const open = links.classList.toggle("open");
  button.classList.toggle("open", open);
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
}

document.addEventListener("click", event => {
  document.querySelectorAll(".cog-nav .nav-links.open").forEach(links => {
    if (links.closest(".cog-nav").contains(event.target)) return;
    links.classList.remove("open");
    const button = links.closest(".cog-nav").querySelector(".mobile-nav-toggle");
    if (button) {
      button.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open navigation");
    }
  });
});

// A history sparkline score for a status, so a check-in extends the trend line.
function statusToScore(status) {
  return status === "on-track" ? 90 : status === "at-risk" ? 55 : 20;
}

// Worst-of the active dimensions wins. Reads DIMENSIONS at call time, so any
// custom dimension (workload/learning) counts toward overall health too.
function overallStatus(item) {
  return DIMENSIONS.reduce(
    (worst, d) => (STATUS_RANK[item[d]] > STATUS_RANK[worst] ? item[d] : worst),
    "on-track"
  );
}

// ── Canonical seed data ──────────────────────────────────────────────────────
const SEED_PROJECTS = [
  { id: 1, name: "Meridian Account Refresh", lead: "Alex Morgan", account: "Lloyds Banking Group",
    delivery: "on-track", morale: "at-risk", satisfaction: "on-track",
    updated: "2026-04-17T09:34:00", notes: "Sprint 4 on schedule. Team flagged some capacity concerns.",
    start: "2026-01-06", end: "2026-06-30",
    milestones: [
      { label: "Discovery", date: "2026-01-20", done: true },
      { label: "Design v1", date: "2026-02-28", done: true },
      { label: "Prototype", date: "2026-04-01", done: true },
      { label: "UAT",       date: "2026-05-15", done: false },
      { label: "Launch",    date: "2026-06-30", done: false }
    ],
    people: [
      { name: "Alex Morgan",  role: "Design Lead" },
      { name: "Sam Chen",     role: "Senior UX Designer" },
      { name: "Jordan Lee",   role: "UX Researcher" },
      { name: "Riley Hughes", role: "UI Designer" }
    ],
    history: { delivery: [90,85,82], morale: [80,70,65], satisfaction: [92,88,85] }
  },
  { id: 2, name: "Helix Digital Transformation", lead: "Jamie Foster", account: "Aviva",
    delivery: "at-risk", morale: "critical", satisfaction: "at-risk",
    updated: "2026-04-11T14:05:00", notes: "Scope creep impacting delivery. Team morale low due to overtime.",
    start: "2025-11-01", end: "2026-07-31",
    milestones: [
      { label: "Research",    date: "2025-12-01", done: true },
      { label: "Design",      date: "2026-02-01", done: true },
      { label: "Dev Handoff", date: "2026-04-01", done: false },
      { label: "Pilot",       date: "2026-06-01", done: false },
      { label: "Launch",      date: "2026-07-31", done: false }
    ],
    people: [
      { name: "Jamie Foster",  role: "Design Lead" },
      { name: "Dana Kapoor",   role: "UX Designer" },
      { name: "Drew Walsh",    role: "Service Designer" },
      { name: "Morgan Miller", role: "UX Researcher" },
      { name: "Taylor Park",   role: "UI Designer" }
    ],
    history: { delivery: [80,65,55], morale: [70,50,30], satisfaction: [75,65,55] },
    actions: [
      { id: "seed-h1", text: "Re-scope the sprint to cut overtime and protect the team", owner: "Jamie Foster", created: "2026-04-12", status: "resolved", resolvedDate: "2026-04-22", statusAtCreation: "critical", statusAtResolution: "at-risk" }
    ]
  },
  { id: 3, name: "Apex UX Overhaul", lead: "Cameron Shaw", account: "Barclays",
    delivery: "on-track", morale: "on-track", satisfaction: "on-track",
    updated: "2026-04-13T10:48:00", notes: "Strong progress. Client very happy with direction.",
    start: "2026-02-01", end: "2026-08-31",
    milestones: [
      { label: "Audit",    date: "2026-02-28", done: true },
      { label: "Concepts", date: "2026-03-31", done: true },
      { label: "Design",   date: "2026-05-31", done: false },
      { label: "Testing",  date: "2026-07-15", done: false },
      { label: "Launch",   date: "2026-08-31", done: false }
    ],
    people: [
      { name: "Cameron Shaw", role: "Design Lead" },
      { name: "Avery Kim",    role: "Senior UX Designer" },
      { name: "Casey Davis",  role: "UI Designer" }
    ],
    history: { delivery: [85,88,92], morale: [82,85,90], satisfaction: [80,85,92] }
  },
  { id: 4, name: "Vertex Design System", lead: "Sam Brennan", account: "Aviva",
    delivery: "critical", morale: "at-risk", satisfaction: "critical",
    updated: "2026-04-02T16:22:00", notes: "Blockers on dev handoff. Stakeholder review missed deadline.",
    start: "2025-10-01", end: "2026-05-31",
    milestones: [
      { label: "Foundations", date: "2025-12-01", done: true },
      { label: "Components",  date: "2026-02-01", done: true },
      { label: "Dev Handoff", date: "2026-03-15", done: false },
      { label: "QA",          date: "2026-04-30", done: false },
      { label: "Release",     date: "2026-05-31", done: false }
    ],
    people: [
      { name: "Sam Brennan",  role: "Design Lead" },
      { name: "Quinn Clarke", role: "Design Systems Designer" },
      { name: "Lee Patel",    role: "UI Developer" }
    ],
    history: { delivery: [75,60,30], morale: [70,60,50], satisfaction: [70,50,20] },
    actions: [
      { id: "seed-v1", text: "Escalate dev-handoff blockers to the delivery lead", owner: "Sam Brennan", created: "2026-04-03", status: "open", statusAtCreation: "critical" }
    ]
  },
  { id: 5, name: "Nexus Consumer Portal", lead: "Jordan Osei", account: "Barclays",
    delivery: "at-risk", morale: "on-track", satisfaction: "at-risk",
    updated: "2026-04-12T08:57:00", notes: "Delayed 2 weeks due to API dependency. Team still positive.",
    start: "2026-01-15", end: "2026-09-30",
    milestones: [
      { label: "Discovery",  date: "2026-02-15", done: true },
      { label: "Wireframes", date: "2026-03-31", done: true },
      { label: "Design",     date: "2026-06-30", done: false },
      { label: "Build",      date: "2026-08-31", done: false },
      { label: "Launch",     date: "2026-09-30", done: false }
    ],
    people: [
      { name: "Jordan Osei",    role: "Design Lead" },
      { name: "Blake Taylor",   role: "UX Designer" },
      { name: "Skyler Johnson", role: "Content Designer" },
      { name: "Robin Tanaka",   role: "UX Researcher" }
    ],
    history: { delivery: [88,75,65], morale: [85,85,88], satisfaction: [80,70,60] }
  }
];

const SEED_TEAMS = [
  { id: 1, name: "CX Design Team", lead: "Alex Morgan",
    delivery: "on-track", morale: "on-track", satisfaction: "on-track",
    updated: "2026-04-17T09:34:00", notes: "Team performing well across all accounts.",
    people: [
      { name: "Alex Morgan",   role: "Design Lead" },
      { name: "Sam Chen",      role: "Senior UX Designer" },
      { name: "Jordan Lee",    role: "UX Researcher" },
      { name: "Riley Hughes",  role: "UI Designer" },
      { name: "Casey Davis",   role: "UI Designer" },
      { name: "Robin Tanaka",  role: "UX Researcher" },
      { name: "Blake Taylor",  role: "UX Designer" },
      { name: "Quinn Clarke",  role: "Design Systems Designer" }
    ],
    history: { delivery: [85,88,92], morale: [82,85,88], satisfaction: [80,85,90] }
  },
  { id: 2, name: "Product Design Team", lead: "Jamie Foster",
    delivery: "at-risk", morale: "at-risk", satisfaction: "on-track",
    updated: "2026-04-11T14:05:00", notes: "Stretched capacity. Two members flagged burnout risk.",
    people: [
      { name: "Jamie Foster",  role: "Design Lead" },
      { name: "Dana Kapoor",   role: "UX Designer" },
      { name: "Drew Walsh",    role: "Service Designer" },
      { name: "Morgan Miller", role: "UX Researcher" },
      { name: "Taylor Park",   role: "UI Designer" },
      { name: "Lee Patel",     role: "UI Developer" }
    ],
    history: { delivery: [80,70,60], morale: [75,60,55], satisfaction: [80,78,82] }
  },
  { id: 3, name: "Research & Insights", lead: "Cameron Shaw",
    delivery: "on-track", morale: "critical", satisfaction: "at-risk",
    updated: "2026-03-28T13:30:00", notes: "Morale impacted by restructure uncertainty.",
    people: [
      { name: "Cameron Shaw",   role: "Research Lead" },
      { name: "Avery Kim",      role: "Senior Researcher" },
      { name: "Skyler Johnson", role: "Content Designer" },
      { name: "Jordan Osei",    role: "Design Researcher" }
    ],
    history: { delivery: [88,85,82], morale: [75,55,30], satisfaction: [82,70,60] }
  }
];

// Check-ins are keyed by "project-1", "team-2", etc. Two entry shapes coexist:
//   • lead (structured):   { name, delivery, morale, satisfaction, note, date }
//   • member (single feel): { person, feeling, note, date }
// Consumers normalise via entryPerson()/entryFeeling().
const SEED_CHECKINS = {
  "project-1": [
    { name: "Sam Chen",  delivery: "good", morale: "okay",       satisfaction: "good", note: "Client loved the new navigation patterns.", date: "2026-04-13" },
    { name: "Jordan Lee", delivery: "okay", morale: "struggling", satisfaction: "good", note: "Feeling stretched across two projects.",     date: "2026-04-12" }
  ],
  "project-2": [
    { name: "Dana Kapoor", delivery: "struggling", morale: "struggling", satisfaction: "okay",       note: "Too many last-minute scope changes.", date: "2026-04-11" },
    { name: "Anonymous",   delivery: "okay",       morale: "struggling", satisfaction: "struggling", note: "",                                    date: "2026-04-10" },
    { name: "Drew Walsh",  delivery: "struggling", morale: "okay",       satisfaction: "okay",       note: "Dev handoff keeps moving.",           date: "2026-04-09" }
  ],
  "project-3": [
    { name: "Avery Kim", delivery: "good", morale: "good", satisfaction: "good", note: "Best project I've worked on this year.", date: "2026-04-13" }
  ],
  "team-2": [
    { name: "Morgan Miller", delivery: "okay", morale: "struggling", satisfaction: "good", note: "Workload feels unsustainable right now.", date: "2026-04-11" }
  ]
};

// ── Persistence ──────────────────────────────────────────────────────────────

// Recursively merge `saved` onto `def`. Plain objects merge key-by-key (so a
// default field the save predates is preserved); arrays and scalars are taken
// from `saved` when present. This is what makes the merge non-lossy.
function deepMerge(def, saved) {
  if (Array.isArray(saved) || typeof saved !== "object" || saved === null) return saved;
  if (typeof def !== "object" || def === null || Array.isArray(def)) return saved;
  const out = Object.assign({}, def);
  for (const key of Object.keys(saved)) {
    out[key] = deepMerge(def[key], saved[key]);
  }
  return out;
}

// Date helpers for rebasing the seed onto "now" so the demo always looks current.
function _pad2(n) { return String(n).padStart(2, "0"); }
function _isoDate(ms) { const d = new Date(ms); return `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`; }
function _isoDateTime(ms) { const d = new Date(ms); return `${_isoDate(ms)}T${_pad2(d.getHours())}:${_pad2(d.getMinutes())}:00`; }
function _shiftDateStr(str, deltaDays) {
  if (!str) return str;
  const hasTime = str.includes("T");
  const d = new Date(str.slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() + deltaDays);
  const out = _isoDate(d.getTime());
  return hasTime ? out + str.slice(10) : out;
}

// Shift all seed dates so the data reads as recent whenever the demo is opened:
//  • `updated` is compressed into the last 1–12 days (so nothing looks overdue),
//  • check-in dates into the last 1–11 days (so votes still count as "recent"),
//  • project timelines shift by a fixed delta (so multi-month spans survive).
// The mix of healthy / at-risk / critical statuses is left untouched, so the
// dashboard still shows variety — the positive empty state appears once a lead
// resolves everything to On Track, not on first load.
function rebaseSeedDates(seed) {
  const now = Date.now(), DAY = 86400000;
  const items = [...seed.projects, ...seed.teams];
  if (!items.length) return seed;

  const ups = items.map(it => new Date(it.updated).getTime());
  const upMin = Math.min(...ups), upMax = Math.max(...ups);
  items.forEach(it => {
    const frac = upMax === upMin ? 1 : (new Date(it.updated).getTime() - upMin) / (upMax - upMin);
    it.updated = _isoDateTime(now - (12 - frac * 11) * DAY); // oldest → 12d ago, newest → 1d ago
  });

  const allCi = Object.values(seed.checkins).flat();
  if (allCi.length) {
    const cs = allCi.map(c => new Date(c.date).getTime());
    const cMin = Math.min(...cs), cMax = Math.max(...cs);
    Object.values(seed.checkins).forEach(list => list.forEach(c => {
      if (!c.date) return;
      const frac = cMax === cMin ? 1 : (new Date(c.date).getTime() - cMin) / (cMax - cMin);
      c.date = _isoDate(now - (11 - frac * 10) * DAY);
    }));
  }

  const deltaDays = Math.round((now - DAY - upMax) / DAY);
  const shift = s => _shiftDateStr(s, deltaDays);
  seed.projects.forEach(p => {
    p.start = shift(p.start); p.end = shift(p.end);
    (p.milestones || []).forEach(m => { m.date = shift(m.date); });
    (p.actions || []).forEach(a => { a.created = shift(a.created); if (a.resolvedDate) a.resolvedDate = shift(a.resolvedDate); });
  });
  seed.teams.forEach(t => (t.actions || []).forEach(a => { a.created = shift(a.created); if (a.resolvedDate) a.resolvedDate = shift(a.resolvedDate); }));
  return seed;
}

function freshSeed() {
  // Deep clone so in-memory edits never mutate the seed constants, then rebase
  // the clone's dates onto "now" so the demo never looks stale.
  return rebaseSeedDates({
    projects: JSON.parse(JSON.stringify(SEED_PROJECTS)),
    teams:    JSON.parse(JSON.stringify(SEED_TEAMS)),
    checkins: JSON.parse(JSON.stringify(SEED_CHECKINS))
  });
}

// Returns { projects, teams, checkins }, with any saved state deep-merged over
// the current seed defaults (so fields added to the seed after a save survive).
function loadData() {
  const base = freshSeed();
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  } catch (e) {
    saved = null;
  }
  if (!saved) {
    normalizeDimensions(base.projects);
    normalizeDimensions(base.teams);
    return base;
  }

  if (Array.isArray(saved.projects)) {
    base.projects = saved.projects.map(p =>
      deepMerge(base.projects.find(d => d.id === p.id) || {}, p)
    );
  }
  if (Array.isArray(saved.teams)) {
    base.teams = saved.teams.map(t =>
      deepMerge(base.teams.find(d => d.id === t.id) || {}, t)
    );
  }
  if (saved.checkins && typeof saved.checkins === "object") {
    base.checkins = saved.checkins;
  }
  normalizeDimensions(base.projects);
  normalizeDimensions(base.teams);
  return base;
}

function saveData(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      projects: state.projects,
      teams:    state.teams,
      checkins: state.checkins
    }));
  } catch (e) { /* storage full or unavailable — non-fatal in the prototype */ }
}

function resetData() {
  localStorage.removeItem(STORE_KEY);
}

// ── Team voting: aggregation + status derivation ─────────────────────────────
// A check-in entry is a vote: { person, anonymous, delivery, morale, satisfaction, note, date }.
// The lead sees the distribution of recent votes per dimension; the item's RAG
// status is derived from that aggregate (the lead can still override by editing).

// ── Dimension catalog (the menu of health areas you can track) ───────────────
// Each item stores a status per active dimension key (e.g. item.delivery). The
// active set is chosen on the settings page; default = the original three.
const DIMENSION_CATALOG = [
  { key: "delivery",     label: "Delivery",                 short: "Delivery",     hint: "Is the work on track?",            color: "#2f78c4" },
  { key: "morale",       label: "Team morale",              short: "Morale",       hint: "How's the team feeling?",          color: "#7373D8" },
  { key: "satisfaction", label: "Stakeholder satisfaction", short: "Satisfaction", hint: "How's the client feeling?",        color: "#06C7CC" },
  { key: "workload",     label: "Workload & capacity",      short: "Workload",     hint: "Is the team's load sustainable?",  color: "#B56AC4" },
  { key: "learning",     label: "Learning & growth",        short: "Learning",     hint: "Are people learning and growing?", color: "#26C4AB" },
];
const DEFAULT_DIMENSIONS = ["delivery", "morale", "satisfaction"];
const DIM_CONFIG_KEY = "cpt_dimensions";

function loadActiveDimensions() {
  try {
    const saved = JSON.parse(localStorage.getItem(DIM_CONFIG_KEY) || "null");
    if (Array.isArray(saved) && saved.length) {
      const set = new Set(saved);
      const keys = DIMENSION_CATALOG.filter(d => set.has(d.key)).map(d => d.key); // known keys, catalog order
      if (keys.length) return keys;
    }
  } catch (e) {}
  return DEFAULT_DIMENSIONS.slice();
}
function saveActiveDimensions(keys) {
  try { localStorage.setItem(DIM_CONFIG_KEY, JSON.stringify(keys)); } catch (e) {}
}

// Active dimension keys. `let` so a settings change can refresh it in-page.
let DIMENSIONS = loadActiveDimensions();
function refreshDimensions() { DIMENSIONS = loadActiveDimensions(); return DIMENSIONS; }

function dimDef(key)   { return DIMENSION_CATALOG.find(d => d.key === key) || { key, label: key, short: key, hint: "", color: "#888" }; }
function dimLabel(key) { return dimDef(key).label; }
function dimHint(key)  { return dimDef(key).hint; }

// Enable the check-in modal's Submit button only when every active dimension has
// a rating. Shared by the lead check-in modal on all pages. `selections` is the
// page-local ciSelections map ({ delivery: "good", ... }).
function refreshCheckinSubmit(selections) {
  const btn = document.getElementById("checkinSubmitBtn");
  if (!btn) return;
  btn.disabled = !DIMENSIONS.every(d => selections && selections[d]);
}

// Ensure every item carries a status + history for each active dimension
// (new dimensions default to On Track with an empty trend).
function normalizeDimensions(items) {
  (items || []).forEach(it => {
    it.history = it.history || {};
    DIMENSIONS.forEach(key => {
      if (!it[key]) it[key] = "on-track";
      if (!Array.isArray(it.history[key])) it.history[key] = [];
    });
  });
}

const RECENT_WINDOW_DAYS = 30;

// Votes within the recent window; falls back to the last few if none are recent.
function recentCheckins(list, now) {
  if (!Array.isArray(list) || !list.length) return [];
  const cutoff = (now || Date.now()) - RECENT_WINDOW_DAYS * 86400000;
  const within = list.filter(e => new Date(e.date).getTime() >= cutoff);
  return within.length ? within : list.slice(-5);
}

// Count good/okay/struggling for one dimension across the given entries.
function tallyDimension(list, dim) {
  const t = { good: 0, okay: 0, struggling: 0, total: 0 };
  list.forEach(e => { if (t[e[dim]] !== undefined) { t[e[dim]]++; t.total++; } });
  return t;
}

// Derive a RAG status from a dimension tally: the modal rating wins, ties go to
// the worse rating. Returns `fallback` (the item's current value) when no votes.
function deriveDimensionStatus(tally, fallback) {
  if (!tally.total) return fallback;
  let best = "good", bestN = -1;
  ["good", "okay", "struggling"].forEach(r => { if (tally[r] >= bestN) { bestN = tally[r]; best = r; } });
  return ciToStatus(best);
}

// Record a vote and recompute the item's three statuses from recent votes.
function applyVote(item, checkinsObj, key, vote) {
  if (!checkinsObj[key]) checkinsObj[key] = [];
  checkinsObj[key].push(vote);
  const recent = recentCheckins(checkinsObj[key]);
  DIMENSIONS.forEach(dim => {
    const derived = deriveDimensionStatus(tallyDimension(recent, dim), item[dim]);
    item[dim] = derived;
    if (item.history && Array.isArray(item.history[dim])) item.history[dim].push(statusToScore(derived));
  });
  item.updated = new Date().toISOString().split("T")[0];
}

// Self-contained distribution widget (no dependency on per-page colour maps), so
// every lead view renders the vote spread the same way.
const VOTE_STYLE = {
  good:       { bg: "#e8f8e6", text: "#1a6e12", label: "good" },
  okay:       { bg: "#fdf5dc", text: "#7a5800", label: "okay" },
  struggling: { bg: "#fce8ea", text: "#7a1219", label: "struggling" },
};
function voteDistributionHTML(list) {
  const recent = recentCheckins(list);
  const rows = DIMENSIONS.map(dim => {
    const t = tallyDimension(recent, dim);
    if (!t.total) return "";
    const segs = ["good", "okay", "struggling"].map(r => t[r]
      ? `<span style="background:${VOTE_STYLE[r].bg};color:${VOTE_STYLE[r].text};padding:1px 8px;border-radius:50px;font-size:0.66rem;font-weight:600;">${t[r]} ${VOTE_STYLE[r].label}</span>`
      : "").filter(Boolean).join(" ");
    return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:5px;">
      <span style="font-size:0.7rem;font-weight:700;color:var(--primary);width:80px;text-transform:capitalize;">${dim}</span>
      <span style="display:flex;gap:5px;flex-wrap:wrap;">${segs}</span></div>`;
  }).filter(Boolean).join("");
  if (!rows) return "";
  return `<div style="background:var(--grey-very-light);border:1px solid var(--grey-light);border-radius:10px;padding:10px 12px;margin-bottom:12px;">
    <div style="font-size:0.7rem;font-weight:700;color:var(--grey-dark);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:7px;">Recent votes</div>
    ${rows}</div>`;
}

// ── Trend-over-time chart (self-contained SVG; shared by every view) ──────────
const DIM_COLOR = Object.fromEntries(DIMENSION_CATALOG.map(d => [d.key, d.color]));
const DIM_NAME  = Object.fromEntries(DIMENSION_CATALOG.map(d => [d.key, d.short]));

// Multi-line trend from a history object { delivery:[], morale:[], satisfaction:[] }.
// Scores are 0–100 (see statusToScore); the last point is the most recent check-in.
// A "healthy" score line is drawn at this level so a reader can see at a glance
// whether the lines are sitting above or below a good baseline.
const HEALTHY_SCORE = 75;
// A single check-in-to-check-in fall of this much (on the 0–100 scale) is worth
// flagging on the chart so a lead can see WHEN the decline started.
const SIGNIFICANT_DROP = 15;

function trendChartHTML(history, options) {
  options = options || {};
  const labels = options.labels || [];
  const series = DIMENSIONS.map(dim => ({ dim, pts: (history && history[dim]) || [] }));
  const maxLen = Math.max(0, ...series.map(s => s.pts.length));
  if (maxLen < 2) {
    return `<p style="font-size:0.8rem;color:var(--grey-dark);margin:0;">Not enough history yet — the trend builds up after a couple of check-ins.</p>`;
  }
  const W = 520, H = 200, PAD = { t: 14, r: 14, b: labels.length ? 28 : 14, l: 30 };
  const xAt = (i, n) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
  const yAt = v => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);
  const grid = [0, 50, 100].map(v =>
    `<line x1="${PAD.l}" y1="${yAt(v).toFixed(1)}" x2="${W - PAD.r}" y2="${yAt(v).toFixed(1)}" stroke="#e7e7ef" stroke-width="1"/>` +
    `<text x="${PAD.l - 6}" y="${(yAt(v) + 3).toFixed(1)}" font-size="8" fill="#9a9ab0" text-anchor="end" font-family="sans-serif">${v}</text>`
  ).join("");

  // Healthy threshold line (dashed green) + label.
  const hy = yAt(HEALTHY_SCORE);
  const threshold =
    `<line x1="${PAD.l}" y1="${hy.toFixed(1)}" x2="${W - PAD.r}" y2="${hy.toFixed(1)}" stroke="#2DB81F" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.85"/>` +
    `<text x="${W - PAD.r}" y="${(hy - 4).toFixed(1)}" font-size="8.5" fill="#2DB81F" text-anchor="end" font-family="sans-serif" font-weight="700">Healthy · ${HEALTHY_SCORE}</text>`;

  // Find the single steepest decline across all series, to annotate where things
  // started dropping. (Compares each point to the one before it.)
  let drop = null;
  series.forEach(s => {
    for (let i = 1; i < s.pts.length; i++) {
      const delta = s.pts[i] - s.pts[i - 1];
      if (delta < 0 && (!drop || delta < drop.delta)) drop = { i, n: s.pts.length, delta, dim: s.dim };
    }
  });
  let annotation = "";
  if (drop && drop.delta <= -SIGNIFICANT_DROP) {
    const dx = xAt(drop.i, drop.n);
    const labelAnchor = drop.i === drop.n - 1 ? "end" : "middle";
    annotation =
      `<line x1="${dx.toFixed(1)}" y1="${PAD.t}" x2="${dx.toFixed(1)}" y2="${H - PAD.b}" stroke="#B81F2D" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>` +
      `<text x="${dx.toFixed(1)}" y="${(PAD.t + 7).toFixed(1)}" font-size="8.5" fill="#B81F2D" text-anchor="${labelAnchor}" font-family="sans-serif" font-weight="700">▼ ${DIM_NAME[drop.dim]} ${Math.round(drop.delta)}</text>`;
  }

  const lines = series.map(s => {
    if (s.pts.length < 2) return "";
    const coords = s.pts.map((v, i) => `${xAt(i, s.pts.length).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
    const lx = xAt(s.pts.length - 1, s.pts.length).toFixed(1), ly = yAt(s.pts[s.pts.length - 1]).toFixed(1);
    return `<polyline points="${coords}" fill="none" stroke="${DIM_COLOR[s.dim]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
           `<circle cx="${lx}" cy="${ly}" r="3" fill="${DIM_COLOR[s.dim]}"/>`;
  }).join("");
  const xLabels = labels.map((label, index) => label
    ? `<text x="${xAt(index, labels.length).toFixed(1)}" y="${H - 7}" font-size="8.5" fill="#7f8094" text-anchor="middle" font-family="sans-serif">${label}</text>`
    : ""
  ).join("");
  const legend = options.showLegend === false ? "" : DIMENSIONS.map(dim =>
    `<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.72rem;color:var(--grey-very-dark);margin-right:14px;">
      <span style="width:10px;height:10px;border-radius:50%;background:${DIM_COLOR[dim]};display:inline-block;"></span>${DIM_NAME[dim]}</span>`
  ).join("");
  return `${legend ? `<div style="margin-bottom:6px;">${legend}</div>` : ""}
    <svg width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Portfolio health over six weeks" style="width:100%;height:auto;display:block;">${grid}${threshold}${annotation}${lines}${xLabels}</svg>`;
}

// "Health trend" section for an item drawer.
function itemTrendHTML(item) {
  return `<div class="section-title" style="margin-top:1.1rem;">Health trend</div>${trendChartHTML(item && item.history)}`;
}

// ── Needs-attention detection ────────────────────────────────────────────────
const STALE_DAYS = 14;

// "declining" when the last three history points strictly fall; "improving" when
// they strictly rise; otherwise "flat". Needs at least three points.
function dimensionTrend(history, dim) {
  const a = (history && history[dim]) || [];
  if (a.length < 3) return "flat";
  const [x, y, z] = a.slice(-3);
  if (z < y && y < x) return "declining";
  if (z > y && y > x) return "improving";
  return "flat";
}

// Days since last update if it exceeds STALE_DAYS, else null.
function staleDays(item, now) {
  if (!item.updated) return null;
  const d = Math.floor(((now || Date.now()) - new Date(item.updated).getTime()) / 86400000);
  return d > STALE_DAYS ? d : null;
}

// Items needing a manager's attention, with reasons, sorted worst-first.
// severity: 3 = critical, 2 = declining, 1 = stale only.
function attentionItems(projects, teams, now) {
  const out = [];
  const scan = (list, type) => (list || []).forEach(item => {
    const reasons = [];
    let severity = 0;
    const overall = overallStatus(item);
    if (overall === "critical") { reasons.push("Overall health critical"); severity = Math.max(severity, 3); }
    DIMENSIONS.forEach(dim => {
      if (item[dim] === "critical" && overall !== "critical") { reasons.push(`${DIM_NAME[dim]} critical`); severity = Math.max(severity, 3); }
      if (dimensionTrend(item.history, dim) === "declining") { reasons.push(`${DIM_NAME[dim]} declining`); severity = Math.max(severity, 2); }
    });
    const sd = staleDays(item, now);
    if (sd !== null) { reasons.push(`No check-in in ${sd} days`); severity = Math.max(severity, 1); }
    if (reasons.length) out.push({ type, id: item.id, name: item.name, lead: item.lead, overall, reasons, severity });
  });
  scan(projects, "project");
  scan(teams, "team");
  out.sort((a, b) => b.severity - a.severity);
  return out;
}

// Average score per dimension across items (aligned to their shared recent length),
// giving a portfolio-level trend for the dashboard.
function portfolioHistory(items) {
  const out = {};
  DIMENSIONS.forEach(d => { out[d] = []; });
  const valid = (items || []).filter(it => it.history && DIMENSIONS.every(d => Array.isArray(it.history[d])));
  if (!valid.length) return out;
  const minLen = Math.min(...valid.map(it => Math.min(...DIMENSIONS.map(d => it.history[d].length))));
  for (let i = 0; i < minLen; i++) {
    DIMENSIONS.forEach(d => {
      const vals = valid.map(it => it.history[d][it.history[d].length - minLen + i]);
      out[d].push(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
    });
  }
  return out;
}

// ── Follow-up actions ────────────────────────────────────────────────────────
// Each item may carry an `actions` array: a lead attaches a follow-up to a red /
// declining item, then marks it done. We snapshot the item's overall status when
// the action is raised (and when resolved) so the UI can show "did it improve?".
const RAG_LABEL = { "on-track": "On Track", "at-risk": "At Risk", "critical": "Critical" };

function pushAction(item, text, owner, dueDate) {
  item.actions = item.actions || [];
  const a = {
    id: "a" + Date.now() + Math.floor(Math.random() * 1000),
    text, owner,
    dueDate: dueDate || "",
    created: new Date().toISOString().split("T")[0],
    status: "open",
    statusAtCreation: overallStatus(item),
  };
  item.actions.push(a);
  return a;
}

function resolveAction(item, actionId) {
  const a = (item.actions || []).find(x => x.id === actionId);
  if (a) {
    a.status = "resolved";
    a.resolvedDate = new Date().toISOString().split("T")[0];
    a.statusAtResolution = overallStatus(item);
  }
}

function actionsSectionHTML(item, type) {
  const actions  = item.actions || [];
  const open     = actions.filter(a => a.status !== "resolved");
  const resolved = actions.filter(a => a.status === "resolved");

  const openRow = a => `
    <div style="display:flex;align-items:flex-start;gap:8px;background:#fff;border:1px solid var(--grey-light);border-left:3px solid #D4A017;border-radius:8px;padding:8px 10px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.83rem;color:var(--grey-very-dark);">${a.text}</div>
        <div style="font-size:0.68rem;color:var(--grey-dark);margin-top:2px;">${a.owner} · raised ${a.created}${a.dueDate ? ` · due ${a.dueDate}` : ""} · was ${RAG_LABEL[a.statusAtCreation] || "—"}</div>
      </div>
      <button onclick="resolveItemAction('${type}',${item.id},'${a.id}')" style="background:none;border:1px solid var(--grey-light);border-radius:50px;padding:2px 10px;font-size:0.7rem;color:var(--primary);cursor:pointer;white-space:nowrap;">Mark done</button>
    </div>`;

  const resolvedRow = a => {
    const improved = a.statusAtCreation && a.statusAtResolution &&
      STATUS_RANK[a.statusAtResolution] < STATUS_RANK[a.statusAtCreation];
    const delta = (a.statusAtCreation && a.statusAtResolution)
      ? ` · ${RAG_LABEL[a.statusAtCreation]} → ${RAG_LABEL[a.statusAtResolution]}${improved ? " ↑" : ""}`
      : "";
    return `
    <div style="display:flex;align-items:flex-start;gap:8px;background:var(--grey-very-light);border:1px solid var(--grey-light);border-radius:8px;padding:8px 10px;opacity:0.92;">
      <span style="color:#2DB81F;font-size:0.9rem;line-height:1.2;">✓</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.83rem;color:var(--grey-very-dark);text-decoration:line-through;">${a.text}</div>
        <div style="font-size:0.68rem;color:var(--grey-dark);margin-top:2px;">${a.owner} · resolved ${a.resolvedDate}${delta}</div>
      </div>
    </div>`;
  };

  return `
    <div class="section-title" style="margin-top:1.1rem;">Follow-up actions${open.length ? ` (${open.length} open)` : ""}</div>
    <div class="d-flex flex-column gap-2">
      ${open.map(openRow).join("")}
      ${resolved.map(resolvedRow).join("")}
      ${actions.length === 0 ? `<p style="font-size:0.8rem;color:var(--grey-dark);margin:0;">No follow-ups yet.</p>` : ""}
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;">
      <input id="actionInput-${type}-${item.id}" type="text" placeholder="Add a follow-up action…"
        onkeydown="if(event.key==='Enter')addItemAction('${type}',${item.id})"
        style="flex:1;border:1px solid var(--grey-light);border-radius:8px;padding:6px 10px;font-size:0.82rem;">
      <button onclick="addItemAction('${type}',${item.id})" style="background:var(--primary);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:0.8rem;font-weight:600;cursor:pointer;">Add</button>
    </div>`;
}

// ── Account / client roll-up ─────────────────────────────────────────────────
// Groups projects by their `account` and aggregates health per account. Overall
// is worst-of across the account's projects, so one critical project surfaces.
function accountRollup(projects) {
  const map = {};
  (projects || []).forEach(p => {
    const acc = p.account || "Unassigned";
    (map[acc] = map[acc] || []).push(p);
  });
  return Object.keys(map).sort().map(account => {
    const projs = map[account];
    const counts = { "on-track": 0, "at-risk": 0, "critical": 0 };
    projs.forEach(p => counts[overallStatus(p)]++);
    const overall = counts.critical ? "critical" : counts["at-risk"] ? "at-risk" : "on-track";
    return { account, projects: projs, counts, overall };
  });
}

// ── Personal wellbeing (private capacity flag) ───────────────────────────────
// Stored under its own key so a lead-page save of cpt_data never clobbers it.
const WELLBEING_KEY = "cpt_wellbeing";
const WELLBEING_LEVELS = [
  { key: "comfortable", label: "Comfortable", color: "#2DB81F" },
  { key: "stretched",   label: "Stretched",   color: "#D4A017" },
  { key: "at-capacity", label: "At capacity", color: "#B81F2D" },
];
function loadWellbeing() {
  try { return JSON.parse(localStorage.getItem(WELLBEING_KEY) || "{}") || {}; }
  catch (e) { return {}; }
}
function saveWellbeing(map) {
  try { localStorage.setItem(WELLBEING_KEY, JSON.stringify(map)); } catch (e) {}
}
function wellbeingLevel(key) { return WELLBEING_LEVELS.find(l => l.key === key) || null; }

// Projects and teams a person sits on.
function personItems(person, projects, teams) {
  const on = list => (list || []).filter(it => (it.people || []).some(p => p.name === person));
  return { projects: on(projects), teams: on(teams) };
}

// Distinct people across projects + teams, with the roles and items each is on.
function rosterPeople(projects, teams) {
  const map = {};
  const add = (item, type) => (item.people || []).forEach(p => {
    const e = map[p.name] = map[p.name] || { name: p.name, roles: new Set(), items: [] };
    e.roles.add(p.role);
    e.items.push({ type, id: item.id, name: item.name, role: p.role });
  });
  (projects || []).forEach(it => add(it, "project"));
  (teams || []).forEach(it => add(it, "team"));
  return Object.values(map)
    .map(e => ({ name: e.name, roles: [...e.roles], items: e.items }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Check-in entries authored by a person (anonymous entries excluded), newest first.
function personCheckinHistory(checkins, name) {
  const out = [];
  Object.keys(checkins || {}).forEach(key => {
    (checkins[key] || []).forEach(c => {
      if ((c.person || c.name) === name) out.push(Object.assign({ key }, c));
    });
  });
  return out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// Name of the project/team a check-in key refers to.
function itemNameForKey(key, projects, teams) {
  const [type, id] = (key || "").split("-");
  const list = type === "project" ? projects : teams;
  const it = (list || []).find(x => x.id === parseInt(id));
  return it ? it.name : key;
}
