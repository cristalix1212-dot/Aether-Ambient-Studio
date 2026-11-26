from playwright.sync_api import sync_playwright
import json, time
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=["--autoplay-policy=no-user-gesture-required","--mute-audio"])
    page=b.new_page(viewport={"width":1560,"height":960})
    errs=[]; logs=[]
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.on('console',lambda m:logs.append(f'{m.type}: {m.text}'))
    page.goto('http://127.0.0.1:8765/index.html',wait_until='domcontentloaded')
    page.wait_for_function('window.__AETHER_READY__ === true'); page.wait_for_timeout(2000)
    print('initial eco', page.evaluate('window.__AETHER__.getState().eco'), 'btn',page.locator('#ecoLabel').inner_text())
    page.evaluate('async()=>{window.__AETHER__.loadProof(); await window.__AETHER__.play()}')
    page.wait_for_timeout(1500)
    print('eco stats',json.dumps(page.evaluate('window.__AETHER__.getLiveStats()'),ensure_ascii=False))
    page.locator('#btnEco').click(); page.wait_for_timeout(1200)
    print('after toggle',page.evaluate('window.__AETHER__.getState().eco'),page.locator('#ecoLabel').inner_text())
    print('hq stats',json.dumps(page.evaluate('window.__AETHER__.getLiveStats()'),ensure_ascii=False))
    page.locator('#btnEco').click(); page.wait_for_timeout(1200)
    print('back eco',page.evaluate('window.__AETHER__.getState().eco'),json.dumps(page.evaluate('window.__AETHER__.getLiveStats()'),ensure_ascii=False))
    print('errs',errs[-5:]); print('logs',logs[-5:])
    b.close()
