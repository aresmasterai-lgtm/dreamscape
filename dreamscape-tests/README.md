# Dreamscape Test Swarm

Multi-agent TDD test suite for trydreamscape.com.
Powered by Ares (Claude) orchestrating specialist agents.

## Architecture

```
orchestrator.py          ← Entry point, runs all agents
│
├── agents/
│   ├── blackboard.py    ← Shared state / inter-agent comms
│   ├── base_agent.py    ← Base class (Claude reasoning + result helpers)
│   ├── planner_agent.py ← Maps routes/APIs, builds test plan
│   ├── api_agent.py     ← Tests all Netlify functions (green + red)
│   ├── ui_agent.py      ← Playwright browser E2E tests
│   └── explorer_agent.py← AI-driven edge case discovery
│
└── unit/
    └── test_functions.py ← Pure function unit tests (no network)
```

## Quick Start

```bash
# Install dependencies
pip install anthropic playwright aiohttp rich
python -m playwright install chromium

# Run full suite (set your API key for AI-powered exploration)
export ANTHROPIC_API_KEY=sk-ant-...
python orchestrator.py --url https://trydreamscape.com

# Run unit tests only (no network needed)
cd unit && python -m pytest test_functions.py -v
```

## What Gets Tested

### Unit Tests (18 tests, no network)
- `getBaseCost()` — all product types correct pricing
- `calcProfit()` — earnings math green + red paths
- `calcSplit()` — Stripe webhook earnings split
- `suggestPrice()` — margin calculator

### API Tests (green + red paths)
- Health endpoint returns ok/degraded status
- Unauthenticated requests blocked (401/403)
- Rate limiter fires on rapid requests (429)
- CORS headers present on all /api/* routes
- Team invite without auth rejected
- Dream API with empty payload handled

### UI / E2E Tests (Playwright)
- Home, Gallery, Marketplace, Pricing, Blog all load
- Gallery tag filter chips render
- Marketplace Canvas/Framed/Wall Art filters work
- Nav links correct on desktop and mobile
- Product share page (/product/bad-id) shows not-found
- Mobile: input font ≥16px (no iOS zoom)
- Mobile: hamburger menu visible

### Explorer Tests (AI-driven)
- XSS injection in prompt fields
- Oversized payload handling
- CORS preflight responses
- Malformed JSON body handling
- Wrong content-type handling

## CI Integration (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Dreamscape Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install anthropic playwright aiohttp
      - run: python -m playwright install chromium --with-deps
      - run: python dreamscape-tests/orchestrator.py
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Findings & Report

Results saved to `reports/latest.json` after every run.
Red tests exit with code 1 (blocks CI merges).
