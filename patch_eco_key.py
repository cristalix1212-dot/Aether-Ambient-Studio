from pathlib import Path
p=Path(r'C:\Users\Я\Documents\AmbientForge\ui\js\app.js')
s=p.read_text(encoding='utf-8')
s=s.replace("""    if (key === 't') { event.preventDefault(); showThemeStudio(); }
    if (key === 'p') { event.preventDefault(); setPianoOpen(!state.pianoOpen); }""", """    if (key === 't') { event.preventDefault(); showThemeStudio(); }
    if (key === 'e') { event.preventDefault(); setEconomy(!state.eco); }
    if (key === 'p') { event.preventDefault(); setPianoOpen(!state.pianoOpen); }""")
p.write_text(s,encoding='utf-8')
p=Path(r'C:\Users\Я\Documents\AmbientForge\README.md')
s=p.read_text(encoding='utf-8')
s=s.replace('| `T` | студия тем |','| `T` | студия тем |\n| `E` | эко-режим / HQ |')
p.write_text(s,encoding='utf-8')
print('eco shortcut added')
