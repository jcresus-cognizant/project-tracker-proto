import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("console", msg => console.log("PAGE LOG:", msg.type(), msg.text()));
  page.on("pageerror", err => console.log("PAGE ERROR:", err));
  await page.goto("http://localhost:8123/member.html");
  await page.waitForTimeout(1000);
  await browser.close();
  process.exit(0);
})();
