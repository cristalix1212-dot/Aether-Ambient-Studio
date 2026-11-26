/* Deterministic ambient composer.
   A project is a small score: 8 tracks, clips, notes, harmony and render hints.
   No audio nodes live here, which keeps generation instant and testable. */

import {
  STYLES, getStyle, getInstrument, MODES, NOTE_NAMES, DEMO_BY_ID,
  SLOT_ROLES, SLOT_LABELS, demosForStyle, keyLabel
} from './instruments.js';
import { WET_HANDS_NOTES, WET_HANDS_META } from './proof_cover.js';

const QUALITIES = {
  maj: [0, 4, 7],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  add9: [0, 4, 7, 14],
  '6/9': [0, 4, 7, 9, 14],
  sus2: [0, 2, 7, 14],
  sus4: [0, 5, 7, 12],
  min: [0, 3, 7],
  min7: [0, 3, 7, 10],
  min9: [0, 3, 7, 10, 14],
  dim: [0, 3, 6],
  quartal: [0, 5, 10, 15]
};

const ARP_PATTERNS = [
  [0, 1.5, 2, 3.5, 4, 5.5, 6.5],
  [0, 1, 2.5, 3, 4.5, 5.5, 7],
  [0, 0.75, 1.5, 3, 4, 4.75, 6, 7],
  [0, 2, 3.5, 4, 5, 6.5],
  [0, 1.5, 3, 4.5, 6],
  [0, 1, 3, 4, 6, 7]
];

const BELL_PATTERNS = [
  [0.5, 2, 3.5, 5.5, 6.5],
  [0.75, 2.5, 4.25, 6],
  [0.5, 1.5, 4, 6.5],
  [1, 3, 4.5, 6]
];

const DUST_PATTERNS = [
  [0.25, 1.75, 3.25, 5.75],
  [0.5, 2.75, 4.25, 6.25],
  [1.25, 3.5, 5.5, 7],
  [0.25, 2, 3.75, 5, 6.75]
];

const TITLE_A = [
  'Tidal', 'Quiet', 'Amber', 'Hollow', 'Slow', 'Paper', 'Glass', 'Distant',
  'Soft', 'Pale', 'Northern', 'Sleeping', 'Open', 'Faded', 'Silver', 'Still',
  'Low', 'Feather', 'Moss', 'Velvet', 'Rain', 'Dust', 'Blue', 'Wandering'
];
const TITLE_B = [
  'Meadow', 'Orbit', 'Harbor', 'Choir', 'Rain', 'Signals', 'Light', 'Fields',
  'Rooms', 'Tides', 'Clouds', 'Static', 'Gardens', 'Horizon', 'Dust', 'Letters',
  'Rooms', 'Bells', 'Current', 'Weather', 'Windows', 'Drift', 'Hearth', 'Relay'
];

export const BARS_OPTIONS = [8, 16, 32];
export const BPM_MIN = 36;
export const BPM_MAX = 180;
export const TAIL_SECONDS = 8;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function hashString(value) {
  const text = String(value);
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

export function makeRng(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  state = (state + 0x6D2B79F5) >>> 0;
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  constructor(seed) {
    this.next = makeRng(seed);
  }
  float(min, max) {
    return min + this.next() * (max - min);
  }
  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  chance(probability) {
    return this.next() < probability;
  }
  shuffle(list) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

export function makeSeed() {
  try {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  }
}

export function normalizeKey(key) {
  const root = Number.isFinite(Number(key?.root)) ? ((Math.round(Number(key.root)) % 12) + 12) % 12 : 0;
  const mode = MODES[key?.mode] ? key.mode : 'major';
  return { root, mode, label: keyLabel({ root, mode }) };
}

export function normalizeBpm(bpm, style = STYLES[0]) {
  const value = Number(bpm);
  if (!Number.isFinite(value)) return style.bpm;
  return Math.round(clamp(value, BPM_MIN, BPM_MAX) * 10) / 10;
}

function chooseKey(style, rng) {
  const mode = rng.pick(style.modes);
  const roots = style.id === 'volume_alpha' ? [9, 2, 4, 7, 0, 5] : [0, 2, 4, 5, 7, 9, 10];
  return { root: rng.pick(roots), mode };
}

function buildProgression(style, key, bars, rng) {
  const progression = rng.pick(style.progressions);
  const mode = MODES[key.mode].intervals;
  const chordBars = style.chordBars || 2;
  const chords = [];
  for (let bar = 0; bar < bars; bar += chordBars) {
    const chordIndex = bar / chordBars;
    const [degree, quality] = progression[chordIndex % progression.length];
    const safeDegree = ((degree % 7) + 7) % 7;
    const rootMidi = 48 + key.root + mode[safeDegree];
    const intervals = QUALITIES[quality] || QUALITIES.maj;
    chords.push({
      startBar: bar,
      bars: Math.min(chordBars, bars - bar),
      index: chordIndex,
      degree: safeDegree,
      quality,
      label: `${NOTE_NAMES[(rootMidi % 12 + 12) % 12]}${quality}`,
      rootMidi,
      tones: intervals.map((interval) => rootMidi + interval)
    });
  }
  return { progression, chords, chordBars };
}

function chordForBar(chords, bar) {
  let found = chords[0];
  for (const chord of chords) {
    if (chord.startBar <= bar) found = chord;
    else break;
  }
  return found;
}

function sectionShape(bar, bars) {
  if (bars <= 8) return bar < 1 ? 0.55 : bar < bars - 2 ? 1 : 0.72;
  if (bar < 4) return 0.54 + bar * 0.04;
  if (bar < 8) return 0.78;
  if (bar < bars - 4) return 1;
  return 0.7;
}

function registerFor(role, instrument, style) {
  const base = {
    texture: 12,
    pad: 0,
    keys: 12,
    bass: -12,
    bell: 24,
    strings: 12,
    lead: 24
  }[role] ?? 0;
  let shift = 0;
  if (instrument?.engine === 'sub') shift -= 12;
  if (role === 'pad' && style.id === 'dark') shift -= 12;
  if (style.id === 'volume_alpha' && role === 'bell') shift -= 12;
  if (style.id === 'volume_alpha' && role === 'lead') shift -= 12;
  return base + shift;
}

function pitchAt(key, degree, octave = 0) {
  const mode = MODES[key.mode].intervals;
  const safe = Math.floor(degree);
  const idx = ((safe % 7) + 7) % 7;
  const oct = Math.floor(safe / 7);
  return 48 + key.root + mode[idx] + (oct + octave) * 12;
}

function clampPitch(pitch) {
  return clamp(Math.round(pitch), 21, 108);
}

function chooseInstruments(style, rng, forced) {
  const used = new Set();
  return SLOT_ROLES.map((role, index) => {
    const forcedInstrument = forced?.[index] ? getInstrument(forced[index]) : null;
    if (forcedInstrument && forcedInstrument.styleId === style.id && !used.has(forcedInstrument.id)) {
      used.add(forcedInstrument.id);
      return forcedInstrument;
    }
    const signature = style.signature?.[index] ? getInstrument(style.signature[index]) : null;
    if (signature && !used.has(signature.id) && signature.role === role) {
      used.add(signature.id);
      return signature;
    }
    let candidates = style.instruments.filter((inst) => inst.role === role && !used.has(inst.id));
    if (!candidates.length) {
      candidates = style.instruments.filter((inst) => !used.has(inst.id));
    }
    if (!candidates.length) {
      candidates = style.instruments;
    }
    const selected = candidates[rng.int(0, candidates.length - 1)];
    used.add(selected.id);
    return selected;
  });
}

function makeMotif(style, rng) {
  const contours = {
    volume_alpha: [0, 2, 4, 2, 5, 4, 1, 3],
    calm: [0, 4, 2, 5, 3, 1, 4, 2],
    dark: [0, 1, 5, 3, 0, 6, 4, 1],
    ambient: [0, 2, 5, 4, 1, 3, 6, 2],
    all: [0, 4, 1, 5, 2, 6, 3, 4]
  };
  const base = contours[style.id] || contours.ambient;
  return base.map((value) => (value + rng.int(0, 2)) % 7);
}

function note(pitch, startBeat, durationBeats, velocity) {
  return {
    pitch: clampPitch(pitch),
    startBeat: Math.max(0, Math.round(startBeat * 1000) / 1000),
    durationBeats: Math.max(0.08, Math.round(durationBeats * 1000) / 1000),
    velocity: Math.max(0.03, Math.min(1, Math.round(velocity * 1000) / 1000))
  };
}

function addVolumeAlphaPiano(notes, project, track, clipStartBar, clipBars, rng) {
  const { chords, key, motif } = project;
  const style = getStyle(project.styleId);
  const register = 0;
  for (let segment = 0; segment < clipBars / 2; segment += 1) {
    const localStart = segment * 8;
    const absBar = clipStartBar + segment * 2;
    const chord = chordForBar(chords, absBar);
    const shape = sectionShape(absBar, project.bars);
    const root = chord.rootMidi - 12;
    const fifth = (chord.tones[2] ?? chord.rootMidi + 7) - 12;

    // Left hand: soft root and fifth, allowed to ring under the right hand.
    notes.push(note(root + rng.float(-0.03, 0.03), rng.float(0.01, 0.04), rng.float(6.4, 7.5), rng.float(0.07, 0.12) * shape));
    if (rng.chance(0.7)) {
      notes.push(note(fifth, localStart + rng.float(0.05, 0.12), rng.float(5.0, 6.5), rng.float(0.028, 0.052) * shape));
    }

    // Right hand: a few broken chord tones plus a simple motif note.
    const patterns = [
      [0, 2, 3.5, 5.5],
      [0, 1.5, 3, 5],
      [0.5, 2, 4, 6],
      [0, 2.5, 4.5, 6.5],
      [0, 1.5, 4, 6]
    ];
    const pattern = patterns[hashString(`${project.seed}|${track.index}|c418-keys`) % patterns.length];
    const melodyDegree = chord.degree + motif[(segment + track.index) % motif.length];
    pattern.forEach((position, index) => {
      if (absBar < 4 && index > 1) return;
      if (absBar >= project.bars - 4 && index > 2 && rng.chance(0.5)) return;
      if (index === 3 && rng.chance(0.25)) return;
      let pitch;
      if (index === 2 && rng.chance(0.5)) {
        pitch = pitchAt(key, melodyDegree + (rng.chance(0.5) ? 0 : 1), 0);
      } else {
        pitch = chord.tones[(index + segment) % Math.min(4, chord.tones.length)] + register;
      }
      if (index === 1 && rng.chance(0.25)) pitch -= 12;
      const duration = rng.pick([1.4, 1.8, 2.4, 3.0]);
      const velocity = (rng.float(0.10, 0.18) + (index === 2 ? 0.045 : 0)) * shape;
      notes.push(note(pitch, localStart + position + rng.float(-0.015, 0.015), duration, velocity));
    });

    // Occasional high answer, but much quieter and lower than the old arpeggios.
    if (rng.chance(0.24)) {
      notes.push(note(pitchAt(key, chord.degree + 2, 1), localStart + rng.float(6.2, 7.2), rng.float(1.5, 3.0), rng.float(0.045, 0.08) * shape));
    }
  }
}

function addKeyNotes(notes, project, track, clipStartBar, clipBars, rng) {
  const { key, chords, motif } = project;
  const style = getStyle(project.styleId);
  const role = track.role;
  if (style.id === 'volume_alpha') {
    addVolumeAlphaPiano(notes, project, track, clipStartBar, clipBars, rng);
    return;
  }
  const instrument = getInstrument(track.instrumentId);
  const register = registerFor(role, instrument, style);
  for (let segment = 0; segment < clipBars / 2; segment += 1) {
    const localStart = segment * 8;
    const absBar = clipStartBar + segment * 2;
    const chord = chordForBar(chords, absBar);
    const shape = sectionShape(absBar, project.bars);
    const isIntro = absBar < 4;
    const isOutro = absBar >= project.bars - 4;
    const unit = style.id === 'dark' ? 0.85 : 1;

    const pattern = ARP_PATTERNS[(hashString(`${project.seed}|${track.index}|arp`) + segment) % ARP_PATTERNS.length];
    const pool = [
      ...chord.tones.map((tone) => tone + register),
      ...Array.from({ length: 4 }, (_, i) => pitchAt(key, chord.degree + motif[(i + segment) % motif.length], register / 12))
    ];
    const sorted = [...new Set(pool.map(clampPitch))].sort((a, b) => a - b);
    const lo = 52;
    const hi = style.id === 'dark' ? 78 : 92;
    pattern.forEach((offset, index) => {
      if (offset >= 8) return;
      if (isIntro && index % 2 === 1) return;
      if (isOutro && index % 3 === 2) return;
      if (rng.chance(isIntro ? 0.24 : 0.08)) return;
      const source = sorted[(index * 2 + (segment % 2)) % sorted.length];
      let pitch = clamp(source, lo, hi);
      if (index === 0 && rng.chance(0.38)) pitch = clamp(chord.tones[0] + register + 12, lo, hi);
      if (index === pattern.length - 1 && rng.chance(0.35)) pitch -= 12;
      const start = localStart + offset + rng.float(-0.018, 0.018);
      const duration = rng.pick([0.55, 0.75, 1.1, 1.5, 2.2]) * (isOutro ? 1.4 : 1);
      const velocity = (rng.float(0.15, 0.34) + (index === 0 ? 0.06 : 0)) * shape * unit;
      notes.push(note(pitch, start, duration, velocity));
    });

    if (rng.chance(0.55)) {
      const gracePitch = clampPitch(chord.tones[rng.int(0, chord.tones.length - 1)] + register + 12);
      notes.push(note(gracePitch, localStart + rng.float(6.6, 7.3), rng.float(0.8, 2.6), rng.float(0.08, 0.2) * shape));
    }
  }
}

function addPadNotes(notes, project, track, clipStartBar, clipBars, rng) {
  const { chords } = project;
  const style = getStyle(project.styleId);
  const instrument = getInstrument(track.instrumentId);
  const register = registerFor(track.role, instrument, style);
  if (style.id === 'volume_alpha') {
    const chord = chordForBar(chords, clipStartBar);
    const shape = sectionShape(clipStartBar, project.bars);
    const voicing = chord.tones.slice(0, 3);
    voicing.forEach((tone, index) => {
      notes.push(note(
        tone + register,
        rng.float(0.02, 0.6) + index * 0.05,
        clipBars * 4 - rng.float(0.2, 1.0),
        rng.float(0.032, 0.06) * shape
      ));
    });
    if (!['dark'].includes(style.id)) {
      notes.push(note(chord.tones[0] + register + 12, rng.float(0.4, 1.2), clipBars * 4 - 1.5, rng.float(0.02, 0.045) * shape));
    }
    return;
  }
  for (let segment = 0; segment < clipBars / 2; segment += 1) {
    const localStart = segment * 8;
    const chord = chordForBar(chords, clipStartBar + segment * 2);
    const shape = sectionShape(clipStartBar + segment * 2, project.bars);
    const voicing = [...chord.tones];
    if (voicing.length > 4) voicing.length = 4;
    const order = [0, 2, 1, 3].filter((index) => index < voicing.length);
    order.forEach((toneIndex, index) => {
      const pitch = voicing[toneIndex] + register;
      const start = localStart + (index === 0 ? 0 : rng.float(0.04, 0.22));
      const duration = 8 - rng.float(0.1, 0.65);
      const velocity = (rng.float(0.1, 0.19) + (toneIndex === 0 ? 0.035 : 0)) * shape;
      notes.push(note(pitch, start, duration, velocity));
    });
    if (style.id !== 'dark' && rng.chance(0.55)) {
      notes.push(note(chord.tones[0] + register + 12, localStart + rng.float(0.2, 0.8), rng.float(4, 7.5), rng.float(0.05, 0.11) * shape));
    }
  }
}

function addBassNotes(notes, project, track, clipStartBar, clipBars, rng) {
  const { chords } = project;
  const style = getStyle(project.styleId);
  const instrument = getInstrument(track.instrumentId);
  const register = registerFor('bass', instrument, style);
  if (style.id === 'volume_alpha') {
    for (let segment = 0; segment < clipBars / 2; segment += 1) {
      const chord = chordForBar(chords, clipStartBar + segment * 2);
      const shape = sectionShape(clipStartBar + segment * 2, project.bars);
      const basePitch = chord.rootMidi + register;
      notes.push(note(basePitch, segment * 8 + rng.float(0, 0.06), rng.float(6.8, 7.6), rng.float(0.09, 0.15) * shape));
      if (rng.chance(0.2)) notes.push(note(basePitch + 7, segment * 8 + 4.2, 2.8, rng.float(0.03, 0.06) * shape));
    }
    return;
  }
  for (let segment = 0; segment < clipBars / 2; segment += 1) {
    const localStart = segment * 8;
    const chord = chordForBar(chords, clipStartBar + segment * 2);
    const shape = sectionShape(clipStartBar + segment * 2, project.bars);
    const basePitch = chord.rootMidi + register;
    notes.push(note(basePitch, localStart + rng.float(0, 0.08), rng.float(6.4, 7.7), rng.float(0.16, 0.26) * shape));
    if (rng.chance(0.5)) {
      notes.push(note(basePitch + 7, localStart + 4 + rng.float(0, 0.12), rng.float(2.8, 3.7), rng.float(0.07, 0.14) * shape));
    }
    if (rng.chance(0.28) && clipBars >= 4) {
      notes.push(note(basePitch + 12, localStart + 7, 2.5, rng.float(0.04, 0.09) * shape));
    }
  }
}

function addBellNotes(notes, project, track, clipStartBar, clipBars, rng) {
  const { chords, key, motif } = project;
  const style = getStyle(project.styleId);
  const instrument = getInstrument(track.instrumentId);
  const register = registerFor('bell', instrument, style);
  if (style.id === 'volume_alpha') {
    for (let segment = 0; segment < clipBars / 2; segment += 1) {
      const localStart = segment * 8;
      const absBar = clipStartBar + segment * 2;
      const chord = chordForBar(chords, absBar);
      const shape = sectionShape(absBar, project.bars);
      if (rng.chance(0.38)) continue;
      const degree = chord.degree + motif[(segment + track.index) % motif.length];
      let pitch = pitchAt(key, degree, 2);
      if (pitch > 86) pitch -= 12;
      notes.push(note(pitch, localStart + rng.pick([1.5, 2.5, 4.5, 6]), rng.pick([2.2, 3.0, 4.0]), rng.float(0.035, 0.07) * shape));
      if (rng.chance(0.14)) {
        notes.push(note(chord.tones[0] + register, localStart + 6.5, 2.5, rng.float(0.025, 0.05) * shape));
      }
    }
    return;
  }
  for (let segment = 0; segment < clipBars / 2; segment += 1) {
    const localStart = segment * 8;
    const chord = chordForBar(chords, clipStartBar + segment * 2);
    const shape = sectionShape(clipStartBar + segment * 2, project.bars);
    const pattern = BELL_PATTERNS[(hashString(`${project.seed}|${track.index}|bells`) + segment) % BELL_PATTERNS.length];
    const tones = [...chord.tones, ...chord.tones.map((tone) => tone + 12)];
    const introSkip = clipStartBar < 4 ? 0.38 : 0;
    pattern.forEach((offset, index) => {
      if (offset >= 8) return;
      if (rng.chance(introSkip)) return;
      if (rng.chance(style.id === 'dark' ? 0.2 : 0.08)) return;
      let pitch;
      if (index % 3 === 0) {
        pitch = chord.tones[(index + segment) % chord.tones.length] + register;
      } else {
        pitch = pitchAt(key, chord.degree + motif[(index + segment) % motif.length], 2);
      }
      if (index === pattern.length - 1 && rng.chance(0.5)) pitch += 12;
      const velocity = rng.float(0.1, 0.24) * shape;
      const duration = rng.pick([1.3, 2.1, 3, 4.4]) * (style.id === 'dark' ? 1.4 : 1);
      notes.push(note(pitch, localStart + offset + rng.float(-0.01, 0.02), duration, velocity));
    });
  }
}

function addStringsNotes(notes, project, track, clipStartBar, clipBars, rng) {
  const { chords } = project;
  const style = getStyle(project.styleId);
  const instrument = getInstrument(track.instrumentId);
  const register = registerFor('strings', instrument, style);
  if (style.id === 'volume_alpha') {
    const chord = chordForBar(chords, clipStartBar);
    const shape = sectionShape(clipStartBar, project.bars);
    [chord.tones[0], chord.tones[2]].filter((tone) => Number.isFinite(tone)).forEach((tone, index) => {
      notes.push(note(tone + register, rng.float(0.2, 0.8) + index * 0.08, clipBars * 4 - rng.float(0.2, 0.8), rng.float(0.028, 0.052) * shape));
    });
    return;
  }
  for (let segment = 0; segment < clipBars / 2; segment += 1) {
    const localStart = segment * 8;
    const chord = chordForBar(chords, clipStartBar + segment * 2);
    const shape = sectionShape(clipStartBar + segment * 2, project.bars);
    const chosen = [chord.tones[0], chord.tones[1], chord.tones[2]].filter((tone) => Number.isFinite(tone));
    chosen.forEach((tone, index) => {
      if (index === 2 && rng.chance(0.45)) return;
      notes.push(note(
        tone + register + (index === 0 ? 0 : 0),
        localStart + rng.float(0.02, 0.5),
        rng.float(7.2, 8.5),
        rng.float(0.08, 0.15) * shape
      ));
    });
    if (clipBars >= 4) {
      notes.push(note(chord.tones[0] + register + 12, localStart + rng.float(0.5, 1.5), rng.float(5, 7), rng.float(0.05, 0.1) * shape));
    }
  }
}

function addTextureNotes(notes, project, track, clipStartBar, clipBars, rng) {
  const { chords } = project;
  const style = getStyle(project.styleId);
  const chord = chordForBar(chords, clipStartBar);
  const shape = sectionShape(clipStartBar, project.bars);
  const start = rng.float(0, 0.2);
  const duration = clipBars * 4 - start - rng.float(0.1, 0.8);
  notes.push(note(chord.rootMidi + 12, start, duration, rng.float(0.13, 0.24) * shape));
  if (clipBars >= 4) {
    const secondChord = chordForBar(chords, clipStartBar + 2);
    notes.push(note(secondChord.rootMidi + 24, 8 + rng.float(0, 0.2), 8 - rng.float(0.1, 0.7), rng.float(0.07, 0.15) * shape));
  }
  if (style.id === 'dark' && rng.chance(0.35)) {
    notes.push(note(chord.rootMidi + 7, clipBars * 2, clipBars * 2 - 0.5, rng.float(0.03, 0.08)));
  }
}

function addDustNotes(notes, project, track, clipStartBar, clipBars, rng) {
  const { chords } = project;
  const style = getStyle(project.styleId);
  const chord = chordForBar(chords, clipStartBar);
  const shape = sectionShape(clipStartBar, project.bars);
  const pattern = DUST_PATTERNS[hashString(`${project.seed}|${track.index}|dust`) % DUST_PATTERNS.length];
  const count = clipBars >= 4 ? pattern.length : Math.max(2, pattern.length - 2);
  for (let index = 0; index < count; index += 1) {
    if (rng.chance(0.22)) continue;
    const pitch = chord.tones[rng.int(0, chord.tones.length - 1)] + 24;
    notes.push(note(
      pitch,
      pattern[index] + rng.float(-0.02, 0.02),
      rng.float(0.2, 1.1),
      rng.float(0.025, 0.085) * shape
    ));
  }
  if (style.id === 'dark' && rng.chance(0.4)) {
    notes.push(note(chord.rootMidi + 36, 7.5, 0.4, 0.04));
  }
}

function addLeadNotes(notes, project, track, clipStartBar, clipBars, rng) {
  const { chords, key, motif } = project;
  const style = getStyle(project.styleId);
  if (style.id === 'volume_alpha') {
    for (let segment = 0; segment < clipBars / 2; segment += 1) {
      const localStart = segment * 8;
      const absBar = clipStartBar + segment * 2;
      const chord = chordForBar(chords, absBar);
      const shape = sectionShape(absBar, project.bars);
      if (rng.chance(0.42)) continue;
      const pitch = pitchAt(key, chord.degree + motif[(segment + track.index) % motif.length], 1);
      notes.push(note(pitch, localStart + rng.pick([1.5, 3.5, 5.5]), rng.pick([1.8, 2.4, 3.2]), rng.float(0.045, 0.085) * shape));
    }
    return;
  }
  const chunk = 2;
  for (let segment = 0; segment < clipBars / chunk; segment += 1) {
    const localStart = segment * 8;
    const chord = chordForBar(chords, clipStartBar + segment * chunk);
    const shape = sectionShape(clipStartBar + segment * chunk, project.bars);
    if (clipStartBar < 4 && rng.chance(0.5)) continue;
    if (clipStartBar >= project.bars - 4 && rng.chance(0.35)) continue;
    const positions = style.id === 'calm' ? [0.5, 3.5, 6] : [0, 2.2, 4.5, 6.5];
    const count = style.id === 'dark' ? 2 : rng.int(2, 3);
    for (let index = 0; index < count; index += 1) {
      const position = positions[(index + segment) % positions.length];
      const degree = chord.degree + motif[(index + segment * 2) % motif.length];
      let pitch = pitchAt(key, degree, 2);
      if (rng.chance(0.3)) pitch = chord.tones[(index + 1) % chord.tones.length] + 24;
      notes.push(note(
        pitch,
        localStart + position + rng.float(-0.02, 0.02),
        rng.float(1.3, 3.8),
        rng.float(0.08, 0.2) * shape
      ));
    }
  }
}

function makeClip(project, track, clipIndex, startBar, clipBars) {
  const rng = new Rng(hashString(`${project.seed}|${project.styleId}|${track.index}|${clipIndex}`));
  const notes = [];
  const role = track.slot === 'DUST' ? 'dust' : track.role;
  switch (role) {
    case 'texture':
      addTextureNotes(notes, project, track, startBar, clipBars, rng);
      break;
    case 'dust':
      addDustNotes(notes, project, track, startBar, clipBars, rng);
      break;
    case 'pad':
      addPadNotes(notes, project, track, startBar, clipBars, rng);
      break;
    case 'keys':
      addKeyNotes(notes, project, track, startBar, clipBars, rng);
      break;
    case 'bass':
      addBassNotes(notes, project, track, startBar, clipBars, rng);
      break;
    case 'bell':
      addBellNotes(notes, project, track, startBar, clipBars, rng);
      break;
    case 'strings':
      addStringsNotes(notes, project, track, startBar, clipBars, rng);
      break;
    case 'lead':
      addLeadNotes(notes, project, track, startBar, clipBars, rng);
      break;
    default:
      addPadNotes(notes, project, track, startBar, clipBars, rng);
  }
  const clipEnd = clipBars * 4;
  notes.forEach((event) => {
    if (event.startBeat >= clipEnd) {
      event.startBeat = Math.max(0, clipEnd - 0.1);
    }
    event.durationBeats = Math.max(0.08, Math.min(event.durationBeats, clipEnd - event.startBeat - 0.015));
  });
  const cleaned = notes.filter((event) => event.startBeat < clipEnd && event.durationBeats > 0);
  if (!cleaned.length) {
    const chord = chordForBar(project.chords, startBar);
    const style = getStyle(project.styleId);
    const instrument = getInstrument(track.instrumentId);
    const register = registerFor(track.role, instrument, style);
    const fallbackPitch = chord.rootMidi + register + (['bell', 'lead'].includes(track.role) ? 12 : 0);
    cleaned.push(note(fallbackPitch, 0.12, Math.min(2.4, clipEnd - 0.3), 0.055));
  }
  cleaned.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  return {
    id: `t${track.index}-c${clipIndex}`,
    name: `${track.slot} ${String(clipIndex + 1).padStart(2, '0')}`,
    startBar,
    bars: clipBars,
    notes: cleaned
  };
}

function trackVolume(role, style, rng) {
  const va = style.id === 'volume_alpha';
  const base = (va ? {
    texture: 0.18,
    pad: 0.27,
    keys: 0.98,
    bass: 0.4,
    bell: 0.22,
    strings: 0.28,
    lead: 0.2
  } : {
    texture: 0.38,
    pad: 0.5,
    keys: 0.82,
    bass: 0.5,
    bell: 0.7,
    strings: 0.58,
    lead: 0.66
  })[role] ?? 0.58;
  return Math.round(clamp(base + rng.float(-0.03, 0.03), 0.2, 0.98) * 100);
}

function trackPan(role, style, index, rng) {
  if (role === 'bass') return 0;
  if (style.id === 'volume_alpha') {
    if (role === 'pad') return Math.round(rng.float(-0.12, 0.12) * 100);
    if (role === 'keys') return Math.round(rng.float(-0.14, 0.06) * 100);
    if (role === 'strings' || role === 'choir') return Math.round(rng.float(0.05, 0.22) * 100);
    if (role === 'bell' || role === 'lead') return Math.round(rng.float(0.12, 0.32) * 100);
    return Math.round(rng.float(-0.3, 0.3) * 100);
  }
  if (role === 'pad') return Math.round(rng.float(-0.2, 0.2) * 100);
  if (index === 0) return -44;
  if (index === 7) return 46;
  return Math.round(rng.float(-0.52, 0.52) * 100);
}

function computeWaveform(tracks, bars, bpm) {
  const bins = 300;
  const totalBeats = bars * 4;
  const data = new Array(bins).fill(0);
  tracks.forEach((track) => {
    const gain = track.volume / 100;
    track.clips.forEach((clip) => {
      clip.notes.forEach((event) => {
        const startBeat = clip.startBar * 4 + event.startBeat;
        const endBeat = startBeat + Math.max(0.15, event.durationBeats);
        const binStart = clamp(Math.floor((startBeat / totalBeats) * bins), 0, bins - 1);
        const binEnd = clamp(Math.ceil((endBeat / totalBeats) * bins), 0, bins);
        for (let bin = binStart; bin < binEnd; bin += 1) {
          const position = (bin - binStart) / Math.max(1, binEnd - binStart);
          const env = Math.pow(1 - position, 1.6);
          data[bin] += event.velocity * gain * env;
        }
      });
    });
  });
  const max = Math.max(...data, 0.0001);
  return data.map((value, index) => {
    const x = index / (bins - 1);
    const contour = 0.85 + 0.15 * Math.sin(index * 0.37);
    return Math.max(0.03, Math.min(1, Math.pow(value / max, 0.75) * contour));
  });
}

function poeticTitle(rng) {
  return `${rng.pick(TITLE_A)} ${rng.pick(TITLE_B)}`;
}

export function generateProject(options = {}) {
  const style = getStyle(options.styleId);
  const seed = String(options.seed || makeSeed());
  const rng = new Rng(hashString(`${seed}|${style.id}|project`));
  const bpm = normalizeBpm(options.bpm ?? style.bpm, style);
  const bars = BARS_OPTIONS.includes(Number(options.bars)) ? Number(options.bars) : style.bars;
  const key = normalizeKey(options.key || chooseKey(style, rng));
  const { progression, chords, chordBars } = buildProgression(style, key, bars, rng);
  const instruments = chooseInstruments(style, rng, options.instruments);
  const motif = makeMotif(style, rng);
  const durationSec = (bars * 4 * 60) / bpm;
  const base = {
    version: 1,
    id: `prj_${hashString(`${seed}|${Date.now()}`).toString(16)}`,
    title: options.title || poeticTitle(rng),
    subtitle: options.isDemo ? options.subtitle : `${style.label} · новая сессия`,
    description: options.description || '',
    styleId: style.id,
    styleLabel: style.label,
    seed,
    bpm,
    bars,
    key,
    isDemo: Boolean(options.isDemo),
    demoId: options.demoId || null,
    createdAt: new Date().toISOString(),
    durationSec,
    tailSec: TAIL_SECONDS,
    progression,
    chords,
    chordBars: style.chordBars || 2,
    motif,
    tracks: []
  };

  base.tracks = instruments.map((instrument, index) => {
    const slot = SLOT_LABELS[index];
    const unit = ['pad', 'strings'].includes(instrument.role) ? 4
      : instrument.role === 'texture' ? (slot === 'DUST' ? 2 : 4)
        : 2;
    const clips = [];
    let clipIndex = 0;
    for (let startBar = 0; startBar < bars; startBar += unit) {
      clips.push(makeClip(base, {
        index,
        slot,
        role: instrument.role,
        instrumentId: instrument.id
      }, clipIndex, startBar, Math.min(unit, bars - startBar)));
      clipIndex += 1;
    }
    const track = {
      index,
      slot,
      name: `${slot} · ${instrument.name}`,
      role: instrument.role,
      roleLabel: instrument.engineLabel,
      instrumentId: instrument.id,
      color: style.trackColors[index] || style.accent,
      volume: trackVolume(instrument.role, style, rng),
      pan: trackPan(instrument.role, style, index, rng),
      mute: false,
      solo: false,
      clips
    };
    return track;
  });

  base.noteCount = base.tracks.reduce((sum, track) => sum + track.clips.reduce((clipSum, clip) => clipSum + clip.notes.length, 0), 0);
  base.clipCount = base.tracks.reduce((sum, track) => sum + track.clips.length, 0);
  base.waveform = computeWaveform(base.tracks, bars, bpm);
  base.keyLabel = keyLabel(key);
  base.generation = {
    algorithm: 'AETHER Procedural Ambient v2',
    prng: 'mulberry32 / FNV-1a seed',
    seedHash: hashString(`${seed}|${style.id}`).toString(16).padStart(8, '0'),
    styleProfile: style.id,
    key: keyLabel(key),
    mode: key.mode,
    chordBars: style.chordBars || 2,
    progression: progression.map(([degree, quality]) => `${degree}:${quality}`),
    chords: chords.map((chord) => `${chord.startBar + 1}:${chord.label}`),
    sections: ['intro 0–4', 'build 4–8', 'body 8–12', 'outro 12–end'].filter((_, index) => bars > index * 4),
    signature: instruments.map((instrument) => instrument.id),
    density: Number((base.noteCount / Math.max(1, bars)).toFixed(2)),
    texture: style.fx,
    swing: 0
  };
  return base;
}


/* A real 20-second reconstruction of the opening of C418 — Wet Hands.
   Notes were transcribed from the reference; the audio you hear is AETHER's
   own felt-piano engine, not the original recording. */
export function createWetHandsProof() {
  const style = getStyle('volume_alpha');
  const bpm = WET_HANDS_META.bpm;
  const bars = WET_HANDS_META.bars;
  const durationSec = WET_HANDS_META.durationSec;
  const beatsPerSecond = bpm / 60;
  const chords = [
    { startBar: 0, bars: 2, index: 0, degree: 0, quality: 'maj7', label: 'Amaj7', rootMidi: 57, tones: [57, 61, 64, 68] },
    { startBar: 2, bars: 2, index: 1, degree: 4, quality: 'maj', label: 'Emaj', rootMidi: 52, tones: [52, 56, 59, 64] },
    { startBar: 4, bars: 2, index: 2, degree: 5, quality: 'min7', label: 'F#min7', rootMidi: 54, tones: [54, 57, 61, 64] },
    { startBar: 6, bars: 2, index: 3, degree: 3, quality: 'maj7', label: 'Dmaj7', rootMidi: 50, tones: [50, 54, 57, 61] }
  ];
  const progression = [[0, 'maj7'], [4, 'maj'], [5, 'min7'], [3, 'maj7']];
  const ranges = [[45, 48], [49, 52], [53, 56], [57, 60], [61, 64], [65, 68], [69, 72], [73, 76]];
  const tracks = ranges.map(([low, high], index) => {
    const trackNotes = WET_HANDS_NOTES
      .filter((entry) => entry.pitch >= low && entry.pitch <= high)
      .map((entry) => {
        const startBeat = Math.min(31.9, entry.startSec * beatsPerSecond);
        const durationBeats = Math.max(0.08, Math.min(entry.durSec * beatsPerSecond, 32 - startBeat - 0.01));
        return {
          pitch: entry.pitch,
          startBeat: Math.round(startBeat * 1000) / 1000,
          durationBeats: Math.round(durationBeats * 1000) / 1000,
          velocity: entry.velocity
        };
      })
      .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
    return {
      index,
      slot: 'KEYS',
      displayName: `PIANO ${String(index + 1).padStart(2, '0')}`,
      name: `PIANO ${String(index + 1).padStart(2, '0')} · ${NOTE_NAMES[low % 12]}${Math.floor(low / 12) - 1}–${NOTE_NAMES[high % 12]}${Math.floor(high / 12) - 1}`,
      role: 'keys',
      roleLabel: 'FELT PIANO',
      instrumentId: 'va_overworld',
      color: style.trackColors[index] || style.accent,
      volume: [18, 35, 55, 68, 76, 80, 82, 82][index],
      pan: index % 2 === 0 ? -6 : 6,
      mute: false,
      solo: false,
      clips: [{
        id: `proof-${index}-c0`,
        name: `PIANO ${String(index + 1).padStart(2, '0')}`,
        startBar: 0,
        bars,
        notes: trackNotes
      }]
    };
  });
  const project = {
    version: 1,
    id: 'prj_wethands_20s_proof',
    title: WET_HANDS_META.title,
    subtitle: WET_HANDS_META.subtitle,
    description: '20-секундная синтезированная реконструкция начала Wet Hands. Ноты получены транскрипцией референса; оригинальный аудиофайл не используется.',
    styleId: style.id,
    styleLabel: style.label,
    seed: 'wet-hands-2011',
    bpm,
    bars,
    key: { root: 9, mode: 'major' },
    keyLabel: 'A major',
    isDemo: false,
    isProof: true,
    demoId: null,
    createdAt: new Date().toISOString(),
    durationSec,
    tailSec: 0,
    mix: { lowShelf: -6.5, highShelf: 1.5, tone: 5600, wet: 0.39, delay: 0.045 },
    progression,
    chords,
    chordBars: 2,
    motif: [0, 2, 4, 1],
    tracks,
    noteCount: tracks.reduce((sum, track) => sum + track.clips[0].notes.length, 0),
    clipCount: tracks.length,
    waveform: computeWaveform(tracks, bars, bpm),
    generation: {
      algorithm: 'AETHER Reference Reconstruction v1',
      prng: 'PianoTranscription CRNN → note sequence',
      seedHash: 'wet-hands-2011',
      styleProfile: style.id,
      key: 'A major',
      mode: 'major',
      chordBars: 2,
      progression: progression.map(([degree, quality]) => `${degree}:${quality}`),
      chords: chords.map((chord) => `${chord.startBar + 1}:${chord.label}`),
      sections: ['verse 0–4', 'verse 4–8'],
      signature: Array.from({ length: 8 }, () => 'va_overworld'),
      density: Number((WET_HANDS_META.noteCount / bars).toFixed(2)),
      texture: { source: WET_HANDS_META.source, excerpt: WET_HANDS_META.excerpt, transcription: WET_HANDS_META.transcription },
      swing: 0
    }
  };
  project.generation.density = Number((project.noteCount / bars).toFixed(2));
  return project;
}

export function createDemoProject(demoId) {
  const demo = DEMO_BY_ID.get(demoId);
  if (!demo) return null;
  return generateProject({
    styleId: demo.styleId,
    seed: demo.seed,
    bpm: demo.bpm,
    bars: demo.bars,
    key: demo.key,
    title: demo.title,
    subtitle: demo.subtitle,
    description: demo.description,
    isDemo: true,
    demoId: demo.id,
    instruments: demo.instruments
  });
}

export function demoCatalog() {
  return STYLES.map((style) => ({
    styleId: style.id,
    label: style.label,
    demos: demosForStyle(style.id).map((demo) => ({
      id: demo.id,
      styleId: style.id,
      title: demo.title,
      subtitle: demo.subtitle,
      bpm: demo.bpm,
      key: keyLabel(demo.key),
      bars: demo.bars,
      instruments: demo.instruments.length
    }))
  }));
}

export function projectNotes(project, trackIndex = null) {
  const tracks = trackIndex === null ? project.tracks : [project.tracks[trackIndex]];
  const result = [];
  tracks.forEach((track) => {
    if (!track) return;
    track.clips.forEach((clip) => {
      clip.notes.forEach((event) => {
        result.push({
          ...event,
          trackIndex: track.index,
          clipId: clip.id,
          startBeat: clip.startBar * 4 + event.startBeat,
          endBeat: clip.startBar * 4 + event.startBeat + event.durationBeats,
          startSec: ((clip.startBar * 4 + event.startBeat) * 60) / project.bpm,
          endSec: ((clip.startBar * 4 + event.startBeat + event.durationBeats) * 60) / project.bpm
        });
      });
    });
  });
  return result.sort((a, b) => a.startBeat - b.startBeat);
}

export function validateProject(project) {
  const errors = [];
  const warn = (message) => errors.push(message);
  if (!project || typeof project !== 'object') return ['project is missing'];
  const style = getStyle(project.styleId);
  if (!style || style.id !== project.styleId) warn('invalid style');
  if (!BARS_OPTIONS.includes(project.bars)) warn('invalid bars');
  if (!Number.isFinite(project.bpm) || project.bpm < BPM_MIN || project.bpm > BPM_MAX) warn('invalid bpm');
  if (!project.key || !MODES[project.key.mode]) warn('invalid key');
  if (!Array.isArray(project.tracks) || project.tracks.length !== 8) warn('expected 8 tracks');
  if (Math.abs(project.durationSec - (project.bars * 4 * 60) / project.bpm) > 0.001) warn('duration mismatch');
  if (!Array.isArray(project.chords) || !project.chords.length) {
    warn('chord list missing');
  } else {
    let chordBar = 0;
    project.chords.forEach((chord) => {
      if (chord.startBar !== chordBar || chord.bars <= 0) warn('chord timeline mismatch');
      chordBar += chord.bars;
    });
    if (chordBar !== project.bars) warn('chords do not cover project');
  }
  let noteCount = 0;
  let clipCount = 0;
  (project.tracks || []).forEach((track, trackIndex) => {
    const instrument = getInstrument(track.instrumentId);
    if (!instrument || instrument.styleId !== style.id) warn(`track ${trackIndex}: instrument missing from style`);
    if (!Array.isArray(track.clips) || !track.clips.length) warn(`track ${trackIndex}: no clips`);
    if (track.volume < 0 || track.volume > 100) warn(`track ${trackIndex}: volume out of range`);
    if (track.pan < -100 || track.pan > 100) warn(`track ${trackIndex}: pan out of range`);
    let expectedBar = 0;
    (track.clips || []).forEach((clip) => {
      clipCount += 1;
      if (clip.startBar !== expectedBar) warn(`track ${trackIndex}: clip gap at bar ${expectedBar}`);
      if (!Number.isFinite(clip.bars) || clip.bars <= 0) warn(`track ${trackIndex}: bad clip length`);
      if (clip.startBar + clip.bars > project.bars) warn(`track ${trackIndex}: clip exceeds project`);
      expectedBar = clip.startBar + clip.bars;
      if (!Array.isArray(clip.notes) || clip.notes.length === 0) warn(`track ${trackIndex}: empty clip ${clip.id}`);
      (clip.notes || []).forEach((event) => {
        noteCount += 1;
        if (!Number.isFinite(event.pitch) || event.pitch < 21 || event.pitch > 108) warn(`track ${trackIndex}: bad pitch`);
        if (!Number.isFinite(event.startBeat) || event.startBeat < 0) warn(`track ${trackIndex}: bad start`);
        if (!Number.isFinite(event.durationBeats) || event.durationBeats <= 0) warn(`track ${trackIndex}: bad duration`);
        if (event.startBeat + event.durationBeats > clip.bars * 4 + 0.001) warn(`track ${trackIndex}: note outside clip`);
        if (!Number.isFinite(event.velocity) || event.velocity <= 0 || event.velocity > 1) warn(`track ${trackIndex}: bad velocity`);
      });
    });
    if (expectedBar !== project.bars) warn(`track ${trackIndex}: clips do not cover the timeline (${expectedBar}/${project.bars})`);
  });
  if (noteCount !== project.noteCount) warn(`note count mismatch (${noteCount} != ${project.noteCount})`);
  if (clipCount !== project.clipCount) warn(`clip count mismatch (${clipCount} != ${project.clipCount})`);
  if (!Array.isArray(project.waveform) || project.waveform.length !== 300) warn('waveform missing');
  if (noteCount < 8) warn('too few notes');
  return errors;
}

export function projectSummary(project) {
  return {
    id: project.id,
    title: project.title,
    styleId: project.styleId,
    styleLabel: project.styleLabel,
    seed: project.seed,
    bpm: project.bpm,
    bars: project.bars,
    key: project.keyLabel,
    durationSec: project.durationSec,
    noteCount: project.noteCount,
    clipCount: project.clipCount,
    trackCount: project.tracks.length,
    isDemo: project.isDemo,
    demoId: project.demoId,
    instruments: project.tracks.map((track) => ({ slot: track.slot, id: track.instrumentId, name: getInstrument(track.instrumentId)?.name || '' }))
  };
}
