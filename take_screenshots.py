import asyncio
import os
from playwright.async_api import async_playwright

async def capture_followup(browser, is_mobile):
    viewport = {"width": 390, "height": 844} if is_mobile else {"width": 1280, "height": 800}
    user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1" if is_mobile else None
    
    page = await browser.new_page(viewport=viewport, user_agent=user_agent)
    prefix = "Mobile" if is_mobile else "Desktop"
    base_dir = f"/Users/juliencresus/Documents/GitHub/project-tracker-proto/screenshots/{prefix.lower()}"
    os.makedirs(base_dir, exist_ok=True)
    
    try:
        # Dashboard Follow-up Modal
        print(f"Capturing {prefix} Followup Modal...")
        await page.goto("http://localhost:3001/dashboard.html")
        await page.wait_for_timeout(1000)
        await page.evaluate("openFollowupModal()")
        await page.wait_for_timeout(500)
        await page.screenshot(path=f"{base_dir}/1b_Dashboard_Followup_Modal.png", full_page=True)
        await page.click(".modal.show .btn-close")
        await page.wait_for_timeout(500)
    except Exception as e:
        print(f"Error capturing {prefix}: {e}")
        
    await page.close()

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        await capture_followup(browser, is_mobile=False)
        await capture_followup(browser, is_mobile=True)
        await browser.close()
        print("Followup screenshots captured.")

if __name__ == "__main__":
    asyncio.run(main())
