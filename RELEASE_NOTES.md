# AETHER Ambient Studio 1.0.0

Desktop generative ambient studio for Windows: five styles, 80 instruments, ten demos, a warm Minecraft-inspired Volume Alpha mode, custom themes and a runnable generation pipeline.

## Highlights

- **Volume Alpha 2011**: felt piano, sparse melodies, 4-bar harmony, tape texture and restrained pads.
- **Custom themes**: five built-in palettes plus a theme editor persisted through the native settings bridge.
- **Runnable pipeline**: `SEED → KEY → CHORDS → FORM → ROLES → MIX` with real values, an execution animation and `ALGORITHM.md`.
- **20-second proof**: a synthesized reconstruction of `C418 — Wet Hands`, `00:00–00:20`, 129 transcribed notes, 8 register tracks, 20.0 seconds. Chroma similarity 0.928, DTW 0.866. The original recording is not included.
- **Performance**: cached note lists, skip silent tracks on export, idle UI meter throttling, debounced resize.

## Verification

- 208 regression checks, 0 failures.
- 15 generation matrices, 40 stress projects.
- Adversarial suite passed with 0 console/page errors.
- Native one-file and portable builds tested on Windows 10 + WebView2.

## Downloads

- `AetherAmbientStudio.exe` — one-file build.
- `AetherAmbientStudio_Portable.zip` — portable build.
- `Wet Hands 20s proof.wav` — proof audio.
- `Mosslight.wav`, `Rain on the Hearth.wav` — Volume Alpha demos.

The exe is built for Windows 10/11 with WebView2 Runtime. Extract the portable ZIP to an ASCII path.

The Wet Hands excerpt is a fan-made transcription/reconstruction for style verification; no original audio is redistributed.
