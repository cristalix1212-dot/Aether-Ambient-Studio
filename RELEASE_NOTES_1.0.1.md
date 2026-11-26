# AETHER Ambient Studio 1.0.1 — audio stability for weak PCs

This release fixes crackling, dropped beats and audio dropouts by reducing the live Web Audio load and scheduling notes in rolling windows.

## What changed

- **ECO mode** in the top-right corner (`E`): enabled automatically on 2–4 cores / 4 GB or less.
- Felt piano in ECO uses **one PeriodicWave oscillator + one hammer transient** instead of 6 partials + body + noise.
- Pads and strings use one oscillator instead of a detuned pair in ECO.
- Live playback schedules a rolling **6-second window every 450 ms** instead of creating hundreds of nodes at once.
- `latencyHint: playback` in ECO gives a larger audio buffer.
- UI work is throttled during playback: transport 30 fps, meter ~11 fps, voice counter ~2 fps.
- Export stays HQ and is unaffected by ECO.

## Measured on the 20-second Wet Hands proof

| | HQ | ECO |
|---|---|---|
| Sources | 1032 | **258** |
| Offline render | 24.5 s | **4.4 s** |
| RMS | 0.098 | 0.101 |
| Centroid | 583 Hz | 542 Hz |

Live test under 6× CPU throttle: proof reached 5.42 s in 6.39 s with no errors or long tasks; the live window held 136 sources instead of 544.

## Verification

- 208 regression checks, 0 failures.
- Adversarial suite: 0 console/page errors.
- Proof playback and UI toggle tested.
- Rebuilt one-file and portable executables.

## Downloads

- `AetherAmbientStudio.exe`
- `AetherAmbientStudio_Portable.zip`
- `Wet Hands 20s proof.wav`
- `Mosslight.wav`, `Rain on the Hearth.wav`

If audio still breaks: enable ECO, close heavy apps and use 8/16 bars. WAV export remains HQ.
