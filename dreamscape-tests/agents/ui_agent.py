"""
UIAgent — Playwright browser automation for Dreamscape frontend.
Selectors calibrated to Dreamscape's actual React DOM structure.
"""
import asyncio
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))

from base_agent import BaseAgent
from blackboard import Blackboard, TestStatus
from playwright.async_api import async_playwright, Page


class UIAgent(BaseAgent):

    def __init__(self, blackboard: Blackboard):
        super().__init__("UIAgent", "frontend UI and browser automation testing expert", blackboard)
        self.base_url = "https://trydreamscape.com"

    async def run(self):
        self.log("🖥  Starting UI browser test suite...")

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])

            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="DreamscapeUIAgent/1.0 Playwright",
            )
            ctx.set_default_timeout(25000)
            page = await ctx.new_page()
            console_errors = []
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

            await self._test_home_loads(page)
            await self._test_gallery_loads(page)
            await self._test_gallery_tag_filter(page)
            await self._test_marketplace_loads(page)
            await self._test_marketplace_filter(page)
            await self._test_pricing_loads(page)
            await self._test_blog_loads(page)
            await self._test_nav_links(page)
            await self._test_product_bad_id(page)
            await self._test_404_redirect(page)
            await ctx.close()

            mobile_ctx = await browser.new_context(
                viewport={"width": 390, "height": 844},
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
                is_mobile=True,
            )
            mobile_ctx.set_default_timeout(25000)
            mobile_page = await mobile_ctx.new_page()
            # Inject age gate bypass BEFORE any navigation — runs on every page load
            await mobile_ctx.add_init_script("localStorage.setItem('ds_age_verified', '2000-01-01')")
            await self._test_mobile_create_page(mobile_page)
            await self._test_mobile_nav(mobile_page)
            await mobile_ctx.close()

            if console_errors:
                await self.finding("medium", f"{len(console_errors)} console errors",
                                   "\n".join(console_errors[:10]))

            await browser.close()

        await self.bb.signal("UIAgent", "*", "done", {"agent": "UIAgent"})
        self.log("🖥  UI tests complete")

    async def _go(self, page: Page, path: str, wait: int = 2000):
        await page.goto(f"{self.base_url}{path}", wait_until="domcontentloaded")
        # Bypass age gate — set localStorage key so the gate doesn't block tests
        await page.evaluate("() => { try { localStorage.setItem('ds_age_verified', '2000-01-01') } catch(e) {} }")
        # If age gate is still showing, reload to apply the bypass
        continue_btn = await page.query_selector("button:has-text('Continue')")
        if continue_btn:
            await page.reload(wait_until="domcontentloaded")
            await page.evaluate("() => { try { localStorage.setItem('ds_age_verified', '2000-01-01') } catch(e) {} }")
        await page.wait_for_timeout(wait)

    async def _test_home_loads(self, page: Page):
        t = time.monotonic()
        try:
            await self._go(page, "/")
            ms = int((time.monotonic() - t) * 1000)
            logo    = await page.query_selector("text=Dreamscape")
            content = await page.query_selector("h1, button, [class*='card']")
            ok = bool(logo and content)
            await self.record("home_load_green", "Home page loads",
                              "frontend", "green", TestStatus.GREEN if ok else TestStatus.RED, ms,
                              error=None if ok else f"logo={bool(logo)} content={bool(content)}")
        except Exception as e:
            await self.record("home_load_green", "Home page loads", "frontend", "green", TestStatus.ERROR, 0, error=str(e))

    async def _test_gallery_loads(self, page: Page):
        t = time.monotonic()
        try:
            await self._go(page, "/gallery")
            ms = int((time.monotonic() - t) * 1000)
            h1    = await page.query_selector("h1")
            title = await page.title()
            ok = bool(h1 and "Dreamscape" in title)
            await self.record("gallery_load_green", "Gallery page loads",
                              "frontend", "green", TestStatus.GREEN if ok else TestStatus.RED, ms,
                              detail=f"title={title}", error=None if ok else f"h1={bool(h1)}")
        except Exception as e:
            await self.record("gallery_load_green", "Gallery page loads", "frontend", "green", TestStatus.ERROR, 0, error=str(e))

    async def _test_gallery_tag_filter(self, page: Page):
        t = time.monotonic()
        try:
            await self._go(page, "/gallery", wait=3000)
            ms = int((time.monotonic() - t) * 1000)
            buttons = await page.query_selector_all("button")
            btn_texts = [(await b.inner_text()).strip() for b in buttons[:40]]
            has_filter = any(t in btn_texts for t in ["All", "✦ All", "My Art", "🎨 My Art"])
            await self.record("gallery_tag_filter_green", "Gallery filter buttons render",
                              "frontend", "green", TestStatus.GREEN if has_filter else TestStatus.RED, ms,
                              detail=f"Buttons: {btn_texts[:8]}",
                              error=None if has_filter else f"No filter buttons. Found: {btn_texts[:8]}")
        except Exception as e:
            await self.record("gallery_tag_filter_green", "Gallery filter buttons", "frontend", "green", TestStatus.ERROR, 0, error=str(e))

    async def _test_marketplace_loads(self, page: Page):
        t = time.monotonic()
        try:
            await self._go(page, "/marketplace", wait=3000)
            ms = int((time.monotonic() - t) * 1000)
            cards = await page.evaluate("() => document.querySelectorAll('[class*=\"ds-card\"], [class*=\"card\"]').length")
            prices = await page.query_selector_all("text=/$")
            ok = cards > 0 or len(prices) > 0
            await self.record("marketplace_green", "Marketplace loads with products",
                              "frontend", "green", TestStatus.GREEN if ok else TestStatus.RED, ms,
                              detail=f"cards={cards}", error=None if ok else "No product cards found")
        except Exception as e:
            await self.record("marketplace_green", "Marketplace loads", "frontend", "green", TestStatus.ERROR, 0, error=str(e))

    async def _test_marketplace_filter(self, page: Page):
        t = time.monotonic()
        try:
            await self._go(page, "/marketplace", wait=3000)
            ms = int((time.monotonic() - t) * 1000)
            buttons = await page.query_selector_all("button")
            btn_texts = [(await b.inner_text()).strip() for b in buttons[:50]]
            found = [f for f in ["T-Shirt", "Hoodie", "Poster", "Canvas", "Mug", "All"] if f in btn_texts]
            ok = len(found) > 0
            await self.record("marketplace_filter_green", "Marketplace product type filters",
                              "frontend", "green", TestStatus.GREEN if ok else TestStatus.RED, ms,
                              detail=f"Found filters: {found}",
                              error=None if ok else f"No product type filters. Buttons: {btn_texts[:12]}")
        except Exception as e:
            await self.record("marketplace_filter_green", "Marketplace filters", "frontend", "green", TestStatus.ERROR, 0, error=str(e))

    async def _test_pricing_loads(self, page: Page):
        t = time.monotonic()
        try:
            await self._go(page, "/pricing", wait=2000)
            ms = int((time.monotonic() - t) * 1000)
            tiers = [t for t in ["Free", "Starter", "Pro", "Studio", "Merchant"] if await page.query_selector(f"text={t}")]
            ok = len(tiers) >= 3
            await self.record("pricing_load_green", "Pricing page shows tiers",
                              "frontend", "green", TestStatus.GREEN if ok else TestStatus.RED, ms,
                              detail=f"Found: {tiers}", error=None if ok else f"Only found: {tiers}")
        except Exception as e:
            await self.record("pricing_load_green", "Pricing page", "frontend", "green", TestStatus.ERROR, 0, error=str(e))

    async def _test_blog_loads(self, page: Page):
        t = time.monotonic()
        try:
            await self._go(page, "/blog", wait=2000)
            ms = int((time.monotonic() - t) * 1000)
            h1 = await page.query_selector("h1")
            await self.record("blog_load_green", "Blog page loads",
                              "frontend", "green", TestStatus.GREEN if h1 else TestStatus.RED, ms,
                              error=None if h1 else "No h1 on blog page")
        except Exception as e:
            await self.record("blog_load_green", "Blog page loads", "frontend", "green", TestStatus.ERROR, 0, error=str(e))

    async def _test_nav_links(self, page: Page):
        t = time.monotonic()
        try:
            await self._go(page, "/")
            ms = int((time.monotonic() - t) * 1000)
            found, missing = [], []
            for label in ["Gallery", "Marketplace", "Create", "Pricing"]:
                el = await page.query_selector(f"a:has-text('{label}')")
                (found if el else missing).append(label)
            ok = not missing
            await self.record("nav_links_green", "Nav links present",
                              "frontend", "green", TestStatus.GREEN if ok else TestStatus.RED, ms,
                              detail=f"Found: {found}", error=None if ok else f"Missing: {missing}")
        except Exception as e:
            await self.record("nav_links_green", "Nav links", "frontend", "green", TestStatus.ERROR, 0, error=str(e))

    async def _test_product_bad_id(self, page: Page):
        t = time.monotonic()
        try:
            await self._go(page, "/product/00000000-0000-0000-0000-000000000000", wait=3000)
            ms = int((time.monotonic() - t) * 1000)
            body = (await page.inner_text("body")).lower()
            ok = any(p in body for p in ["not found", "browse marketplace", "doesn't exist"])
            await self.record("invalid_product_red", "Bad product ID shows not-found",
                              "frontend", "red", TestStatus.GREEN if ok else TestStatus.RED, ms,
                              error=None if ok else "No not-found message for invalid product ID")
        except Exception as e:
            await self.record("invalid_product_red", "Bad product ID", "frontend", "red", TestStatus.ERROR, 0, error=str(e))

    async def _test_404_redirect(self, page: Page):
        t = time.monotonic()
        try:
            await self._go(page, "/this-does-not-exist-xyz999", wait=2000)
            ms = int((time.monotonic() - t) * 1000)
            body = await page.inner_text("body")
            ok = len(body.strip()) > 100 and "dreamscape" in body.lower()
            await self.record("404_redirect_red", "Unknown routes render SPA",
                              "frontend", "red", TestStatus.GREEN if ok else TestStatus.RED, ms,
                              error=None if ok else "Unknown route returned blank page")
        except Exception as e:
            await self.record("404_redirect_red", "Unknown routes", "frontend", "red", TestStatus.ERROR, 0, error=str(e))

    async def _test_mobile_create_page(self, page: Page):
        t = time.monotonic()
        try:
            await page.goto(f"{self.base_url}/create", wait_until="domcontentloaded")
            await page.evaluate("() => { try { localStorage.setItem('ds_age_verified', '2000-01-01') } catch(e) {} }")
            continue_btn = await page.query_selector("button:has-text('Continue')")
            if continue_btn:
                await page.reload(wait_until="domcontentloaded")
                await page.evaluate("() => { try { localStorage.setItem('ds_age_verified', '2000-01-01') } catch(e) {} }")
            await page.wait_for_timeout(3000)
            ms = int((time.monotonic() - t) * 1000)
            inp = await page.query_selector("input[type='text'], input:not([type]), textarea")
            if inp:
                fs = await page.evaluate("el => parseFloat(window.getComputedStyle(el).fontSize)", inp)
                ok = fs >= 16
                await self.record("mobile_create_green", f"Mobile input font {fs}px {'≥' if ok else '<'} 16px",
                                  "frontend", "green", TestStatus.GREEN if ok else TestStatus.RED, ms,
                                  error=None if ok else f"{fs}px causes iOS auto-zoom")
            else:
                signin = await page.query_selector("text=/sign in/i")
                await self.record("mobile_create_green", "Mobile create — sign-in wall shown",
                                  "frontend", "green", TestStatus.GREEN if signin else TestStatus.RED, ms,
                                  detail="Unauthed users see sign-in correctly" if signin else None,
                                  error=None if signin else "No input or sign-in found")
        except Exception as e:
            await self.record("mobile_create_green", "Mobile create page", "frontend", "green", TestStatus.ERROR, 0, error=str(e))

    async def _test_mobile_nav(self, page: Page):
        t = time.monotonic()
        try:
            await page.goto(f"{self.base_url}/", wait_until="domcontentloaded")
            await page.evaluate("() => { try { localStorage.setItem('ds_age_verified', '2000-01-01') } catch(e) {} }")
            continue_btn = await page.query_selector("button:has-text('Continue')")
            if continue_btn:
                await page.reload(wait_until="domcontentloaded")
                await page.evaluate("() => { try { localStorage.setItem('ds_age_verified', '2000-01-01') } catch(e) {} }")
            await page.wait_for_timeout(2000)
            ms = int((time.monotonic() - t) * 1000)
            h = (await page.query_selector(".mobile-menu-btn") or
                 await page.query_selector("button:has-text('☰')") or
                 await page.query_selector("[class*='mobile-menu']"))
            if h:
                vis = await h.is_visible()
                await self.record("mobile_nav_green", "Mobile hamburger visible",
                                  "frontend", "green", TestStatus.GREEN if vis else TestStatus.RED, ms)
            else:
                btns = [(await b.inner_text()).strip() for b in await page.query_selector_all("button")][:10]
                await self.record("mobile_nav_green", "Mobile hamburger visible",
                                  "frontend", "green", TestStatus.RED, ms,
                                  error=f"Hamburger not found. Buttons: {btns}")
        except Exception as e:
            await self.record("mobile_nav_green", "Mobile nav", "frontend", "green", TestStatus.ERROR, 0, error=str(e))
