import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:8123";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const log = [];
async function go(file, url, { full = true, action } = {}) {
  await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  if (action) { await action(); await page.waitForTimeout(500); }
  const path = `${OUT}/${file}`;
  await page.screenshot({ path, fullPage: full });
  log.push(`${file}  ←  ${url}${action ? " (action)" : ""}`);
  console.log("✓", file);
}

// ── Login / role chooser ────────────────────────────────────────────────
await go("01-login.png", "login.html");
await go("02-welcome.png", "index.html");

// ── Dashboard (lead) ────────────────────────────────────────────────────
await go("03-dashboard.png", "dashboard.html");
await go("04-dashboard-add-modal.png", "dashboard.html", {
  full: false, action: () => page.evaluate(() => openAddModal()),
});
await go("05-dashboard-checkin-modal.png", "dashboard.html", {
  full: false, action: () => page.evaluate(() => openCheckinModal()),
});
await go("06-dashboard-detail-drawer.png", "dashboard.html", {
  full: false, action: () => page.evaluate(() => openDetail(2, "project")), // Helix (has actions + at-risk)
});

// ── Projects ────────────────────────────────────────────────────────────
await go("07-projects.png", "projects.html");
await go("08-projects-detail-drawer.png", "projects.html", {
  full: false, action: () => page.evaluate(() => openDrawer(2)),
});

// ── Teams ───────────────────────────────────────────────────────────────
await go("09-teams.png", "teams.html");
await go("10-teams-detail-drawer.png", "teams.html", {
  full: false, action: () => page.evaluate(() => openDrawer(3)), // Research & Insights (critical morale)
});

// ── People (1:1 view) ───────────────────────────────────────────────────
await go("11-people.png", "people.html");
await go("12-people-person-selected.png", "people.html", {
  full: true, action: () => page.evaluate(() => selectPerson("Jordan Lee")),
});

// ── Settings (configurable dimensions) ──────────────────────────────────
await go("13-settings.png", "settings.html");

// ── Member (team-member self check-in) ──────────────────────────────────
await go("14-member.png", "member.html");

await browser.close();
console.log("\n--- captured ---\n" + log.join("\n"));
