/* AETHER theme system: built-in palettes, derived CSS variables, persistence. */

export const SETTINGS_KEY = 'aether.theme.settings.v2';

const DEFAULT_COLORS = {
  bg: '#0c0a08',
  panel: '#17130e',
  text: '#e8ddcb',
  muted: '#9c8a72',
  accent: '#d0a878',
  accent2: '#9caf8a',
  danger: '#b77a6c',
  warn: '#c6a36e'
};

export const BUILTIN_THEMES = Object.freeze([
  {
    id: 'minecraft_parchment',
    name: 'Minecraft Parchment',
    description: 'Тёплое дерево, бумага и кассетный свет',
    builtIn: true,
    colors: { ...DEFAULT_COLORS }
  },
  {
    id: 'cave_lantern',
    name: 'Cave Lantern',
    description: 'Холодный камень и тёплый фонарь',
    builtIn: true,
    colors: {
      bg: '#080c10', panel: '#10181c', text: '#e1e6dd', muted: '#849894',
      accent: '#d6a45f', accent2: '#7f9f94', danger: '#b87970', warn: '#d2ac70'
    }
  },
  {
    id: 'birch_grove',
    name: 'Birch Grove',
    description: 'Светлая берёза, мох и мягкая зелень',
    builtIn: true,
    colors: {
      bg: '#0a0d09', panel: '#151b13', text: '#e7e8d8', muted: '#98a38c',
      accent: '#cab98c', accent2: '#89a77f', danger: '#b77a70', warn: '#ccb27b'
    }
  },
  {
    id: 'nether_ember',
    name: 'Nether Ember',
    description: 'Тёмный камень, пепел и ржавый огонь',
    builtIn: true,
    colors: {
      bg: '#0f0908', panel: '#1d1210', text: '#efded2', muted: '#a58a7b',
      accent: '#d58b5f', accent2: '#9b7465', danger: '#d47a6d', warn: '#d6a268'
    }
  },
  {
    id: 'deep_aurora',
    name: 'Deep Aurora',
    description: 'Ночное небо, хвоя и приглушённая зелень',
    builtIn: true,
    colors: {
      bg: '#080c10', panel: '#10191f', text: '#dcebe8', muted: '#86a29e',
      accent: '#8fb3a7', accent2: '#b0a884', danger: '#b9827a', warn: '#c9b47e'
    }
  }
]);

const HEX = /^#[0-9a-f]{6}$/i;

export function isHex(value) {
  return typeof value === 'string' && HEX.test(value);
}

export function mix(a, b, amount = 0.5) {
  if (!isHex(a) || !isHex(b)) return a || b;
  const t = Math.max(0, Math.min(1, amount));
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

export function rgba(hex, alpha) {
  if (!isHex(hex)) return `rgba(208, 168, 120, ${alpha})`;
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export function rgbTriplet(hex) {
  if (!isHex(hex)) return '208, 168, 120';
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

export function normalizeColors(input = {}) {
  const colors = {};
  Object.entries(DEFAULT_COLORS).forEach(([key, fallback]) => {
    colors[key] = isHex(input[key]) ? input[key].toLowerCase() : fallback;
  });
  return colors;
}

export function deriveThemeVars(theme) {
  const c = normalizeColors(theme.colors);
  const panel = c.panel;
  return {
    '--bg': c.bg,
    '--bg-deep': mix(c.bg, '#000000', 0.42),
    '--shell': mix(c.bg, panel, 0.62),
    '--panel': panel,
    '--panel-2': mix(panel, c.text, 0.032),
    '--panel-3': mix(panel, c.text, 0.072),
    '--panel-4': mix(panel, c.text, 0.12),
    '--line': rgba(mix(c.text, panel, 0.55), 0.13),
    '--line-soft': rgba(mix(c.text, panel, 0.55), 0.07),
    '--line-strong': rgba(mix(c.text, panel, 0.55), 0.25),
    '--text': c.text,
    '--text-soft': mix(c.text, c.muted, 0.42),
    '--muted': c.muted,
    '--dim': mix(c.muted, panel, 0.46),
    '--accent': c.accent,
    '--accent-2': c.accent2,
    '--accent-rgb': rgbTriplet(c.accent),
    '--danger': c.danger,
    '--warn': c.warn,
    '--cyan': c.accent2
  };
}

export function makeCustomTheme(name, colors, id = null) {
  return {
    id: id || `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: String(name || 'Моя тема').trim().slice(0, 30) || 'Моя тема',
    description: 'Пользовательская тема',
    builtIn: false,
    colors: normalizeColors(colors)
  };
}

export function allThemes(settings) {
  return [...BUILTIN_THEMES, ...(settings?.customThemes || [])];
}

export function findTheme(settings, id) {
  return allThemes(settings).find((theme) => theme.id === id) || BUILTIN_THEMES[0];
}

export function normalizeSettings(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  const settings = {
    version: 2,
    activeThemeId: 'minecraft_parchment',
    customThemes: []
  };
  if (parsed && typeof parsed === 'object') {
    if (typeof parsed.activeThemeId === 'string') settings.activeThemeId = parsed.activeThemeId;
    if (Array.isArray(parsed.customThemes)) {
      settings.customThemes = parsed.customThemes
        .filter((theme) => theme && typeof theme.id === 'string' && typeof theme.name === 'string')
        .slice(0, 30)
        .map((theme) => makeCustomTheme(theme.name, theme.colors, theme.id));
    }
  }
  if (!findTheme(settings, settings.activeThemeId)) settings.activeThemeId = 'minecraft_parchment';
  return settings;
}

export function applyTheme(theme) {
  const vars = deriveThemeVars(theme);
  Object.entries(vars).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.dataset.themeName = theme.name;
  return vars;
}

export function activeColors(theme) {
  return normalizeColors(theme?.colors);
}
