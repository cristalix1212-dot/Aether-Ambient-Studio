/* Web Audio synthesis and transport.
   Scores are scheduled into a small graph of buses, a shared plate reverb and
   a tempo delay. Playback is fully live, so track mute/solo/volume stay instant.
   Export uses the exact same graph in an OfflineAudioContext. */

import { getInstrument, getStyle } from './instruments.js';
import { projectNotes } from './composer.js';

const TAU = Math.PI * 2;
const LIVE_LOOKAHEAD_SECONDS = 6;
const LIVE_SCHEDULE_INTERVAL_MS = 450;
let sharedNoise = new WeakMap();

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeStop(source, when) {
  try {
    source.stop(when);
  } catch {
    /* already stopped */
  }
}

const WAVE_HARMONICS = {
  felt:   [0, 0.82, 0.18, 0.055, 0.015],
  pad:    [0, 0.42, 0.27, 0.18, 0.13, 0.09, 0.06, 0.04],
  strings:[0, 0.38, 0.3, 0.23, 0.17, 0.12, 0.08, 0.05],
  organ:  [0, 0.58, 0.24, 0.16, 0.1, 0.07, 0.04],
  bass:   [0, 0.78, 0.16, 0.07, 0.03],
  harp:   [0, 0.55, 0.25, 0.12, 0.07, 0.04],
  choir:  [0, 0.52, 0.33, 0.22, 0.14, 0.09, 0.05],
  drone:  [0, 0.5, 0.3, 0.2, 0.12, 0.08, 0.05],
  pluck:  [0, 0.6, 0.24, 0.12, 0.06]
};
const waveCache = new WeakMap();

function getWave(ctx, name) {
  let cache = waveCache.get(ctx);
  if (!cache) {
    cache = new Map();
    waveCache.set(ctx, cache);
  }
  if (cache.has(name)) return cache.get(name);
  const harmonics = WAVE_HARMONICS[name] || WAVE_HARMONICS.felt;
  const real = new Float32Array(harmonics.length);
  const imag = new Float32Array(harmonics);
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  cache.set(name, wave);
  return wave;
}

function getNoiseBuffer(ctx) {
  let buffer = sharedNoise.get(ctx);
  if (buffer) return buffer;
  const seconds = 2.2;
  buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.018 * white) / 1.018;
      data[i] = white * 0.62 + brown * 2.4;
    }
  }
  sharedNoise.set(ctx, buffer);
  return buffer;
}

function createReverbNetwork(ctx, style) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const preDelay = ctx.createDelay(0.2);
  preDelay.delayTime.value = 0.019 + Math.min(0.016, style.fx.reverb * 0.0025);
  input.connect(preDelay);

  const diffusion = ctx.createDelay(0.08);
  diffusion.delayTime.value = 0.0067;
  const diffusionFeedback = ctx.createGain();
  diffusionFeedback.gain.value = 0.48;
  preDelay.connect(diffusion);
  diffusion.connect(diffusionFeedback);
  diffusionFeedback.connect(diffusion);

  // A minuscule DC offset keeps the very quiet feedback tails out of
  // denormal range, which otherwise makes some Chromium builds crawl.
  const dither = ctx.createConstantSource();
  dither.offset.value = 0.000001;
  dither.connect(preDelay);
  dither.start(0);

  const size = clamp(style.fx.reverb / 4.2, 0.72, 1.55);
  const feedback = clamp(0.79 + style.fx.reverb * 0.0125, 0.82, 0.885);
  const taps = [
    { time: 0.0297, pan: -0.78, gain: 0.18 },
    { time: 0.0371, pan: 0.66, gain: 0.17 },
    { time: 0.0419, pan: -0.36, gain: 0.16 },
    { time: 0.0473, pan: 0.31, gain: 0.15 },
    { time: 0.0531, pan: -0.1, gain: 0.13 },
    { time: 0.0599, pan: 0.88, gain: 0.11 }
  ];
  taps.forEach((tap, index) => {
    const delay = ctx.createDelay(0.6);
    delay.delayTime.value = tap.time * size;
    const loop = ctx.createGain();
    loop.gain.value = feedback - index * 0.005;
    const pan = ctx.createStereoPanner();
    pan.pan.value = tap.pan;
    const level = ctx.createGain();
    level.gain.value = tap.gain;

    diffusion.connect(delay);
    delay.connect(loop);
    loop.connect(delay);
    delay.connect(pan);
    pan.connect(level);
    level.connect(output);
  });

  const early = ctx.createDelay(0.15);
  early.delayTime.value = 0.028;
  const earlyGain = ctx.createGain();
  earlyGain.gain.value = 0.1;
  preDelay.connect(early);
  early.connect(earlyGain);
  earlyGain.connect(output);

  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 85;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = style.fx.reverbTone || 7600;
  lowpass.Q.value = 0.3;
  output.connect(highpass);
  highpass.connect(lowpass);
  return { input, output: lowpass, dither };
}

function createStereoWidener(ctx, amount = 0.14) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  input.connect(splitter);
  const left = ctx.createGain();
  const right = ctx.createGain();
  splitter.connect(left, 0);
  splitter.connect(right, 1);
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);

  // A small, low-passed cross-feed opens the stereo image without making the
  // bass or the piano wander. This is deliberately subtle.
  const crossLeft = ctx.createDelay(0.05);
  crossLeft.delayTime.value = 0.011;
  const crossRight = ctx.createDelay(0.05);
  crossRight.delayTime.value = 0.014;
  splitter.connect(crossLeft, 1);
  splitter.connect(crossRight, 0);
  [crossLeft, crossRight].forEach((delay, index) => {
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 230;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4200;
    const gain = ctx.createGain();
    gain.gain.value = amount;
    delay.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(merger, 0, index === 0 ? 0 : 1);
  });
  merger.connect(output);
  return { input, output };
}

function createMasterChain(ctx, style, destination, { live = false, bpm = 72, dry = false } = {}) {
  const input = ctx.createGain();
  input.gain.value = 1;

  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = style.fx.tone;
  tone.Q.value = 0.35;

  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 115;
  lowShelf.gain.value = Number.isFinite(style.fx.lowShelf) ? style.fx.lowShelf : (style.id === 'volume_alpha' ? 2.0 : 1.0);
  const highShelf = ctx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 1900;
  highShelf.gain.value = Number.isFinite(style.fx.highShelf) ? style.fx.highShelf : (style.id === 'volume_alpha' ? -4.4 : -2.4);

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 8;
  compressor.ratio.value = 1.4;
  compressor.attack.value = 0.025;
  compressor.release.value = 0.5;

  const widener = createStereoWidener(ctx, style.id === 'volume_alpha' ? 0.5 : 0.16);

  const master = ctx.createGain();
  master.gain.value = live ? 0.84 : 0.86;

  input.connect(tone);
  tone.connect(lowShelf);
  lowShelf.connect(highShelf);
  highShelf.connect(widener.input);
  widener.output.connect(compressor);
  compressor.connect(master);

  let analyser = null;
  if (live) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;
    master.connect(analyser);
    analyser.connect(destination);
  } else {
    master.connect(destination);
  }

  let reverb = null;
  let reverbSend = null;
  let delay = null;
  let delaySend = null;
  let airSource = null;
  if (!dry) {
    reverb = createReverbNetwork(ctx, style);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = style.fx.wet * 0.85;
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.82;
    reverb.output.connect(reverbReturn);
    reverbReturn.connect(tone);
    reverbSend.connect(reverb.input);

    delay = ctx.createDelay(1.4);
    delay.delayTime.value = Math.min(1.1, (60 / clamp(bpm, 30, 200)) * 0.72);
    const delayDamp = ctx.createBiquadFilter();
    delayDamp.type = 'lowpass';
    delayDamp.frequency.value = 2200;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    delaySend = ctx.createGain();
    delaySend.gain.value = 0.45;
    const delayReturn = ctx.createGain();
    delayReturn.gain.value = style.fx.delay * 1.4;
    delaySend.connect(delay);
    delay.connect(delayDamp);
    delayDamp.connect(feedback);
    feedback.connect(delay);
    delayDamp.connect(delayReturn);
    delayReturn.connect(tone);

    const air = ctx.createBufferSource();
    air.buffer = getNoiseBuffer(ctx);
    air.loop = true;
    const airHigh = ctx.createBiquadFilter();
    airHigh.type = 'highpass';
    airHigh.frequency.value = 120;
    const airLow = ctx.createBiquadFilter();
    airLow.type = 'lowpass';
    airLow.frequency.value = style.id === 'volume_alpha' ? 2600 : 3800;
    const airGain = ctx.createGain();
    airGain.gain.value = style.id === 'volume_alpha' ? 0.0012 : style.id === 'dark' ? 0.0014 : 0.0018;
    air.connect(airHigh);
    airHigh.connect(airLow);
    airLow.connect(airGain);
    airGain.connect(tone);
    air.start(0);
    airSource = air;
  }

  return { input, tone, compressor, master, analyser, reverbSend, delaySend, reverb, delay, airSource };
}

function trackGainValue(project, track) {
  const anySolo = project.tracks.some((candidate) => candidate.solo);
  if (track.mute || (anySolo && !track.solo)) return 0;
  return clamp(track.volume / 100, 0, 1) * 0.92;
}

function createTrackGraph(ctx, project, track, chain) {
  const gain = ctx.createGain();
  gain.gain.value = trackGainValue(project, track);
  const panner = ctx.createStereoPanner();
  panner.pan.value = clamp(track.pan / 100, -1, 1);
  gain.connect(panner);
  panner.connect(chain.input);
  if (chain.reverbSend) panner.connect(chain.reverbSend);
  if (chain.delaySend && ['keys', 'bell', 'lead', 'strings'].includes(track.role)) {
    panner.connect(chain.delaySend);
  }
  return { gain, panner, input: gain };
}

function makeVoiceDestination(ctx, bus, instrument, event, track) {
  const panner = ctx.createStereoPanner();
  let pan = 0;
  if (!['bass', 'sub'].includes(instrument.role)) {
    pan = ((((event.pitch * 13 + track.index * 7 + Math.floor(event.startBeat * 4)) % 23) - 11) / 100) * 0.9;
  }
  panner.pan.value = clamp(pan, -0.45, 0.45);
  panner.connect(bus);
  return panner;
}

function addOsc(ctx, type, freq, t0, stopAt, sources, detune = 0) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = clamp(freq, 12, 19000);
  osc.detune.value = detune;
  osc.start(t0);
  safeStop(osc, Math.max(stopAt, t0 + 0.03));
  sources.push(osc);
  return osc;
}

function addWaveOsc(ctx, waveName, freq, t0, stopAt, sources, detune = 0) {
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(getWave(ctx, waveName));
  osc.frequency.value = clamp(freq, 12, 19000);
  osc.detune.value = detune;
  osc.start(t0);
  safeStop(osc, Math.max(stopAt, t0 + 0.03));
  sources.push(osc);
  return osc;
}

function addNoise(ctx, dest, t0, stopAt, sources, { loop = true, offset = 0 } = {}) {
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  source.loop = loop;
  source.loopStart = 0;
  source.loopEnd = source.buffer.duration;
  source.connect(dest);
  source.start(t0, offset % source.buffer.duration);
  safeStop(source, Math.max(stopAt, t0 + 0.03));
  sources.push(source);
  return source;
}

function addLfo(ctx, param, rate, depth, t0, stopAt, sources) {
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = rate;
  const amount = ctx.createGain();
  amount.gain.value = depth;
  lfo.connect(amount);
  amount.connect(param);
  lfo.start(t0);
  safeStop(lfo, Math.max(stopAt, t0 + 0.03));
  sources.push(lfo);
  return lfo;
}

function amplitudeEnvelope(ctx, destination, t0, peak, attack, noteDur, release, decay = 0, sustain = 1) {
  const gain = ctx.createGain();
  gain.connect(destination);
  const safePeak = Math.max(0.0004, peak);
  const noteEnd = t0 + Math.max(0.04, noteDur);
  const actualAttack = Math.max(0.003, Math.min(attack, Math.max(0.02, noteDur * 0.72)));
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(safePeak, t0 + actualAttack);
  if (decay > 0) {
    const decayEnd = Math.min(noteEnd, t0 + actualAttack + decay);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, safePeak * sustain), decayEnd);
    if (decayEnd < noteEnd - 0.005) {
      gain.gain.setValueAtTime(Math.max(0.0001, safePeak * sustain), noteEnd);
    }
  } else {
    gain.gain.setValueAtTime(safePeak, noteEnd);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd + Math.max(0.08, release));
  return gain;
}

function biquad(ctx, type, frequency, q = 0.7) {
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = clamp(frequency, 20, 19500);
  filter.Q.value = q;
  return filter;
}

function simpleMix(ctx, gains = []) {
  const mix = ctx.createGain();
  mix.gain.value = 1;
  gains.forEach((value) => {
    const g = ctx.createGain();
    g.gain.value = value;
    g.connect(mix);
  });
  return mix;
}

function spawnVoice(ctx, bus, instrument, event, t0, duration, sources, track, economy = false) {
  const p = instrument.params || {};
  const velocity = clamp(event.velocity, 0.02, 1);
  const frequency = midiToFreq(event.pitch);
  const dest = makeVoiceDestination(ctx, bus, instrument, event, track);
  const release = Math.min(2.6, Math.max(0.15, Number(p.release) || 2.2));
  const stopAt = t0 + Math.max(0.15, duration) + release + 0.4;
  const engine = instrument.engine;

  switch (engine) {
    case 'felt': {
      const baseCutoff = p.cutoff ?? 1900;

      // Low-CPU path: one PeriodicWave oscillator + one hammer transient.
      // The six-partial/inharmonic version stays for export and HQ playback.
      if (economy) {
        const filter = biquad(ctx, 'lowpass', baseCutoff, 0.35);
        filter.frequency.setValueAtTime(Math.min(5000, baseCutoff * 1.9 + velocity * 1300), t0);
        filter.frequency.exponentialRampToValueAtTime(Math.max(650, baseCutoff * 0.72), t0 + Math.max(0.4, Math.min(duration, 5.0)));
        filter.connect(dest);
        const decay = clamp(4.4 - (event.pitch - 48) * 0.03, 1.8, 4.8);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(Math.max(0.0004, 0.42 * velocity), t0 + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
        const osc = addWaveOsc(ctx, 'felt', frequency, t0, Math.min(stopAt, t0 + decay + 0.12), sources, p.detune ?? 2);
        osc.connect(env);
        env.connect(filter);

        const hammer = ctx.createGain();
        hammer.gain.setValueAtTime(0.05 * velocity, t0);
        hammer.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
        hammer.connect(dest);
        const hammerFilter = biquad(ctx, 'lowpass', 1400, 0.7);
        hammerFilter.connect(hammer);
        addNoise(ctx, hammerFilter, t0, t0 + 0.085, sources, { loop: false, offset: Math.random() * 1.2 });
        break;
      }

      const filter = biquad(ctx, 'lowpass', baseCutoff, 0.35);
      filter.frequency.setValueAtTime(Math.min(5000, baseCutoff * 1.9 + velocity * 1300), t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(650, baseCutoff * 0.72), t0 + Math.max(0.4, Math.min(duration, 5.0)));
      filter.connect(dest);

      // Hammer/mechanical noise is what makes a felt piano read as a piano
      // rather than a sine/bell pad.
      const hammer = ctx.createGain();
      hammer.gain.setValueAtTime(0.055 * velocity, t0);
      hammer.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);
      hammer.connect(dest);
      const hammerFilter = biquad(ctx, 'lowpass', 1400, 0.7);
      hammerFilter.connect(hammer);
      addNoise(ctx, hammerFilter, t0, t0 + 0.09, sources, { loop: false, offset: Math.random() * 1.2 });

      const baseDecay = clamp(4.8 - (event.pitch - 48) * 0.032, 2.2, 5.2);
      const partials = [
        [1.000, 0.74, 0],
        [2.003, 0.30, 1],
        [3.008, 0.15, 2],
        [4.018, 0.07, 3],
        [5.031, 0.032, 4],
        [6.046, 0.014, 5]
      ];
      partials.forEach(([mult, amplitude, harmonic], index) => {
        const decay = Math.max(0.16, baseDecay / Math.pow(1.42, harmonic));
        const endTime = t0 + decay;
        const gain = ctx.createGain();
        const peak = Math.max(0.0003, amplitude * velocity * 0.92);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.007 + index * 0.0015);
        gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
        const osc = addOsc(ctx, 'sine', frequency * mult, t0, Math.min(stopAt, endTime + 0.12), sources, (p.detune ?? 2) * (index === 0 ? 1 : 0));
        osc.connect(gain);
        gain.connect(filter);
      });

      // A quiet body/triangle layer gives the low-mid weight of an upright.
      const body = addOsc(ctx, 'triangle', frequency, t0, Math.min(stopAt, t0 + 2.4), sources, p.detune ?? 2);
      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0.0001, t0);
      bodyGain.gain.exponentialRampToValueAtTime(0.055 * velocity, t0 + 0.008);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
      body.connect(bodyGain);
      bodyGain.connect(filter);
      break;
    }

    case 'bell': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.16 * velocity, 0.005, duration, release, 3.8, 0.08);
      const carrier = addOsc(ctx, 'sine', frequency, t0, stopAt, sources);
      const modulator = addOsc(ctx, 'sine', frequency * (p.ratio ?? 2.01), t0, stopAt, sources);
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(frequency * (p.index ?? 1.7), t0);
      modGain.gain.exponentialRampToValueAtTime(frequency * 0.05, t0 + Math.max(0.4, duration));
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      const filter = biquad(ctx, 'lowpass', p.cutoff ?? 5200, 0.35);
      carrier.connect(filter);
      filter.connect(env);
      break;
    }

    case 'pad': {
      const attack = p.attack ?? 3.2;
      const filter = biquad(ctx, 'lowpass', (p.cutoff ?? 1400) * 0.55, 0.5);
      filter.frequency.setValueAtTime((p.cutoff ?? 1400) * 0.55, t0);
      filter.frequency.linearRampToValueAtTime(p.cutoff ?? 1400, t0 + Math.min(attack, duration * 0.8));
      const env = amplitudeEnvelope(ctx, dest, t0, 0.115 * velocity, attack, duration, release, 0, 1);
      filter.connect(env);
      if (economy) {
        const osc = addWaveOsc(ctx, 'pad', frequency, t0, stopAt, sources, 0);
        const gain = ctx.createGain();
        gain.gain.value = 0.72;
        osc.connect(gain);
        gain.connect(filter);
        break;
      }
      const detune = p.detune ?? 7;
      [-detune, detune].forEach((cents) => {
        const osc = addWaveOsc(ctx, 'pad', frequency, t0, stopAt, sources, cents);
        const gain = ctx.createGain();
        gain.gain.value = 0.46;
        const pan = ctx.createStereoPanner();
        pan.pan.value = cents < 0 ? -0.48 : 0.48;
        osc.connect(gain);
        gain.connect(pan);
        pan.connect(filter);
      });
      break;
    }

    case 'glass': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.085 * velocity, 0.006, duration, release, 5.2, 0.03);
      const glassFilter = biquad(ctx, 'lowpass', p.cutoff ?? 6000, 0.4);
      glassFilter.connect(env);
      [[1, 0.78], [p.ratio ?? 2.76, 0.24]].forEach(([mult, level]) => {
        const osc = addOsc(ctx, 'sine', frequency * mult, t0, stopAt, sources);
        const gain = ctx.createGain();
        gain.gain.value = level;
        osc.connect(gain);
        gain.connect(glassFilter);
      });
      break;
    }

    case 'bass': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.24 * velocity, p.attack ?? 0.12, duration, release, 0, 1);
      const filter = biquad(ctx, 'lowpass', p.cutoff ?? 230, 0.65);
      filter.connect(env);
      const osc = addWaveOsc(ctx, 'bass', frequency, t0, stopAt, sources, 2);
      const gain = ctx.createGain();
      gain.gain.value = 0.9;
      osc.connect(gain);
      gain.connect(filter);
      break;
    }

    case 'sub': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.23 * velocity, p.attack ?? 0.3, duration, release, 0, 1);
      const filter = biquad(ctx, 'lowpass', 120, 0.5);
      filter.connect(env);
      addOsc(ctx, 'sine', frequency, t0, stopAt, sources).connect(filter);
      break;
    }

    case 'pluck': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.135 * velocity, 0.004, duration, release, 0.9, 0.05);
      const filter = biquad(ctx, 'lowpass', p.cutoff ?? 2400, 0.8);
      filter.frequency.setValueAtTime((p.cutoff ?? 2400) * 1.6, t0);
      filter.frequency.exponentialRampToValueAtTime(p.cutoff ?? 2400, t0 + 0.6);
      filter.connect(env);
      const osc = addWaveOsc(ctx, 'pluck', frequency, t0, stopAt, sources);
      const gain = ctx.createGain();
      gain.gain.value = 0.9;
      osc.connect(gain);
      gain.connect(filter);
      break;
    }

    case 'choir': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.12 * velocity, p.attack ?? 1.2, duration, release, 0, 1);
      const filter = biquad(ctx, 'lowpass', p.cutoff ?? 1800, 0.55);
      filter.connect(env);
      const osc = addWaveOsc(ctx, 'choir', frequency, t0, stopAt, sources, 4);
      const gain = ctx.createGain();
      gain.gain.value = 0.9;
      osc.connect(gain);
      gain.connect(filter);
      break;
    }

    case 'drone': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.14 * velocity, p.attack ?? 4.5, duration, release, 0, 1);
      const filter = biquad(ctx, 'lowpass', p.cutoff ?? 320, 0.6);
      filter.frequency.setValueAtTime((p.cutoff ?? 320) * 0.7, t0);
      filter.frequency.linearRampToValueAtTime(p.cutoff ?? 320, t0 + Math.min(6, duration * 0.8));
      filter.connect(env);
      const detune = p.detune ?? 8;
      [-detune, detune].forEach((cents) => {
        const osc = addWaveOsc(ctx, 'drone', frequency, t0, stopAt, sources, cents);
        const gain = ctx.createGain();
        gain.gain.value = 0.44;
        const pan = ctx.createStereoPanner();
        pan.pan.value = cents < 0 ? -0.34 : 0.34;
        osc.connect(gain);
        gain.connect(pan);
        pan.connect(filter);
      });
      break;
    }

    case 'strings': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.1 * velocity, p.attack ?? 1.4, duration, release, 0, 1);
      const filter = biquad(ctx, 'lowpass', p.cutoff ?? 1500, 0.5);
      filter.connect(env);
      if (economy) {
        const osc = addWaveOsc(ctx, 'strings', frequency, t0, stopAt, sources, 0);
        const gain = ctx.createGain();
        gain.gain.value = 0.76;
        osc.connect(gain);
        gain.connect(filter);
        break;
      }
      const detune = p.detune ?? 6;
      [-detune, detune].forEach((cents) => {
        const osc = addWaveOsc(ctx, 'strings', frequency, t0, stopAt, sources, cents);
        const gain = ctx.createGain();
        gain.gain.value = 0.44;
        const pan = ctx.createStereoPanner();
        pan.pan.value = cents < 0 ? -0.5 : 0.5;
        osc.connect(gain);
        gain.connect(pan);
        pan.connect(filter);
      });
      break;
    }

    case 'organ': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.1 * velocity, p.attack ?? 0.35, duration, release, 0, 1);
      const filter = biquad(ctx, 'lowpass', p.cutoff ?? 2400, 0.4);
      filter.connect(env);
      const osc = addWaveOsc(ctx, 'organ', frequency, t0, stopAt, sources, 2);
      const gain = ctx.createGain();
      gain.gain.value = 0.9;
      osc.connect(gain);
      gain.connect(filter);
      break;
    }

    case 'mallet': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.13 * velocity, 0.003, duration, release, 2.4, 0.06);
      const carrier = addOsc(ctx, 'sine', frequency, t0, stopAt, sources);
      const modulator = addOsc(ctx, 'sine', frequency * (p.ratio ?? 3.01), t0, stopAt, sources);
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(frequency * (p.index ?? 2.1), t0);
      modGain.gain.exponentialRampToValueAtTime(0.01, t0 + Math.min(1.2, duration));
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      const woodFilter = biquad(ctx, 'lowpass', p.cutoff ?? 5000, 0.4);
      carrier.connect(woodFilter);
      woodFilter.connect(env);
      break;
    }

    case 'harp': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.16 * velocity, 0.004, duration, release, 2.0, 0.04);
      const osc = addWaveOsc(ctx, 'harp', frequency, t0, stopAt, sources, 3);
      const gain = ctx.createGain();
      gain.gain.value = 0.9;
      const harpFilter = biquad(ctx, 'lowpass', p.cutoff ?? 5000, 0.35);
      osc.connect(gain);
      gain.connect(harpFilter);
      harpFilter.connect(env);
      break;
    }

    case 'texture': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.06 * velocity, p.attack ?? 2.2, duration, release, 0, 1);
      const filter = biquad(ctx, 'bandpass', p.center ?? 1300, p.q ?? 1.6);
      filter.connect(env);
      addNoise(ctx, filter, t0, stopAt, sources, { loop: true });
      break;
    }

    case 'tape': {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.05 * velocity, p.attack ?? 2.2, duration, release, 0, 1);
      const filter = biquad(ctx, 'bandpass', p.center ?? 620, p.q ?? 0.9);
      filter.connect(env);
      addNoise(ctx, filter, t0, stopAt, sources, { loop: true });
      break;
    }

    default: {
      const env = amplitudeEnvelope(ctx, dest, t0, 0.1 * velocity, 0.05, duration, release, 0, 1);
      addOsc(ctx, 'sine', frequency, t0, stopAt, sources).connect(env);
    }
  }
}

function scheduleProject(ctx, project, trackGraphs, chain, startAt, offsetSec, sources, options = {}) {
  const {
    skipSilent = false,
    economy = false,
    fromSec = null,
    toSec = Infinity,
    includeSustaining = false,
    notes: precomputedNotes = null
  } = options;
  const notes = precomputedNotes || projectNotes(project);
  const anySolo = skipSilent ? project.tracks.some((candidate) => candidate.solo) : false;
  const windowStart = fromSec === null ? offsetSec : fromSec;

  for (const event of notes) {
    if (event.startSec >= toSec) break;
    if (event.endSec <= windowStart + 0.002) continue;
    if (fromSec !== null && event.startSec < fromSec && !(includeSustaining && event.endSec > fromSec)) continue;
    const track = project.tracks[event.trackIndex];
    if (!track) continue;
    if (skipSilent && (track.mute || (anySolo && !track.solo))) continue;
    const startDelay = Math.max(0, event.startSec - offsetSec);
    const t0 = startAt + startDelay;
    const remaining = event.endSec - Math.max(offsetSec, event.startSec - 0.01);
    if (remaining <= 0.03) continue;
    const instrument = getInstrument(track.instrumentId);
    if (!instrument) continue;
    spawnVoice(ctx, trackGraphs[event.trackIndex].input, instrument, event, t0, remaining, sources, track, economy);
  }
}

function buildProjectGraph(ctx, project, destination, { live = false, dry = false } = {}) {
  const baseStyle = getStyle(project.styleId);
  const style = project.mix ? { ...baseStyle, fx: { ...baseStyle.fx, ...project.mix } } : baseStyle;
  const chain = createMasterChain(ctx, style, destination, { live, bpm: project.bpm, dry });
  const trackGraphs = project.tracks.map((track) => createTrackGraph(ctx, project, track, chain));
  return { chain, trackGraphs };
}

function applyMix(project, trackGraphs, chain, immediate = false) {
  const anySolo = project.tracks.some((track) => track.solo);
  project.tracks.forEach((track, index) => {
    const graph = trackGraphs[index];
    if (!graph) return;
    const value = trackGainValue(project, track);
    try {
      graph.gain.gain.cancelScheduledValues(0);
      graph.gain.gain.setTargetAtTime(value, graph.gain.context.currentTime, immediate ? 0.005 : 0.045);
    } catch {
      graph.gain.gain.value = value;
    }
    graph.panner.pan.setTargetAtTime(clamp(track.pan / 100, -1, 1), graph.panner.context.currentTime, 0.04);
  });
}

function normalizeBuffer(buffer, target = 0.9) {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  const gain = peak > 0.00001 ? target / peak : 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      data[i] *= gain;
    }
  }
  const fadeIn = Math.min(256, buffer.length);
  const fadeOut = Math.min(Math.floor(buffer.sampleRate * 1.8), Math.floor(buffer.length * 0.2));
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < fadeIn; i += 1) data[i] *= i / fadeIn;
    for (let i = 0; i < fadeOut; i += 1) {
      const index = data.length - 1 - i;
      data[index] *= i / fadeOut;
    }
  }
  return peak;
}

function analyzeBuffer(buffer) {
  let peak = 0;
  let sum = 0;
  let count = 0;
  let silent = 0;
  let side = 0;
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  for (let i = 0; i < left.length; i += 1) {
    const l = left[i];
    const r = right[i];
    const abs = Math.max(Math.abs(l), Math.abs(r));
    if (abs > peak) peak = abs;
    if (abs < 0.0005) silent += 1;
    sum += l * l + r * r;
    side += Math.abs(l - r);
    count += 2;
  }
  return {
    peak,
    rms: Math.sqrt(sum / Math.max(1, count)),
    silenceRatio: silent / Math.max(1, left.length),
    stereoWidth: side / Math.max(1, left.length),
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels
  };
}

export function audioBufferToWav(buffer) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  const channelData = [];
  for (let channel = 0; channel < channels; channel += 1) {
    channelData.push(buffer.getChannelData(channel));
  }
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      let sample = clamp(channelData[channel][frame], -1, 1);
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return arrayBuffer;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.graph = null;
    this.sources = [];
    this.project = null;
    this.playing = false;
    this.offset = 0;
    this.startedAt = 0;
    this.endTimer = null;
    this.loop = false;
    this.masterVolume = 0.86;
    this.onEnd = null;
    this.lastRenderStats = null;
    this._previewSources = [];
    this._previewGraph = null;
    this._previewCleanup = null;
    this.economy = false;
    this._liveNotes = [];
    this._scheduleCursor = 0;
    this._lookaheadTimer = null;
    this.lastLiveStats = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('Web Audio is not available');
      this.ctx = new Context({ latencyHint: this.economy ? 'playback' : 'interactive' });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  get position() {
    if (!this.playing || !this.ctx) return clamp(this.offset, 0, this.project?.durationSec || 0);
    return clamp(this.offset + (this.ctx.currentTime - this.startedAt), 0, this.project?.durationSec || 0);
  }

  play(project, offset = 0, loop = this.loop) {
    this.ensureContext();
    this.stopInternal(0.035);
    this.project = project;
    this.loop = Boolean(loop);
    const max = project.durationSec;
    this.offset = clamp(Number(offset) || 0, 0, Math.max(0, max - 0.05));
    if (this.offset >= max - 0.05) this.offset = 0;
    this.graph = buildProjectGraph(this.ctx, project, this.ctx.destination, { live: true });
    this.graph.chain.master.gain.cancelScheduledValues(0);
    this.graph.chain.master.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    this.sources = [];
    this._liveNotes = projectNotes(project);
    this._scheduleCursor = this.offset;
    this.playing = true;
    const startAt = this.ctx.currentTime + 0.08;
    this.startedAt = startAt;
    // Do not create every oscillator at once: schedule a rolling window so a
    // weak CPU is not hit by a thousand-node spike before the first beat.
    this._scheduleLiveWindow(this.offset + LIVE_LOOKAHEAD_SECONDS, true);
    clearInterval(this._lookaheadTimer);
    this._lookaheadTimer = setInterval(() => {
      if (!this.playing) return;
      this._scheduleLiveWindow(Math.min(max, this.position + LIVE_LOOKAHEAD_SECONDS));
    }, LIVE_SCHEDULE_INTERVAL_MS);
    this._scheduleEnd((max - this.offset) * 1000 + 120);
    return true;
  }

  _scheduleLiveWindow(until, includeSustaining = false) {
    if (!this.playing || !this.project) return;
    const from = this._scheduleCursor;
    const to = Math.min(this.project.durationSec, Math.max(from, Number(until) || 0));
    if (to <= from + 0.01) return;
    scheduleProject(
      this.ctx,
      this.project,
      this.graph.trackGraphs,
      this.graph.chain,
      this.startedAt,
      this.offset,
      this.sources,
      {
        economy: this.economy,
        fromSec: from,
        toSec: to,
        includeSustaining,
        notes: this._liveNotes
      }
    );
    this._scheduleCursor = to;
    this.lastLiveStats = {
      economy: this.economy,
      scheduledUntil: Number(to.toFixed(2)),
      notes: this._liveNotes.length,
      sources: this.sources.length
    };
  }

  _clearLiveScheduler() {
    clearInterval(this._lookaheadTimer);
    this._lookaheadTimer = null;
  }

  setEconomy(value) {
    const next = Boolean(value);
    if (this.economy === next) return;
    this.economy = next;
    if (this.playing && this.project) {
      this.play(this.project, this.position, this.loop);
    }
  }

  _scheduleEnd(delayMs) {
    clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => {
      if (!this.playing) return;
      if (this.loop) {
        this.play(this.project, 0, true);
      } else {
        this.playing = false;
        this._clearLiveScheduler();
        this.offset = 0;
        this._fadeOut(0.6);
        if (typeof this.onEnd === 'function') this.onEnd();
      }
    }, Math.max(50, delayMs));
  }

  _fadeOut(seconds = 0.05) {
    if (!this.graph) return;
    const master = this.graph.chain.master;
    const now = this.ctx.currentTime;
    try {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    } catch {
      master.gain.value = 0;
    }
    const oldSources = this.sources;
    const oldGraph = this.graph;
    this.sources = [];
    this.graph = null;
    if (oldGraph?.chain?.airSource) {
      try { oldGraph.chain.airSource.stop(); } catch { /* noop */ }
    }
    if (oldGraph?.chain?.reverb?.dither) {
      try { oldGraph.chain.reverb.dither.stop(); } catch { /* noop */ }
    }
    setTimeout(() => {
      oldSources.forEach((source) => {
        try { source.stop(); } catch { /* noop */ }
      });
      try { oldGraph.chain.master.disconnect(); } catch { /* noop */ }
      try { oldGraph.chain.analyser?.disconnect(); } catch { /* noop */ }
    }, Math.ceil(seconds * 1000) + 60);
  }

  stopInternal(fade = 0.05) {
    clearTimeout(this.endTimer);
    this.endTimer = null;
    this._clearLiveScheduler();
    this.playing = false;
    this._fadeOut(fade);
  }

  stop() {
    this.offset = 0;
    this.stopInternal(0.06);
  }

  pause() {
    if (!this.playing) return this.position;
    const position = this.position;
    this.offset = position;
    this.stopInternal(0.035);
    return position;
  }

  seek(seconds) {
    const target = clamp(Number(seconds) || 0, 0, this.project?.durationSec || 0);
    if (this.playing) {
      this.play(this.project, target, this.loop);
    } else {
      this.offset = target;
    }
    return target;
  }

  setLoop(value) {
    this.loop = Boolean(value);
    if (this.playing) {
      const remaining = Math.max(0.1, this.project.durationSec - this.position);
      this._scheduleEnd(remaining * 1000 + 120);
    }
  }

  setMasterVolume(value) {
    this.masterVolume = clamp(Number(value) || 0, 0, 1);
    if (this.graph) {
      this.graph.chain.master.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.04);
    }
  }

  updateMix(project) {
    if (!this.graph || !project) return;
    applyMix(project, this.graph.trackGraphs, this.graph.chain);
  }

  levels() {
    if (!this.ctx || !this.graph?.chain.analyser) return { peak: 0, rms: 0 };
    const analyser = this.graph.chain.analyser;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const value = (data[i] - 128) / 128;
      peak = Math.max(peak, Math.abs(value));
      sum += value * value;
    }
    return { peak, rms: Math.sqrt(sum / data.length) };
  }

  async preview(instrumentId, styleId, key = { root: 0, mode: 'major' }) {
    const instrument = getInstrument(instrumentId);
    const style = getStyle(styleId);
    if (!instrument) return;
    this.ensureContext();
    if (this._previewCleanup) {
      try { this._previewCleanup(); } catch { /* noop */ }
      this._previewCleanup = null;
    }
    this._previewSources.forEach((source) => { try { source.stop(); } catch { /* noop */ } });
    this._previewSources = [];
    try { this._previewGraph?.chain.master.disconnect(); } catch { /* noop */ }

    const chain = createMasterChain(this.ctx, style, this.ctx.destination, { live: false });
    chain.master.gain.value = 0.5;
    const bus = this.ctx.createGain();
    bus.gain.value = 0.85;
    const track = { index: 0, role: instrument.role };
    const start = this.ctx.currentTime + 0.04;
    const roots = { bass: 36, sub: 33, bell: 72, lead: 69, strings: 60, pad: 57, keys: 60, texture: 60 };
    const base = (roots[instrument.role] || 60) + (key.root || 0);
    const offsets = [0, 4, 7, 12];
    offsets.forEach((offset, index) => {
      const event = { pitch: base + offset, velocity: 0.38, startBeat: index };
      spawnVoice(this.ctx, bus, instrument, event, start + index * 0.24, 1.1, this._previewSources, track);
    });
    bus.connect(chain.input);
    bus.connect(chain.reverbSend);
    bus.connect(chain.delaySend);
    this._previewGraph = chain;
    const cleanup = () => {
      this._previewSources.forEach((source) => { try { source.stop(); } catch { /* noop */ } });
      this._previewSources = [];
      try { chain.airSource?.stop(); } catch { /* noop */ }
      try { chain.reverb?.dither?.stop(); } catch { /* noop */ }
      try { chain.master.disconnect(); } catch { /* noop */ }
      try { chain.input.disconnect(); } catch { /* noop */ }
      this._previewCleanup = null;
    };
    this._previewCleanup = cleanup;
    setTimeout(cleanup, 5600);
  }

  async _resample(buffer, sampleRate = 44100) {
    const target = new OfflineAudioContext(2, Math.ceil(buffer.duration * sampleRate), sampleRate);
    const source = target.createBufferSource();
    source.buffer = buffer;
    source.connect(target.destination);
    source.start(0);
    return target.startRendering();
  }

  async renderWav(project, onProgress = null, options = {}) {
    const outputRate = 44100;
    const renderRate = 32000;
    const totalSeconds = project.durationSec + project.tailSec;
    const frames = Math.ceil(totalSeconds * renderRate);
    if (!Number.isFinite(frames) || frames <= 0 || frames > renderRate * 600) {
      throw new Error('Некорректная длина проекта');
    }
    if (onProgress) onProgress({ phase: 'render', progress: 0.08, message: 'Готовим граф…' });
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const offline = new OfflineAudioContext(2, frames, renderRate);
    const graph = buildProjectGraph(offline, project, offline.destination, { live: false, dry: Boolean(options.dry) });
    const sources = [];
    scheduleProject(offline, project, graph.trackGraphs, graph.chain, 0.02, 0, sources, { skipSilent: true, economy: Boolean(options.economy) });
    if (onProgress) onProgress({ phase: 'render', progress: 0.25, message: 'Рендерим дорожки…' });
    const started = performance.now();
    const rendered = await offline.startRendering();
    const renderMs = performance.now() - started;
    if (onProgress) onProgress({ phase: 'master', progress: 0.76, message: 'Апсемплинг до 44.1 kHz…' });
    const resampleStart = performance.now();
    const buffer = await this._resample(rendered, outputRate);
    const resampleMs = performance.now() - resampleStart;
    if (onProgress) onProgress({ phase: 'master', progress: 0.86, message: 'Нормализуем…' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    normalizeBuffer(buffer, 0.84);
    const stats = analyzeBuffer(buffer);
    this.lastRenderStats = { ...stats, renderMs: Math.round(renderMs), resampleMs: Math.round(resampleMs), sourceCount: sources.length };
    const wav = audioBufferToWav(buffer);
    if (onProgress) onProgress({ phase: 'done', progress: 1, message: 'Готово' });
    return { buffer, wav, stats: this.lastRenderStats };
  }
}
