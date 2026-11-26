from __future__ import annotations
import json, pathlib, sys, time, traceback
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "tests" / "screens"
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://127.0.0.1:8765/index.html"
failures = []
checks = 0

def check(condition, message):
    global checks
    checks += 1
    if not condition:
        failures.append(message)
        print("FAIL:", message)

def section(name):
    print("\n==", name)

def sample_project(page, demo_id):
    page.evaluate("(id) => window.__AETHER__.loadDemo(id)", demo_id)
    return page.evaluate("window.__AETHER__.getProject()")

def validate_project_structure(project, style_ids):
    errors=[]
    if len(project.get('tracks',[])) != 8: errors.append('tracks != 8')
    if not project.get('noteCount',0) > 40: errors.append('too few notes')
    if project.get('styleId') not in style_ids: errors.append('unknown style')
    for t in project.get('tracks',[]):
        if not t.get('clips'): errors.append(f'track {t["index"]} no clips')
        bar=0
        for c in t.get('clips',[]):
            if c['startBar'] != bar: errors.append(f'track {t["index"]} clip gap')
            bar += c['bars']
            if not c.get('notes'): errors.append(f'empty clip {c["id"]}')
            for n in c.get('notes',[]):
                if not (0 <= n['startBeat'] < c['bars']*4): errors.append('note start out of clip')
                if n['startBeat'] + n['durationBeats'] > c['bars']*4 + 0.01: errors.append('note end out of clip')
                if not (21 <= n['pitch'] <= 108): errors.append('pitch out of range')
                if not (0 < n['velocity'] <= 1): errors.append('velocity out of range')
        if bar != project['bars']: errors.append(f'track {t["index"]} does not fill song')
    return errors

def main():
    global checks
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required", "--mute-audio"])
        page = browser.new_page(viewport={"width":1560,"height":960})
        console_errors=[]
        page_errors=[]
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("window.__AETHER_READY__ === true", timeout=20000)
        page.wait_for_timeout(1900)

        section("catalog")
        styles = page.evaluate("window.__AETHER__.getStyles()")
        demos = page.evaluate("window.__AETHER__.getDemos()")
        check(len(styles)==5, f'expected 5 styles, got {len(styles)}')
        check(sum(s['instruments'] for s in styles)==80, 'expected 80 instruments')
        for s in styles:
            check(s['instruments']>=15, f'{s["id"]} has only {s["instruments"]} instruments')
            check(s['demos']==2, f'{s["id"]} has {s["demos"]} demos')
            check(len(set(i['id'] for i in s['instrumentList']))==s['instruments'], f'{s["id"]} duplicate instrument ids')
        check(len(demos)==5 and all(len(g['demos'])==2 for g in demos), 'demo catalog must be 2 per style')
        demo_ids=[d['id'] for g in demos for d in g['demos']]
        check(len(demo_ids)==10 and len(set(demo_ids))==10, 'expected 10 unique demo ids')
        check(not page.evaluate("window.__AETHER__.validateAllDemos().filter(x => x.errors.length)"), 'validateAllDemos reports errors')

        section("all demo tracks")
        style_ids={s['id'] for s in styles}
        signatures=set()
        for did in demo_ids:
            project = sample_project(page, did)
            errs=validate_project_structure(project, style_ids)
            js_errs=page.evaluate("window.__AETHER__.validate()")
            check(not errs, f'{did} structure: {errs[:3]}')
            check(not js_errs, f'{did} JS validation: {js_errs[:3]}')
            check(project['demoId']==did, f'{did} demoId mismatch')
            check(project['isDemo'] is True, f'{did} not marked demo')
            sig=tuple((t['instrumentId'], len(t['clips']), len(t['clips'][0]['notes']), t['clips'][0]['notes'][0]['pitch']) for t in project['tracks'])
            check(sig not in signatures, f'{did} is not distinct from another demo')
            signatures.add(sig)
            print(f'  demo {did:18s} notes={project["noteCount"]:3d} bars={project["bars"]} bpm={project["bpm"]} key={project["key"]}')
        check(len(signatures)==10, 'demo signatures not unique')

        section("generation matrix")
        for style in styles:
            for idx, (bars, bpm) in enumerate([(8, 36), (16, 90), (32, 180)]):
                summary=page.evaluate("([sid, seed, bars, bpm]) => { window.__AETHER__.setStyle(sid); const barsEl=document.querySelector('#barsSelect'); barsEl.value=String(bars); document.querySelector('#bpmInput').value=String(bpm); return window.__AETHER__.generate(sid, seed); }", [style['id'], f'matrix-{style["id"]}-{idx}', bars, bpm])
                check(summary is not None, f'generate failed {style["id"]} {bars} bars')
                project=page.evaluate("window.__AETHER__.getProject()")
                check(project['styleId']==style['id'], f'wrong style generated {style["id"]}')
                check(project['bars']==bars, f'wrong bars {style["id"]}: {project["bars"]}')
                check(abs(project['bpm']-bpm)<0.01, f'wrong bpm {style["id"]}: {project["bpm"]}')
                check(not validate_project_structure(project, style_ids), f'generated structure invalid {style["id"]} {bars}')
                check(not page.evaluate("window.__AETHER__.validate()"), f'generated JS validation {style["id"]} {bars}')
        print('  matrix generated', len(styles)*3, 'sessions')

        stress=page.evaluate("window.__AETHER__.stressGenerate(40)")
        check(not stress['failures'], f'stress failures: {stress["failures"][:2]}')
        print('  stress projects:', stress['count'], 'failures:', len(stress['failures']))

        section("UI interactions")
        page.evaluate("window.__AETHER__.loadDemo('va_mosslight')")
        page.wait_for_timeout(200)
        check(page.locator('.track-header').count()==8, 'track header count')
        check(page.locator('.clip').count()==52, 'clip count')
        check(page.locator('.clip.selected').count()==1, 'one selected clip')
        check(page.locator('.pr-note').count()>0, 'piano roll has notes')

        # Styles and tabs
        for style in styles:
            page.locator(f'[data-action="select-style"][data-style-id="{style["id"]}"]').click()
            check(page.evaluate("window.__AETHER__.getState().styleId")==style['id'], f'style click failed {style["id"]}')
            check(style['label'] in page.locator('#stylePickerLabel').inner_text(), f'style picker label {style["id"]}')
        page.locator('[data-browser-tab="sounds"]').click()
        check(page.locator('.inst-row').count()==16, 'instrument browser should show 16 for selected style')
        # audition two instruments
        page.locator('.inst-row').nth(0).click()
        page.wait_for_timeout(250)
        page.locator('.inst-row').nth(3).click()
        page.wait_for_timeout(250)
        page.locator('[data-browser-tab="demos"]').click()
        check(page.locator('.demo-card').count()==10, 'demos tab should contain 10 cards')
        page.locator('[data-demo-id="am_sloworbit"]').click()
        check(page.evaluate("window.__AETHER__.getState().project.demoId")=='am_sloworbit', 'demo card load')
        page.locator('[data-browser-tab="styles"]').click()

        # Playback
        page.locator('#btnPlay').click()
        page.wait_for_timeout(1600)
        st=page.evaluate("window.__AETHER__.getState()")
        check(st['playing'] and st['audioState']=='running', f'playback did not start {st["playing"]}/{st["audioState"]}')
        check(st['position']>0.4, f'playback position stalled {st["position"]}')
        lv=page.evaluate("window.__AETHER__.levels()")
        check(lv['peak']>=0 and lv['rms']>=0, 'levels invalid')
        page.locator('#btnPlay').click()
        page.wait_for_timeout(100)
        check(not page.evaluate("window.__AETHER__.getState().playing"), 'pause failed')
        page.evaluate("window.__AETHER__.seek(10)")
        check(abs(page.evaluate("window.__AETHER__.getState().position")-10)<0.6, 'seek failed')

        # Loop near the end
        page.evaluate("window.__AETHER__.setLoop(true)")
        dur=page.evaluate("window.__AETHER__.getState().project.durationSec")
        page.evaluate("(d) => window.__AETHER__.seek(d - 0.4)", dur)
        page.locator('#btnPlay').click()
        page.wait_for_timeout(1600)
        st=page.evaluate("window.__AETHER__.getState()")
        check(st['playing'] and st['position'] < dur / 2, f'loop did not restart: {st["position"]} / {dur}')
        page.evaluate("window.__AETHER__.setLoop(false)")
        page.locator('#btnStop').click()
        page.wait_for_timeout(150)
        check(page.evaluate("window.__AETHER__.getState().position")==0, 'stop did not reset')

        # Track controls
        page.locator('.ms-btn.mute').first.click()
        check(page.evaluate("window.__AETHER__.getProject().tracks[0].mute") is True, 'mute toggle failed')
        page.locator('.ms-btn.solo').nth(1).click()
        check(page.evaluate("window.__AETHER__.getProject().tracks[1].solo") is True, 'solo toggle failed')
        page.locator('.ms-btn.mute').first.click()
        page.locator('.ms-btn.solo').nth(1).click()
        check(page.evaluate("window.__AETHER__.getProject().tracks[0].mute") is False, 'mute clear failed')
        check(page.evaluate("window.__AETHER__.getProject().tracks[1].solo") is False, 'solo clear failed')

        page.locator('.track-header').nth(3).click()
        check(page.evaluate("window.__AETHER__.getState().selectedTrackIndex")==3, 'track selection failed')
        page.select_option('[data-track-instrument]', index=1)
        page.wait_for_timeout(200)
        check(page.evaluate("window.__AETHER__.validate()")==[], 'instrument change invalidated project')
        # sliders
        page.locator('[data-track-volume]').evaluate("(el) => { el.value='55'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
        page.locator('[data-track-pan]').evaluate("(el) => { el.value='-40'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
        check(page.evaluate("window.__AETHER__.getProject().tracks[3].volume")==55, 'volume slider failed')
        check(page.evaluate("window.__AETHER__.getProject().tracks[3].pan")==-40, 'pan slider failed')

        # BPM boundaries
        for invalid, expected in [("0",36), ("999",180)]:
            page.evaluate("(v) => window.__AETHER__.setBpm(v)", invalid)
            got=page.evaluate("window.__AETHER__.getState().project.bpm")
            check(abs(got-expected)<0.2, f'bpm clamp {invalid}: {got} != {expected}')
        page.evaluate("window.__AETHER__.setBpm('abc')")
        got=page.evaluate("window.__AETHER__.getState().project.bpm")
        check(36 <= got <= 180, f'bpm invalid fallback range: {got}')
        page.evaluate("window.__AETHER__.setBpm(66)")

        # Keyboard flow
        page.evaluate("document.activeElement?.blur()")
        page.keyboard.press('g')
        page.wait_for_timeout(250)
        check(page.evaluate("window.__AETHER__.getState().project") is not None, 'G shortcut did not generate')
        page.keyboard.press('p')
        page.wait_for_timeout(150)
        check(page.evaluate("window.__AETHER__.getState().pianoOpen") is False, 'P shortcut failed')
        page.keyboard.press('p')
        page.keyboard.press('l')
        page.wait_for_timeout(100)
        check(page.evaluate("window.__AETHER__.getState().loop") is True, 'L shortcut failed')
        page.keyboard.press('l')

        # Modals and menus
        page.locator('#btnHelp').click()
        page.wait_for_timeout(150)
        check(page.locator('.modal-dialog').is_visible(), 'help modal not visible')
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
        check(page.locator('.modal-dialog').count()==0, 'help modal did not close')
        page.locator('[data-menu="file"]').click()
        check(page.locator('.menu-popover').is_visible(), 'file menu not visible')
        page.keyboard.press('Escape')
        check(page.locator('.menu-popover').count()==0, 'file menu did not close')

        # Browser tab and resize
        page.set_viewport_size({"width":1180,"height":760})
        page.wait_for_timeout(500)
        overflow=page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check(overflow<=2, f'horizontal overflow at 1180x760: {overflow}')
        page.screenshot(path=str(OUT/'layout_1180x760.png'))
        page.set_viewport_size({"width":1920,"height":1080})
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT/'layout_1920x1080.png'))
        page.set_viewport_size({"width":1560,"height":960})
        page.wait_for_timeout(400)

        # Style showcase screenshots
        for style in styles:
            page.evaluate("(sid) => window.__AETHER__.setStyle(sid)", style['id'])
            page.evaluate("(sid) => window.__AETHER__.loadDemo(window.__AETHER__.getDemos().find(g => g.styleId === sid).demos[0].id)", style['id'])
            page.wait_for_timeout(250)
            page.screenshot(path=str(OUT/f'style_{style["id"]}.png'))
        page.evaluate("window.__AETHER__.loadDemo('va_mosslight')")

        section("errors")
        app_errors=page.evaluate("window.__AETHER__.getErrors()")
        print('  console errors:', len(console_errors))
        if console_errors: print('  ', console_errors[:5])
        print('  page errors:', len(page_errors))
        if page_errors: print('  ', page_errors[:5])
        print('  app errors:', len(app_errors))
        if app_errors: print('  ', app_errors[:5])
        check(not console_errors, f'console errors: {console_errors[:3]}')
        check(not page_errors, f'page errors: {page_errors[:3]}')
        check(not app_errors, f'app errors: {app_errors[:3]}')
        browser.close()

    print(f'\nCHECKS: {checks}  FAILURES: {len(failures)}')
    if failures:
        for f in failures[:30]: print(' -', f)
        return 1
    print('ALL TESTS PASSED')
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception:
        traceback.print_exc()
        raise SystemExit(2)
