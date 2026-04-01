"""
PlannerAgent — reads Dreamscape source, maps routes/APIs/components,
builds a comprehensive test plan on the blackboard for all other agents.
"""
import asyncio
import re
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from base_agent import BaseAgent
from blackboard import Blackboard


class PlannerAgent(BaseAgent):

    ROUTES = [
        {"path": "/",           "name": "Discover / Home Feed",  "auth": False},
        {"path": "/gallery",    "name": "Gallery",               "auth": False},
        {"path": "/marketplace","name": "Marketplace",           "auth": False},
        {"path": "/create",     "name": "Create (Dream AI)",     "auth": True},
        {"path": "/profile",    "name": "Profile",               "auth": True},
        {"path": "/pricing",    "name": "Pricing",               "auth": False},
        {"path": "/blog",       "name": "Blog",                  "auth": False},
        {"path": "/orders",     "name": "Orders",                "auth": True},
    ]

    API_ENDPOINTS = [
        {"path": "/api/health",            "method": "GET",  "auth": False},
        {"path": "/api/generate-image",    "method": "POST", "auth": True},
        {"path": "/api/dream",             "method": "POST", "auth": True},
        {"path": "/api/printful",          "method": "GET",  "auth": True},
        {"path": "/api/create-checkout",   "method": "POST", "auth": True},
        {"path": "/api/connect-status",    "method": "POST", "auth": True},
        {"path": "/api/notify-follow",     "method": "POST", "auth": True},
        {"path": "/api/team-invite",       "method": "POST", "auth": True},
        {"path": "/api/remove-background", "method": "POST", "auth": True},
        {"path": "/api/payout-trigger",    "method": "POST", "auth": True},
    ]

    CRITICAL_FLOWS = [
        # Green paths (happy paths)
        {"id": "gen_image_green",     "name": "Generate image successfully",        "path": "green", "agent": "ExplorerAgent"},
        {"id": "publish_art_green",   "name": "Publish artwork to gallery",         "path": "green", "agent": "UIAgent"},
        {"id": "sell_product_green",  "name": "Create product from artwork",        "path": "green", "agent": "UIAgent"},
        {"id": "marketplace_green",   "name": "Browse and filter marketplace",      "path": "green", "agent": "UIAgent"},
        {"id": "profile_load_green",  "name": "Profile page loads with artwork",    "path": "green", "agent": "UIAgent"},
        {"id": "gallery_load_green",  "name": "Gallery loads and filters by tag",   "path": "green", "agent": "UIAgent"},
        {"id": "health_api_green",    "name": "Health API returns ok status",       "path": "green", "agent": "APIAgent"},
        {"id": "pricing_load_green",  "name": "Pricing page renders all tiers",     "path": "green", "agent": "UIAgent"},
        {"id": "dream_api_green",     "name": "Dream AI responds to message",       "path": "green", "agent": "APIAgent"},
        # Red paths (failure / edge cases)
        {"id": "gen_unauth_red",      "name": "Generate image without auth → blocked",  "path": "red",   "agent": "APIAgent"},
        {"id": "broken_img_red",      "name": "Broken image triggers fallback not flag", "path": "red",  "agent": "UIAgent"},
        {"id": "chunk_error_red",     "name": "Stale chunk triggers auto-reload",        "path": "red",   "agent": "ExplorerAgent"},
        {"id": "invalid_product_red", "name": "Product page with bad ID shows 404",      "path": "red",   "agent": "UIAgent"},
        {"id": "team_seat_red",       "name": "Team invite over seat limit → rejected",  "path": "red",   "agent": "APIAgent"},
        {"id": "rate_limit_red",      "name": "Rapid API calls trigger rate limit",      "path": "red",   "agent": "APIAgent"},
    ]

    def __init__(self, blackboard: Blackboard, base_url: str = "https://trydreamscape.com"):
        super().__init__("PlannerAgent", "test planning and app architecture analysis expert", blackboard)
        self.base_url = base_url

    async def run(self):
        self.log("📋 Building test plan from app knowledge...")

        # Write routes, endpoints, flows to blackboard
        await self.bb.set_knowledge("routes",        self.ROUTES)
        await self.bb.set_knowledge("api_endpoints", self.API_ENDPOINTS)
        await self.bb.set_knowledge("base_url",      self.base_url)

        # Use Claude to enrich the plan with risk analysis
        plan_json = self.think_json(
            f"""You are planning a test suite for Dreamscape (trydreamscape.com), an AI art + print-on-demand platform.

Known critical flows:
{self._flows_summary()}

Analyze these flows and for each one output a JSON array of test tasks:
{{
  "tasks": [
    {{
      "id": "<flow id>",
      "name": "<flow name>",
      "path": "green" or "red",
      "agent": "<agent name>",
      "priority": 1-5,
      "risk": "why this could fail",
      "assertion": "what success looks like"
    }}
  ]
}}""",
            system="You are a senior QA architect. Output only valid JSON."
        )

        tasks = plan_json.get("tasks", self.CRITICAL_FLOWS)
        await self.bb.set_plan(tasks)
        self.log(f"📋 Plan ready — {len(tasks)} test tasks across {len(self.ROUTES)} routes, {len(self.API_ENDPOINTS)} endpoints")

        # Signal all agents plan is ready
        await self.bb.signal("PlannerAgent", "*", "plan_ready", {"task_count": len(tasks)})

    def _flows_summary(self) -> str:
        return "\n".join(f"- [{f['path'].upper()}] {f['name']}" for f in self.CRITICAL_FLOWS)
