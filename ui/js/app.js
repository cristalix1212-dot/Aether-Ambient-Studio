/* AETHER — interface controller. */

import {
  STYLES, getStyle, getInstrument, demosForStyle, noteName, keyLabel,
  ROLE_META
} from './instruments.js';
import {
  generateProject, createDemoProject, createWetHandsProof, projectSummary, validateProject, projectNotes,
  demoCatalog, BARS_OPTIONS, BPM_MIN, BPM_MAX, makeSeed, normalizeBpm, clamp
} from './composer.js';
import { AudioEngine } from './audio.js';
import {
  BUILTIN_THEMES, SETTINGS_KEY, normalizeSettings, findTheme, allThemes,
  applyTheme, makeCustomTheme, activeColors, isHex
} from './themes.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  project: null,
  styleId: 'volume_alpha',
  browserTab: 'styles',
  selectedTrackIndex: 0,
  selectedClipId: null,
  position: 0,
  playing: false,
  loop: false,
  audioReady: false,
  exporting: false,
  pianoOpen: true,
  tool: 'select',
  snap: '1/4',
  zoom: 1,
  mode: 'song',
  auditionId: null,
  lastHud: 0,
  lastMeter: 0,
  lastVoices: 0,
  lastVoiceTime: 0,
  pipelineRunning: false,
  lastGenerationMs: 0,
  idleCleared: false,
  flatNotes: [],
  themeSettings: normalizeSettings(null),
  activeThemeId: 'minecraft_parchment',
  themeDraft: null,
  themePreviewDirty: false,
  activeMenu: null,
  lastError: null
};

const audio = new AudioEngine();
const dom = {};
let bridgeReady = false;
let initialized = false;
let overviewResizeObserver = null;
let exportTicker = null;

window.__AETHER_ERRORS__ = [];

function rememberError(error) {
  const message = error?.stack || error?.message || String(error);
  window.__AETHER_ERRORS__.push({ at: new Date().toISOString(), message });
  if (window.__AETHER_ERRORS__.length > 40) window.__AETHER_ERRORS__.shift();
}

window.addEventListener('error', (event) => rememberError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => rememberError(event.reason));
window.addEventListener('pywebviewready', () => {
  bridgeReady = true;
  document.documentElement.classList.add('has-bridge');
  if (initialized) hydrateThemeSettings();
});

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function hexToRgb(hex) {
  const value = String(hex || '#d0a878').replace('#', '');
  const normalized = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  const number = parseInt(normalized, 16);
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatTime(seconds, withFraction = false) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const whole = Math.floor(safe % 60);
  const fraction = Math.floor((safe % 1) * 100);
  return `${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')}${withFraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
}

function formatBar(seconds, bpm) {
  const beats = Math.max(0, (Number(seconds) || 0) * (Number(bpm) || 60) / 60);
  const bar = Math.floor(beats / 4) + 1;
  const beat = Math.floor(beats % 4) + 1;
  return `BAR ${bar}.${beat}`;
}

function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes > 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function sanitizeFilename(value) {
  return String(value || 'Aether Ambient')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Aether Ambient';
}

function cacheDom() {
  const ids = [
    'splash', 'engineChip', 'engineText', 'btnStop', 'btnPlay', 'btnLoop', 'timeMain', 'timeMs',
    'barPos', 'lcdState', 'bpmValue', 'keyValue', 'masterDb', 'masterMeter', 'snapChip',
    'viewPlaylist', 'viewPiano', 'nowTitle', 'nowSubtitle', 'btnRandomize', 'btnExportTop',
    'browserContent', 'overviewCanvas', 'overviewMeta', 'overviewPlayhead', 'playlistTitle',
    'playlistMeta', 'zoomLabel', 'btnZoomOut', 'btnZoomIn', 'ruler', 'trackHeaders', 'lanes', 'arrangementBody',
    'laneGrid', 'laneRows', 'lanePlayhead', 'pianoRoll', 'prClipName', 'prMeta', 'prKeys',
    'prGrid', 'prEmpty', 'btnClosePiano', 'stylePickerButton', 'stylePickerDot',
    'stylePickerLabel', 'stylePopover', 'styleDescription', 'styleToolFact', 'styleDemoFact',
    'barsSelect', 'bpmInput', 'seedInput', 'btnSeed', 'btnGenerate', 'genHint',
    'genTrackCount', 'genSeedLabel', 'trackInspector', 'statNotes', 'statClips', 'statDuration',
    'btnExport', 'btnHelp', 'statusLight', 'statusText', 'statusCenter', 'statusVoices',
    'statusClock', 'toasts', 'modalRoot', 'exportOverlay', 'exportTitle', 'exportStatus',
    'exportProgress', 'exportProject', 'exportElapsed', 'btnGenerate', 'btnTheme',
    'themeLabel', 'btnAlgorithm', 'btnRandomAmbient', 'btnProof', 'btnPipelineRun',
    'pipelineSteps', 'pipeSeed', 'pipeKey', 'pipeChords', 'pipeForm', 'pipeRoles',
    'pipeMix', 'exportPerf'
  ];
  ids.forEach((id) => { dom[id] = document.getElementById(id); });
  dom.tabs = $$('.browser-tabs button');
  dom.toolButtons = $$('[data-tool]');
  dom.playIcon = dom.btnPlay?.querySelector('use');
  dom.masterSegments = $$('#masterMeter i');
  dom.styleOptions = [];
}

function init() {
  if (initialized) return;
  initialized = true;
  cacheDom();
  audio.onEnd = () => {
    state.playing = false;
    state.position = 0;
    updateTransportUi(0);
    setStatus('Воспроизведение завершено', '');
    setLcdState('STOPPED');
  };
  bindMenus();
  bindTransport();
  bindBrowser();
  bindArrangement();
  bindInspector();
  bindGenerator();
  bindPianoRoll();
  bindMisc();
  bindKeyboard();
  bindWindowEvents();
  exposeDebugApi();
  applyActiveTheme();
  updateThemeLabel();
  hydrateThemeSettings();

  try {
    const firstDemo = demosForStyle(state.styleId)[0];
    const project = createDemoProject(firstDemo.id);
    if (!project) throw new Error('Demo project could not be created');
    commitProject(project, { announce: false, initial: true });
    setStatus('Демо загружено', '');
  } catch (error) {
    rememberError(error);
    console.error(error);
    showToast('Ошибка запуска', 'Не удалось создать стартовую сессию. Откройте демо в браузере.', 'error');
    setStatus('Ошибка запуска', 'error');
    dom.splash.querySelector('.splash-note').textContent = 'не удалось загрузить сессию';
  }

  requestAnimationFrame(tick);
  if (overviewResizeObserver) overviewResizeObserver.disconnect();
  overviewResizeObserver = new ResizeObserver(() => drawOverview());
  const wrap = dom.overviewCanvas?.parentElement;
  if (wrap) overviewResizeObserver.observe(wrap);
  window.setTimeout(() => dom.splash.classList.add('fade-out'), 620);
  window.setTimeout(() => { if (dom.splash) dom.splash.remove(); }, 1350);
  window.__AETHER_READY__ = true;
}

function commitProject(project, { announce = false, initial = false } = {}) {
  if (!project) return;
  const errors = validateProject(project);
  if (errors.length) {
    console.warn('Project validation:', errors);
    showToast('Проверка проекта', errors.slice(0, 2).join(' · '), 'warn');
  }
  audio.stop();
  state.playing = false;
  state.position = 0;
  state.idleCleared = false;
  state.project = project;
  state.styleId = project.styleId;
  state.flatNotes = projectNotes(project);
  const richest = project.tracks.reduce((best, track, index) => {
    const count = track.clips.reduce((sum, clip) => sum + clip.notes.length, 0);
    return count > best.count ? { index, count } : best;
  }, { index: 0, count: -1 });
  state.selectedTrackIndex = richest.index;
  const richestTrack = project.tracks[richest.index];
  const richestClip = richestTrack?.clips.reduce((best, clip) => (
    clip.notes.length > best.notes.length ? clip : best
  ), richestTrack.clips[0]);
  state.selectedClipId = richestClip?.id || project.tracks[0]?.clips[0]?.id || null;
  syncStyleChrome();
  syncGeneratorFields(true);
  renderAll();
  syncPipeline();
  updateTransportUi(0);
  setLcdState('STOPPED');
  if (announce) {
    showToast(initial ? 'Сессия готова' : 'Демо загружено', `${project.title} · ${project.keyLabel} · ${Math.round(project.durationSec)} сек.`);
  }
}

function styleAccentCss(style) {
  const { r, g, b } = hexToRgb(style.accent);
  // The chrome accent belongs to the chosen app theme. Style color is kept
  // separately for the style cards and browser identity.
  document.documentElement.style.setProperty('--style-accent', style.accent);
  document.documentElement.style.setProperty('--style-accent-2', style.accent2);
  document.documentElement.style.setProperty('--style-accent-rgb', `${r}, ${g}, ${b}`);
}

function syncStyleChrome() {
  const style = getStyle(state.styleId);
  styleAccentCss(style);
  if (!dom.stylePickerLabel) return;
  setText(dom.stylePickerLabel, style.label);
  if (dom.stylePickerDot) dom.stylePickerDot.style.background = style.accent;
  setText(dom.styleDescription, style.description);
  setText(dom.styleToolFact, `${style.instrumentCount} инструментов`);
  setText(dom.styleDemoFact, `${demosForStyle(style.id).length} демо`);
  setText(dom.statusCenter, `${style.short} · ${style.instrumentCount} INSTRUMENTS`);
  $("#genTrackCount").textContent = `8 дорожек · ${style.instrumentCount} инструментов`;
  dom.stylePickerButton.setAttribute('aria-expanded', 'false');
  dom.stylePopover.hidden = true;
  dom.stylePopover.innerHTML = STYLES.map((item) => `
    <button type="button" class="style-option ${item.id === state.styleId ? 'active' : ''}" data-action="pick-style" data-style-id="${item.id}" style="--opt-accent:${item.accent}">
      <span class="style-option-dot"></span>
      <span>${esc(item.label)}</span>
      <small>${item.instrumentCount} ЗВ.</small>
    </button>
  `).join('');
  if (dom.stylePickerButton) {
    dom.stylePickerButton.style.setProperty('--style-accent', style.accent);
  }
  updateGeneratePreview();
  const project = state.project;
  if (project) {
    setText(dom.nowTitle, project.title);
    setText(dom.nowSubtitle, project.subtitle || `${project.styleLabel} · сессия`);
    setText(dom.playlistTitle, project.title);
    document.title = `${project.title} — AETHER`;
  }
}

function updateGeneratePreview() {
  const style = getStyle(state.styleId);
  const bars = Number(dom.barsSelect?.value) || 16;
  const bpm = parseFloat(dom.bpmInput?.value) || style.bpm;
  const seconds = bars * 4 * 60 / clamp(Number(bpm) || style.bpm, BPM_MIN, BPM_MAX);
  setText(dom.genHint, `${bars} тактов · ~${formatTime(seconds)}`);
  if (dom.genSeedLabel && dom.seedInput) {
    const seed = dom.seedInput.value.trim() || '—';
    setText(dom.genSeedLabel, `SEED ${seed.slice(0, 10).toUpperCase()}`);
  }
}

function syncGeneratorFields(force = false) {
  if (!state.project) return;
  const style = getStyle(state.project.styleId);
  if (force || document.activeElement !== dom.barsSelect) dom.barsSelect.value = String(state.project.bars);
  if (force || document.activeElement !== dom.bpmInput) dom.bpmInput.value = state.project.bpm.toFixed(1);
  if (force || document.activeElement !== dom.seedInput) dom.seedInput.value = state.project.seed;
  dom.bpmInput.min = String(BPM_MIN);
  dom.bpmInput.max = String(BPM_MAX);
  setText(dom.bpmValue, state.project.bpm.toFixed(1));
  setText(dom.keyValue, state.project.keyLabel);
  setText(dom.overviewMeta, `${state.project.tracks.length} TRACKS · ${state.project.bars} BARS`);
  setText(dom.playlistMeta, `${state.project.tracks.length} TRACKS · ${formatTime(state.project.durationSec)}`);
  setText(dom.genTrackCount, `8 дорожек · ${style.instrumentCount} инструментов`);
  updateGeneratePreview();
}

function renderAll() {
  renderBrowser();
  renderRuler();
  renderArrangement();
  renderPianoRoll();
  renderTrackInspector();
  renderStats();
  updateSelectionClasses();
  updateTrackVisualState();
  drawOverview();
  syncStyleChrome();
  updateTransportUi(state.position);
}

function setStyle(styleId, { updateFields = true } = {}) {
  const style = getStyle(styleId);
  if (!style) return;
  state.styleId = style.id;
  if (updateFields) {
    dom.bpmInput.value = style.bpm.toFixed(1);
    dom.barsSelect.value = String(style.bars);
  }
  syncStyleChrome();
  renderBrowser();
  updateGeneratePreview();
  setStatus(`Стиль: ${style.label}`, '');
}

function generateAmbient({ styleId = state.styleId, seed = null, announce = true } = {}) {
  if (state.exporting) {
    showToast('Идёт экспорт', 'Дождитесь окончания рендера WAV.', 'warn');
    return null;
  }
  try {
    const style = getStyle(styleId);
    const bars = BARS_OPTIONS.includes(Number(dom.barsSelect.value)) ? Number(dom.barsSelect.value) : style.bars;
    const rawBpm = parseFloat(dom.bpmInput.value);
    const bpm = normalizeBpm(Number.isFinite(rawBpm) ? rawBpm : style.bpm, style);
    const chosenSeed = String(seed || dom.seedInput.value.trim() || makeSeed()).slice(0, 64);
    const generationStarted = performance.now();
    const project = generateProject({
      styleId: style.id,
      seed: chosenSeed,
      bpm,
      bars
    });
    state.lastGenerationMs = performance.now() - generationStarted;
    const errors = validateProject(project);
    if (errors.length) throw new Error(errors.join('; '));
    commitProject(project, { announce: false });
    setStatus('Эмбиент сгенерирован', '');
    if (announce) {
      showToast(
        'Эмбиент сгенерирован',
        `${style.label} · ${project.keyLabel} · ${project.noteCount} нот · ${formatTime(project.durationSec)}`
      );
    }
    return projectSummary(project);
  } catch (error) {
    rememberError(error);
    console.error(error);
    showToast('Не удалось сгенерировать', String(error.message || error), 'error');
    setStatus('Ошибка генерации', 'error');
    return null;
  }
}

function loadDemo(demoId, { announce = true } = {}) {
  try {
    const project = createDemoProject(demoId);
    if (!project) throw new Error('Демо не найдено');
    commitProject(project, { announce: false });
    setStatus('Демо загружено', '');
    if (announce) showToast('Демо загружено', `${project.title} · ${getStyle(project.styleId).label}`);
    return projectSummary(project);
  } catch (error) {
    rememberError(error);
    showToast('Не удалось открыть демо', String(error.message || error), 'error');
    return null;
  }
}


/* ---------- themes / settings ---------- */

let themeHydrationStarted = false;

function currentTheme() {
  return findTheme(state.themeSettings, state.activeThemeId);
}

function updateThemeLabel() {
  const theme = currentTheme();
  if (dom.themeLabel) dom.themeLabel.textContent = 'ТЕМА';
  if (dom.btnTheme) {
    dom.btnTheme.title = `Тема: ${theme.name}`;
    dom.btnTheme.style.color = theme.colors.accent;
    dom.btnTheme.style.borderColor = `color-mix(in srgb, ${theme.colors.accent} 38%, transparent)`;
  }
}

function applyActiveTheme() {
  const theme = currentTheme();
  applyTheme(theme);
  state.activeThemeId = theme.id;
  updateThemeLabel();
}

async function loadSettingsPayload() {
  try {
    if (window.pywebview?.api?.load_settings) {
      const raw = await window.pywebview.api.load_settings();
      if (raw) return { raw, source: 'bridge' };
    }
  } catch (error) {
    rememberError(error);
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { raw, source: 'local' };
  } catch {
    /* storage can be disabled */
  }
  return null;
}

async function hydrateThemeSettings() {
  if (themeHydrationStarted && !bridgeReady) return;
  themeHydrationStarted = true;
  try {
    const payload = await loadSettingsPayload();
    if (payload?.raw) {
      const next = normalizeSettings(payload.raw);
      // Do not throw away unsaved custom themes from a later localStorage read.
      state.themeSettings = next;
      state.activeThemeId = next.activeThemeId;
      applyActiveTheme();
      if (state.themeDraft && !dom.modalRoot.hidden) {
        // The theme studio was already open; keep its draft but refresh the
        // applied chrome from persisted settings.
        applyActiveTheme();
      }
    }
  } catch (error) {
    rememberError(error);
  }
}

function persistThemeSettings() {
  const payload = JSON.stringify(state.themeSettings);
  try { localStorage.setItem(SETTINGS_KEY, payload); } catch { /* noop */ }
  if (window.pywebview?.api?.save_settings) {
    Promise.resolve(window.pywebview.api.save_settings(payload)).catch((error) => rememberError(error));
  }
}

function themePreview(draft) {
  const preview = makeCustomTheme(draft.name || 'Моя тема', draft.colors, draft.editingId || 'preview');
  applyTheme(preview);
  state.themePreviewDirty = true;
  if (dom.themeLabel) dom.themeLabel.textContent = 'ТЕМА';
  if (dom.btnTheme) {
    dom.btnTheme.title = `Предпросмотр: ${preview.name}`;
    dom.btnTheme.style.color = preview.colors.accent;
    dom.btnTheme.style.borderColor = `color-mix(in srgb, ${preview.colors.accent} 40%, transparent)`;
  }
}

function themeSwatches(colors) {
  return [colors.bg, colors.panel, colors.text, colors.muted, colors.accent, colors.accent2]
    .map((color) => `<i style="--sw:${color}"></i>`).join('');
}

function themeCard(theme, active) {
  const custom = !theme.builtIn;
  return `<div class="theme-card ${active ? 'active' : ''}" data-theme-preset="${esc(theme.id)}" role="button" tabindex="0">
    <span class="theme-card-swatches">${themeSwatches(theme.colors)}</span>
    <strong>${esc(theme.name)}</strong>
    <span>${esc(theme.description || (custom ? 'Пользовательская тема' : ''))}</span>
    ${custom ? `<span class="theme-card-actions">
      <button type="button" data-theme-edit="${esc(theme.id)}" title="Редактировать">✎</button>
      <button type="button" data-theme-delete="${esc(theme.id)}" title="Удалить">×</button>
    </span>` : ''}
  </div>`;
}

function themeStudioHtml() {
  const active = currentTheme();
  const draft = state.themeDraft || { name: active.builtIn ? 'Моя тема' : active.name, colors: { ...active.colors }, editingId: active.builtIn ? null : active.id };
  state.themeDraft = draft;
  const themes = allThemes(state.themeSettings);
  const fields = [
    ['bg', 'Фон'], ['panel', 'Панель'], ['text', 'Текст'],
    ['muted', 'Тихий текст'], ['accent', 'Акцент'], ['accent2', 'Второй акцент']
  ];
  return `<div class="theme-studio-head">
    <div><div class="modal-kicker">AETHER · THEME STUDIO</div><h2>Темы приложения</h2><p>Выберите готовую палитру или соберите свою — она сохранится в профиле.</p></div>
    <button type="button" class="icon-btn modal-close" data-close-modal aria-label="Закрыть"><svg><use href="#i-close"></use></svg></button>
  </div>
  <div class="theme-section-label">ГОТОВЫЕ ТЕМЫ</div>
  <div class="theme-grid">${themes.map((theme) => themeCard(theme, theme.id === state.activeThemeId)).join('')}</div>
  <div class="theme-section-label">СВОЯ ТЕМА</div>
  <div class="theme-editor">
    <div class="theme-editor-top">
      <div class="theme-name-field"><label for="themeName">НАЗВАНИЕ</label><input id="themeName" maxlength="30" value="${esc(draft.name)}" autocomplete="off"></div>
      <button type="button" class="theme-btn primary" data-theme-apply>Применить и сохранить</button>
      <button type="button" class="theme-btn" data-theme-save-new>Сохранить как новую</button>
    </div>
    <div class="theme-color-grid">${fields.map(([key, label]) => `<div class="theme-color-cell"><label for="themeColor-${key}">${label}</label><input id="themeColor-${key}" type="color" data-theme-color="${key}" value="${esc(draft.colors[key])}"><code data-theme-hex="${key}">${esc(draft.colors[key].toUpperCase())}</code></div>`).join('')}</div>
    <div class="theme-editor-actions">
      <button type="button" class="theme-btn" data-theme-reset>Сбросить к активной</button>
      ${draft.editingId ? '<button type="button" class="theme-btn danger" data-theme-delete-current>Удалить тему</button>' : ''}
    </div>
    <p class="theme-note">Фон, панели, текст и акценты перекрашиваются сразу. Активная тема сохраняется между запусками.</p>
  </div>`;
}

function refreshThemeStudio() {
  if (dom.modalRoot.hidden) return;
  dom.modalRoot.innerHTML = `<div class="modal-dialog theme-dialog">${themeStudioHtml()}</div>`;
  $$('[data-close-modal]', dom.modalRoot).forEach((button) => button.addEventListener('click', closeModal));
  wireThemeStudio();
}

function wireThemeStudio() {
  const dialog = dom.modalRoot.querySelector('.theme-dialog');
  if (!dialog) return;
  const presetClick = (event) => {
    const deleteButton = event.target.closest('[data-theme-delete]');
    if (deleteButton) {
      event.stopPropagation();
      deleteTheme(deleteButton.dataset.themeDelete);
      return;
    }
    const editButton = event.target.closest('[data-theme-edit]');
    if (editButton) {
      event.stopPropagation();
      const theme = findTheme(state.themeSettings, editButton.dataset.themeEdit);
      state.themeDraft = { name: theme.name, colors: { ...theme.colors }, editingId: theme.id };
      state.activeThemeId = theme.id;
      applyActiveTheme();
      persistThemeSettings();
      state.themePreviewDirty = false;
      refreshThemeStudio();
      return;
    }
    const card = event.target.closest('[data-theme-preset]');
    if (!card) return;
    const theme = findTheme(state.themeSettings, card.dataset.themePreset);
    state.activeThemeId = theme.id;
    state.themeDraft = { name: theme.builtIn ? 'Моя тема' : theme.name, colors: { ...theme.colors }, editingId: theme.builtIn ? null : theme.id };
    state.themePreviewDirty = false;
    applyActiveTheme();
    persistThemeSettings();
    refreshThemeStudio();
  };
  dialog.addEventListener('click', presetClick);
  dialog.addEventListener('input', (event) => {
    const color = event.target.closest('[data-theme-color]');
    if (color) {
      const key = color.dataset.themeColor;
      const draft = state.themeDraft;
      const value = color.value;
      if (!isHex(value)) return;
      draft.colors[key] = value;
      const code = dialog.querySelector(`[data-theme-hex="${key}"]`);
      if (code) code.textContent = value.toUpperCase();
      themePreview(draft);
    }
    if (event.target.id === 'themeName') {
      state.themeDraft.name = event.target.value;
    }
  });
  dialog.querySelector('[data-theme-apply]')?.addEventListener('click', () => saveThemeDraft(false));
  dialog.querySelector('[data-theme-save-new]')?.addEventListener('click', () => saveThemeDraft(true));
  dialog.querySelector('[data-theme-reset]')?.addEventListener('click', () => {
    const active = currentTheme();
    state.themeDraft = { name: active.builtIn ? 'Моя тема' : active.name, colors: { ...active.colors }, editingId: active.builtIn ? null : active.id };
    state.themePreviewDirty = false;
    applyActiveTheme();
    refreshThemeStudio();
  });
  dialog.querySelector('[data-theme-delete-current]')?.addEventListener('click', () => {
    if (state.themeDraft?.editingId) deleteTheme(state.themeDraft.editingId);
  });
}

function saveThemeDraft(asNew) {
  const draft = state.themeDraft;
  if (!draft) return;
  let theme;
  if (!asNew && draft.editingId) {
    const index = state.themeSettings.customThemes.findIndex((item) => item.id === draft.editingId);
    theme = makeCustomTheme(draft.name, draft.colors, draft.editingId);
    if (index >= 0) state.themeSettings.customThemes[index] = theme;
    else state.themeSettings.customThemes.push(theme);
  } else {
    theme = makeCustomTheme(draft.name || 'Моя тема', draft.colors);
    state.themeSettings.customThemes.push(theme);
  }
  state.themeSettings.customThemes = state.themeSettings.customThemes.slice(-30);
  state.activeThemeId = theme.id;
  state.themeSettings.activeThemeId = theme.id;
  state.themeDraft = { name: theme.name, colors: { ...theme.colors }, editingId: theme.id };
  state.themePreviewDirty = false;
  applyActiveTheme();
  persistThemeSettings();
  refreshThemeStudio();
  showToast('Тема сохранена', theme.name, '');
}

function deleteTheme(themeId) {
  const theme = findTheme(state.themeSettings, themeId);
  if (!theme || theme.builtIn) return;
  state.themeSettings.customThemes = state.themeSettings.customThemes.filter((item) => item.id !== themeId);
  if (state.activeThemeId === themeId) state.activeThemeId = 'minecraft_parchment';
  state.themeDraft = { name: 'Моя тема', colors: { ...findTheme(state.themeSettings, state.activeThemeId).colors }, editingId: null };
  state.themePreviewDirty = false;
  applyActiveTheme();
  persistThemeSettings();
  refreshThemeStudio();
  showToast('Тема удалена', theme.name, '');
}

function showThemeStudio() {
  const active = currentTheme();
  state.themeDraft = { name: active.builtIn ? 'Моя тема' : active.name, colors: { ...active.colors }, editingId: active.builtIn ? null : active.id };
  state.themePreviewDirty = false;
  openModal(themeStudioHtml(), 'theme-dialog');
  wireThemeStudio();
}


function syncPipeline() {
  const project = state.project;
  if (!project || !dom.pipeSeed) return;
  const generation = project.generation || {};
  const chords = (project.chords || []).map((chord) => chord.label);
  const shortChords = chords.length > 3 ? `${chords.slice(0, 3).join(' · ')}…` : chords.join(' · ');
  const seed = String(project.seed || '—');
  setText(dom.pipeSeed, seed.length > 12 ? `${seed.slice(0, 11)}…` : seed);
  setText(dom.pipeKey, project.keyLabel || generation.key || '—');
  setText(dom.pipeChords, shortChords || '—');
  setText(dom.pipeForm, `${project.bars} · ${Math.round(project.bpm)}`);
  setText(dom.pipeRoles, `${project.tracks.length} · ${project.noteCount}`);
  setText(dom.pipeMix, project.isProof ? 'proof · piano' : `${generation.styleProfile === 'volume_alpha' ? 'felt' : 'ambient'} · reverb`);
  [['seed', seed], ['key', project.keyLabel], ['chords', chords.join(' · ')], ['form', `${project.bars} тактов · ${project.bpm} BPM`], ['roles', `${project.tracks.length} дорожек · ${project.noteCount} нот`], ['mix', project.isProof ? 'felt piano · reconstruction' : 'felt / reverb / stereo']].forEach(([stage, value]) => {
    const element = dom.pipelineSteps?.querySelector(`[data-stage="${stage}"]`);
    if (element) element.title = `${stage.toUpperCase()}: ${value}`;
  });
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function runPipeline() {
  if (state.exporting) {
    showToast('Идёт экспорт', 'Дождитесь окончания рендера WAV.', 'warn');
    return null;
  }
  if (state.pipelineRunning) return null;
  state.pipelineRunning = true;
  const steps = [...(dom.pipelineSteps?.querySelectorAll('.pipeline-step') || [])];
  steps.forEach((step) => step.classList.remove('active', 'done'));
  dom.pipelineSteps?.classList.add('running');
  dom.btnPipelineRun.disabled = true;
  for (const step of steps) {
    step.classList.add('active');
    await sleep(80);
    step.classList.remove('active');
    step.classList.add('done');
  }
  const summary = generateAmbient();
  // The values are replaced by the actual output of the sequence.
  syncPipeline();
  dom.pipelineSteps?.classList.remove('running');
  dom.btnPipelineRun.disabled = false;
  state.pipelineRunning = false;
  return summary;
}

function showAlgorithm() {
  const project = state.project;
  const generation = project?.generation || {};
  const stats = audio.lastRenderStats;
  const chordList = (generation.chords || []).join(' · ') || '—';
  const progression = (generation.progression || []).join(' → ') || '—';
  const signature = (generation.signature || []).map((id) => getInstrument(id)?.name || id).join(' · ');
  openModal(`
    <button type="button" class="icon-btn modal-close" data-close-modal aria-label="Закрыть"><svg><use href="#i-close"></use></svg></button>
    <div class="modal-kicker">AETHER · GENERATION PIPELINE</div>
    <h2>Последовательность генерации</h2>
    <p>Восемь шагов выполняются по порядку. Ниже — фактические значения текущей сессии; кнопка внизу запускает ту же последовательность заново.</p>
    <ol class="algo-steps">
      <li><b>Seed → PRNG.</b> FNV-1a хеширует seed и стиль, mulberry32 превращает хеш в предсказуемую последовательность.</li>
      <li><b>Профиль стиля.</b> Выбирается сигнатурный набор из 8 инструментов, лады, диапазон BPM и характер эффектов.</li>
      <li><b>Тональность.</b> Корень и лад выбираются из профиля; аккорды строятся по степеням лада.</li>
      <li><b>Гармония.</b> Прогрессия раскладывается по тактам: у Volume Alpha — длинные 4-барные блоки, у остальных — 2-барные.</li>
      <li><b>Форма.</b> Intro / build / body / outro управляют плотностью, регистром и громкостью событий.</li>
      <li><b>Восемь ролей.</b> Атмосфера, пэд, клавиши, бас, колокола, струнные, лид и пыль получают свои генераторы нот.</li>
      <li><b>Живой звук.</b> Web Audio планирует ноты, фильтры и общий реверб; экспорт повторяет ту же схему офлайн.</li>
      <li><b>Кэш и оптимизация.</b> Ноты кэшируются, тихие дорожки не планируются при экспорте, интерфейс обновляется без перерисовки всей сцены.</li>
    </ol>
    <div class="algo-stats">
      <div class="algo-stat"><span>SEED</span><strong>${esc(project?.seed || '—')}</strong></div>
      <div class="algo-stat"><span>HASH</span><strong>${esc(generation.seedHash || '—')}</strong></div>
      <div class="algo-stat"><span>КЛЮЧ</span><strong>${esc(project?.keyLabel || '—')}</strong></div>
      <div class="algo-stat"><span>ТАКТЫ</span><strong>${project?.bars || '—'} · ${project?.bpm?.toFixed(1) || '—'} BPM</strong></div>
      <div class="algo-stat"><span>АККОРДЫ</span><strong>${esc(chordList)}</strong></div>
      <div class="algo-stat"><span>ПРОГРЕССИЯ</span><strong>${esc(progression)}</strong></div>
      <div class="algo-stat"><span>НОТЫ / ПЛОТНОСТЬ</span><strong>${project?.noteCount || 0} · ${generation.density || 0}/такт</strong></div>
      <div class="algo-stat"><span>ГЕНЕРАЦИЯ</span><strong>${state.lastGenerationMs ? `${Math.round(state.lastGenerationMs)} мс` : '—'}</strong></div>
    </div>
    <div class="algo-trace"><b>INSTRUMENTS</b> ${esc(signature || '—')}<br><b>CHORD BARS</b> ${generation.chordBars || '—'} · <b>ALGORITHM</b> ${esc(generation.algorithm || 'AETHER Procedural Ambient v2')}<br><b>SECTIONS</b> ${esc((generation.sections || []).join(' / ') || '—')}<br><b>RENDER</b> ${stats ? `${stats.renderMs} мс · ${stats.sourceCount} источников` : 'ещё не экспортировался'}</div>
    <p class="theme-note">Случайный эмбиент — это тот же алгоритм с новым seed и случайно выбранным стилем. Кнопка «Случайный эмбиент» делает это одним нажатием.</p>
    <div class="algo-actions">
      <button type="button" class="theme-btn primary" data-algo-run>▶ Выполнить последовательность</button>
      <button type="button" class="theme-btn" data-algo-proof>20 сек · Wet Hands proof</button>
    </div>
  `, 'algo-dialog');
  dom.modalRoot.querySelector('[data-algo-run]')?.addEventListener('click', () => { closeModal(); runPipeline(); });
  dom.modalRoot.querySelector('[data-algo-proof]')?.addEventListener('click', () => { closeModal(); loadProof(); });
}

function loadProof() {
  if (state.exporting) {
    showToast('Идёт экспорт', 'Дождитесь окончания рендера WAV.', 'warn');
    return;
  }
  stopPlayback();
  const project = createWetHandsProof();
  commitProject(project, { announce: false });
  setStatus('Proof · Wet Hands 00:00–00:20', '');
  showToast('20-секундный proof', 'Wet Hands · Volume Alpha · синтезированная реконструкция');
}

function generateRandomAmbient() {
  if (state.exporting) {
    showToast('Идёт экспорт', 'Дождитесь окончания рендера WAV.', 'warn');
    return;
  }
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];
  const span = (style.bpmRange?.[1] || style.bpm + 8) - (style.bpmRange?.[0] || style.bpm - 8);
  const bpm = Math.round((style.bpmRange?.[0] || style.bpm - 8) + Math.random() * span);
  setStyle(style.id);
  dom.bpmInput.value = bpm.toFixed(1);
  dom.barsSelect.value = '16';
  const seed = makeSeed();
  dom.seedInput.value = seed;
  const summary = generateAmbient({ styleId: style.id, seed, announce: false });
  if (summary) {
    showToast('Случайный эмбиент', `${style.label} · ${summary.key} · ${summary.noteCount} нот`);
    setStatus('Случайный эмбиент сгенерирован', '');
  }
}


/* ---------- browser ---------- */

function renderBrowser() {
  if (!dom.browserContent) return;
  if (state.browserTab === 'styles') {
    const style = getStyle(state.styleId);
    const demos = demosForStyle(style.id);
    dom.browserContent.innerHTML = `
      <div class="browser-section-head"><span>СТИЛИ</span><b>${STYLES.length}</b></div>
      ${STYLES.map((item) => `
        <button type="button" class="style-tile ${item.id === state.styleId ? 'active' : ''}" data-action="select-style" data-style-id="${item.id}" style="--tile-accent:${item.accent};--tile-accent2:${item.accent2}">
          <span class="style-swatch"></span>
          <span class="style-tile-copy"><strong>${esc(item.label)}</strong><em>${esc(item.tagline)}</em></span>
          <span class="style-tile-count">${item.instrumentCount}</span>
        </button>
      `).join('')}
      <div class="browser-style-note">${esc(style.description)}</div>
      <div class="browser-section-head"><span>ДЕМО ЭТОГО СТИЛЯ</span><b>2</b></div>
      ${demos.map((demo) => demoCard(demo, style)).join('')}
    `;
  } else if (state.browserTab === 'sounds') {
    const style = getStyle(state.styleId);
    const usedIds = new Set((state.project?.tracks || []).map((track) => track.instrumentId));
    dom.browserContent.innerHTML = `
      <div class="browser-section-head"><span>${esc(style.short)}</span><b>${style.instrumentCount} ЗВ.</b></div>
      <div class="browser-style-note">Нажмите на инструмент, чтобы услышать короткий фрагмент. Инструменты с точкой уже стоят в сессии.</div>
      ${style.instruments.map((instrument) => `
        <button type="button" class="inst-row ${usedIds.has(instrument.id) ? 'used' : ''} ${state.auditionId === instrument.id ? 'playing' : ''}" data-instrument-id="${instrument.id}">
          <span class="inst-play"><svg><use href="#i-play"></use></svg></span>
          <span class="inst-name"><strong>${esc(instrument.name)}</strong><em>${esc(instrument.engineLabel)} · ${esc(ROLE_META[instrument.role]?.label || instrument.role)}</em></span>
          ${usedIds.has(instrument.id) ? '<span class="inst-used"></span>' : ''}
          <span class="inst-role">${esc(ROLE_META[instrument.role]?.label || instrument.role)}</span>
        </button>
      `).join('')}
    `;
  } else {
    dom.browserContent.innerHTML = `
      <div class="browser-section-head"><span>ВСЕ ДЕМО-ТРЕКИ</span><b>10</b></div>
      ${STYLES.map((style) => {
        const demos = demosForStyle(style.id);
        return `<div class="demo-group">
          <div class="demo-group-head"><span>${esc(style.label)}</span><b>${demos.length} ТРЕКА</b></div>
          ${demos.map((demo) => demoCard(demo, style)).join('')}
        </div>`;
      }).join('')}
    `;
  }
  $$('.browser-tabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.browserTab === state.browserTab);
  });
}

function demoCard(demo, style) {
  const active = state.project?.demoId === demo.id;
  return `<button type="button" class="demo-card ${active ? 'active' : ''}" data-demo-id="${demo.id}" style="--tile-accent:${style.accent}">
    <span class="demo-art"></span>
    <span class="demo-copy"><strong>${esc(demo.title)}</strong><span>${demo.bpm} BPM · ${esc(keyLabel(demo.key))} · ${formatTime(demo.bars * 4 * 60 / demo.bpm)}</span><em>${esc(demo.description)}</em></span>
  </button>`;
}

function setBrowserTab(tab) {
  if (!['styles', 'sounds', 'demos'].includes(tab)) return;
  state.browserTab = tab;
  renderBrowser();
  dom.browserContent.scrollTop = 0;
}

function bindBrowser() {
  dom.browserContent.addEventListener('click', (event) => {
    const demo = event.target.closest('[data-demo-id]');
    if (demo) {
      loadDemo(demo.dataset.demoId);
      return;
    }
    const styleTile = event.target.closest('[data-action="select-style"]');
    if (styleTile) {
      setStyle(styleTile.dataset.styleId);
      return;
    }
    const instrument = event.target.closest('[data-instrument-id]');
    if (instrument) auditionInstrument(instrument.dataset.instrumentId, instrument);
  });
  dom.tabs.forEach((button) => {
    button.addEventListener('click', () => setBrowserTab(button.dataset.browserTab));
  });
}

async function auditionInstrument(instrumentId, row = null) {
  try {
    const ready = await ensureAudio();
    if (!ready) return;
    state.auditionId = instrumentId;
    $$('.inst-row.playing').forEach((element) => element.classList.remove('playing'));
    const currentRow = row || $(`[data-instrument-id="${CSS.escape(instrumentId)}"]`);
    currentRow?.classList.add('playing');
    const project = state.project;
    await audio.preview(instrumentId, state.styleId, project?.key || { root: 0, mode: 'major' });
    window.setTimeout(() => {
      if (state.auditionId === instrumentId) {
        currentRow?.classList.remove('playing');
        state.auditionId = null;
      }
    }, 2200);
  } catch (error) {
    rememberError(error);
    showToast('Аудио недоступно', 'Web Audio не смог запуститься в этом окружении.', 'error');
  }
}

/* ---------- arrangement ---------- */

function renderRuler() {
  const project = state.project;
  if (!project) return;
  let html = '';
  for (let bar = 0; bar < project.bars; bar += 1) {
    const label = project.bars > 24 && bar % 2 === 1 ? '' : String(bar + 1);
    html += `<div class="ruler-bar"><span>${label}</span></div>`;
  }
  dom.ruler.innerHTML = `${html}<div class="ruler-playhead" id="rulerPlayhead"></div>`;
  dom.rulerPlayhead = $('#rulerPlayhead');
}

function clipNoteSvg(notes, clipBars) {
  const totalBeats = Math.max(1, clipBars * 4);
  const pitches = notes.map((note) => note.pitch);
  const minPitch = Math.min(...pitches);
  const maxPitch = Math.max(...pitches);
  const span = Math.max(6, maxPitch - minPitch);
  return notes.map((note) => {
    const x = clamp(note.startBeat / totalBeats, 0, 1) * 100;
    const width = Math.max(0.7, (note.durationBeats / totalBeats) * 100);
    const y = 2 + (1 - (note.pitch - minPitch) / span) * 19;
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="2.7" rx="0.7"></rect>`;
  }).join('');
}

function renderArrangement() {
  const project = state.project;
  if (!project) return;
  const style = getStyle(project.styleId);
  dom.laneGrid.style.backgroundSize = `${100 / project.bars}% 100%, ${100 / (project.bars * 4)}% 100%`;
  dom.laneGrid.style.backgroundImage = `linear-gradient(to right, rgba(207,184,148,.13) 1px, transparent 1px), linear-gradient(to right, rgba(207,184,148,.045) 1px, transparent 1px)`;
  dom.trackHeaders.innerHTML = project.tracks.map((track) => {
    const instrument = getInstrument(track.instrumentId);
    return `<div class="track-header" data-track-index="${track.index}" style="--track-color:${track.color}">
      <span class="track-accent"></span>
      <span class="track-num">${String(track.index + 1).padStart(2, '0')}</span>
      <div class="track-copy">
        <strong>${esc(track.displayName || track.slot)} <em>${track.displayName ? '' : esc(instrument?.name || '')}</em></strong>
        <span>${esc(track.roleLabel)} · ${track.clips.reduce((sum, clip) => sum + clip.notes.length, 0)} НОТ</span>
      </div>
      <div class="track-ms">
        <button type="button" class="ms-btn mute ${track.mute ? 'on' : ''}" data-ms="mute" data-track-index="${track.index}" title="Mute">M</button>
        <button type="button" class="ms-btn solo ${track.solo ? 'on' : ''}" data-ms="solo" data-track-index="${track.index}" title="Solo">S</button>
      </div>
    </div>`;
  }).join('');
  dom.laneRows.innerHTML = project.tracks.map((track) => {
    const clips = track.clips.map((clip) => {
      const left = (clip.startBar / project.bars) * 100;
      const width = (clip.bars / project.bars) * 100;
      return `<div class="clip" data-clip-id="${clip.id}" data-track-index="${track.index}" style="left:calc(${left}% + 1px);width:calc(${width}% - 2px);--clip-color:${track.color}" title="${esc(clip.name)} · ${clip.notes.length} нот">
        <div class="clip-head"><span class="clip-name">${esc(clip.name)}</span><span class="clip-count">${clip.notes.length}</span></div>
        <svg class="clip-notes" viewBox="0 0 100 28" preserveAspectRatio="none">${clipNoteSvg(clip.notes, clip.bars)}</svg>
      </div>`;
    }).join('');
    return `<div class="lane-row" data-track-index="${track.index}">${clips}</div>`;
  }).join('');
  applyRowHeight();
  updateSelectionClasses();
  updateTrackVisualState();
  updatePlayhead(state.position);
}

function applyRowHeight() {
  const available = dom.arrangementBody?.clientHeight || 0;
  const base = available > 220 ? clamp(available / 8, 36, 78) : 46;
  const height = Math.max(32, Math.round(base * state.zoom));
  document.documentElement.style.setProperty('--row-h', `${height}px`);
  setText(dom.zoomLabel, `${Math.round(state.zoom * 100)}%`);
}

function updateSelectionClasses() {
  $$('.track-header', dom.trackHeaders).forEach((header) => {
    header.classList.toggle('selected', Number(header.dataset.trackIndex) === state.selectedTrackIndex);
  });
  $$('.clip', dom.laneRows).forEach((clip) => {
    clip.classList.toggle('selected', clip.dataset.clipId === state.selectedClipId);
  });
}

function updateTrackVisualState() {
  const project = state.project;
  if (!project) return;
  const anySolo = project.tracks.some((track) => track.solo);
  $$('.track-header', dom.trackHeaders).forEach((header) => {
    const track = project.tracks[Number(header.dataset.trackIndex)];
    const silent = Boolean(track && (track.mute || (anySolo && !track.solo)));
    header.classList.toggle('is-silent', silent);
  });
  $$('.lane-row', dom.laneRows).forEach((row) => {
    const track = project.tracks[Number(row.dataset.trackIndex)];
    const silent = Boolean(track && (track.mute || (anySolo && !track.solo)));
    row.classList.toggle('is-silent', silent);
  });
  $$('.ms-btn.mute', dom.trackHeaders).forEach((button) => {
    const track = project.tracks[Number(button.dataset.trackIndex)];
    button.classList.toggle('on', Boolean(track?.mute));
  });
  $$('.ms-btn.solo', dom.trackHeaders).forEach((button) => {
    const track = project.tracks[Number(button.dataset.trackIndex)];
    button.classList.toggle('on', Boolean(track?.solo));
  });
}

function selectTrack(index, clipId = null) {
  if (!state.project) return;
  const track = state.project.tracks[index];
  if (!track) return;
  state.selectedTrackIndex = index;
  state.selectedClipId = clipId || track.clips[0]?.id || null;
  updateSelectionClasses();
  renderPianoRoll();
  renderTrackInspector();
  setStatus(`Выбрана дорожка ${String(index + 1).padStart(2, '0')} · ${track.slot}`, '');
}

function selectClip(clipId) {
  if (!state.project) return;
  for (const track of state.project.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) {
      state.selectedTrackIndex = track.index;
      state.selectedClipId = clip.id;
      updateSelectionClasses();
      renderPianoRoll();
      renderTrackInspector();
      return;
    }
  }
}

function selectedClip() {
  if (!state.project) return null;
  const track = state.project.tracks[state.selectedTrackIndex];
  if (!track) return null;
  return track.clips.find((clip) => clip.id === state.selectedClipId) || track.clips[0] || null;
}

function bindArrangement() {
  dom.trackHeaders.addEventListener('click', (event) => {
    const ms = event.target.closest('[data-ms]');
    if (ms) {
      event.stopPropagation();
      const track = state.project?.tracks[Number(ms.dataset.trackIndex)];
      if (!track) return;
      if (ms.dataset.ms === 'mute') track.mute = !track.mute;
      if (ms.dataset.ms === 'solo') track.solo = !track.solo;
      audio.updateMix(state.project);
      updateTrackVisualState();
      renderTrackInspector();
      setStatus(ms.dataset.ms === 'mute' ? (track.mute ? `Mute: ${track.slot}` : `Mute снят: ${track.slot}`) : (track.solo ? `Solo: ${track.slot}` : `Solo снят: ${track.slot}`), '');
      return;
    }
    const header = event.target.closest('.track-header');
    if (header) selectTrack(Number(header.dataset.trackIndex));
  });

  dom.lanes.addEventListener('click', (event) => {
    const clip = event.target.closest('.clip');
    if (clip) {
      selectTrack(Number(clip.dataset.trackIndex), clip.dataset.clipId);
      return;
    }
    const row = event.target.closest('.lane-row');
    if (row) selectTrack(Number(row.dataset.trackIndex));
    seekFromPointer(event, dom.lanes);
  });

  dom.ruler.addEventListener('click', (event) => seekFromPointer(event, dom.ruler));
  $('#overviewCanvas').parentElement.addEventListener('click', (event) => seekFromPointer(event, $('#overviewCanvas').parentElement));
}

function seekFromPointer(event, element) {
  if (!state.project) return;
  const rect = element.getBoundingClientRect();
  if (!rect.width) return;
  const fraction = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  seekTo(fraction * state.project.durationSec);
}

function seekTo(seconds) {
  if (!state.project) return;
  let target = clamp(Number(seconds) || 0, 0, state.project.durationSec);
  const snapTimes = { '1/4': 1, '1/8': 0.5, '1/16': 0.25, OFF: 0 };
  const step = snapTimes[state.snap];
  if (step) {
    const beat = 60 / state.project.bpm;
    target = Math.round(target / (beat * step)) * beat * step;
  }
  state.position = clamp(target, 0, state.project.durationSec);
  if (state.playing) {
    audio.play(state.project, state.position, state.loop);
  }
  updateTransportUi(state.position);
}

/* ---------- piano roll ---------- */

function renderPianoRoll() {
  const project = state.project;
  const clip = selectedClip();
  if (!project || !clip) {
    dom.prEmpty.classList.add('show');
    dom.prKeys.innerHTML = '';
    dom.prGrid.innerHTML = '';
    setText(dom.prMeta, '— нот');
    return;
  }
  dom.prEmpty.classList.remove('show');
  const notes = clip.notes;
  if (!notes.length) {
    dom.prEmpty.classList.add('show');
    dom.prKeys.innerHTML = '';
    dom.prGrid.innerHTML = '';
    setText(dom.prMeta, '0 нот');
    return;
  }
  let minPitch = Math.min(...notes.map((note) => note.pitch)) - 1;
  let maxPitch = Math.max(...notes.map((note) => note.pitch)) + 1;
  if (maxPitch - minPitch < 18) {
    const extra = 18 - (maxPitch - minPitch);
    minPitch -= Math.floor(extra / 2);
    maxPitch += Math.ceil(extra / 2);
  }
  if (maxPitch - minPitch > 36) {
    const center = Math.round(notes.reduce((sum, note) => sum + note.pitch, 0) / notes.length);
    minPitch = center - 18;
    maxPitch = center + 18;
  }
  minPitch = clamp(minPitch, 24, 84);
  maxPitch = clamp(maxPitch, Math.min(96, minPitch + 17), 104);
  const rows = maxPitch - minPitch + 1;
  const height = dom.prGrid.parentElement.clientHeight || 140;
  const rowHeight = height / rows;
  const clipBeats = clip.bars * 4;
  setText(dom.prClipName, `${clip.name} · ${getInstrument(project.tracks[state.selectedTrackIndex]?.instrumentId)?.name || ''}`);
  setText(dom.prMeta, `${notes.length} нот · ${noteName(minPitch)}–${noteName(maxPitch)}`);

  let keys = '';
  for (let pitch = maxPitch; pitch >= minPitch; pitch -= 1) {
    const black = [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
    const isC = ((pitch % 12) + 12) % 12 === 0;
    keys += `<div class="pr-key ${black ? 'black' : ''} ${isC ? 'c' : ''}" style="height:${rowHeight}px">${isC || black ? noteName(pitch) : ''}</div>`;
  }
  dom.prKeys.innerHTML = keys;
  dom.prGrid.style.backgroundSize = `100% ${rowHeight}px, ${100 / clip.bars}% 100%, ${100 / (clip.bars * 4)}% 100%`;
  const track = project.tracks[state.selectedTrackIndex];
  dom.prGrid.innerHTML = notes.map((note) => {
    const left = (note.startBeat / clipBeats) * 100;
    const width = (note.durationBeats / clipBeats) * 100;
    const top = (maxPitch - note.pitch) * rowHeight;
    return `<div class="pr-note" data-note-midi="${note.pitch}" style="left:${left}%;width:max(0.8%,${width}%);top:${top}px;height:${Math.max(3, rowHeight - 1)}px;--note-color:${track?.color || '#d0a878'}" title="${noteName(note.pitch)} · ${note.durationBeats.toFixed(2)} доли · velocity ${note.velocity.toFixed(2)}"></div>`;
  }).join('');
}

function setPianoOpen(open) {
  state.pianoOpen = Boolean(open);
  dom.pianoRoll.classList.toggle('collapsed', !state.pianoOpen);
  dom.viewPiano.classList.toggle('active', state.pianoOpen);
  dom.viewPlaylist.classList.toggle('active', !state.pianoOpen);
  if (state.pianoOpen) window.requestAnimationFrame(() => renderPianoRoll());
}

function bindPianoRoll() {
  dom.viewPiano.addEventListener('click', () => setPianoOpen(true));
  dom.viewPlaylist.addEventListener('click', () => setPianoOpen(false));
  dom.btnClosePiano.addEventListener('click', () => setPianoOpen(false));
  dom.prGrid.addEventListener('click', (event) => {
    const note = event.target.closest('[data-note-midi]');
    if (!note) return;
    const track = state.project?.tracks[state.selectedTrackIndex];
    if (track) auditionInstrument(track.instrumentId, null);
  });
}

/* ---------- inspector ---------- */

function renderTrackInspector() {
  const project = state.project;
  if (!project) {
    dom.trackInspector.innerHTML = '<div class="track-empty">Выберите дорожку или клип в плейлисте.</div>';
    return;
  }
  const track = project.tracks[state.selectedTrackIndex];
  if (!track) {
    dom.trackInspector.innerHTML = '<div class="track-empty">Дорожка не выбрана.</div>';
    return;
  }
  const instrument = getInstrument(track.instrumentId);
  const style = getStyle(project.styleId);
  const options = style.instruments.filter((item) => item.role === track.role);
  dom.trackInspector.innerHTML = `
    <div class="track-inspector-top">
      <span class="track-badge" style="--track-color:${track.color}"></span>
      <div class="track-inspector-title"><strong>${esc(track.displayName || `${track.slot} · ${String(track.index + 1).padStart(2, '0')}`)}</strong><span>${esc(track.displayName ? track.name.split(' · ').slice(1).join(' · ') : (instrument?.name || ''))}</span></div>
      <span class="inst-role">${esc(track.roleLabel)}</span>
    </div>
    <label class="field">ИНСТРУМЕНТ
      <select class="instrument-select" data-track-instrument>
        ${options.map((item) => `<option value="${item.id}" ${item.id === track.instrumentId ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
      </select>
    </label>
    <div class="mix-row"><label>VOL</label><input type="range" min="0" max="100" value="${track.volume}" data-track-volume><output>${track.volume}%</output></div>
    <div class="mix-row"><label>PAN</label><input type="range" min="-100" max="100" value="${track.pan}" data-track-pan><output>${track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}${Math.abs(track.pan)}</output></div>
    <div class="track-toggles">
      <button type="button" class="track-toggle mute ${track.mute ? 'on' : ''}" data-track-toggle="mute">MUTE</button>
      <button type="button" class="track-toggle solo ${track.solo ? 'on' : ''}" data-track-toggle="solo">SOLO</button>
    </div>
  `;
}

function bindInspector() {
  dom.trackInspector.addEventListener('input', (event) => {
    const track = state.project?.tracks[state.selectedTrackIndex];
    if (!track) return;
    if (event.target.matches('[data-track-volume]')) {
      track.volume = Number(event.target.value);
      const output = event.target.parentElement.querySelector('output');
      if (output) output.textContent = `${track.volume}%`;
      audio.updateMix(state.project);
    }
    if (event.target.matches('[data-track-pan]')) {
      track.pan = Number(event.target.value);
      const output = event.target.parentElement.querySelector('output');
      if (output) output.textContent = `${track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}${Math.abs(track.pan)}`;
      audio.updateMix(state.project);
    }
  });
  dom.trackInspector.addEventListener('change', (event) => {
    if (!event.target.matches('[data-track-instrument]')) return;
    const track = state.project?.tracks[state.selectedTrackIndex];
    if (!track) return;
    const instrument = getInstrument(event.target.value);
    if (!instrument || instrument.styleId !== state.project.styleId) return;
    track.instrumentId = instrument.id;
    track.role = instrument.role;
    track.roleLabel = instrument.engineLabel;
    track.name = `${track.slot} · ${instrument.name}`;
    renderArrangement();
    renderTrackInspector();
    renderBrowser();
    if (state.playing) {
      const position = audio.position;
      audio.play(state.project, position, state.loop);
    }
    showToast('Инструмент заменён', `${track.slot} → ${instrument.name}`);
  });
  dom.trackInspector.addEventListener('click', (event) => {
    const button = event.target.closest('[data-track-toggle]');
    if (!button) return;
    const track = state.project?.tracks[state.selectedTrackIndex];
    if (!track) return;
    if (button.dataset.trackToggle === 'mute') track.mute = !track.mute;
    if (button.dataset.trackToggle === 'solo') track.solo = !track.solo;
    audio.updateMix(state.project);
    updateTrackVisualState();
    renderTrackInspector();
  });
}

function renderStats() {
  const project = state.project;
  if (!project) return;
  setText(dom.statNotes, project.noteCount.toLocaleString('ru-RU'));
  setText(dom.statClips, String(project.clipCount));
  setText(dom.statDuration, formatTime(project.durationSec));
}

/* ---------- generator controls ---------- */

function bindGenerator() {
  dom.stylePickerButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = dom.stylePopover.hidden;
    dom.stylePopover.hidden = !open;
    dom.stylePickerButton.setAttribute('aria-expanded', String(open));
  });
  dom.stylePopover.addEventListener('click', (event) => {
    const option = event.target.closest('[data-action="pick-style"]');
    if (!option) return;
    setStyle(option.dataset.styleId);
    dom.stylePopover.hidden = true;
    dom.stylePickerButton.setAttribute('aria-expanded', 'false');
  });
  dom.barsSelect.addEventListener('change', updateGeneratePreview);
  dom.bpmInput.addEventListener('input', updateGeneratePreview);
  dom.bpmInput.addEventListener('change', () => {
    const value = parseFloat(dom.bpmInput.value);
    if (!Number.isFinite(value)) {
      if (state.project) dom.bpmInput.value = state.project.bpm.toFixed(1);
      updateGeneratePreview();
      return;
    }
    if (state.project) applyBpm(value);
    else {
      dom.bpmInput.value = normalizeBpm(value, getStyle(state.styleId)).toFixed(1);
      updateGeneratePreview();
    }
  });
  dom.bpmInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      dom.bpmInput.blur();
    }
  });
  dom.seedInput.addEventListener('input', updateGeneratePreview);
  dom.seedInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      generateAmbient();
    }
  });
  dom.btnSeed.addEventListener('click', randomizeSeed);
  dom.btnRandomize.addEventListener('click', randomizeSeed);
  dom.btnGenerate.addEventListener('click', () => runPipeline());
  dom.btnRandomAmbient.addEventListener('click', generateRandomAmbient);
  dom.btnPipelineRun.addEventListener('click', () => runPipeline());
  dom.btnProof.addEventListener('click', loadProof);
  dom.btnAlgorithm.addEventListener('click', showAlgorithm);
  dom.btnTheme.addEventListener('click', showThemeStudio);
  dom.btnExport.addEventListener('click', exportWav);
  dom.btnExportTop.addEventListener('click', exportWav);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.style-picker')) {
      dom.stylePopover.hidden = true;
      dom.stylePickerButton.setAttribute('aria-expanded', 'false');
    }
  });
  $$('[data-bpm-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const current = state.project?.bpm ?? parseFloat(dom.bpmInput.value) ?? getStyle(state.styleId).bpm;
      const next = clamp(current + Number(button.dataset.bpmStep), BPM_MIN, BPM_MAX);
      dom.bpmInput.value = next.toFixed(1);
      if (state.project) applyBpm(next);
      else updateGeneratePreview();
    });
  });
}

function randomizeSeed() {
  const seed = makeSeed();
  dom.seedInput.value = seed;
  updateGeneratePreview();
  showToast('Новый seed', seed);
}

function applyBpm(value) {
  if (!state.project) {
    dom.bpmInput.value = normalizeBpm(value, getStyle(state.styleId)).toFixed(1);
    updateGeneratePreview();
    return;
  }
  const bpm = normalizeBpm(value, getStyle(state.styleId));
  state.project.bpm = bpm;
  state.project.durationSec = (state.project.bars * 4 * 60) / bpm;
  state.flatNotes = projectNotes(state.project);
  dom.bpmInput.value = bpm.toFixed(1);
  setText(dom.bpmValue, bpm.toFixed(1));
  audio.stop();
  state.playing = false;
  state.position = 0;
  renderArrangement();
  syncGeneratorFields(false);
  updateTransportUi(0);
  setStatus(`Темп: ${bpm.toFixed(1)} BPM`, '');
}

/* ---------- transport ---------- */

function bindTransport() {
  dom.btnPlay.addEventListener('click', togglePlay);
  dom.btnStop.addEventListener('click', stopPlayback);
  dom.btnLoop.addEventListener('click', () => {
    state.loop = !state.loop;
    dom.btnLoop.classList.toggle('active', state.loop);
    audio.setLoop(state.loop);
    setStatus(state.loop ? 'Зацикливание включено' : 'Зацикливание выключено', '');
  });
  dom.btnZoomIn.addEventListener('click', () => {
    state.zoom = clamp(Math.round((state.zoom + 0.1) * 10) / 10, 0.8, 1.4);
    applyRowHeight();
    drawOverview();
  });
  dom.btnZoomOut.addEventListener('click', () => {
    state.zoom = clamp(Math.round((state.zoom - 0.1) * 10) / 10, 0.8, 1.4);
    applyRowHeight();
    drawOverview();
  });
  dom.snapChip.addEventListener('click', () => {
    const values = ['1/4', '1/8', '1/16', 'OFF'];
    state.snap = values[(values.indexOf(state.snap) + 1) % values.length];
    dom.snapChip.innerHTML = `SNAP <b>${state.snap === 'OFF' ? 'OFF' : state.snap}</b>`;
    setStatus(`Snap: ${state.snap}`, '');
  });
  $$('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      state.tool = button.dataset.tool;
      dom.toolButtons.forEach((item) => item.classList.toggle('active', item === button));
    });
  });
  $$('#modeSong, #modePattern').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.id === 'modePattern' ? 'pattern' : 'song';
      $('#modeSong').classList.toggle('active', state.mode === 'song');
      $('#modePattern').classList.toggle('active', state.mode === 'pattern');
      setStatus(state.mode === 'song' ? 'Режим песни' : 'Режим паттерна', '');
    });
  });
}

async function ensureAudio() {
  try {
    audio.ensureContext();
    if (!state.audioReady) {
      state.audioReady = true;
      dom.engineChip.classList.add('live');
      setText(dom.engineText, 'АУДИО ГОТОВО');
    }
    return true;
  } catch (error) {
    rememberError(error);
    setText(dom.engineText, 'АУДИО НЕДОСТУПНО');
    showToast('Аудио недоступно', 'Проверьте аудиоустройство и попробуйте снова.', 'error');
    return false;
  }
}

async function togglePlay() {
  if (!state.project) return;
  if (state.playing) {
    state.position = audio.pause();
    state.playing = false;
    updateTransportUi(state.position);
    setLcdState('PAUSED');
    setStatus('Пауза', '');
    return;
  }
  const ready = await ensureAudio();
  if (!ready) return;
  try {
    state.playing = true;
    state.idleCleared = false;
    const ok = audio.play(state.project, state.position, state.loop);
    if (!ok) throw new Error('Playback rejected');
    updatePlayButton();
    setLcdState('PLAYING');
    setStatus('Воспроизведение', '');
    updateTransportUi(state.position);
  } catch (error) {
    rememberError(error);
    state.playing = false;
    showToast('Не удалось запустить', String(error.message || error), 'error');
    setStatus('Ошибка воспроизведения', 'error');
  }
}

function stopPlayback() {
  audio.stop();
  state.playing = false;
  state.position = 0;
  state.idleCleared = false;
  updatePlayButton();
  updateTransportUi(0);
  setLcdState('STOPPED');
  setStatus('Остановлено', '');
}

function updatePlayButton() {
  if (!dom.playIcon) return;
  dom.playIcon.setAttribute('href', state.playing ? '#i-pause' : '#i-play');
  dom.btnPlay.classList.toggle('playing', state.playing);
  dom.btnPlay.setAttribute('aria-label', state.playing ? 'Пауза' : 'Играть');
}

function setLcdState(value) {
  setText(dom.lcdState, value);
}

function updateTransportUi(position) {
  const project = state.project;
  const duration = project?.durationSec || 0;
  const safe = clamp(Number(position) || 0, 0, duration);
  const main = formatTime(safe);
  const hundredths = String(Math.floor((safe % 1) * 100)).padStart(2, '0');
  setText(dom.timeMain, main);
  setText(dom.timeMs, `.${hundredths}`);
  setText(dom.barPos, formatBar(safe, project?.bpm || 60));
  setText(dom.statusClock, formatTime(safe, true));
  if (project) {
    setText(dom.bpmValue, project.bpm.toFixed(1));
    setText(dom.keyValue, project.keyLabel);
  }
  const fraction = duration > 0 ? safe / duration : 0;
  updatePlayhead(fraction);
}

function updatePlayhead(fraction) {
  const percent = `${clamp(fraction, 0, 1) * 100}%`;
  if (dom.lanePlayhead) dom.lanePlayhead.style.left = percent;
  if (dom.overviewPlayhead) dom.overviewPlayhead.style.left = percent;
  const rulerPlayhead = dom.rulerPlayhead || $('#rulerPlayhead');
  if (rulerPlayhead) rulerPlayhead.style.left = percent;
}

function tick(now) {
  if (!initialized) return;
  if (state.exporting) {
    requestAnimationFrame(tick);
    return;
  }
  if (state.playing && audio.playing) {
    state.position = audio.position;
    updateTransportUi(state.position);
  } else if (state.playing && !audio.playing) {
    state.playing = false;
    state.position = 0;
    updatePlayButton();
    updateTransportUi(0);
  }
  if (now - state.lastMeter > 55) {
    state.lastMeter = now;
    updateMeter();
  }
  if (now - state.lastVoiceTime > 260 && state.project) {
    state.lastVoiceTime = now;
    updateVoiceStatus();
  }
  if (now - state.lastHud > 100) {
    state.lastHud = now;
    if (dom.statusLight.classList.contains('busy') && !state.exporting) {
      dom.statusLight.classList.remove('busy');
    }
  }
  requestAnimationFrame(tick);
}

function clearMeter() {
  dom.masterSegments.forEach((segment) => {
    segment.classList.remove('on', 'warm', 'hot');
  });
  setText(dom.masterDb, '−∞ dB');
}

function updateMeter() {
  const levels = audio.levels();
  const level = clamp(Math.max(levels.rms * 4.2, levels.peak * 1.15), 0, 1);
  const lit = Math.round(level * dom.masterSegments.length);
  dom.masterSegments.forEach((segment, index) => {
    const on = index < lit;
    segment.classList.toggle('on', on);
    segment.classList.toggle('warm', on && index >= 8 && index < 10);
    segment.classList.toggle('hot', on && index >= 10);
  });
  const peak = levels.peak;
  setText(dom.masterDb, level > 0.01 ? `${(20 * Math.log10(Math.max(0.0001, peak))).toFixed(0)} dB` : '−∞ dB');
}

function updateVoiceStatus() {
  if (!state.project) return;
  const position = state.position;
  const notes = state.flatNotes?.length ? state.flatNotes : projectNotes(state.project);
  const count = notes.filter((note) => note.startSec <= position && note.endSec >= position).length;
  state.lastVoices = count;
  setText(dom.statusVoices, `${count} ${count === 1 ? 'голос' : count >= 2 && count <= 4 ? 'голоса' : 'голосов'}`);
}

/* ---------- overview ---------- */

function drawOverview() {
  const canvas = dom.overviewCanvas;
  const project = state.project;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);
  const style = getStyle(project?.styleId || state.styleId);
  const { r, g, b } = hexToRgb(style.accent);
  const { r: r2, g: g2, b: b2 } = hexToRgb(style.accent2);

  const bars = project?.bars || 16;
  ctx.strokeStyle = 'rgba(207,184,148,0.075)';
  ctx.lineWidth = 1;
  for (let bar = 1; bar < bars; bar += 1) {
    const x = (bar / bars) * width;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 4);
    ctx.lineTo(x + 0.5, height - 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(207,184,148,0.13)';
  ctx.beginPath();
  ctx.moveTo(0, height / 2 + 0.5);
  ctx.lineTo(width, height / 2 + 0.5);
  ctx.stroke();
  if (!project) return;

  const data = project.waveform;
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
  gradient.addColorStop(0.45, `rgba(${r},${g},${b},0.85)`);
  gradient.addColorStop(0.78, `rgba(${r2},${g2},${b2},0.78)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0.24)`);
  const columns = Math.min(260, Math.floor(width / 3));
  const step = Math.max(1, Math.floor(data.length / columns));
  ctx.fillStyle = gradient;
  const center = height / 2;
  for (let i = 0; i < columns; i += 1) {
    let max = 0;
    for (let j = 0; j < step; j += 1) max = Math.max(max, data[i * step + j] || 0);
    const x = (i / columns) * width;
    const h = 2 + Math.pow(max, 0.8) * (height * 0.37);
    const w = Math.max(1, width / columns - 1.1);
    ctx.beginPath();
    const radius = Math.min(w / 2, 1.4);
    ctx.roundRect(x, center - h, w, h * 2, radius);
    ctx.fill();
  }
  const area = ctx.createLinearGradient(0, 0, 0, height);
  area.addColorStop(0, `rgba(${r},${g},${b},0.1)`);
  area.addColorStop(0.5, `rgba(${r},${g},${b},0.02)`);
  area.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = area;
  ctx.fillRect(0, 0, width, height);
}

/* ---------- menus, modals, export, errors ---------- */

function bindMenus() {
  $$('[data-menu]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openMenu(button.dataset.menu, button);
    });
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.menu-popover') && !event.target.closest('[data-menu]')) closeMenu();
  });
  dom.modalRoot.addEventListener('click', (event) => {
    if (event.target === dom.modalRoot) closeModal();
  });
}

function menuItems(menu) {
  if (menu === 'file') {
    return [
      ['Новый эмбиент', 'G', () => generateAmbient()],
      ['Открыть демо', 'D', () => setBrowserTab('demos')],
      ['—'],
      ['Экспорт WAV', 'E', () => exportWav()],
      ['—'],
      ['Выход', '', () => quitApp()]
    ];
  }
  if (menu === 'edit') {
    return [
      ['Новый seed', 'R', () => randomizeSeed()],
      ['Сбросить темп', '', () => {
        if (!state.project) return;
        applyBpm(getStyle(state.project.styleId).bpm);
        showToast('Темп сброшен', `${state.project.bpm.toFixed(1)} BPM`);
      }]
    ];
  }
  if (menu === 'view') {
    return [
      ['Показать piano roll', 'P', () => setPianoOpen(true)],
      ['Скрыть piano roll', 'P', () => setPianoOpen(false)],
      ['—'],
      ['Раздел «Демо»', '', () => setBrowserTab('demos')],
      ['Раздел «Звуки»', '', () => setBrowserTab('sounds')],
      ['—'],
      ['Темы приложения', 'T', showThemeStudio],
      ['Алгоритм генерации', '', showAlgorithm],
      ['—'],
      ['Дорожки крупнее', '', () => { state.zoom = clamp(state.zoom + 0.1, 0.8, 1.4); applyRowHeight(); }],
      ['Дорожки компактнее', '', () => { state.zoom = clamp(state.zoom - 0.1, 0.8, 1.4); applyRowHeight(); }]
    ];
  }
  return [
    ['Горячие клавиши', '?', showShortcuts],
    ['О программе', '', showAbout]
  ];
}

function openMenu(menu, button) {
  closeMenu();
  const popover = document.createElement('div');
  popover.className = 'menu-popover';
  menuItems(menu).forEach(([label, hint, action]) => {
    if (label === '—') {
      popover.appendChild(document.createElement('hr'));
      return;
    }
    const item = document.createElement('button');
    item.type = 'button';
    item.innerHTML = `<span>${esc(label)}</span><span>${esc(hint)}</span>`;
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      closeMenu();
      action();
    });
    popover.appendChild(item);
  });
  document.body.appendChild(popover);
  const rect = button.getBoundingClientRect();
  popover.style.left = `${Math.min(window.innerWidth - 230, rect.left)}px`;
  popover.style.top = `${rect.bottom + 3}px`;
  $$('[data-menu]').forEach((item) => item.classList.toggle('open', item === button));
  state.activeMenu = popover;
}

function closeMenu() {
  if (state.activeMenu) state.activeMenu.remove();
  state.activeMenu = null;
  $$('[data-menu]').forEach((item) => item.classList.remove('open'));
  if (document.activeElement?.matches('[data-menu]')) document.activeElement.blur();
}

function openModal(html, dialogClass = '') {
  dom.modalRoot.innerHTML = `<div class="modal-dialog ${esc(dialogClass)}">${html}</div>`;
  dom.modalRoot.hidden = false;
  $$('[data-close-modal]', dom.modalRoot).forEach((button) => button.addEventListener('click', closeModal));
}

function closeModal() {
  if (state.themePreviewDirty) {
    state.themePreviewDirty = false;
    state.themeDraft = null;
    applyActiveTheme();
  }
  dom.modalRoot.hidden = true;
  dom.modalRoot.innerHTML = '';
}

function showShortcuts() {
  openModal(`
    <button type="button" class="icon-btn modal-close" data-close-modal aria-label="Закрыть"><svg><use href="#i-close"></use></svg></button>
    <div class="modal-kicker">AETHER · УПРАВЛЕНИЕ</div>
    <h2>Горячие клавиши</h2>
    <p>Всё, что нужно для быстрой работы с эмбиентом.</p>
    <div class="shortcut-grid">
      <kbd>Space</kbd><span>Играть / пауза</span>
      <kbd>S</kbd><span>Остановить и вернуться в начало</span>
      <kbd>L</kbd><span>Зациклить сессию</span>
      <kbd>G</kbd><span>Сгенерировать эмбиент</span>
      <kbd>R</kbd><span>Случайный seed</span>
      <kbd>P</kbd><span>Показать / скрыть piano roll</span>
      <kbd>1 — 5</kbd><span>Выбрать стиль генерации</span>
      <kbd>?</kbd><span>Эта справка</span>
    </div>
  `);
}

function showAbout() {
  const totalInstruments = STYLES.reduce((sum, style) => sum + style.instrumentCount, 0);
  openModal(`
    <button type="button" class="icon-btn modal-close" data-close-modal aria-label="Закрыть"><svg><use href="#i-close"></use></svg></button>
    <div class="modal-kicker">AETHER · AMBIENT STUDIO · 1.0</div>
    <h2>Тишина, собранная из звука</h2>
    <p>Оригинальная студия для генерации эмбиента. Не является копией FL Studio: интерфейс лишь использует знакомый язык дорожек, клипов и piano roll, чтобы работать было сразу понятно.</p>
    <p>Каждый стиль имеет собственный набор из 16 инструментов. Кнопка «Сгенерировать эмбиент» создаёт полноценную сессию на 8 дорожек: гармонию, фактуру, колокола, бас и воздух.</p>
    <div class="about-cols">
      <div class="about-stat"><strong>${totalInstruments}</strong><span>инструментов в 5 стилях</span></div>
      <div class="about-stat"><strong>10</strong><span>демо-треков, по 2 на стиль</span></div>
      <div class="about-stat"><strong>8</strong><span>дорожек в каждой сессии</span></div>
      <div class="about-stat"><strong>WAV</strong><span>44.1 kHz · 16-bit · stereo</span></div>
    </div>
  `);
}

function bindMisc() {
  dom.btnHelp.addEventListener('click', showShortcuts);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      if (!dom.modalRoot.hidden) closeModal();
    }
  });
  window.addEventListener('pagehide', () => audio.stop());
}

function bindKeyboard() {
  document.addEventListener('keydown', (event) => {
    const tag = event.target?.tagName;
    const editable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || event.target?.isContentEditable;
    if (editable) return;
    if (!dom.modalRoot.hidden || !dom.exportOverlay.hidden) {
      if (event.key === 'Escape') return;
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      togglePlay();
      return;
    }
    if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
      event.preventDefault();
      showShortcuts();
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 's') { event.preventDefault(); stopPlayback(); }
    if (key === 'g' && event.shiftKey) { event.preventDefault(); generateRandomAmbient(); return; }
    if (key === 'g') { event.preventDefault(); generateAmbient(); }
    if (key === 'r') { event.preventDefault(); randomizeSeed(); }
    if (key === 't') { event.preventDefault(); showThemeStudio(); }
    if (key === 'p') { event.preventDefault(); setPianoOpen(!state.pianoOpen); }
    if (key === 'l') {
      event.preventDefault();
      state.loop = !state.loop;
      dom.btnLoop.classList.toggle('active', state.loop);
      audio.setLoop(state.loop);
    }
    if (key === 'e') { event.preventDefault(); exportWav(); }
    const index = ['1', '2', '3', '4', '5'].indexOf(event.key);
    if (index >= 0) setStyle(STYLES[index].id);
  });
}

function bindWindowEvents() {
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      drawOverview();
      applyRowHeight();
      updateTransportUi(state.position);
    }, 90);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.playing) {
      state.position = audio.pause();
      state.playing = false;
      updatePlayButton();
      updateTransportUi(state.position);
    }
  });
}

function showToast(title, text = '', type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`.trim();
  const strong = document.createElement('strong');
  strong.textContent = title;
  const span = document.createElement('span');
  span.textContent = text;
  toast.append(strong, span);
  dom.toasts.appendChild(toast);
  while (dom.toasts.children.length > 4) dom.toasts.firstElementChild.remove();
  window.setTimeout(() => {
    toast.classList.add('out');
    window.setTimeout(() => toast.remove(), 280);
  }, 3600);
}

function setStatus(text, mode = '') {
  setText(dom.statusText, text);
  dom.statusLight.classList.toggle('busy', mode === 'busy' || state.exporting);
  dom.statusLight.classList.toggle('error', mode === 'error');
}

function quitApp() {
  if (window.pywebview?.api?.quit) {
    window.pywebview.api.quit();
  } else {
    window.close();
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunks = [];
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(''));
}

function downloadBlob(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 12000);
}

function deepCloneProject(project) {
  return JSON.parse(JSON.stringify(project));
}

async function exportWav() {
  if (!state.project) {
    showToast('Нет сессии', 'Сначала сгенерируйте эмбиент.', 'warn');
    return;
  }
  if (state.exporting) {
    showToast('Рендер уже идёт', 'Дождитесь завершения текущего файла.', 'warn');
    return;
  }
  state.exporting = true;
  document.body.classList.add('is-exporting');
  dom.btnExport.disabled = true;
  dom.btnExportTop.disabled = true;
  dom.btnGenerate.disabled = true;
  dom.exportOverlay.hidden = false;
  dom.exportTitle.textContent = 'Собираем эмбиент';
  dom.exportStatus.textContent = 'Готовим граф…';
  dom.exportProgress.style.width = '2%';
  dom.exportProject.textContent = `${state.project.title} · ${state.project.bpm.toFixed(1)} BPM`;
  dom.exportElapsed.textContent = '0.0 c';
  setStatus('Рендер WAV…', 'busy');
  dom.statusLight.classList.add('busy');
  const startedAt = performance.now();
  if (exportTicker) clearInterval(exportTicker);
  exportTicker = setInterval(() => {
    dom.exportElapsed.textContent = `${((performance.now() - startedAt) / 1000).toFixed(1)} c`;
  }, 120);

  try {
    const snapshot = deepCloneProject(state.project);
    const result = await audio.renderWav(snapshot, ({ progress = 0, message = '' } = {}) => {
      dom.exportProgress.style.width = `${Math.max(2, Math.min(92, progress * 100))}%`;
      dom.exportStatus.textContent = message || 'Рендерим…';
    });
    const bytes = result.wav.byteLength;
    const base64 = arrayBufferToBase64(result.wav);
    const filename = `AETHER - ${sanitizeFilename(snapshot.title)}.wav`;
    dom.exportProgress.style.width = '95%';
    dom.exportStatus.textContent = 'Сохраняем файл…';
    let saved = null;
    let canceled = false;
    if (window.pywebview?.api?.save_wav) {
      try {
        saved = await window.pywebview.api.save_wav(base64, filename);
        if (!saved) canceled = true;
      } catch (bridgeError) {
        rememberError(bridgeError);
        saved = null;
      }
    }
    if (!saved && !canceled) {
      downloadBlob(result.wav, filename);
      saved = `Загрузки/${filename}`;
    }
    dom.exportProgress.style.width = '100%';
    if (canceled) {
      dom.exportTitle.textContent = 'Экспорт отменён';
      dom.exportStatus.textContent = 'Файл не был сохранён';
      showToast('Экспорт отменён', 'Файл не сохранялся.', 'warn');
      setStatus('Экспорт отменён', '');
    } else {
      dom.exportTitle.textContent = 'Готово';
      dom.exportStatus.textContent = 'WAV-файл собран';
      showToast('WAV готов', `${formatSize(bytes)} · ${result.stats.duration.toFixed(1)} сек. · ${saved || filename}`);
      setStatus('WAV экспортирован', '');
    }
    window.setTimeout(() => { dom.exportOverlay.hidden = true; }, 780);
  } catch (error) {
    rememberError(error);
    console.error(error);
    dom.exportOverlay.hidden = true;
    showToast('Ошибка экспорта', String(error.message || error), 'error');
    setStatus('Ошибка экспорта', 'error');
  } finally {
    if (exportTicker) clearInterval(exportTicker);
    exportTicker = null;
    state.exporting = false;
    document.body.classList.remove('is-exporting');
    if (audio.lastRenderStats) {
      setText(dom.exportPerf, `Последний рендер: ${(audio.lastRenderStats.renderMs / 1000).toFixed(1)} с · ${audio.lastRenderStats.sourceCount} источников · ${(audio.lastRenderStats.rms * 100).toFixed(1)}% RMS`);
    }
    dom.btnExport.disabled = false;
    dom.btnExportTop.disabled = false;
    dom.btnGenerate.disabled = false;
    dom.statusLight.classList.remove('busy');
    window.setTimeout(() => { if (!state.exporting) dom.exportOverlay.hidden = true; }, 1000);
  }
}

/* ---------- debug / test surface ---------- */

function exposeDebugApi() {
  window.__AETHER__ = {
    get ready() { return true; },
    getState() {
      return {
        ready: initialized,
        styleId: state.styleId,
        styleLabel: getStyle(state.styleId).label,
        browserTab: state.browserTab,
        project: state.project ? projectSummary(state.project) : null,
        selectedTrackIndex: state.selectedTrackIndex,
        selectedClipId: state.selectedClipId,
        position: state.position,
        playing: state.playing,
        audioPlaying: audio.playing,
        audioReady: state.audioReady,
        audioState: audio.ctx?.state || null,
        loop: state.loop,
        exporting: state.exporting,
        pianoOpen: state.pianoOpen,
        validation: state.project ? validateProject(state.project) : ['no project'],
        errors: window.__AETHER_ERRORS__.slice(-5)
      };
    },
    getStyles() {
      return STYLES.map((style) => ({
        id: style.id,
        label: style.label,
        instruments: style.instrumentCount,
        instrumentList: style.instruments.map((instrument) => ({
          id: instrument.id, name: instrument.name, role: instrument.role, engine: instrument.engine
        })),
        demos: demosForStyle(style.id).length
      }));
    },
    getDemos() { return demoCatalog(); },
    getProject() { return state.project ? deepCloneProject(state.project) : null; },
    validate() { return state.project ? validateProject(state.project) : ['no project']; },
    generate(styleId, seed = null) { return generateAmbient({ styleId, seed }); },
    loadDemo(id) { return loadDemo(id); },
    loadProof() { loadProof(); return true; },
    setStyle(id) { setStyle(id); return state.styleId; },
    setBrowserTab(tab) { setBrowserTab(tab); return state.browserTab; },
    selectClip(trackIndex, clipId = null) {
      if (!state.project?.tracks[trackIndex]) return false;
      state.selectedTrackIndex = Number(trackIndex);
      state.selectedClipId = clipId || state.project.tracks[trackIndex].clips[0]?.id || null;
      updateSelectionClasses();
      renderPianoRoll();
      renderTrackInspector();
      return state.selectedClipId;
    },
    setBpm(value) { applyBpm(Number(value)); return state.project?.bpm || null; },
    setLoop(value) {
      state.loop = Boolean(value);
      dom.btnLoop.classList.toggle('active', state.loop);
      audio.setLoop(state.loop);
      return state.loop;
    },
    async play() { await togglePlay(); return { playing: state.playing, position: state.position, audioState: audio.ctx?.state || null }; },
    pause() { if (state.playing) { state.position = audio.pause(); state.playing = false; updateTransportUi(state.position); } return state.position; },
    stop() { stopPlayback(); return state.position; },
    seek(seconds) { seekTo(seconds); return state.position; },
    setTrack(trackIndex, patch = {}) {
      const track = state.project?.tracks[Number(trackIndex)];
      if (!track) return false;
      if (typeof patch.volume === 'number') track.volume = clamp(patch.volume, 0, 100);
      if (typeof patch.pan === 'number') track.pan = clamp(patch.pan, -100, 100);
      if (typeof patch.mute === 'boolean') track.mute = patch.mute;
      if (typeof patch.solo === 'boolean') track.solo = patch.solo;
      if (typeof patch.instrumentId === 'string') {
        const instrument = getInstrument(patch.instrumentId);
        if (instrument && instrument.styleId === state.project.styleId) {
          track.instrumentId = instrument.id;
          track.role = instrument.role;
          track.roleLabel = instrument.engineLabel;
          track.name = `${track.slot} · ${instrument.name}`;
        }
      }
      audio.updateMix(state.project);
      renderArrangement();
      renderTrackInspector();
      return true;
    },
    setPianoOpen(open) { setPianoOpen(open); return state.pianoOpen; },
    stressGenerate(count = 20) {
      const failures = [];
      const results = [];
      for (let i = 0; i < count; i += 1) {
        const style = STYLES[i % STYLES.length];
        try {
          const project = generateProject({ styleId: style.id, seed: `stress-${i}-${Date.now()}`, bpm: style.bpm + (i % 9) - 4, bars: BARS_OPTIONS[i % 3] });
          const errors = validateProject(project);
          if (errors.length) failures.push({ i, style: style.id, errors });
          results.push({ style: style.id, notes: project.noteCount, errors: errors.length });
        } catch (error) {
          failures.push({ i, style: style.id, errors: [String(error.message || error)] });
        }
      }
      return { count, failures, results };
    },
    validateAllDemos() {
      return demoCatalog().flatMap((group) => group.demos.map((demo) => {
        const project = createDemoProject(demo.id);
        return { id: demo.id, styleId: demo.styleId, errors: validateProject(project), notes: project.noteCount };
      }));
    },
    async renderCurrentBase64(options = {}) {
      if (!state.project) throw new Error('no project');
      const result = await audio.renderWav(deepCloneProject(state.project), null, options);
      return {
        base64: arrayBufferToBase64(result.wav),
        stats: result.stats,
        bytes: result.wav.byteLength,
        filename: `AETHER - ${sanitizeFilename(state.project.title)}.wav`
      };
    },
    async renderDemoBase64(demoId) {
      const project = createDemoProject(demoId);
      if (!project) throw new Error('unknown demo');
      const result = await audio.renderWav(project);
      return {
        base64: arrayBufferToBase64(result.wav),
        stats: result.stats,
        bytes: result.wav.byteLength,
        filename: `AETHER - ${sanitizeFilename(project.title)}.wav`,
        project: projectSummary(project)
      };
    },
    lastRenderStats() { return audio.lastRenderStats; },
    levels() { return audio.levels(); },
    getErrors() { return window.__AETHER_ERRORS__.slice(); }
  };
  window.__AETHER_READY__ = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
