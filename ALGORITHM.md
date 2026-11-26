# AETHER: алгоритм генерации

Это не описание «в общих чертах», а последовательность, которую выполняет `ui/js/composer.js` при каждом нажатии «Сгенерировать эмбиент» или «Выполнить последовательность».

## Вход

```text
styleId   : volume_alpha | calm | dark | ambient | all
seed      : строка (например, mosslight-2011)
bpm       : 36…180
bars      : 8 | 16 | 32
```

Seed можно заменить, BPM и длину — изменить. Одинаковые входы всегда дают один и тот же проект.

## Шаги

### 01. Seed → PRNG

```text
h0 = FNV1a(seed + "|" + styleId + "|project")
rng = mulberry32(h0)
```

Дальше ни один генератор не использует `Math.random()`; вся случайность идёт из `rng`, поэтому проект воспроизводим.

### 02. Профиль стиля

Из `instruments.js` берётся:

- 16 инструментов стиля;
- сигнатурный набор из 8 инструментов (`style.signature`);
- лады (`style.modes`);
- диапазон BPM и базовый BPM;
- `chordBars` (у Volume Alpha — 4);
- параметры эффектов: `reverb`, `wet`, `tone`, `reverbTone`, `delay`, `drive`.

### 03. Тональность

```text
root = один из 12 pitch classes, выбранный rng
mode = один из ладов стиля, выбранный rng
key  = { root, mode }
```

Для Volume Alpha используются мажор/лидийский/дорийский/миксолидийский оттенки; для дарка — минор/фригийский.

### 04. Гармония

```text
progression = style.progressions[rng.int(0, n-1)]
chordBars    = style.chordBars || 2
for bar in 0, chordBars, 2*chordBars, ...:
    degree, quality = progression[(bar / chordBars) % progression.length]
    rootMidi = 48 + key.root + modeIntervals[degree]
    tones    = rootMidi + QUALITIES[quality]
```

У Volume Alpha прогрессия раскладывается блоками по 4 такта; у остальных — по 2. Это даёт «долгую» гармонию вместо быстрой смены аккордов.

### 05. Форма

```text
intro : bar < 4
build : 4 <= bar < 8
body  : 8 <= bar < bars-4
outro : bar >= bars-4
```

`sectionShape(bar, bars)` возвращает коэффициент 0.54…1.0. Он применяется к velocity и плотности, а не меняет аккорды.

### 06. Восемь ролей

Фиксированный порядок дорожек:

```text
ATMOS → PAD → KEYS → BASS → BELLS → STRINGS → LEAD → DUST
```

Для каждой роли выбирается инструмент из сигнатурного набора. Если сигнатуры нет — из общего пула стиля без повторов.

### 07. Генерация нот по ролям

Каждая дорожка режется на клипы. Для клипа вызывается генератор роли:

| Роль | Что делает генератор |
|---|---|
| `texture` | один-два длинных тона + шумовой слой |
| `pad` | аккордовые тона на 2/4 такта |
| `keys` | для Volume Alpha — фетровое пиано: левая рука (root/fifth), правая — 4–6 нот на 2 такта, motif-нота |
| `bass` | root + редкая квинта, длинные ноты |
| `bell` | редкие высокие ответы, 2–4 ноты на блок |
| `strings` | длинные терции/квинты, тихие |
| `lead` | разреженная мелодия из motif |
| `dust` | короткие высокие «пылинки» |

Нота имеет схему:

```js
{ pitch, startBeat, durationBeats, velocity }
```

`startBeat` считается от начала клипа; `velocity` — 0.03…1. Затем клип обрезается по длине, пустой клип получает один тихий fallback-тон, чтобы таймлайн всегда был заполнен.

### 08. Дорожки и клипы

```text
for each of 8 instruments:
    unit = 4 for pad/strings; 2 for most; 2 for dust
    for startBar = 0; startBar < bars; startBar += unit:
        makeClip(...)
```

Итог: 8 дорожек, клипы покрывают весь проект, `noteCount` и `clipCount` пересчитываются, waveform строится из нот и громкости дорожек.

### 09. Аудио

`audio.js` строит граф:

```text
note → felt piano / pad / noise engine
     → track gain + pan
     → master tone → low shelf → high shelf → stereo widener
     → compressor → master gain → destination
```

Тот же граф используется для живого Web Audio и для `OfflineAudioContext` при экспорте. Поэтому WAV звучит как плеер, а не как отдельный «экспортный» синтез.

## Pipeline в интерфейсе

Под генератором есть полоса:

```text
01 SEED → 02 KEY → 03 CHORDS → 04 FORM → 05 ROLES → 06 MIX
```

Кнопка `▶ ВЫПОЛНИТЬ` проигрывает шаги подсветкой и затем вызывает ту же генерацию. Кнопка `АЛГОРИТМ` открывает окно с текущими значениями и кнопками «Выполнить последовательность» / «20 сек proof».

## 20-секундный proof

`createWetHandsProof()` — отдельный проект, не входящий в каталог 10 демо:

- источник: `C418 — Wet Hands (Volume Alpha, 2011)`, фрагмент `00:00–00:20`;
- ноты: CRNN-транскрипция (`piano_transcription_inference`, Note_pedal), 129 нот;
- 8 дорожек — регистровые слои одного фетрового пиано;
- 8 тактов × 96 BPM = 20 секунд; старты нот пересчитаны так, чтобы сохранить исходные секунды;
- рендер — только синтез AETHER, оригинальный аудиофайл не встроен.

Проверка сходства: chroma cosine **0.928**, DTW similarity **0.866**, тональность A major.
