from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=["--autoplay-policy=no-user-gesture-required","--mute-audio"])
    page=b.new_page(viewport={"width":1560,"height":960})
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8765/index.html',wait_until='domcontentloaded')
    page.wait_for_function('window.__AETHER_READY__ === true'); page.wait_for_timeout(1200)
    page.evaluate('window.__AETHER__.loadProof()'); page.wait_for_timeout(300)
    res=page.evaluate('async () => await window.__AETHER__.play()')
    page.wait_for_timeout(2200)
    st=page.evaluate('window.__AETHER__.getState()')
    print('play',res,'pos',st['position'],'playing',st['playing'],'audio',st['audioPlaying'])
    print('errors',errs[-3:])
    b.close()
