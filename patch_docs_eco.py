from pathlib import Path
p=Path(r'C:\Users\Я\Documents\AmbientForge\tests\TEST_REPORT.md')
s=p.read_text(encoding='utf-8')
s=s.replace('Версия: AETHER Ambient Studio 1.0.0 · warm / Minecraft redesign','Версия: AETHER Ambient Studio 1.0.1 · warm / Minecraft redesign · eco audio')
s=s.replace('| Нативный .exe | Запускается, WebView2, звук, сохранение WAV |','| Нативный .exe | Запускается, WebView2, звук, сохранение WAV |\n| Эко-режим | Авто на 2 ядрах, 258 источников вместо 1032, 0 ошибок |')
p.write_text(s,encoding='utf-8')
p=Path(r'C:\Users\Я\Documents\AmbientForge\README.md')
s=p.read_text(encoding='utf-8')
needle='''На proof-треке: **1032 → 258** источников, офлайн-рендер **24,5 → 4,4 с**, RMS **0.098 → 0.101**, спектральный центроид **583 → 542 Гц**.'''
repl='''На proof-треке: **1032 → 258** источников, офлайн-рендер **24,5 → 4,4 с**, RMS **0.098 → 0.101**, спектральный центроид **583 → 542 Гц**.

Если на слабом ПК звук всё ещё рвётся: включите **ЭКО** (клавиша `E`), закройте тяжёлые приложения и используйте 8/16 тактов вместо 32. Экспорт WAV всегда идёт в HQ и не зависит от live-эко.'''
if needle not in s: raise SystemExit('readme needle missing')
s=s.replace(needle,repl)
p.write_text(s,encoding='utf-8')
print('docs eco patched')
