#!/usr/bin/env python3
"""
Dreamscape Test Orchestrator
═══════════════════════════════════════════════════════════════════
Runs the full multi-agent test swarm:
  PlannerAgent   → builds test plan from app knowledge
  APIAgent       → tests Netlify functions (green + red paths)
  UIAgent        → Playwright browser E2E tests
  ExplorerAgent  → AI-driven edge case discovery
  UnitTests      → pure function validation

Usage:
  python orchestrator.py [--url https://trydreamscape.com] [--report report.json]
"""
import asyncio
import json
import os
import sys
import time
import argparse
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "agents"))
sys.path.insert(0, str(Path(__file__).parent / "unit"))

from blackboard import Blackboard, TestStatus
from planner_agent import PlannerAgent
from api_agent import APIAgent
from ui_agent import UIAgent
from explorer_agent import ExplorerAgent
from test_functions import run_unit_tests


# ── ANSI colours ────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"
DIM    = "\033[2m"


def banner():
    print(f"""
{BOLD}{CYAN}
  ██████╗ ██████╗ ███████╗ █████╗ ███╗   ███╗███████╗ ██████╗ █████╗ ██████╗ ███████╗
  ██╔══██╗██╔══██╗██╔════╝██╔══██╗████╗ ████║██╔════╝██╔════╝██╔══██╗██╔══██╗██╔════╝
  ██║  ██║██████╔╝█████╗  ███████║██╔████╔██║███████╗██║     ███████║██████╔╝█████╗
  ██║  ██║██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║╚════██║██║     ██╔══██║██╔═══╝ ██╔══╝
  ██████╔╝██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████║╚██████╗██║  ██║██║     ███████╗
  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝     ╚══════╝
{RESET}{DIM}  Multi-Agent Test Swarm — Powered by Ares / Claude{RESET}
""")


async def run_swarm(base_url: str, report_path: str):
    banner()
    bb = Blackboard()
    await bb.mark_start()
    await bb.set_knowledge("base_url", base_url)

    print(f"{BOLD}Target:{RESET} {base_url}")
    print(f"{BOLD}Time:  {RESET} {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{DIM}{'─'*70}{RESET}\n")

    # ── Phase 1: Plan ────────────────────────────────────────────
    print(f"{CYAN}[1/4] PlannerAgent — building test plan...{RESET}")
    planner = PlannerAgent(bb, base_url)
    await planner.run()

    # ── Phase 2: Unit tests (fast, no network) ───────────────────
    print(f"\n{CYAN}[2/4] UnitTests — validating pure functions...{RESET}")
    await run_unit_tests(bb)

    # ── Phase 3: API + UI + Explorer in parallel ─────────────────
    print(f"\n{CYAN}[3/4] Agent swarm — API, UI, Explorer running in parallel...{RESET}")
    api_agent      = APIAgent(bb)
    ui_agent       = UIAgent(bb)
    explorer_agent = ExplorerAgent(bb)

    await asyncio.gather(
        api_agent.run(),
        ui_agent.run(),
        explorer_agent.run(),
    )

    # ── Phase 4: Final report ────────────────────────────────────
    await bb.mark_end()
    print(f"\n{CYAN}[4/4] Generating report...{RESET}\n")
    await print_report(bb)
    await save_report(bb, report_path)

    stats = await bb.get_stats()
    return stats["red"] == 0


async def print_report(bb: Blackboard):
    stats   = await bb.get_stats()
    results = await bb.get_results()
    findings = bb.findings

    total    = stats["total"]
    green    = stats["green"]
    red      = stats["red"]
    skipped  = stats.get("skipped", 0)
    errors   = stats.get("error", 0)
    duration = stats.get("duration_s", 0)

    pass_pct = round((green / total) * 100) if total > 0 else 0
    bar_green = "█" * (green * 20 // total) if total > 0 else ""
    bar_red   = "░" * ((total - green) * 20 // total) if total > 0 else ""

    print(f"{BOLD}{'═'*70}{RESET}")
    print(f"{BOLD}  DREAMSCAPE TEST RESULTS{RESET}")
    print(f"{'═'*70}")
    print(f"  {GREEN}{bar_green}{RED}{bar_red}{RESET}  {pass_pct}% passing")
    print()
    print(f"  {GREEN}✅ Green (passed):{RESET}  {green:>4}")
    print(f"  {RED}❌ Red   (failed):{RESET}  {red:>4}")
    print(f"  {YELLOW}⚠️  Error (infra): {RESET}  {errors:>4}")
    print(f"  {DIM}⏭  Skipped:        {RESET}  {skipped:>4}")
    print(f"  {DIM}📊 Total:           {RESET}  {total:>4}")
    print(f"  {DIM}⏱  Duration:        {RESET}  {duration}s")
    print(f"{'─'*70}")

    # Group by category
    categories = {}
    for r in results:
        categories.setdefault(r.category, []).append(r)

    for cat, items in categories.items():
        cat_green = sum(1 for i in items if i.status == TestStatus.GREEN)
        cat_red   = sum(1 for i in items if i.status == TestStatus.RED)
        icon = GREEN + "✓" + RESET if cat_red == 0 else RED + "✗" + RESET
        print(f"\n  {icon} {BOLD}{cat.upper()}{RESET}  ({cat_green}/{len(items)} passing)")
        for r in items:
            if r.status == TestStatus.GREEN:
                marker = f"{GREEN}  ✅{RESET}"
            elif r.status == TestStatus.RED:
                marker = f"{RED}  ❌{RESET}"
            elif r.status == TestStatus.SKIPPED:
                marker = f"{YELLOW}  ⏭{RESET}"
            else:
                marker = f"{YELLOW}  ⚠️{RESET}"

            path_tag = f"{DIM}[{r.path.upper()}]{RESET}"
            print(f"{marker} {path_tag} {r.name}  {DIM}{r.duration_ms}ms{RESET}")
            if r.error:
                print(f"      {RED}{DIM}↳ {r.error}{RESET}")
            if r.detail and r.status == TestStatus.GREEN:
                print(f"      {DIM}↳ {r.detail}{RESET}")

    # Findings
    if findings:
        print(f"\n{'─'*70}")
        print(f"\n  {BOLD}🔍 FINDINGS ({len(findings)}){RESET}")
        for f in findings:
            sev_color = RED if f["severity"] in ("critical","high") else YELLOW if f["severity"] == "medium" else DIM
            print(f"\n  {sev_color}[{f['severity'].upper()}]{RESET} {BOLD}{f['title']}{RESET}")
            # Wrap detail
            detail = f["detail"]
            for line in detail.split("\n")[:5]:
                print(f"    {DIM}{line}{RESET}")

    print(f"\n{'═'*70}")
    if red == 0:
        print(f"  {GREEN}{BOLD}🎉 ALL TESTS PASSING — Dreamscape is healthy!{RESET}")
    else:
        print(f"  {RED}{BOLD}⚠️  {red} test(s) failing — see red results above{RESET}")
    print(f"{'═'*70}\n")


async def save_report(bb: Blackboard, path: str):
    snapshot = await bb.snapshot()
    snapshot["generated_at"] = datetime.utcnow().isoformat()
    with open(path, "w") as f:
        json.dump(snapshot, f, indent=2)
    print(f"  📄 Full report saved → {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Dreamscape multi-agent test swarm")
    parser.add_argument("--url",    default="https://trydreamscape.com", help="Base URL")
    parser.add_argument("--report", default="reports/latest.json",       help="Report output path")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.report), exist_ok=True)

    all_green = asyncio.run(run_swarm(args.url, args.report))
    sys.exit(0 if all_green else 1)
