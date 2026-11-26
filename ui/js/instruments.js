/* AETHER — style palettes, instrument catalog and demo score metadata.
   Every style owns exactly 16 playable instruments: 3 texture, 2 pad,
   3 keys, 2 bass, 3 bell, 2 strings and 1 lead. */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const MODES = {
  major:      { label: 'major',      intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor:      { label: 'minor',      intervals: [0, 2, 3, 5, 7, 8, 10] },
  dorian:     { label: 'dorian',     intervals: [0, 2, 3, 5, 7, 9, 10] },
  lydian:     { label: 'lydian',     intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { label: 'mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  phrygian:   { label: 'phrygian',   intervals: [0, 1, 3, 5, 7, 8, 10] }
};

export const ENGINE_LABELS = {
  felt: 'FELT PIANO',
  bell: 'FM BELL',
  pad: 'WARM PAD',
  glass: 'GLASS',
  bass: 'ROUND BASS',
  pluck: 'PLUCK',
  choir: 'VOX',
  drone: 'DRONE',
  texture: 'TEXTURE',
  strings: 'STRINGS',
  organ: 'ORGAN',
  mallet: 'MALLET',
  harp: 'HARP',
  tape: 'TAPE',
  sub: 'SUB',
  pulse: 'PULSE'
};

const TRACK_COLORS = {
  volume_alpha: ['#b99a72', '#a58a67', '#8f9b75', '#c2ab86', '#98765d', '#7f8a68', '#c0a17d', '#8a7056'],
  calm:         ['#8fa4a2', '#9baeb8', '#a8b6a6', '#7f9894', '#b7c2b4', '#8ea7a0', '#a0b0b7', '#758b88'],
  dark:         ['#8b7565', '#967667', '#75665f', '#a0806b', '#6f625c', '#9a7b70', '#7d6b61', '#655951'],
  ambient:      ['#9aa89c', '#a8b4a6', '#8f9f96', '#b3bda9', '#85998f', '#a2ad9c', '#95a59b', '#7f9288'],
  all:          ['#c2a077', '#9ca98b', '#b48d73', '#8d9b9a', '#c6b18b', '#a2917a', '#b2846b', '#918e7c']
};

const styles = [
  {
    id: 'volume_alpha',
    label: 'Volume Alpha 2011',
    short: 'VOLUME ALPHA',
    tagline: 'тёплое фетровое пиано и кассетная пыль',
    description: 'Тихое фетровое пиано, мягкие септаккорды, кассетный воздух и светлая меланхолия. Плотность и характер — как у Volume Alpha.',
    accent: '#c6a67b',
    accent2: '#93a382',
    bpm: 62,
    bpmRange: [52, 76],
    modes: ['major', 'lydian'],
    bars: 16,
    chordBars: 4,
    signature: ['va_tape', 'va_hearth', 'va_overworld', 'va_lowland', 'va_musicbox', 'va_strings', 'va_harp', 'va_vinyl'],
    fx: { reverb: 3.5, wet: 0.43, delay: 0.07, tone: 4700, drive: 0.05, reverbTone: 3200 },
    progressions: [
      [[0, 'maj7'], [4, 'sus4'], [5, 'min7'], [3, 'maj7']],
      [[0, 'add9'], [3, 'maj7'], [5, 'min7'], [4, 'sus2']],
      [[0, 'maj7'], [5, 'min7'], [3, 'maj7'], [4, 'sus4']]
    ],
    trackColors: TRACK_COLORS.volume_alpha,
    instruments: [
      { id: 'va_overworld', name: 'Overworld Felt', engine: 'felt', role: 'keys', params: { bright: 0.16, attack: 0.01, release: 2.6, detune: 2, cutoff: 1850 }, note: 'главное фетровое пиано' },
      { id: 'va_wetmoss', name: 'Wet Moss Keys', engine: 'felt', role: 'keys', params: { bright: 0.08, attack: 0.018, release: 3.0, detune: 6, cutoff: 1800 }, note: 'очень приглушённые клавиши' },
      { id: 'va_birch', name: 'Birch Mallet', engine: 'mallet', role: 'keys', params: { ratio: 1.51, index: 0.7, decay: 1.2, cutoff: 1800 }, note: 'тихий деревянный малет' },
      { id: 'va_hearth', name: 'Hearth Pad', engine: 'pad', role: 'pad', params: { cutoff: 700, attack: 3.8, release: 4.5, detune: 4 }, note: 'тёмный домашний пэд' },
      { id: 'va_cloud', name: 'Cloud Lullaby', engine: 'pad', role: 'pad', params: { cutoff: 1200, attack: 4.5, release: 5.0, detune: 7 }, note: 'мягкий светлый пэд' },
      { id: 'va_lowland', name: 'Lowland Bass', engine: 'bass', role: 'bass', params: { cutoff: 160, attack: 0.16, release: 2.2 }, note: 'тёплый округлый бас' },
      { id: 'va_sub', name: 'Moss Sub', engine: 'sub', role: 'bass', params: { attack: 0.3, release: 2.6 }, note: 'очень низкий суб' },
      { id: 'va_chime', name: 'Chime in Grass', engine: 'bell', role: 'bell', params: { ratio: 1.51, index: 0.75, decay: 3.8, cutoff: 2400 }, note: 'мягкий колокольчик' },
      { id: 'va_glass', name: 'Dew Glass', engine: 'glass', role: 'bell', params: { ratio: 2.01, decay: 4.0, cutoff: 2200 }, note: 'стеклянная капля' },
      { id: 'va_musicbox', name: 'Meadow Music Box', engine: 'mallet', role: 'bell', params: { ratio: 2.51, index: 1.1, decay: 2.4, cutoff: 2300 }, note: 'тихая музыкальная шкатулка' },
      { id: 'va_strings', name: 'Hearth Strings', engine: 'strings', role: 'strings', params: { cutoff: 1000, attack: 2.2, release: 3.6, detune: 4 }, note: 'тёплые струнные' },
      { id: 'va_choir', name: 'Quiet Choir', engine: 'choir', role: 'strings', params: { attack: 1.8, release: 3.4, cutoff: 1100 }, note: 'тихий хор' },
      { id: 'va_harp', name: 'Droplet Harp', engine: 'harp', role: 'lead', params: { bright: 0.25, release: 1.9, cutoff: 1900 }, note: 'капельная арфа' },
      { id: 'va_tape', name: 'Tape Meadow', engine: 'tape', role: 'texture', params: { center: 380, q: 0.8, attack: 3.0, release: 3.0, wow: 0.28 }, note: 'кассетная пыль' },
      { id: 'va_air', name: 'Meadow Air', engine: 'texture', role: 'texture', params: { center: 700, q: 1.1, attack: 2.8, release: 3.2 }, note: 'тихий воздух луга' },
      { id: 'va_vinyl', name: 'Warm Vinyl', engine: 'tape', role: 'texture', params: { center: 260, q: 0.9, attack: 1.8, release: 2.8, wow: 0.4 }, note: 'тёплый винил' }
    ]
  },
  {
    id: 'calm',
    label: 'Спокойный эмбиент',
    short: 'CALM',
    tagline: 'медленное дыхание',
    description: 'Прозрачные пэды, редкие арпеджио и морской воздух. Музыка для тихой комнаты.',
    accent: '#9aafa9',
    accent2: '#bcc3b2',
    bpm: 62,
    bpmRange: [48, 72],
    modes: ['major', 'lydian'],
    bars: 16,
    fx: { reverb: 4.6, wet: 0.49, delay: 0.13, tone: 9800, drive: 0.01 },
    progressions: [
      [[0, 'maj9'], [5, 'min7'], [3, 'maj7'], [4, 'sus2']],
      [[0, 'add9'], [2, 'min7'], [5, 'maj7'], [4, '6/9']],
      [[0, 'maj7'], [4, 'sus4'], [5, 'min9'], [3, 'maj7']]
    ],
    trackColors: TRACK_COLORS.calm,
    instruments: [
      { id: 'ca_dawn', name: 'Dawn Veil', engine: 'pad', role: 'pad', params: { cutoff: 1650, attack: 4.5, release: 6.0, detune: 7 }, note: 'рассветная дымка' },
      { id: 'ca_breath', name: 'Long Breath', engine: 'pad', role: 'pad', params: { cutoff: 900, attack: 5.5, release: 8.0, detune: 4 }, note: 'очень медленный пэд' },
      { id: 'ca_piano', name: 'Still Piano', engine: 'felt', role: 'keys', params: { bright: 0.38, attack: 0.02, release: 3.0, detune: 2 }, note: 'спокойное пиано' },
      { id: 'ca_keys', name: 'Rain Keys', engine: 'glass', role: 'keys', params: { ratio: 2.01, decay: 3.2, bright: 0.5 }, note: 'стеклянные клавиши' },
      { id: 'ca_organ', name: 'Soft Organ', engine: 'organ', role: 'keys', params: { cutoff: 2200, attack: 0.6, release: 2.8, tremolo: 3.8 }, note: 'мягкий орган' },
      { id: 'ca_bass', name: 'Tide Bass', engine: 'bass', role: 'bass', params: { cutoff: 250, attack: 0.3, release: 2.4 }, note: 'приливный бас' },
      { id: 'ca_sub', name: 'Blue Sub', engine: 'sub', role: 'bass', params: { attack: 0.45, release: 3.2 }, note: 'синий суб' },
      { id: 'ca_bell', name: 'Distant Bell', engine: 'bell', role: 'bell', params: { ratio: 1.51, index: 1.1, decay: 4.5 }, note: 'далёкий колокол' },
      { id: 'ca_celeste', name: 'Celeste', engine: 'glass', role: 'bell', params: { ratio: 3.01, decay: 5.0 }, note: 'небесная челеста' },
      { id: 'ca_mallet', name: 'Driftwood', engine: 'mallet', role: 'bell', params: { ratio: 2.51, index: 1.3, decay: 1.9 }, note: 'дерево, выброшенное морем' },
      { id: 'ca_strings', name: 'Slow Strings', engine: 'strings', role: 'strings', params: { cutoff: 1300, attack: 2.2, release: 4.5, detune: 6 }, note: 'медленные струнные' },
      { id: 'ca_choir', name: 'Breath Choir', engine: 'choir', role: 'strings', params: { attack: 2.0, release: 4.2, cutoff: 1400 }, note: 'дышащий хор' },
      { id: 'ca_harp', name: 'Quiet Harp', engine: 'harp', role: 'lead', params: { bright: 0.45, release: 2.4 }, note: 'тихая арфа' },
      { id: 'ca_air', name: 'Sea Air', engine: 'texture', role: 'texture', params: { center: 1100, q: 1.1, attack: 3.2, release: 4.0 }, note: 'морской воздух' },
      { id: 'ca_water', name: 'Shallow Water', engine: 'texture', role: 'texture', params: { center: 2300, q: 2.8, attack: 1.8, release: 3.0 }, note: 'мелкая вода' },
      { id: 'ca_tape', name: 'Soft Grain', engine: 'tape', role: 'texture', params: { center: 650, q: 0.8, attack: 2.0, release: 3.0, wow: 0.12 }, note: 'мягкое зерно' }
    ]
  },
  {
    id: 'dark',
    label: 'Дарк эмбиент',
    short: 'DARK',
    tagline: 'низкие пространства',
    description: 'Дроны, пустые коридоры, холодный металл и шёпот. Глубокий и медленный.',
    accent: '#9a7e6e',
    accent2: '#73645b',
    bpm: 54,
    bpmRange: [42, 66],
    modes: ['minor', 'phrygian', 'dorian'],
    bars: 16,
    fx: { reverb: 5.8, wet: 0.56, delay: 0.18, tone: 6200, drive: 0.07 },
    progressions: [
      [[0, 'min'], [5, 'maj'], [2, 'maj'], [6, 'maj']],
      [[0, 'min7'], [3, 'min'], [5, 'maj7'], [4, 'min']],
      [[0, 'min'], [1, 'maj'], [5, 'min7'], [6, 'maj']]
    ],
    trackColors: TRACK_COLORS.dark,
    instruments: [
      { id: 'da_drone', name: 'Obsidian Drone', engine: 'drone', role: 'pad', params: { cutoff: 300, attack: 6.0, release: 8.0, detune: 9 }, note: 'обсидиановый дрон' },
      { id: 'da_veil', name: 'Ash Veil', engine: 'pad', role: 'pad', params: { cutoff: 760, attack: 5.0, release: 7.0, detune: 12 }, note: 'пепельная вуаль' },
      { id: 'da_piano', name: 'Abandoned Piano', engine: 'felt', role: 'keys', params: { bright: 0.22, attack: 0.02, release: 4.0, detune: 13 }, note: 'заброшенное пиано' },
      { id: 'da_glasskey', name: 'Fractured Glass', engine: 'glass', role: 'keys', params: { ratio: 2.76, decay: 3.8, bright: 0.37 }, note: 'треснувшее стекло' },
      { id: 'da_rusted', name: 'Rusted Mallet', engine: 'mallet', role: 'keys', params: { ratio: 1.71, index: 2.5, decay: 2.6, bright: 0.28 }, note: 'ржавый молоточек' },
      { id: 'da_sub', name: 'Trench Sub', engine: 'sub', role: 'bass', params: { attack: 0.35, release: 4.5 }, note: 'подводный суб' },
      { id: 'da_bass', name: 'Iron Bass', engine: 'bass', role: 'bass', params: { cutoff: 170, attack: 0.2, release: 3.2 }, note: 'железный бас' },
      { id: 'da_bell', name: 'Funeral Bell', engine: 'bell', role: 'bell', params: { ratio: 1.41, index: 2.2, decay: 6.0 }, note: 'погребальный колокол' },
      { id: 'da_metal', name: 'Cold Metal', engine: 'mallet', role: 'bell', params: { ratio: 4.11, index: 3.2, decay: 3.8 }, note: 'холодный металл' },
      { id: 'da_ghost', name: 'Ghost Chime', engine: 'glass', role: 'bell', params: { ratio: 3.51, decay: 6.0 }, note: 'призрачный звон' },
      { id: 'da_choir', name: 'Hollow Choir', engine: 'choir', role: 'strings', params: { attack: 2.6, release: 5.5, cutoff: 1000 }, note: 'пустой хор' },
      { id: 'da_strings', name: 'Black Strings', engine: 'strings', role: 'strings', params: { cutoff: 950, attack: 2.8, release: 5.0, detune: 10 }, note: 'чёрные струнные' },
      { id: 'da_lead', name: 'Siren Glass', engine: 'glass', role: 'lead', params: { ratio: 1.99, decay: 5.2, bright: 0.28 }, note: 'стеклянная сирена' },
      { id: 'da_wind', name: 'Catacomb Wind', engine: 'texture', role: 'texture', params: { center: 520, q: 1.4, attack: 3.6, release: 5.0 }, note: 'ветер катакомб' },
      { id: 'da_grain', name: 'Granular Dust', engine: 'texture', role: 'texture', params: { center: 1800, q: 3.5, attack: 2.4, release: 4.0 }, note: 'гранулярная пыль' },
      { id: 'da_tape', name: 'Decayed Tape', engine: 'tape', role: 'texture', params: { center: 380, q: 1.6, attack: 3.0, release: 4.5, wow: 0.42 }, note: 'распавшаяся лента' }
    ]
  },
  {
    id: 'ambient',
    label: 'Эмбиент',
    short: 'AMBIENT',
    tagline: 'дрейфующие слои',
    description: 'Классический эмбиент: дрейфующие слои, стекло, ветер и медленные гармонии.',
    accent: '#a3b0a0',
    accent2: '#8b9c92',
    bpm: 68,
    bpmRange: [52, 78],
    modes: ['lydian', 'major', 'dorian'],
    bars: 16,
    fx: { reverb: 4.2, wet: 0.46, delay: 0.16, tone: 11200, drive: 0.02 },
    progressions: [
      [[0, 'sus2'], [3, 'maj7'], [5, 'min9'], [4, 'sus4']],
      [[0, 'maj7'], [1, 'maj7'], [5, 'min7'], [3, 'maj7']],
      [[0, 'add9'], [5, 'maj7'], [1, 'sus2'], [4, '6/9']]
    ],
    trackColors: TRACK_COLORS.ambient,
    instruments: [
      { id: 'am_airpad', name: 'Cirrus Pad', engine: 'pad', role: 'pad', params: { cutoff: 2100, attack: 3.8, release: 5.8, detune: 8 }, note: 'перистый пэд' },
      { id: 'am_drone', name: 'Slow Orbit', engine: 'drone', role: 'pad', params: { cutoff: 420, attack: 5.0, release: 7.0, detune: 7 }, note: 'медленная орбита' },
      { id: 'am_piano', name: 'Cloud Piano', engine: 'felt', role: 'keys', params: { bright: 0.5, attack: 0.015, release: 2.8, detune: 4 }, note: 'облачное пиано' },
      { id: 'am_pluck', name: 'Rain Pluck', engine: 'pluck', role: 'keys', params: { bright: 0.4, decay: 1.8, cutoff: 2600 }, note: 'дождевой плак' },
      { id: 'am_organ', name: 'Solar Organ', engine: 'organ', role: 'keys', params: { cutoff: 2600, attack: 0.5, release: 3.0, tremolo: 2.2 }, note: 'солнечный орган' },
      { id: 'am_bass', name: 'Deep Current', engine: 'bass', role: 'bass', params: { cutoff: 220, attack: 0.2, release: 2.8 }, note: 'глубокое течение' },
      { id: 'am_sub', name: 'Horizon Sub', engine: 'sub', role: 'bass', params: { attack: 0.3, release: 3.0 }, note: 'суб горизонта' },
      { id: 'am_bell', name: 'Glass Bell', engine: 'bell', role: 'bell', params: { ratio: 2.01, index: 1.2, decay: 4.2 }, note: 'стеклянный колокол' },
      { id: 'am_glass', name: 'Prism', engine: 'glass', role: 'bell', params: { ratio: 2.41, decay: 5.5 }, note: 'призма' },
      { id: 'am_mallet', name: 'Distant Mallet', engine: 'mallet', role: 'bell', params: { ratio: 2.21, index: 1.6, decay: 2.6 }, note: 'далёкий малет' },
      { id: 'am_strings', name: 'Aurora Strings', engine: 'strings', role: 'strings', params: { cutoff: 1750, attack: 1.8, release: 4.2, detune: 7 }, note: 'сияющие струнные' },
      { id: 'am_choir', name: 'Sky Choir', engine: 'choir', role: 'strings', params: { attack: 1.5, release: 3.8, cutoff: 1800 }, note: 'небесный хор' },
      { id: 'am_harp', name: 'Star Harp', engine: 'harp', role: 'lead', params: { bright: 0.7, release: 2.6 }, note: 'звёздная арфа' },
      { id: 'am_wind', name: 'High Wind', engine: 'texture', role: 'texture', params: { center: 2000, q: 1.2, attack: 2.5, release: 4.0 }, note: 'высокий ветер' },
      { id: 'am_rain', name: 'Field Rain', engine: 'texture', role: 'texture', params: { center: 3200, q: 2.0, attack: 1.6, release: 3.2 }, note: 'полевой дождь' },
      { id: 'am_tape', name: 'Warm Static', engine: 'tape', role: 'texture', params: { center: 800, q: 0.7, attack: 2.2, release: 3.5, wow: 0.1 }, note: 'тёплый статик' }
    ]
  },
  {
    id: 'all',
    label: 'Все вместе',
    short: 'ALL TOGETHER',
    tagline: 'инструменты всех миров',
    description: 'Инструменты всех направлений в одном свободном наборе. Неожиданные, но мягкие сочетания.',
    accent: '#c0a078',
    accent2: '#9aa88a',
    bpm: 70,
    bpmRange: [54, 82],
    modes: ['dorian', 'major', 'lydian', 'minor'],
    bars: 16,
    fx: { reverb: 4.0, wet: 0.43, delay: 0.15, tone: 10400, drive: 0.03 },
    progressions: [
      [[0, 'maj7'], [5, 'min7'], [3, 'maj9'], [4, 'sus2']],
      [[0, 'min7'], [3, 'maj7'], [5, 'min9'], [4, 'sus4']],
      [[0, '6/9'], [1, 'maj7'], [5, 'min7'], [3, 'add9']]
    ],
    trackColors: TRACK_COLORS.all,
    instruments: [
      { id: 'all_pad', name: 'Everything Pad', engine: 'pad', role: 'pad', params: { cutoff: 1550, attack: 3.0, release: 5.0, detune: 10 }, note: 'пэд из всех стилей' },
      { id: 'all_drone', name: 'Shared Root', engine: 'drone', role: 'pad', params: { cutoff: 360, attack: 4.5, release: 6.5, detune: 6 }, note: 'общий низкий корень' },
      { id: 'all_piano', name: 'Borrowed Piano', engine: 'felt', role: 'keys', params: { bright: 0.48, attack: 0.015, release: 2.2, detune: 6 }, note: 'взятое напрокат пиано' },
      { id: 'all_organ', name: 'Hybrid Organ', engine: 'organ', role: 'keys', params: { cutoff: 2400, attack: 0.35, release: 2.5, tremolo: 4.4 }, note: 'гибридный орган' },
      { id: 'all_glasskey', name: 'Crossfade Glass', engine: 'glass', role: 'keys', params: { ratio: 2.31, decay: 3.4, bright: 0.55 }, note: 'стеклянный кроссфейд' },
      { id: 'all_bass', name: 'Common Bass', engine: 'bass', role: 'bass', params: { cutoff: 240, attack: 0.16, release: 2.1 }, note: 'общий бас' },
      { id: 'all_sub', name: 'Unified Sub', engine: 'sub', role: 'bass', params: { attack: 0.28, release: 3.0 }, note: 'единый суб' },
      { id: 'all_bell', name: 'Twin Bell', engine: 'bell', role: 'bell', params: { ratio: 1.81, index: 1.8, decay: 4.0 }, note: 'двойной колокол' },
      { id: 'all_choirbell', name: 'Choir Bell', engine: 'choir', role: 'bell', params: { attack: 0.15, release: 3.0, cutoff: 2100 }, note: 'вокальный колокол' },
      { id: 'all_mallet', name: 'Migration Mallet', engine: 'mallet', role: 'bell', params: { ratio: 2.71, index: 1.5, decay: 2.0 }, note: 'малет-мигрант' },
      { id: 'all_strings', name: 'All Strings', engine: 'strings', role: 'strings', params: { cutoff: 1650, attack: 1.6, release: 4.0, detune: 8 }, note: 'все струнные' },
      { id: 'all_choir', name: 'All Voices', engine: 'choir', role: 'strings', params: { attack: 1.0, release: 3.4, cutoff: 1900 }, note: 'все голоса' },
      { id: 'all_harp', name: 'Patchwork Harp', engine: 'harp', role: 'lead', params: { bright: 0.6, release: 2.1 }, note: 'лоскутная арфа' },
      { id: 'all_texture', name: 'Collage Air', engine: 'texture', role: 'texture', params: { center: 1500, q: 1.6, attack: 2.0, release: 3.4 }, note: 'коллаж воздуха' },
      { id: 'all_tape', name: 'Tape From Everywhere', engine: 'tape', role: 'texture', params: { center: 700, q: 1.0, attack: 2.8, release: 3.6, wow: 0.25 }, note: 'лента отовсюду' },
      { id: 'all_grain', name: 'Granular Mix', engine: 'texture', role: 'texture', params: { center: 2500, q: 3.0, attack: 1.8, release: 3.8 }, note: 'гранулярный микс' }
    ]
  }
];

export const STYLES = Object.freeze(styles.map((style) => {
  const instruments = Object.freeze(style.instruments.map((instrument) => Object.freeze({
    ...instrument,
    styleId: style.id,
    engineLabel: ENGINE_LABELS[instrument.engine] || instrument.engine.toUpperCase()
  })));
  return Object.freeze({ ...style, instruments, instrumentCount: instruments.length });
}));

export const STYLE_BY_ID = new Map(STYLES.map((style) => [style.id, style]));

export const ALL_INSTRUMENTS = STYLES.flatMap((style) => style.instruments);
export const INSTRUMENT_BY_ID = new Map(ALL_INSTRUMENTS.map((instrument) => [instrument.id, instrument]));

export function getStyle(id) {
  return STYLE_BY_ID.get(id) || STYLES[0];
}

export function getInstrument(id) {
  return INSTRUMENT_BY_ID.get(id) || null;
}

export function noteName(midi) {
  if (!Number.isFinite(midi)) return '—';
  const value = Math.round(midi);
  return `${NOTE_NAMES[((value % 12) + 12) % 12]}${Math.floor(value / 12) - 1}`;
}

export function keyLabel(key) {
  if (!key || !Number.isFinite(key.root) || !MODES[key.mode]) return '—';
  return `${NOTE_NAMES[((key.root % 12) + 12) % 12]} ${MODES[key.mode].label}`;
}

const DEMOS = [
  {
    id: 'va_mosslight', styleId: 'volume_alpha', title: 'Mosslight',
    subtitle: 'Volume Alpha · демо 01',
    description: 'Светлое фетровое пиано, кассетный воздух и колокольчики над мхом.',
    seed: 'mosslight-2011', bpm: 66, key: { root: 9, mode: 'major' }, bars: 16,
    instruments: ['va_air', 'va_hearth', 'va_overworld', 'va_lowland', 'va_chime', 'va_strings', 'va_harp', 'va_tape']
  },
  {
    id: 'va_rainhearth', styleId: 'volume_alpha', title: 'Rain on the Hearth',
    subtitle: 'Volume Alpha · демо 02',
    description: 'Влажные клавиши, музыкальная шкатулка и тёплый шум дождя.',
    seed: 'rain-hearth-va', bpm: 72, key: { root: 2, mode: 'lydian' }, bars: 16,
    instruments: ['va_tape', 'va_cloud', 'va_wetmoss', 'va_sub', 'va_musicbox', 'va_choir', 'va_harp', 'va_vinyl']
  },
  {
    id: 'ca_stillwater', styleId: 'calm', title: 'Still Water',
    subtitle: 'Спокойный · демо 01',
    description: 'Медленное дыхание пэдов и стеклянные капли над неподвижной водой.',
    seed: 'still-water-calm', bpm: 60, key: { root: 0, mode: 'major' }, bars: 16,
    instruments: ['ca_air', 'ca_dawn', 'ca_piano', 'ca_bass', 'ca_bell', 'ca_strings', 'ca_harp', 'ca_water']
  },
  {
    id: 'ca_lowtide', styleId: 'calm', title: 'Low Tide Letters',
    subtitle: 'Спокойный · демо 02',
    description: 'Письма, оставленные на берегу: мягкий орган, хор и далёкая челеста.',
    seed: 'low-tide-letters', bpm: 64, key: { root: 7, mode: 'major' }, bars: 16,
    instruments: ['ca_water', 'ca_breath', 'ca_keys', 'ca_sub', 'ca_celeste', 'ca_choir', 'ca_harp', 'ca_tape']
  },
  {
    id: 'da_obsidian', styleId: 'dark', title: 'Obsidian Choir',
    subtitle: 'Дарк · демо 01',
    description: 'Низкий дрон, пустой хор и металл, который звучит в темноте.',
    seed: 'obsidian-choir', bpm: 52, key: { root: 0, mode: 'minor' }, bars: 16,
    instruments: ['da_wind', 'da_drone', 'da_piano', 'da_sub', 'da_bell', 'da_choir', 'da_lead', 'da_grain']
  },
  {
    id: 'da_signal', styleId: 'dark', title: 'Signal from the Deep',
    subtitle: 'Дарк · демо 02',
    description: 'Сигнал из глубины: железный бас, чёрные струны и гранулярная пыль.',
    seed: 'signal-deep-dark', bpm: 56, key: { root: 2, mode: 'phrygian' }, bars: 16,
    instruments: ['da_grain', 'da_veil', 'da_glasskey', 'da_bass', 'da_metal', 'da_strings', 'da_lead', 'da_tape']
  },
  {
    id: 'am_cloudatlas', styleId: 'ambient', title: 'Cloud Atlas',
    subtitle: 'Эмбиент · демо 01',
    description: 'Перистые пэды, облачное пиано и сияющие струнные в высоком небе.',
    seed: 'cloud-atlas-am', bpm: 68, key: { root: 4, mode: 'lydian' }, bars: 16,
    instruments: ['am_wind', 'am_airpad', 'am_piano', 'am_bass', 'am_bell', 'am_strings', 'am_harp', 'am_rain']
  },
  {
    id: 'am_sloworbit', styleId: 'ambient', title: 'Slow Orbit',
    subtitle: 'Эмбиент · демо 02',
    description: 'Медленная орбита, призмы и тёплый статик на дальней стороне Земли.',
    seed: 'slow-orbit-am', bpm: 62, key: { root: 5, mode: 'major' }, bars: 16,
    instruments: ['am_rain', 'am_drone', 'am_pluck', 'am_sub', 'am_glass', 'am_choir', 'am_harp', 'am_tape']
  },
  {
    id: 'all_everything', styleId: 'all', title: 'Everything at Once',
    subtitle: 'Все вместе · демо 01',
    description: 'Все миры в одной комнате: тёплое пиано, струнные, колокола и лента.',
    seed: 'everything-at-once', bpm: 72, key: { root: 9, mode: 'dorian' }, bars: 16,
    instruments: ['all_texture', 'all_pad', 'all_piano', 'all_bass', 'all_bell', 'all_strings', 'all_harp', 'all_tape']
  },
  {
    id: 'all_collage', styleId: 'all', title: 'Collage of Weather',
    subtitle: 'Все вместе · демо 02',
    description: 'Коллаж погоды: орган, малет, хор и гранулярный воздух разных стилей.',
    seed: 'collage-of-weather', bpm: 65, key: { root: 2, mode: 'major' }, bars: 16,
    instruments: ['all_grain', 'all_drone', 'all_organ', 'all_sub', 'all_mallet', 'all_choir', 'all_harp', 'all_texture']
  }
];

export const DEMO_TRACKS = Object.freeze(DEMOS.map((demo) => Object.freeze(demo)));

export const DEMO_BY_ID = new Map(DEMO_TRACKS.map((demo) => [demo.id, demo]));

export function demosForStyle(styleId) {
  return DEMO_TRACKS.filter((demo) => demo.styleId === styleId);
}

export const ROLE_LABELS = {
  texture: 'ATMOS',
  pad: 'PAD',
  keys: 'KEYS',
  bass: 'BASS',
  bell: 'BELLS',
  strings: 'STRINGS',
  lead: 'LEAD'
};

export const SLOT_ROLES = ['texture', 'pad', 'keys', 'bass', 'bell', 'strings', 'lead', 'texture'];
export const SLOT_LABELS = ['ATMOS', 'PAD', 'KEYS', 'BASS', 'BELLS', 'STRINGS', 'LEAD', 'DUST'];

export const ROLE_META = {
  texture: { label: 'Атмосфера', color: '#7ca8a0' },
  pad: { label: 'Пэды', color: '#6d9fd0' },
  keys: { label: 'Клавиши', color: '#d2b57a' },
  bass: { label: 'Бас', color: '#8d7bb8' },
  bell: { label: 'Колокола', color: '#7fc9c3' },
  strings: { label: 'Струнные', color: '#c78da0' },
  lead: { label: 'Лид', color: '#d69b6b' }
};
