from pathlib import Path
p=Path(r'C:\Users\Я\Documents\AmbientForge\ui\js\app.js')
s=p.read_text(encoding='utf-8')
s=s.replace("""  lastMeter: 0,
  lastVoices: 0,""", """  lastMeter: 0,
  lastTransport: 0,
  lastVoices: 0,""")
s=s.replace("""  if (state.playing && audio.playing) {
    state.position = audio.position;
    updateTransportUi(state.position);
    if (now - state.lastMeter > 55) {
      state.lastMeter = now;
      updateMeter();
    }
    if (now - state.lastVoiceTime > 260 && state.project) {
      state.lastVoiceTime = now;
      updateVoiceStatus();
    }
  }""", """  if (state.playing && audio.playing) {
    state.position = audio.position;
    if (now - state.lastTransport > 34) {
      state.lastTransport = now;
      updateTransportUi(state.position);
    }
    if (now - state.lastMeter > 90) {
      state.lastMeter = now;
      updateMeter();
    }
    if (now - state.lastVoiceTime > 450 && state.project) {
      state.lastVoiceTime = now;
      updateVoiceStatus();
    }
  }""")
p.write_text(s,encoding='utf-8')
print('tick throttled')
