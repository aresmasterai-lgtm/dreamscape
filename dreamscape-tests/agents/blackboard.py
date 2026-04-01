"""
Dreamscape Blackboard System
────────────────────────────
Central shared state store for all test agents.
Agents READ knowledge, WRITE findings, SIGNAL each other.
"""
import asyncio
import json
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime


class TestStatus(str, Enum):
    PENDING  = "pending"
    RUNNING  = "running"
    GREEN    = "green"   # passed
    RED      = "red"     # failed
    SKIPPED  = "skipped"
    ERROR    = "error"   # agent/infra error


@dataclass
class TestResult:
    id:          str
    name:        str
    category:    str          # unit | frontend | e2e | agent
    path:        str          # green | red
    status:      TestStatus   = TestStatus.PENDING
    duration_ms: int          = 0
    error:       Optional[str] = None
    detail:      Optional[str] = None
    agent:       Optional[str] = None
    timestamp:   str          = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self):
        d = asdict(self)
        d['status'] = self.status.value
        return d


@dataclass
class AgentSignal:
    from_agent:  str
    to_agent:    str          # '*' = broadcast
    signal_type: str          # 'block_discovered' | 'route_ready' | 'finding' | 'done'
    payload:     Dict         = field(default_factory=dict)
    timestamp:   str          = field(default_factory=lambda: datetime.utcnow().isoformat())


class Blackboard:
    """
    Thread-safe shared knowledge base for the Dreamscape test swarm.
    
    Structure:
      knowledge   — what we know about the app (routes, API endpoints, components)
      results     — all test results accumulated so far
      signals     — agent-to-agent messages (queue)
      findings    — interesting discoveries (bugs, anomalies)
      plan        — ordered list of test tasks
      stats       — running totals
    """

    def __init__(self):
        self._lock = asyncio.Lock()

        # Knowledge written by PlannerAgent from app introspection
        self.knowledge: Dict[str, Any] = {
            "routes":     [],
            "api_endpoints": [],
            "components":  [],
            "test_users":  {},
            "base_url":    "https://trydreamscape.com",
        }

        # Test results from all agents
        self.results: List[TestResult] = []

        # Signal queue for inter-agent comms
        self.signals: asyncio.Queue = asyncio.Queue()

        # Bugs / anomalies discovered
        self.findings: List[Dict] = []

        # Planned tasks (populated by PlannerAgent)
        self.plan: List[Dict] = []

        # Running stats
        self.stats = {
            "total": 0, "green": 0, "red": 0,
            "skipped": 0, "error": 0,
            "start_time": None, "end_time": None,
        }

    # ── Knowledge ────────────────────────────────────────────────
    async def set_knowledge(self, key: str, value: Any):
        async with self._lock:
            self.knowledge[key] = value

    async def get_knowledge(self, key: str, default=None):
        async with self._lock:
            return self.knowledge.get(key, default)

    # ── Results ──────────────────────────────────────────────────
    async def add_result(self, result: TestResult):
        async with self._lock:
            self.results.append(result)
            self.stats["total"] += 1
            if result.status == TestStatus.GREEN:
                self.stats["green"] += 1
            elif result.status == TestStatus.RED:
                self.stats["red"] += 1
            elif result.status == TestStatus.SKIPPED:
                self.stats["skipped"] += 1
            elif result.status == TestStatus.ERROR:
                self.stats["error"] += 1

    async def get_results(self, category: Optional[str] = None, status: Optional[TestStatus] = None):
        async with self._lock:
            r = self.results
            if category:
                r = [x for x in r if x.category == category]
            if status:
                r = [x for x in r if x.status == status]
            return list(r)

    # ── Signals ──────────────────────────────────────────────────
    async def signal(self, from_agent: str, to_agent: str, signal_type: str, payload: Dict = {}):
        sig = AgentSignal(from_agent, to_agent, signal_type, payload)
        await self.signals.put(sig)

    async def next_signal(self, for_agent: str, timeout: float = 5.0) -> Optional[AgentSignal]:
        """Get next signal addressed to this agent (or broadcast)."""
        try:
            sig = await asyncio.wait_for(self.signals.get(), timeout=timeout)
            if sig.to_agent in (for_agent, '*'):
                return sig
            # Not for us — put back
            await self.signals.put(sig)
            return None
        except asyncio.TimeoutError:
            return None

    # ── Findings ─────────────────────────────────────────────────
    async def add_finding(self, agent: str, severity: str, title: str, detail: str):
        async with self._lock:
            self.findings.append({
                "agent": agent,
                "severity": severity,   # critical | high | medium | low
                "title": title,
                "detail": detail,
                "timestamp": datetime.utcnow().isoformat(),
            })

    # ── Plan ─────────────────────────────────────────────────────
    async def set_plan(self, tasks: List[Dict]):
        async with self._lock:
            self.plan = tasks

    async def get_plan(self):
        async with self._lock:
            return list(self.plan)

    # ── Stats ────────────────────────────────────────────────────
    async def mark_start(self):
        async with self._lock:
            self.stats["start_time"] = time.time()

    async def mark_end(self):
        async with self._lock:
            self.stats["end_time"] = time.time()

    async def get_stats(self):
        async with self._lock:
            s = dict(self.stats)
            if s["start_time"] and s["end_time"]:
                s["duration_s"] = round(s["end_time"] - s["start_time"], 1)
            return s

    # ── Snapshot ─────────────────────────────────────────────────
    async def snapshot(self) -> Dict:
        """Full state dump for reporting."""
        async with self._lock:
            return {
                "knowledge": self.knowledge,
                "results":   [r.to_dict() for r in self.results],
                "findings":  self.findings,
                "stats":     self.stats,
                "plan":      self.plan,
            }
