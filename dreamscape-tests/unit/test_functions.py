"""
Unit tests for Dreamscape pure functions.
These run purely in Python — no browser, no network.
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)) + "/agents")

import asyncio
from blackboard import Blackboard, TestStatus


# ── Mirror the JS functions in Python for unit testing ──────────

def get_base_cost(model_name: str) -> float:
    m = model_name.lower()
    if any(k in m for k in ['hoodie', 'sweatshirt', 'pullover']): return 27.95
    if any(k in m for k in ['crewneck', 'crew neck']): return 22.95
    if any(k in m for k in ['tank', 'racerback', 'sleeveless']): return 12.95
    if any(k in m for k in ['long sleeve', 'longsleeve']): return 17.95
    if any(k in m for k in ['kids', 'youth', 'toddler', 'baby', 'onesie']): return 10.95
    if any(k in m for k in ['t-shirt', 'tee', 'jersey', 'cotton tee']): return 14.95
    if 'acrylic print' in m: return 39.95
    if any(k in m for k in ['metal print', 'aluminum', 'dibond']): return 34.95
    if 'wood print' in m: return 29.95
    if 'canvas' in m and 'tote' not in m: return 29.95
    if 'framed' in m: return 34.95
    if any(k in m for k in ['poster', 'art print']): return 11.95
    if any(k in m for k in ['mug', 'cup', 'ceramic']): return 9.95
    if any(k in m for k in ['phone case', 'iphone', 'snap case', 'tough case']): return 14.95
    if any(k in m for k in ['tote', 'canvas bag']): return 12.95
    if any(k in m for k in ['pillow', 'cushion']): return 22.95
    if any(k in m for k in ['blanket', 'throw', 'sherpa']): return 39.95
    if any(k in m for k in ['sticker', 'decal']): return 4.95
    if any(k in m for k in ['hat', 'cap', 'beanie']): return 17.95
    return 14.95  # default

def suggest_price(base: float) -> float:
    """~38% gross margin."""
    raw = base / (1 - 0.38)
    return round(round(raw) - 0.01, 2)

def calc_profit(retail: float, base: float, ds_fee: float = 0.10) -> dict:
    stripe_fee = retail * 0.029 + 0.30
    dream_fee  = retail * ds_fee
    earnings   = retail - base - stripe_fee - dream_fee
    margin     = (earnings / retail) * 100 if retail > 0 else 0
    break_even = (base + 0.30) / (1 - 0.029 - ds_fee)
    return {"earnings": round(earnings, 2), "margin": round(margin, 1), "break_even": round(break_even, 2)}

def calc_split(amount_cents: int, base_cost: float, artist_royalty_pct: float = 0) -> dict:
    """Mirror of stripe-webhook calcSplit."""
    retail        = amount_cents / 100
    stripe_fee    = retail * 0.029 + 0.30
    dreamscape_fee = retail * 0.10
    after_fees    = retail - base_cost - stripe_fee - dreamscape_fee
    artist_royalty = round(after_fees * (artist_royalty_pct / 100), 2) if artist_royalty_pct > 0 else 0
    creator_earn  = round(after_fees - artist_royalty, 2)
    return {
        "retail": retail,
        "stripe_fee": round(stripe_fee, 2),
        "dreamscape_fee": round(dreamscape_fee, 2),
        "artist_royalty": artist_royalty,
        "creator_earnings": creator_earn,
    }


# ── Test runner ──────────────────────────────────────────────────

async def run_unit_tests(bb: Blackboard):
    cases = []

    # getBaseCost tests
    cases += [
        ("unit_cost_tshirt",    "getBaseCost: t-shirt",      "Bella+Canvas 3001 Unisex T-Shirt",     14.95),
        ("unit_cost_hoodie",    "getBaseCost: hoodie",        "Unisex Heavy Blend Hooded Sweatshirt", 27.95),
        ("unit_cost_mug",       "getBaseCost: mug",           "White Glossy Mug",                    9.95),
        ("unit_cost_canvas",    "getBaseCost: canvas print",  "Gallery Wrapped Canvas Print",         29.95),
        ("unit_cost_framed",    "getBaseCost: framed",        "Wood Framed Poster",                   34.95),
        ("unit_cost_acrylic",   "getBaseCost: acrylic print", "Acrylic Print",                        39.95),
        ("unit_cost_poster",    "getBaseCost: poster",        "Enhanced Matte Paper Poster",          11.95),
        ("unit_cost_tote",      "getBaseCost: tote bag",      "Heavy Tote Bag",                      12.95),
        ("unit_cost_sticker",   "getBaseCost: sticker",       "Die Cut Vinyl Sticker",                4.95),
        ("unit_cost_canvas_tote","getBaseCost: canvas tote doesn't match canvas", "Canvas Tote Bag", 12.95),
    ]

    for test_id, name, model, expected in cases:
        t = time.monotonic()
        got = get_base_cost(model)
        ms  = int((time.monotonic() - t) * 1000)
        if abs(got - expected) < 0.01:
            await bb.add_result(TestStatus.GREEN and __make_result(test_id, name, "unit", "green", TestStatus.GREEN, ms, detail=f"${got}"))
        else:
            await bb.add_result(__make_result(test_id, name, "unit", "green", TestStatus.RED, ms, error=f"Expected ${expected} got ${got}"))

    # calcProfit tests
    profit_cases = [
        ("unit_profit_tshirt", "calcProfit: t-shirt at $29.99", 29.99, 14.95),
        ("unit_profit_canvas", "calcProfit: canvas at $59.99",  59.99, 29.95),
        ("unit_profit_below_cost", "calcProfit: retail below cost → negative", 10.00, 14.95),
    ]
    for test_id, name, retail, base in profit_cases:
        t = time.monotonic()
        result = calc_profit(retail, base)
        ms = int((time.monotonic() - t) * 1000)
        if retail > base:
            # Expect positive earnings
            ok = result["earnings"] > 0 and result["margin"] > 0
        else:
            ok = result["earnings"] < 0  # correctly negative
        status = TestStatus.GREEN if ok else TestStatus.RED
        await bb.add_result(__make_result(test_id, name, "unit", "green", status, ms,
                                         detail=f"earnings=${result['earnings']} margin={result['margin']}%",
                                         error=None if ok else f"Unexpected result: {result}"))

    # calcSplit tests
    split_cases = [
        ("unit_split_basic",    "calcSplit: basic order no royalty",  2999, 14.95 * 0.4, 0),
        ("unit_split_royalty",  "calcSplit: order with 10% royalty",  2999, 14.95 * 0.4, 10),
        ("unit_split_cents",    "calcSplit: amount converts from cents", 5000, 12.00, 0),
    ]
    for test_id, name, cents, base, royalty_pct in split_cases:
        t = time.monotonic()
        s = calc_split(cents, base, royalty_pct)
        ms = int((time.monotonic() - t) * 1000)
        # Sanity: retail = cents/100, creator_earnings < retail
        ok = abs(s["retail"] - cents/100) < 0.01 and s["creator_earnings"] < s["retail"]
        if royalty_pct > 0:
            ok = ok and s["artist_royalty"] > 0
        status = TestStatus.GREEN if ok else TestStatus.RED
        await bb.add_result(__make_result(test_id, name, "unit", "green", status, ms,
                                         detail=str(s), error=None if ok else f"Split sanity failed: {s}"))

    # suggestPrice tests
    price_cases = [
        ("unit_price_tshirt", "suggestPrice: t-shirt ~$23-25 (38% margin)", 14.95, 22, 26),
        ("unit_price_canvas", "suggestPrice: canvas ~$47-50 (38% margin)",  29.95, 46, 52),
    ]
    for test_id, name, base, low, high in price_cases:
        t = time.monotonic()
        p = suggest_price(base)
        ms = int((time.monotonic() - t) * 1000)
        ok = low <= p <= high
        await bb.add_result(__make_result(test_id, name, "unit", "green",
                                         TestStatus.GREEN if ok else TestStatus.RED, ms,
                                         detail=f"${p}", error=None if ok else f"${p} not in ${low}-${high}"))

    reds = await bb.get_results(category="unit", status=TestStatus.RED)
    print(f"[UnitTests] ✅ Done — {len(cases) + len(profit_cases) + len(split_cases) + len(price_cases)} tests, {len(reds)} red")


from blackboard import TestResult
import uuid

def __make_result(test_id, name, category, path, status, ms, detail=None, error=None) -> TestResult:
    return TestResult(
        id=test_id,
        name=name,
        category=category,
        path=path,
        status=status,
        duration_ms=ms,
        detail=detail,
        error=error,
        agent="UnitTests",
    )
