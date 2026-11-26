from playwright.sync_api import sync_playwright
from pathlib import Path
import time, wave, json
ROOT = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required", "--mute-audio"])
    ctx = b.new_context(accept_downloads=True, viewport={"width":1560,"height":960})
    page = ctx.new_page()
    errors=[]
    page.on("console", lambda m: errors.append(m.text) if m.type=='error' else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://127.0.0.1:8765/index.html", wait_until="domcontentloaded")
    page.wait_for_function("window.__AETHER_READY__ === true")
    page.evaluate("window.__AETHER__.loadDemo('da_obsidian')")
    page.wait_for_timeout(500)
    t=time.time()
    with page.expect_download(timeout=180000) as dl_info:
        page.locator('#btnExport').click()
        page.wait_for_timeout(600)
        print('overlay visible during render:', page.locator('#exportOverlay').is_visible())
        print('generate disabled:', page.locator('#btnGenerate').is_disabled())
    download=dl_info.value
    out=ROOT/'tests'/'export_da_obsidian.wav'
    download.save_as(str(out))
    elapsed=time.time()-t
    page.wait_for_timeout(1500)
    print('download suggested:', download.suggested_filename, 'elapsed', round(elapsed,2), 'size', out.stat().st_size)
    print('overlay after:', page.locator('#exportOverlay').is_visible())
    print('generate enabled:', page.locator('#btnGenerate').is_enabled())
    print('state exporting:', page.evaluate("window.__AETHER__.getState().exporting"))
    print('errors:', errors[:5])
    with wave.open(str(out),'rb') as w:
        print('wav fmt', w.getframerate(), w.getnchannels(), w.getsampwidth(), 'frames', w.getnframes(), 'dur', round(w.getnframes()/w.getframerate(),2))
    page.screenshot(path=str(ROOT/'tests'/'screens'/'export_finished.png'))
    b.close()
