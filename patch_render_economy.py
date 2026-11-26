from pathlib import Path
p=Path(r'C:\Users\Я\Documents\AmbientForge\ui\js\audio.js')
s=p.read_text(encoding='utf-8')
s=s.replace("scheduleProject(offline, project, graph.trackGraphs, graph.chain, 0.02, 0, sources, { skipSilent: true });",
"scheduleProject(offline, project, graph.trackGraphs, graph.chain, 0.02, 0, sources, { skipSilent: true, economy: Boolean(options.economy) });")
p.write_text(s,encoding='utf-8')
print('render economy option')
