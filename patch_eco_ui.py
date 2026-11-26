from pathlib import Path
# HTML
p=Path(r'C:\Users\Я\Documents\AmbientForge\ui\index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('''      <div class="menubar-right">
        <button type="button" class="theme-button" id="btnTheme" title="Темы оформления"><svg><use href="#i-palette"></use></svg><span id="themeLabel">ТЕМА</span></button>''','''      <div class="menubar-right">
        <button type="button" class="eco-button" id="btnEco" title="Эко-режим: меньше голосов, стабильнее звук на слабом ПК"><span class="eco-light"></span><span id="ecoLabel">ЭКО</span></button>
        <button type="button" class="theme-button" id="btnTheme" title="Темы оформления"><svg><use href="#i-palette"></use></svg><span id="themeLabel">ТЕМА</span></button>''')
p.write_text(s,encoding='utf-8')
# CSS
p=Path(r'C:\Users\Я\Documents\AmbientForge\ui\css\app.css')
s=p.read_text(encoding='utf-8')
s=s.replace('''.theme-button {
  height: 24px;''','''.eco-button {
  height: 24px;
  display: flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.018);
  color: var(--dim);
  font-family: var(--font-num);
  font-size: 6.5px;
  letter-spacing: 0.9px;
  padding: 0 7px;
}
.eco-light { width: 5px; height: 5px; border-radius: 50%; background: var(--dim); flex: none; }
.eco-button.active { color: var(--accent-2); border-color: rgba(156, 175, 138, 0.32); background: rgba(156, 175, 138, 0.06); }
.eco-button.active .eco-light { background: var(--accent-2); box-shadow: 0 0 5px rgba(156, 175, 138, 0.5); }
.eco-button:hover { color: var(--text); border-color: var(--line-strong); }
.theme-button {
  height: 24px;''')
p.write_text(s,encoding='utf-8')
# app
p=Path(r'C:\Users\Я\Documents\AmbientForge\ui\js\app.js')
s=p.read_text(encoding='utf-8')
s=s.replace("""  lastGenerationMs: 0,
  idleCleared: false,""", """  lastGenerationMs: 0,
  idleCleared: false,
  eco: false,""")
s=s.replace("""    'themeLabel', 'btnAlgorithm', 'btnRandomAmbient', 'btnProof', 'btnPipelineRun',
    'pipelineSteps', 'pipeSeed', 'pipeKey', 'pipeChords', 'pipeForm', 'pipeRoles',
    'pipeMix', 'exportPerf'
  ];""", """    'themeLabel', 'btnAlgorithm', 'btnRandomAmbient', 'btnProof', 'btnPipelineRun',
    'pipelineSteps', 'pipeSeed', 'pipeKey', 'pipeChords', 'pipeForm', 'pipeRoles',
    'pipeMix', 'exportPerf', 'btnEco', 'ecoLabel'
  ];""")
s=s.replace("""  applyActiveTheme();
  updateThemeLabel();
  hydrateThemeSettings();""", """  applyActiveTheme();
  updateThemeLabel();
  initializeEco();
  hydrateThemeSettings();""")
# functions before syncPipeline
anchor='function syncPipeline() {'
code=r'''
function initializeEco() {
  const cores = Number(navigator.hardwareConcurrency) || 8;
  const memory = Number(navigator.deviceMemory) || 8;
  let saved = null;
  try { saved = localStorage.getItem('aether.eco'); } catch { /* noop */ }
  const automatic = cores <= 4 || memory <= 4;
  const enabled = saved === '1' ? true : saved === '0' ? false : automatic;
  setEconomy(enabled, { announce: false });
}

function setEconomy(enabled, { announce = true } = {}) {
  state.eco = Boolean(enabled);
  audio.setEconomy(state.eco);
  if (dom.btnEco) {
    dom.btnEco.classList.toggle('active', state.eco);
    dom.btnEco.setAttribute('aria-pressed', String(state.eco));
    dom.btnEco.title = state.eco
      ? 'Эко-режим включён: 1 осциллятор на пиано, окно планирования и меньшая нагрузка'
      : 'HQ-режим: полный тембр пиано, больше голосов';
  }
  if (dom.ecoLabel) dom.ecoLabel.textContent = state.eco ? 'ЭКО' : 'HQ';
  try { localStorage.setItem('aether.eco', state.eco ? '1' : '0'); } catch { /* noop */ }
  if (announce) {
    showToast(state.eco ? 'Эко-режим включён' : 'HQ-режим включён',
      state.eco ? 'Меньше голосов, стабильнее на слабом ПК.' : 'Полный тембр, больше нагрузка на CPU.');
  }
}

'''
if anchor not in s: raise SystemExit('sync anchor missing')
s=s.replace(anchor,code+anchor,1)
# bind eco
s=s.replace("""  dom.btnTheme.addEventListener('click', showThemeStudio);
  dom.btnExport.addEventListener('click', exportWav);""", """  dom.btnTheme.addEventListener('click', showThemeStudio);
  dom.btnEco.addEventListener('click', () => setEconomy(!state.eco));
  dom.btnExport.addEventListener('click', exportWav);""")
# menu item
s=s.replace("""      ['Темы приложения', 'T', showThemeStudio],
      ['Алгоритм генерации', '', showAlgorithm],""", """      ['Эко-режим', state.eco ? 'ON' : 'OFF', () => setEconomy(!state.eco)],
      ['Темы приложения', 'T', showThemeStudio],
      ['Алгоритм генерации', '', showAlgorithm],""")
# debug state
s=s.replace("""        exporting: state.exporting,
        pianoOpen: state.pianoOpen,""", """        exporting: state.exporting,
        eco: state.eco,
        liveStats: audio.lastLiveStats,
        pianoOpen: state.pianoOpen,""")
s=s.replace("""    setStyle(id) { setStyle(id); return state.styleId; },""", """    setEco(value) { setEconomy(Boolean(value)); return state.eco; },
    getLiveStats() { return audio.lastLiveStats; },
    setStyle(id) { setStyle(id); return state.styleId; },""")
p.write_text(s,encoding='utf-8')
print('eco UI patched')
