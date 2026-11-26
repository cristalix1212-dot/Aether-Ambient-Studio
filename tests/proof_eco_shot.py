from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    page=b.new_page(viewport={"width":1560,"height":960})
    page.goto('http://127.0.0.1:8765/index.html',wait_until='domcontentloaded')
    page.wait_for_function('window.__AETHER_READY__ === true'); page.wait_for_timeout(2200)
    page.locator('#btnProof').click(); page.wait_for_timeout(5000)
    page.screenshot(path=r'C:\Users\Я\Documents\AmbientForge\tests\screens\proof_ui.png')
    print('eco',page.evaluate('window.__AETHER__.getState().eco'),'label',page.locator('#ecoLabel').inner_text())
    b.close()
