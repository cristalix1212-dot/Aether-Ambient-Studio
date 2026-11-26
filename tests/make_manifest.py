from playwright.sync_api import sync_playwright
import json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True, args=["--mute-audio"])
    page=b.new_page(viewport={"width":1400,"height":900})
    page.goto("http://127.0.0.1:8765/index.html", wait_until="networkidle")
    page.wait_for_function("window.__AETHER_READY__ === true")
    groups=page.evaluate("window.__AETHER__.getDemos()")
    manifest=[]
    for g in groups:
        for d in g["demos"]:
            page.evaluate("(id) => window.__AETHER__.loadDemo(id)", d["id"])
            project=page.evaluate("window.__AETHER__.getProject()")
            manifest.append({
                "id": d["id"], "style": g["label"], "styleId": g["styleId"], "title": d["title"],
                "bpm": project["bpm"], "bars": project["bars"], "key": project["keyLabel"],
                "notes": project["noteCount"], "clips": project["clipCount"],
                "durationSec": round(project["durationSec"],2),
                "instruments": [t["instrumentId"] for t in project["tracks"]],
                "validation": page.evaluate("window.__AETHER__.validate()")
            })
    out=ROOT/'tests'/'demo_manifest.json'
    out.write_text(json.dumps({"styleCount":len(groups),"demoCount":len(manifest),"demos":manifest},ensure_ascii=False,indent=2),encoding='utf-8')
    print('wrote',out,len(manifest))
    b.close()
