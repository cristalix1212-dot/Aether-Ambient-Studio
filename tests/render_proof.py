from playwright.sync_api import sync_playwright
import base64, json, time
from pathlib import Path
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    page=b.new_page(viewport={"width":1400,"height":900})
    page.goto('http://127.0.0.1:8765/index.html',wait_until='domcontentloaded')
    page.wait_for_function('window.__AETHER_READY__ === true')
    page.wait_for_timeout(1200)
    page.evaluate('window.__AETHER__.loadProof()')
    page.wait_for_timeout(500)
    t=time.time()
    result=page.evaluate('async () => await window.__AETHER__.renderCurrentBase64()')
    print('render seconds',round(time.time()-t,2),'stats',result['stats'])
    raw=base64.b64decode(result['base64'])
    out=Path(r'C:\Users\Я\Documents\AmbientForge\tests\proof_wet_hands.wav'); out.write_bytes(raw)
    print('saved',out.stat().st_size)
    b.close()
