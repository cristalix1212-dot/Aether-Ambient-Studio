from pathlib import Path
p=Path(r'C:\Users\Я\Documents\AmbientForge\ui\js\audio.js')
s=p.read_text(encoding='utf-8')
s=s.replace("const TAU = Math.PI * 2;\nlet sharedNoise = new WeakMap();",
"const TAU = Math.PI * 2;\nconst LIVE_LOOKAHEAD_SECONDS = 6;\nconst LIVE_SCHEDULE_INTERVAL_MS = 450;\nlet sharedNoise = new WeakMap();")
s=s.replace("""    this._previewSources = [];
    this._previewGraph = null;
    this._previewCleanup = null;
  }""", """    this._previewSources = [];
    this._previewGraph = null;
    this._previewCleanup = null;
    this.economy = false;
    this._liveNotes = [];
    this._scheduleCursor = 0;
    this._lookaheadTimer = null;
    this.lastLiveStats = null;
  }""")
s=s.replace("this.ctx = new Context({ latencyHint: 'interactive' });",
"this.ctx = new Context({ latencyHint: this.economy ? 'playback' : 'interactive' });")
old_play="""  play(project, offset = 0, loop = this.loop) {
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
    const startAt = this.ctx.currentTime + 0.08;
    this.startedAt = startAt;
    scheduleProject(this.ctx, project, this.graph.trackGraphs, this.graph.chain, startAt, this.offset, this.sources);
    this.playing = true;
    this._scheduleEnd((max - this.offset) * 1000 + 120);
    return true;
  }"""
new_play=r'''  play(project, offset = 0, loop = this.loop) {
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
  }'''
if old_play not in s: raise SystemExit('play block missing')
s=s.replace(old_play,new_play,1)
s=s.replace("""    clearTimeout(this.endTimer);
    this.endTimer = null;
    this.playing = false;
    this._fadeOut(fade);""", """    clearTimeout(this.endTimer);
    this.endTimer = null;
    this._clearLiveScheduler();
    this.playing = false;
    this._fadeOut(fade);""")
s=s.replace("""      } else {
        this.playing = false;
        this.offset = 0;
        this._fadeOut(0.6);""", """      } else {
        this.playing = false;
        this._clearLiveScheduler();
        this.offset = 0;
        this._fadeOut(0.6);""")
p.write_text(s,encoding='utf-8')
print('engine eco scheduler patched')
