from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    page=b.new_page(viewport={"width":1560,"height":960})
    errs=[]; logs=[]
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.on('console',lambda m:logs.append(f'{m.type}: {m.text}'))
    page.goto('http://127.0.0.1:8765/index.html',wait_until='domcontentloaded')
    page.wait_for_function('window.__AETHER_READY__ === true')
    page.wait_for_timeout(1800)
    page.locator('#btnProof').click(); page.wait_for_timeout(600)
    st=page.evaluate('window.__AETHER__.getState()')
    proj=page.evaluate('window.__AETHER__.getProject()')
    print('state',json.dumps({k:st[k] for k in ['styleId','validation','project']},ensure_ascii=False)[:1000])
    print('proj', {k:proj[k] for k in ['title','bpm','bars','durationSec','noteCount','clipCount','isProof']})
    print('tracks',len(proj['tracks']),'notes',sum(len(c['notes']) for t in proj['tracks'] for c in t['clips']))
    print('generation',proj['generation'])
    print('errs',errs[-5:]); print('logs',logs[-5:])
    page.screenshot(path=r'C:\Users\Я\Documents\AmbientForge\tests\screens\proof_ui.png')
    b.close()
