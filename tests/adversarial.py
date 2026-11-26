"""Adversarial UI/audio smoke test.

Runs intentionally messy sequences: rapid generation, style switching,
transport spam, mute/solo flips, bad BPMs, randomised track edits and rapid
resizes. The app must stay alive, keep a valid project and report no errors.
"""
from __future__ import annotations

import json
import pathlib
import random
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:8765/index.html"
failures = []


def check(condition, message):
    if not condition:
        failures.append(message)
        print("FAIL:", message)


def main():
    rng = random.Random(42)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        console_errors = []
        page_errors = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("window.__AETHER_READY__ === true", timeout=20000)
        page.wait_for_timeout(800)

        # 1. Hammer generate/style/demo actions through the controller.
        for i in range(35):
            page.evaluate(
                "(i) => { const s=window.__AETHER__.getStyles()[i%5]; window.__AETHER__.setStyle(s.id); window.__AETHER__.generate(s.id, 'adv-'+i); }",
                i,
            )
        check(not page.evaluate("window.__AETHER__.validate()"), "project invalid after generation spam")

        # 2. Transport and seek spam.
        for i in range(22):
            page.evaluate("window.__AETHER__.play()")
            page.wait_for_timeout(40)
            page.evaluate("(t) => window.__AETHER__.seek(t)", rng.uniform(0, 20))
            page.evaluate("window.__AETHER__.pause()")
            page.evaluate("window.__AETHER__.stop()")
        page.evaluate("window.__AETHER__.loadDemo('am_cloudatlas')")

        # 3. Mute/solo/volume/pan random walks.
        for i in range(40):
            track = rng.randrange(8)
            page.evaluate(
                "([t, patch]) => window.__AETHER__.setTrack(t, patch)",
                [track, {
                    "mute": rng.choice([True, False]),
                    "solo": rng.choice([True, False]),
                    "volume": rng.randrange(0, 101),
                    "pan": rng.randrange(-100, 101),
                }],
            )
        for track in range(8):
            page.evaluate("([t]) => window.__AETHER__.setTrack(t, {mute:false, solo:false})", [track])
        check(not page.evaluate("window.__AETHER__.validate()"), "project invalid after mixer walk")

        # 4. Invalid/degenerate inputs.
        page.evaluate("window.__AETHER__.setBpm('nonsense')")
        bpm = page.evaluate("window.__AETHER__.getState().project.bpm")
        check(36 <= bpm <= 180, f"bpm escaped range: {bpm}")
        page.evaluate("window.__AETHER__.setBpm(1e9)")
        check(page.evaluate("window.__AETHER__.getState().project.bpm") == 180, "high bpm not clamped")
        page.evaluate("window.__AETHER__.setBpm(-1e9)")
        check(page.evaluate("window.__AETHER__.getState().project.bpm") == 36, "low bpm not clamped")
        check(page.evaluate("window.__AETHER__.selectClip(999, 'nope')") is False, "invalid clip accepted")
        page.evaluate("window.__AETHER__.generate('unknown-style', 'x' * 200)")
        check(not page.evaluate("window.__AETHER__.validate()"), "invalid style/seed broke project")

        # 5. Rapid resizes and tab switching.
        for w, h in [(1180, 760), (1440, 900), (1920, 1080), (1200, 780), (1560, 960)]:
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(80)
        check(
            page.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 2,
            "horizontal overflow after resize spam",
        )
        for tab in ["styles", "sounds", "demos", "sounds", "styles"]:
            page.evaluate("(t) => window.__AETHER__.setBrowserTab(t)", tab)
        check(page.locator(".track-header").count() == 8, "arrangement lost tracks")
        check(page.locator(".clip").count() > 0, "arrangement lost clips")
        check(page.locator(".pr-note").count() > 0, "piano roll lost notes")

        # 6. Audio preview spam.
        for i in range(12):
            page.evaluate("window.__AETHER__.loadDemo('va_mosslight')")
            page.locator(".browser-tabs button[data-browser-tab='sounds']").click()
            page.locator(".inst-row").nth(i % 16).click()
            page.wait_for_timeout(50)

        # 7. Final invariants.
        page.evaluate("window.__AETHER__.loadDemo('va_mosslight')")
        page.wait_for_timeout(200)
        state = page.evaluate("window.__AETHER__.getState()")
        check(state["validation"] == [], f"final project invalid: {state['validation']}")
        app_errors = page.evaluate("window.__AETHER__.getErrors()")
        print(f"console_errors={len(console_errors)} page_errors={len(page_errors)} app_errors={len(app_errors)}")
        check(not console_errors, f"console errors: {console_errors[:3]}")
        check(not page_errors, f"page errors: {page_errors[:3]}")
        check(not app_errors, f"app errors: {app_errors[:3]}")
        page.screenshot(path=str(ROOT / "tests" / "screens" / "adversarial_final.png"))
        browser.close()

    if failures:
        print(f"ADVERSARIAL FAILURES: {len(failures)}")
        for item in failures:
            print(" -", item)
        return 1
    print("ADVERSARIAL PASSED")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print("EXCEPTION:", exc)
        raise
