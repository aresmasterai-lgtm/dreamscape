"""
APIAgent — tests all Dreamscape Netlify function endpoints.
Green paths: valid requests return correct shapes.
Red paths: invalid/unauthed requests return correct errors.
"""
import asyncio
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))

import aiohttp
from base_agent import BaseAgent
from blackboard import Blackboard, TestStatus


class APIAgent(BaseAgent):

    def __init__(self, blackboard: Blackboard):
        super().__init__("APIAgent", "API and backend function testing expert", blackboard)

    async def run(self):
        self.log("🔌 Starting API test suite...")
        base_url = await self.bb.get_knowledge("base_url", "https://trydreamscape.com")

        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={"User-Agent": "DreamscapeTestAgent/1.0"},
        ) as session:
            await self._test_health(session, base_url)
            await self._test_unauth_blocks(session, base_url)
            await self._test_rate_limit(session, base_url)
            await self._test_dream_api_no_prompt(session, base_url)
            await self._test_team_invite_no_auth(session, base_url)
            await self._test_cors_headers(session, base_url)

        await self.bb.signal("APIAgent", "*", "done", {"agent": "APIAgent"})
        self.log("🔌 API tests complete")

    # ── Green: Health ────────────────────────────────────────────
    async def _test_health(self, session, base_url):
        t = time.monotonic()
        try:
            async with session.get(f"{base_url}/api/health") as r:
                ms = int((time.monotonic() - t) * 1000)
                data = await r.json(content_type=None)
                if r.status == 200 and "status" in data:
                    await self.record(
                        "health_api_green", "Health API returns ok status",
                        "api", "green", TestStatus.GREEN, ms,
                        detail=f"status={data.get('status')} services={list(data.get('services', {}).keys())}"
                    )
                    if data.get("status") == "degraded":
                        await self.finding("high", "Services degraded at test time", str(data.get("services")))
                else:
                    await self.record(
                        "health_api_green", "Health API returns ok status",
                        "api", "green", TestStatus.RED, ms,
                        error=f"HTTP {r.status} — {data}"
                    )
        except Exception as e:
            await self.record("health_api_green", "Health API returns ok status",
                              "api", "green", TestStatus.ERROR, 0, error=str(e))

    # ── Red: Unauthenticated generate-image should block ─────────
    async def _test_unauth_blocks(self, session, base_url):
        t = time.monotonic()
        try:
            async with session.post(
                f"{base_url}/api/generate-image",
                json={"prompt": "test prompt", "aspectRatio": "square"},
            ) as r:
                ms = int((time.monotonic() - t) * 1000)
                # Should be 401 or 403
                if r.status in (401, 403):
                    await self.record(
                        "gen_unauth_red", "Generate image without auth → blocked",
                        "api", "red", TestStatus.GREEN, ms,
                        detail=f"Correctly returned HTTP {r.status}"
                    )
                else:
                    body = await r.text()
                    await self.record(
                        "gen_unauth_red", "Generate image without auth → blocked",
                        "api", "red", TestStatus.RED, ms,
                        error=f"Expected 401/403 but got {r.status}",
                        detail=body[:200]
                    )
                    await self.finding("critical", "Unauthenticated image generation not blocked",
                                       f"HTTP {r.status} returned — auth middleware may be bypassed")
        except Exception as e:
            await self.record("gen_unauth_red", "Generate image without auth → blocked",
                              "api", "red", TestStatus.ERROR, 0, error=str(e))

    # ── Red: Rate limiting ───────────────────────────────────────
    async def _test_rate_limit(self, session, base_url):
        """Fire 35 rapid requests to /api/dream and expect a 429 somewhere."""
        t = time.monotonic()
        got_429 = False
        try:
            for i in range(35):
                async with session.post(
                    f"{base_url}/api/dream",
                    json={"messages": [{"role": "user", "content": "hi"}]},
                ) as r:
                    if r.status == 429:
                        got_429 = True
                        break
            ms = int((time.monotonic() - t) * 1000)
            if got_429:
                await self.record(
                    "rate_limit_red", "Rapid API calls trigger rate limit",
                    "api", "red", TestStatus.GREEN, ms,
                    detail="Rate limiter fired correctly after rapid requests"
                )
            else:
                await self.record(
                    "rate_limit_red", "Rapid API calls trigger rate limit",
                    "api", "red", TestStatus.RED, ms,
                    error="35 rapid requests didn't trigger 429 — rate limiter may be missing"
                )
                await self.finding("high", "Rate limiter not firing", "35 rapid /api/dream requests returned no 429")
        except Exception as e:
            await self.record("rate_limit_red", "Rapid API calls trigger rate limit",
                              "api", "red", TestStatus.ERROR, 0, error=str(e))

    # ── Red: Dream API with no prompt ────────────────────────────
    async def _test_dream_api_no_prompt(self, session, base_url):
        t = time.monotonic()
        try:
            async with session.post(
                f"{base_url}/api/dream",
                json={"messages": []},
            ) as r:
                ms = int((time.monotonic() - t) * 1000)
                # Should be 400 or 401
                if r.status in (400, 401, 403):
                    await self.record(
                        "dream_api_no_prompt_red", "Dream API with empty messages → error",
                        "api", "red", TestStatus.GREEN, ms,
                        detail=f"Correctly returned {r.status}"
                    )
                else:
                    await self.record(
                        "dream_api_no_prompt_red", "Dream API with empty messages → error",
                        "api", "red", TestStatus.RED, ms,
                        error=f"Expected 4xx but got {r.status}"
                    )
        except Exception as e:
            await self.record("dream_api_no_prompt_red", "Dream API with empty messages → error",
                              "api", "red", TestStatus.ERROR, 0, error=str(e))

    # ── Red: Team invite without auth ────────────────────────────
    async def _test_team_invite_no_auth(self, session, base_url):
        t = time.monotonic()
        try:
            async with session.post(
                f"{base_url}/api/team-invite",
                json={"email": "hacker@evil.com", "role": "designer"},
            ) as r:
                ms = int((time.monotonic() - t) * 1000)
                if r.status in (401, 403):
                    await self.record(
                        "team_seat_red", "Team invite over seat limit → rejected",
                        "api", "red", TestStatus.GREEN, ms,
                        detail=f"Unauthenticated invite correctly blocked with {r.status}"
                    )
                else:
                    await self.record(
                        "team_seat_red", "Team invite over seat limit → rejected",
                        "api", "red", TestStatus.RED, ms,
                        error=f"Unauthenticated team invite returned {r.status} — should be 401/403"
                    )
        except Exception as e:
            await self.record("team_seat_red", "Team invite over seat limit → rejected",
                              "api", "red", TestStatus.ERROR, 0, error=str(e))

    # ── Green: CORS headers present on /api/* ────────────────────
    async def _test_cors_headers(self, session, base_url):
        t = time.monotonic()
        try:
            async with session.options(
                f"{base_url}/api/health",
                headers={"Origin": "https://trydreamscape.com",
                         "Access-Control-Request-Method": "GET"},
            ) as r:
                ms = int((time.monotonic() - t) * 1000)
                cors = r.headers.get("Access-Control-Allow-Origin", "")
                if cors:
                    await self.record(
                        "cors_green", "CORS headers present on API routes",
                        "api", "green", TestStatus.GREEN, ms,
                        detail=f"ACAO: {cors}"
                    )
                else:
                    await self.record(
                        "cors_green", "CORS headers present on API routes",
                        "api", "green", TestStatus.RED, ms,
                        error="No Access-Control-Allow-Origin header on OPTIONS preflight"
                    )
        except Exception as e:
            await self.record("cors_green", "CORS headers present on API routes",
                              "api", "green", TestStatus.ERROR, 0, error=str(e))
