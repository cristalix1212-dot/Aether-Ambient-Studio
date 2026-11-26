from playwright.sync_api import sync_playwright
import json, time
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=["--autoplay-policy=no-user-gesture-required","--mute-audio"])
    page=b.new_page(viewport={"width":1560,"height":960})
    logs=[]; errs=[]
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto("http://127.0.0.1:8765/index.html", wait_until="domcontentloaded")
    page.wait_for_function("window.__AETHER_READY__ === true", timeout=20000)
    page.wait_for_timeout(1000)
    print('ready state', page.evaluate("window.__AETHER__.getState().validation"))
    print('theme exists', page.locator('#btnTheme').count(), 'algo', page.locator('#btnAlgorithm').count(), 'random', page.locator('#btnRandomAmbient').count())
    page.locator('#btnTheme').click(); page.wait_for_timeout(400)
    print('theme modal', page.locator('.theme-dialog').count(), 'cards', page.locator('.theme-card').count(), 'inputs', page.locator('[data-theme-color]').count())
    page.screenshot(path=r'C:\Users\Я\Documents\AmbientForge\tests\screens\theme_studio.png')
    page.keyboard.press('Escape'); page.wait_for_timeout(200)
    page.locator('#btnAlgorithm').click(); page.wait_for_timeout(300)
    print('algo modal', page.locator('.algo-steps').count(), 'stats', page.locator('.algo-stat').count())
    page.screenshot(path=r'C:\Users\Я\Documents\AmbientForge\tests\screens\algorithm_modal.png')
    page.keyboard.press('Escape'); page.wait_for_timeout(200)
    page.locator('#btnRandomAmbient').click(); page.wait_for_timeout(500)
    print('random state', json.dumps(page.evaluate("window.__AETHER__.getState()"), ensure_ascii=False)[:500])
    print('logs', logs[-10:]); print('errs', errs[-5:])
    b.close()

