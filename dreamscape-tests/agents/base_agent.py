"""
Base Agent — all Dreamscape test agents inherit from this.
Provides: Claude API access, blackboard comms, structured output helpers.
"""
import asyncio
import json
import os
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

import anthropic

from blackboard import Blackboard, TestResult, TestStatus


class BaseAgent(ABC):
    """
    Every agent has:
      - A name and specialty description
      - Access to the blackboard (shared state)
      - Access to Claude (via Anthropic API) for reasoning
      - Helpers for recording test results
    """

    MODEL = "claude-sonnet-4-6"

    def __init__(self, name: str, specialty: str, blackboard: Blackboard):
        self.name       = name
        self.specialty  = specialty
        self.bb         = blackboard
        self._api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        self.client = anthropic.Anthropic(api_key=self._api_key) if self._api_key else None
        self._log_lines: List[str] = []

    def log(self, msg: str):
        line = f"[{self.name}] {msg}"
        self._log_lines.append(line)
        print(line)

    # ── Claude reasoning ─────────────────────────────────────────
    def think(self, prompt: str, system: Optional[str] = None, max_tokens: int = 1500) -> str:
        """Synchronous Claude call for reasoning / analysis."""
        messages = [{"role": "user", "content": prompt}]
        sys = system or f"You are {self.name}, a {self.specialty}. Be concise and precise."
        if not self.client: return ""
        resp = self.client.messages.create(
            model=self.MODEL,
            max_tokens=max_tokens,
            system=sys,
            messages=messages,
        )
        return resp.content[0].text if resp.content else ""

    def think_json(self, prompt: str, system: Optional[str] = None) -> Dict:
        """Claude call that returns parsed JSON."""
        sys = (system or "") + "\n\nRespond ONLY with valid JSON. No markdown, no backticks, no explanation."
        raw = self.think(prompt, system=sys, max_tokens=2000)
        # Strip any accidental backticks
        raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"error": "Failed to parse JSON", "raw": raw}

    # ── Result helpers ───────────────────────────────────────────
    async def record(
        self,
        test_id: str,
        name: str,
        category: str,
        path: str,
        status: TestStatus,
        duration_ms: int = 0,
        error: Optional[str] = None,
        detail: Optional[str] = None,
    ):
        result = TestResult(
            id=test_id,
            name=name,
            category=category,
            path=path,
            status=status,
            duration_ms=duration_ms,
            error=error,
            detail=detail,
            agent=self.name,
        )
        await self.bb.add_result(result)
        icon = "✅" if status == TestStatus.GREEN else "❌" if status == TestStatus.RED else "⚠️"
        self.log(f"{icon} [{path.upper()}] {name} — {status.value} ({duration_ms}ms)")
        if error:
            self.log(f"   ↳ {error}")

    async def finding(self, severity: str, title: str, detail: str):
        await self.bb.add_finding(self.name, severity, title, detail)
        self.log(f"🔍 FINDING [{severity.upper()}]: {title}")

    # ── Lifecycle ────────────────────────────────────────────────
    @abstractmethod
    async def run(self):
        """Main entry point for this agent."""
        ...
