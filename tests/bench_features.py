from playwright.sync_api import sync_playwright
import json,time
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    page=b.new_page(viewport={"width":1400,"height":900})
    page.goto("http://127.0.0.1:8765/index.html",wait_until="domcontentloaded")
    page.wait_for_function("window.__AETHER_READY__ === true")
    res=page.evaluate("""async () => {
      const m = await import('./js/composer.js');
      const t=performance.now();
      let notes=0,errs=0;
      for(let i=0;i<200;i++){
        const p=m.generateProject({styleId:['volume_alpha','calm','dark','ambient','all'][i%5],seed:'bench-'+i,bpm:60+(i%20),bars:[8,16,32][i%3]});
        notes+=p.noteCount;
        const e=m.validateProject(p); if(e.length) errs++;
      }
      const pure=performance.now()-t;
      const t2=performance.now();
      for(let i=0;i<20;i++){ window.__AETHER__.generate('volume_alpha','ui-bench-'+i); }
      return {pureMs:pure,pureAvg:pure/200,notes,errors:errs,uiMs:performance.now()-t2,uiAvg:(performance.now()-t2)/20};
    }""")
    print(json.dumps(res,ensure_ascii=False))
    print('generation state', page.evaluate("window.__AETHER__.getState().project && window.__AETHER__.getProject().generation"))
    b.close()
