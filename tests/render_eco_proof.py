from playwright.sync_api import sync_playwright
import base64,time
from pathlib import Path
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    page=b.new_page(viewport={"width":1400,"height":900})
    page.goto('http://127.0.0.1:8765/index.html',wait_until='domcontentloaded')
    page.wait_for_function('window.__AETHER_READY__ === true'); page.wait_for_timeout(1200)
    page.evaluate('window.__AETHER__.loadProof()'); page.wait_for_timeout(400)
    r=page.evaluate('async()=>await window.__AETHER__.renderCurrentBase64({economy:true})')
    print(r['stats'])
    Path(r'C:\Users\Я\Documents\AmbientForge\tests\proof_eco.wav').write_bytes(base64.b64decode(r['base64']))
    b.close()
