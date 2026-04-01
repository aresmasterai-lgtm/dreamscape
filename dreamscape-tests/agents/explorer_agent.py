"""
ExplorerAgent — uses Claude reasoning to explore Dreamscape for edge cases,
unexpected behaviors, and security issues that scripted tests miss.
"""
import asyncio
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))

import aiohttp
from base_agent import BaseAgent
from blackboard import Blackboard, TestStatus


class ExplorerAgent(BaseAgent):

    def __init__(self, blackboard: Blackboard):
        super().__init__("ExplorerAgent", "creative security and edge case exploration expert", blackboard)
        self.base_url = "https://trydreamscape.com"

    async def run(self):
        self.log("🔭 Starting exploration and edge case discovery...")

        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={"User-Agent": "DreamscapeExplorer/1.0"},
        ) as session:

            # Discover edge cases using Claude reasoning
            edge_cases = self._plan_edge_cases()
            self.log(f"🔭 Exploring {len(edge_cases)} edge cases...")

            for case in edge_cases:
                await self._run_edge_case(session, case)
                await asyncio.sleep(0.3)  # polite rate

        # Synthesize all findings with Claude
        await self._synthesize_findings()

        await self.bb.signal("ExplorerAgent", "*", "done", {"agent": "ExplorerAgent"})
        self.log("🔭 Exploration complete")

    def _plan_edge_cases(self):
        """Ask Claude to generate edge cases based on the app's known behavior."""
        result = self.think_json(
            """Dreamscape is an AI art + print-on-demand platform at trydreamscape.com.
Key features: Dream AI image generation, Marketplace, Gallery, Stripe payments, Printful fulfillment.
Security concerns: auth middleware, rate limiting, image generation quotas, team seat limits.

Generate 8 specific HTTP-level edge case tests as JSON:
{
  "cases": [
    {
      "id": "string",
      "name": "string",
      "method": "GET|POST|OPTIONS",
      "path": "/api/...",
      "body": {} or null,
      "headers": {},
      "path_type": "green|red",
      "expect_status": [200] or [400, 401, 403, 429],
      "description": "what we're probing"
    }
  ]
}""",
            system="You are a security-focused QA engineer. Generate realistic, specific tests."
        )
        return result.get("cases", self._default_cases())

    def _default_cases(self):
        """Fallback cases if Claude generation fails."""
        return [
            {
                "id": "xss_prompt",
                "name": "XSS in prompt field rejected",
                "method": "POST",
                "path": "/api/dream",
                "body": {"messages": [{"role": "user", "content": "<script>alert('xss')</script>"}]},
                "headers": {},
                "path_type": "red",
                "expect_status": [400, 401, 403],
                "description": "Script injection in dream messages",
            },
            {
                "id": "oversized_payload",
                "name": "Oversized JSON payload handled",
                "method": "POST",
                "path": "/api/dream",
                "body": {"messages": [{"role": "user", "content": "A" * 50000}]},
                "headers": {},
                "path_type": "red",
                "expect_status": [400, 401, 403, 413, 429],
                "description": "50KB prompt payload",
            },
            {
                "id": "options_preflight",
                "name": "OPTIONS preflight returns CORS headers",
                "method": "OPTIONS",
                "path": "/api/generate-image",
                "body": None,
                "headers": {"Origin": "https://trydreamscape.com"},
                "path_type": "green",
                "expect_status": [200, 204],
                "description": "CORS preflight for image generation",
            },
            {
                "id": "malformed_json",
                "name": "Malformed JSON body returns 400",
                "method": "POST",
                "path": "/api/dream",
                "body": None,
                "headers": {"Content-Type": "application/json"},
                "raw_body": "{ not valid json !!!",
                "path_type": "red",
                "expect_status": [400, 401, 403, 500],
                "description": "Non-parseable JSON body",
            },
            {
                "id": "wrong_content_type",
                "name": "Wrong content-type on POST handled",
                "method": "POST",
                "path": "/api/notify-follow",
                "body": "targetUserId=test",
                "headers": {"Content-Type": "application/x-www-form-urlencoded"},
                "path_type": "red",
                "expect_status": [400, 401, 403, 415],
                "description": "Form-encoded body to JSON endpoint",
            },
        ]

    async def _run_edge_case(self, session: aiohttp.ClientSession, case: dict):
        test_id = case.get("id", "unknown")
        name    = case.get("name", "Unknown test")
        path    = case.get("path", "/")
        method  = case.get("method", "GET").upper()
        path_type = case.get("path_type", "red")
        expect  = case.get("expect_status", [200])
        headers = case.get("headers", {})
        t = time.monotonic()

        try:
            url  = f"{self.base_url}{path}"
            body = case.get("body")
            raw  = case.get("raw_body")

            if method == "GET":
                resp = await session.get(url, headers=headers)
            elif method == "OPTIONS":
                resp = await session.options(url, headers=headers)
            elif method == "POST":
                if raw is not None:
                    resp = await session.post(url, data=raw, headers=headers)
                elif body is not None:
                    resp = await session.post(url, json=body, headers=headers)
                else:
                    resp = await session.post(url, headers=headers)
            else:
                return

            async with resp:
                ms = int((time.monotonic() - t) * 1000)
                status = resp.status
                if status in expect:
                    await self.record(
                        test_id, name, "explorer", path_type,
                        TestStatus.GREEN, ms,
                        detail=f"HTTP {status} as expected"
                    )
                else:
                    await self.record(
                        test_id, name, "explorer", path_type,
                        TestStatus.RED, ms,
                        error=f"Expected {expect} but got {status}"
                    )
                    # Use Claude to analyze why this might be a problem
                    analysis = self.think(
                        f"""Test: {name}
Request: {method} {path}
Expected status: {expect}
Got status: {status}
Description: {case.get('description', '')}

In 2 sentences, explain if this is a security concern or just an API quirk."""
                    )
                    await self.finding("medium", f"Unexpected response: {name}", analysis)

        except Exception as e:
            ms = int((time.monotonic() - t) * 1000)
            await self.record(test_id, name, "explorer", path_type,
                              TestStatus.ERROR, ms, error=str(e))

    async def _synthesize_findings(self):
        """Use Claude to synthesize all red results into an executive summary."""
        results = await self.bb.get_results(status=TestStatus.RED)
        if not results:
            self.log("🔭 No red results to synthesize")
            return

        red_summary = "\n".join(
            f"- {r.name}: {r.error}" for r in results[:15]
        )

        analysis = self.think(
            f"""You are a QA lead reviewing test failures for Dreamscape (trydreamscape.com).

Failed tests:
{red_summary}

Write a brief executive summary (3-5 sentences) of:
1. The most critical issues
2. Likely root causes
3. Recommended fix priority""",
            system="You are a senior QA engineer. Be direct and actionable."
        )

        await self.bb.add_finding(
            "ExplorerAgent", "info",
            "Executive Summary of Test Failures",
            analysis
        )
        self.log(f"🔭 Synthesis complete:\n{analysis}")
