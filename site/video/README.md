# Demo videos

Scripted, reproducible demo videos of viteTranslate. A story written in Italian goes in; an mp4 with English narration and subtitles comes out. Nobody touches the mouse: Playwright drives a real VS Code (with the extension) and the app in Chrome, an AI voice reads the lines, ffmpeg cuts.

Change a sentence, run it again: only that line is re-voiced, everything is re-shot the same way.

**This file commands `site/video`.** Whatever happens in this folder (stories, storyboards, the pipeline in `uty/`, takes and cuts) follows it, and `AGENTS.md` sends every agent here. It speaks to whoever writes a story, whoever runs the pipeline, and the editor's LLM (Claude Code, Copilot, any agent in VS Code) that converts one. Where each video stands, and how it got there: [projects/index.md](projects/index.md).

## How a video is made

1. **Write the story** in `projects/<project>/storyboard.md`, in Italian: scenes, what is shown, what is said. It is the source of truth; the format is in [storyboard.md](#storyboardmd).
2. **Have it converted.** Ask the LLM in VS Code:
   > Convert `site/video/projects/<project>/storyboard.md` into `storyboard.yaml` following `site/video/README.md`.

   It writes `storyboard.yaml` (English, executable), touching only the scenes that changed, and stamps it: see [Converting](#converting).
3. **Rehearse** for free: `node uty/run.mjs <project> tts record preview --silent`, then look at `preview/contact.jpg` and `preview/<project>.mp4`. Whoever starts it, the run shows live in VS Code: see [Watching a run](#watching-a-run).
4. **Tune** at the level you need. Content (a sentence, a scene, the order) → `storyboard.md`, then back to step 2. Technique (a wait, a selector, a hold) → `storyboard.yaml`, directly.
5. **Final cut** with the real voice: `node uty/run.mjs <project>`. The mp4 goes to YouTube; the repo keeps the `.srt` and `poster.jpg`.

## Rules for agents

1. **Read this file first**, and [projects/index.md](projects/index.md), before touching anything in `site/video`.
2. **`storyboard.md` wins** (next section). Never edit it, except to add a missing id to a heading, and say so.
3. **Ask, don't guess.** A `.md` that is ambiguous, a scene that can't be shot as written: ask the user.
4. **Rehearse with `--silent`.** The real voice spends the user's OpenRouter credit: run it only when they ask. A `--silent` run keeps the real lines whose text and voice haven't changed, and writes silence only for the others.
5. **The user watches every run live.** Run the commands as usual, and `run.mjs` makes sure they see it ([Watching a run](#watching-a-run)). Say what a run does before starting it. Give it a long timeout, and never start two runs at once.
6. **Nothing generated goes in git.** `audio/`, `capture/`, `preview/`, `log/` and the mp4 are rebuilt by a run; the repo keeps `projects/index.md`, the two storyboards, the `.srt`, `credits.txt` and `poster.jpg`. The tracks of `commons/bkmusic` stay local too; its `credits.md` goes in.
7. **Change the pipeline, change this file.** A change in `uty/` that alters keys, actions, steps or commands updates this file in the same go.
8. **Something failed?** Start from the project's `log/`: what's in it is under [The pipeline](#the-pipeline).
9. **Keep the travel log.** A session that changes something here (a project, the pipeline, this file) ends with an entry at the top of the log in [projects/index.md](projects/index.md): the date, what was done, what was decided and why, what is left. Update its table and its "Next" list in the same go.
10. **Write down what you learned.** A trap, a measure, a trick that saved a run: it goes in [Field notes](#field-notes), so the next session starts from it. Stage facts (selectors, what the app does) go in [On stage](#on-stage).

## Two files, one boss

| File | Language | Written by | Holds |
| :- | :- | :- | :- |
| `storyboard.md` | Italian | a person | **the content**: scenes and their order, what is shown, what is said, audience, tone |
| `storyboard.yaml` | English | the LLM, then tuned by a person | **the technique**: actions, timings, selectors, zoom |

**`storyboard.md` wins.** When the two disagree, the YAML is wrong. A different sentence, a new scene, a new order: edit the `.md`, then convert again. Waits, holds, selectors, typing speed: edit the YAML directly, it's what it's there for.

The pipeline enforces it. `stamp` records, at the bottom of the YAML, a fingerprint of every scene of the `.md` it was converted from; `check` compares them with the `.md` of now. Until the YAML catches up, `tts`, `record`, `preview` and `compose` stop and list the scenes to adapt (`--stale` runs them anyway, for rehearsals only).

## storyboard.md

```markdown
# Quick start

- **Titolo:** viteTranslate quick start
- **Pubblico:** sviluppatori React che non conoscono viteTranslate
- **Durata:** circa 55 secondi
- **Voce:** Leda. Un collega che mostra un attrezzo a un altro.
- **Progetto filmato:** demo/Vite_8/quickApp
- **Copertina:** la scena `fallback`
- **Musica:** Chris Haugen - Mirage, discreta

## write · Una frase nuova

- **Scena:** vscode
- **Si vede:** App.jsx aperto. Sotto il primo paragrafo si scrive `<p><Trans>You have three new messages.</Trans></p>` e si salva. Si cerchia la riga nuova nel pannello.
- **Si dice:** Serve una frase nuova? La scrivi nel JSX, così come si legge.
- **Note:** la digitazione si vede tutta.
```

- **Header** (before the first scene): every field is optional. Unknown fields are fine: the LLM reads them as direction.
- **A scene** is a `## <id> · Title` heading (`—`, `:` or `-` work as separators too). The id is lowercase letters, digits and `-`, and it is the link with the YAML: renaming it makes a new scene, and the tuning of the old one is lost.
- **Scena**: where the scene is shot: `card`, `app`, `vscode`, `split` (VS Code and the app side by side) or `split-panel` (a split with VS Code's terminal under both, full width). The field, not the `##` block it sits in. An `app` scene can show any web page, not only the fixture: a published site, say.
- **Si vede** is the action, **Si dice** the narration, **Note** anything else (pace, what to stress, what to avoid).
- **Musica** (in the header): a track of `commons/bkmusic` by its file name, and how loud. *Discreta* is the default; *appena percettibile* and *presente* go softer and louder. No field, no music. See [Music](#music).
- **Marks**: a hand-drawn highlighter that circles, boxes, underlines or points at something, before it's used or once it shows up. Ask for it in **Si vede** with words like these; the LLM turns them into [`mark`](#marks):

| In **Si vede** | In the YAML |
| :- | :- |
| *si cerchia X* | `mark` on X (a circle is the default) |
| *si riquadra X*, *X in un riquadro* | `shape: box` |
| *si sottolinea X* | `shape: underline` |
| *una freccia indica X* | `shape: arrow` |
| *si cerchia* a piece of code (*il `null`*, *la riga 12*) | a `find` for it, then `mark: selection` |
| *a puntini*, *tratteggiato* | `dashes: true` (dots), `dashes: { dash: 10 }` (dashes) |
| *in giallo*, *in rosso*, *in bianco* | `color: amber`, `coral`, `white` |
| *marcato*, *sottile* | `width: [14, 5]`, `width: [6, 2]` |
| *lento*, *di colpo* | `draw: 1.2`, `draw: 0.3` |
| *fermo*, *senza tremare* | `boil: false` |
| *il segno di prima sbiadisce*, *resta* | `dim: 0.3`, `dim: 1` (unsaid: it goes away) |
| *i segni spariscono* | `unmark` |

## Converting

The LLM, step by step. From `site/video`:

1. **`node uty/run.mjs <project> check`.** It says which scenes are new, changed or gone, and whether the header changed. "Never stamped" means a full conversion.
2. **Touch only what `check` lists.** Copy every other scene as it is: it carries tuning someone paid for. A changed header means reviewing the top keys (title, voice, fixture, poster).
3. **Map** each scene of the `.md` to one of the YAML, same id, same order:
   - **Scena** → `stage`. A `card` uses the shared cards in `commons/` unless the `.md` asks for something else; with an `app`, `split` or `split-panel` stage, `app.style` is `@commons/app-dark.css` on the same terms. Pick the card that fits what **Si vede** describes, and put what it shows *on a word* in its `at`: see [Cards](#cards). A page other than the fixture's app goes in the scene's `url`.
   - **Si dice** → `say`, in English. Adapt, don't translate: spoken register, short sentences, contractions welcome, same meaning and same beats. About 2.6 words a second (the real Leda ran at 2.75): check the total against **Durata**. Names of products, code and keys stay as written. Never promise what the root `README.md` and `doc/` don't describe.
   - **Si vede** → `do`. Open the fixture's files to find the real line numbers and texts (`goto`, `find`, `click`); what the panel and the app show is in [On stage](#on-stage). Start with a short `wait` so the viewer can read the screen; let the voice lead, the hands follow.
   - **Timing.** The voice starts `lead` (0.4 s) into the scene: the word *n* falls at about 0.4 + n / 2.6 s. Once the real voice is in, use its own pace: words over the line's `duration` in `audio/manifest.json`. Put each action on its word, and budget the list with the times in the [action table](#storyboardyaml).
   - **Wait for what is seen.** When the `.md` says something shows up (a panel row, a translated sentence), end on a `waitFor` for it rather than a guessed `wait`: the take can't cut before it's there.
   - **Marks** (*si cerchia*, *si sottolinea*, *una freccia indica*…) → `mark`, with the words of the [table](#storyboardmd) and the keys of [Marks](#marks). The mark lands on the word that names the thing, and comes before the hand acts on it (mark, then click). A mark the `.md` doesn't ask for is content: don't add it. To mark something that is about to show up, `waitFor` it first. Once drawn, a mark stays whole long enough for the eye to find it: see [Marks](#marks).
   - **Voce** → `voice.voice` and `voice.instructions` (in English). **Progetto filmato** → `fixture`. **Copertina** → `poster`. **Titolo** → `title`.
   - **Musica** → `music`: the track's file name in `track`. *Discreta*: the defaults; *appena percettibile*: `max: -14, min: -32`; *presente*: `max: -4, min: -20`. Other words about it (*entra piano*, *si ferma prima della chiusura*) go to the keys of [Music](#music).
4. **`node uty/run.mjs <project> stamp`.** It refuses if the YAML's scene ids or order differ from the `.md`.
5. **Rehearse:** `node uty/run.mjs <project> tts record preview --silent`, then look at `preview/contact.jpg` (one frame per scene) and `log/`. The user watches it live: [For an agent](#watching-a-run) has the timeouts. Fix the technique in the YAML; technique alone needs no new `stamp`.
   - `contact.jpg` shows the middle of each scene. To see how a scene ends, pull a frame from `preview/<project>.mp4` at its start + duration (`capture/takes.json`) with the `ffmpeg-static` binary of `node_modules`.
   - With `--silent` each line lasts an estimate. Once the real voice is in, re-time the actions tied to a word.
   - Check each scene as it lands, in `capture/strips/`. One to fix: fix it and run `record` again, which starts from there ([Partial takes](#partial-takes)).
6. **Report** what changed, and anything in the `.md` that could not be shot.

The [rules for agents](#rules-for-agents) hold throughout: the `.md` is never edited, gaps are asked, not guessed.

## storyboard.yaml

<!-- LINKED-DATA: the keys, defaults and actions below are what uty/storyboard.mjs (DEFAULTS, ACTIONS, loadProject) accepts and uty/director.mjs runs, the action times included (its pauses and delays). Change one, change the other. -->

```yaml
# Generated from storyboard.md (the source of truth) following site/video/README.md.
title: viteTranslate quick start
fixture: demo/Vite_8/quickApp          # copied fresh before every take
app: { port: 5199, style: "@commons/app-dark.css" }
poster: { scene: fallback, at: 2.5 }
voice: { model: google/gemini-3.8-flash-lite-tts, voice: Leda, instructions: Relaxed and clear. }
setup:                                 # played before recording
  - click: { selector: '.activitybar [aria-label^="viteTranslate"]' }
  - open: src/App.jsx
scenes:
  - id: title
    stage: card
    card: "@commons/title.html"
    params: { line: Write the sentence., accent: Get the translation. }
    say: viteTranslate. Translations for React and Vite, written right where the text lives.
  - id: write
    stage: vscode
    say: Need a new sentence? Write it in JSX, just as it reads.
    do:
      - goto: 9
      - key: Enter
      - type: <p><Trans>You have three new messages.</Trans></p>
      - save
    hold: 0.5                          # extra seconds after the voice
# ── source: … written by `stamp`, never by hand
```

**Top level** — `title`; `fixture` (a repo folder with a `package.json`); `app.port`, `app.style` (CSS injected in the app); `vscode.settings` (merged over the defaults in `uty/director.mjs`), `vscode.style` (CSS), `vscode.env` (names of environment variables handed to VS Code and its terminals, such as a key for `--llm-translate`: the values are looked up like the voice's key, never written in the YAML); `output` (`width`, `height`, `fps`, default 1920×1080×30; `mbPerMinute` 60, the most the final mp4 may weigh, in MB per minute as Windows counts them, about 8 Mbit/s: changing it needs `compose` only); `zoom` (`vscode` 1.2, `app` 1.6, `card` 1); `voice` (`model`, `voice`, `instructions`, `sampleRate` 24000, `apiKeyEnv` `OPENROUTER_API_KEY`); `lead` 0.4 and `tail` 0.6 seconds of silence around each line; `split` 0.62 (VS Code's share of a split, and of the top of a split-panel); `panel` 0.3 (the share of the height of VS Code's panel in a split-panel); `fade` `[0.5, 0.7]` (seconds of the video's fade from black at the start, to black at the end); `typeDelay` 55 ms per key; `mark` (the defaults of every mark in the video, with the keys of the [Marks](#marks) table); `music` (the background music: see [Music](#music)); `poster`; `setup`; `scenes`; `source` (written by `stamp`).

**Scene** — `id`, `stage` (`vscode`, `app`, `split`, `split-panel`, `card`), `card` and `params` (for `stage: card`), `url` (a stage with the app: the page it shows, loaded before the clip starts), `storage` (with `url`: localStorage entries written on that page's origin before it loads, such as a site's remembered language), `anchor` (with `url`: a CSS selector the page opens scrolled to, its entrance animations done; use it instead of a `#hash`, which a site may route elsewhere), `preload` (with `url`: `true` scrolls the page through once before the clip, top to bottom and back, so its lazy images are loaded and its once-only entrance animations done; for a scene that scrolls far), `say`, `instructions` (voice direction for this line, added to `voice.instructions`), `do`, `hold`. A scene lasts `max(actions, lead + voice + tail) + hold`.

**split-panel** — VS Code fills the frame, and the app covers its top right corner (`split` of the width to VS Code, as in a split) down to VS Code's panel. The panel (the terminal) stays uncovered below, full width, `panel` of the height: long lines, like an LLM's run, don't wrap. Before the clip, the panel is opened if closed and its border dragged to that height.

**Files** — `@commons/…` is `site/video/commons/`; anything else is relative to the project folder. The shared cards are in [Cards](#cards); `@commons/app-dark.css` is the `app.style` of the demo apps.

| Action | Does | Takes about |
| :- | :- | :- |
| `wait: 1.5` | pause, in seconds | as written |
| `open: src/App.jsx` | Quick Open, type the path, Enter | 1.5 s |
| `goto: 9` · `goto: { line: 9, column: 4 }` | Go to Line; without a column, end of line | 0.6 s |
| `find: "null"` | select the first match: the next `type` replaces it | 0.8 s |
| `type: text` | type in the editor (`{ page: app, text }` elsewhere) | `typeDelay` per character |
| `key: Enter` · `key: [Control+A, Delete]` | press keys | 0.12 s a key |
| `save` | Ctrl+S | 0.4 s |
| `command: View: Close All Editors` | run a palette command; refuses if the first match isn't it | 1 s |
| `click: { text: Sync }` | glide the fake pointer there and click; also `selector`, `role` + `name`, `page`, `exact: false`, `after` | 0.7–1.3 s |
| `waitFor: { text: …, page: app }` | wait for something to show up (default 15 s) | until it shows |
| `reload: app` | reload a page | until the network is idle |
| `scroll: { selector: "#call-forms" }` | the page glides to the target, easing in and out; also `text`, `page`, `block: center`, `offset` (video px left above it, for a fixed top bar), `time`, `ease` (`cubic`; `sine` for a long run, such as a whole page: at its fastest 1.6 times the average speed, not 3, so it glides instead of jumping) | `time` (1 s) |
| `mark: { text: Sync }` · `mark: selection` | draw a hand-drawn mark around the target: see [Marks](#marks) | its `draw` (0.6 s) |
| `unmark` · `unmark: 0.8` | fade every mark out, in seconds | 0.4 s, or as written |

Clicks, marks and waits search the page and every frame in it, the extension's webviews included. Default page: `app` on app stages, `vscode` elsewhere.

### Marks

<!-- LINKED-DATA: these keys and defaults are MARK_TARGET and MARK_STYLE in uty/storyboard.mjs, opzioniSegno in uty/director.mjs and DEFAULTS in uty/marker.js. The engine was born in the "Stage Marker Lab" prototype. Change one, change the others. -->

A hand-drawn highlighter over the page (`uty/marker.js`). The pen lands, presses and tapers off; the line trembles a little, like hand-drawn animation. It's drawn above everything, the extension's webviews included, and below the pointer.

```yaml
- mark: { text: Sync }                                    # a green circle: the defaults
- mark: { selector: 'vscode-button[data-cmd="sync"]', shape: arrow }
- find: "null"
- mark: selection                                         # the editor's selection: how code is marked
- mark: { page: app, text: Français, shape: box, color: amber, dim: 0.3 }
- unmark
```

**Where.** Like `click`: `text` (with `exact: false` for a part), `selector`, `role` + `name`, `page`, `timeout`. Or `selection` (`mark: selection`, or `selection: true` among other keys): the editor's selection, after a `find`. Code is split into many small pieces on screen, and a text search on it doesn't hold. A block, such as a paragraph, is as wide as its column: the mark goes around its text. Buttons and inline elements keep their own box. `all: true` goes around every visible match together: the cells of a table column, which no single element holds. `after` is the seconds before the next action (default: the draw time).

**How.** Sizes are pixels of the 1920 × 1080 video, at any page zoom.

| Key | Default | What it does |
| :- | :- | :- |
| `shape` | `circle` | `circle`: an ellipse a little past the full turn. `box`: rounded, the pen runs on along the top. `underline`: rising a little at the end. `arrow`: from the side with room, with a two-stroke head |
| `width` | `[10, 3]` | the stroke at the start and at the end; one number for both |
| `dashes` | none | dots or dashes instead of the brush: `true`, or `{ dash: 0, gap: 16, march: 24 }`. `dash: 0` gives round dots; `march` slides the pattern along the line in px a second (negative runs backwards, 0 holds it) |
| `color` | `green` | `green` (the site's), `amber`, `coral`, `white`, or any CSS color |
| `opacity` | `0.9` | |
| `shadow` | `true` | a soft shadow under the ink, to lift it off busy code |
| `draw` | `0.6` | seconds to draw it |
| `boil` | `{ size: 1.2, rate: 10, drawings: 3 }` | the tremble: its size in px, drawings a second, how many drawings take turns. `false` holds the line still |
| `dim` | `{ to: 0, time: 0.4 }` | what the earlier marks do when this one comes: the opacity they fade to (`1` keeps them, `0` takes them away) and how long the fade lasts. A number is `to` |
| `pad` | `22` | the room between the target and the line |
| `overshoot` | `0.12` | how far past the full turn the pen goes, as a share of a lap |
| `wobble` | `0.6` | how unsteady the hand is |
| `seed` | `7` | another hand: the same mark, drawn differently |

A mark's shape depends on its scene, its number in the scene and the seed: every take draws it the same way. A `mark:` at the top of the YAML sets the defaults for the whole video, with the keys of this table (`mark: { color: amber }`).

**Long enough to be seen.** The eye has to find the mark, then what's inside it: a mark that vanishes too soon is a flash nobody follows. Once drawn, a mark stays whole for **at least 1.5 s**, and **2 s** when it's on words to read. It stays whole until a newer mark dims it, an `unmark`, or the cut. Make room with a `hold` on the scene, or a `wait` before what comes next. `record` checks the 1.5 s and warns under the scene (`! mark … stays whole 0.4 s`).

Marks don't follow the page. A mark is drawn where its target is at that moment, and every mark vanishes at a cut and on a reload. Mark when the layout is still: not while the terminal opens or the page reloads.

### Music

<!-- LINKED-DATA: these keys and defaults are MUSIC_DEFAULTS in uty/music.mjs. Change one, change the other. -->

A track of `commons/bkmusic` under the voice, the way a voice-over does it: it goes down just before every line, nearly disappears while the voice speaks, and comes back up in the pauses. Nothing chases the voice: the times of the lines are known, so the volume curve is written exactly (`uty/music.mjs`). The track is measured and brought to its level, whatever its master, and it loops if it's shorter than the video (never with `toEnd`).

```yaml
music: { track: Chris Haugen - Mirage }                       # the defaults
music: { track: Chris Haugen - Mirage, max: -14, min: -32, before: 0.8 }
```

| Key | Default | What it does |
| :- | :- | :- |
| `track` | none | the file name in `commons/bkmusic`, without its extension |
| `max` | `-8` | dB under the voice, in the pauses |
| `min` | `-26` | dB under the voice, while it speaks |
| `before` | `0.6` | seconds: it starts going down this long before a line |
| `after` | `1` | seconds to come back up after a line |
| `bridge` | `2` | seconds: shorter pauses stay down, so there's no up and down between close lines |
| `start` | `0` | seconds into the track |
| `delay` | `0` | seconds of video before the track comes in: the voice opens alone. With `toEnd`, the track also ends that much later |
| `fade` | `[1.5, 4]` | seconds of fade in as the track comes in, and of fade out at the end: **at least 4**, or the YAML stops. A shorter close sounds cut off |
| `toEnd` | `false` | `true`: the last scene holds until the track ends (from `start`, after `delay`), so the video closes on the music's own ending. `record` stretches it; set the video's own `fade` for the black. A video longer than the track gets a warning, and silence after the track: it never loops |

**Credits.** `commons/bkmusic/credits.md` holds one bulleted line per track, starting with its file name (author, title, link). Every other line of text counts for all tracks: the license, the provider. The closing card shows them at the bottom, and `compose` writes them in `output/credits.txt` for the YouTube description. A track without its line stops the YAML: the credits are owed.

The tracks stay out of git; `credits.md` is in, with the links to get them again. Levels and timing need `compose` only. A different track needs `record` too, for the credits on the closing card.

### Cards

<!-- LINKED-DATA: params and defaults below are read by each card's own script in commons/ (title, outro, question, beats, together); the clock is commons/clock.js, its take is ciak() in uty/director.mjs, called by uty/record.mjs right after the recorders start. Change one, change the others. -->

A card is a full-screen page between the screens of the app: a title, a question, a few figures, a list. It's an HTML file played live by the recorder at 1920 × 1080 (zoom 1), so it can animate. A scene uses one with `stage: card`, `card` (its path) and `params`. The shared ones are in `commons/`, in the site's colors; reuse them before writing a new one.

| Card | Shows | Good for | Timed with `at` |
| :- | :- | :- | :- |
| `@commons/title.html` | the logo, a line with a green half | the opening | no |
| `@commons/outro.html` | logo, npm command, Marketplace, GitHub; music credits at the bottom; a stamp and a QR, if asked | the closing, and a last word after it | `stampAt`, `qrAt` |
| `@commons/question.html` | a big question, then a few words lighting up below it | a hook; a question and its answer in keywords | yes |
| `@commons/beats.html` | a title, a command, then 2 to 4 tiles landing one by one | three facts, three figures, three steps | yes |
| `@commons/together.html` | columns of ticked items, filling one after another | a summary: what's in, grouped | yes |

**Params.** They reach the card as a query string, every value a string. A list holds one item per line, and `|` splits an item into its parts: write it as a YAML block scalar. Times are seconds, comma-separated. A param left out takes its default; the recorder also adds `clock` and, with music, `credits` to every card, and a card ignores what it doesn't read.

```yaml
- id: bundle
  stage: card
  card: "@commons/beats.html"
  params:
    title: In production
    beats: |
      0|runtime dependencies
      5 kB|gzip
      Precompiled|no message parsing at runtime
    at: 2.4, 3.9, 5.6
    note: "ICU plurals, select, numbers and dates: compiled at build time"
    noteAt: 6.2
  say: And in production, it travels light. Zero runtime dependencies, five kilobytes gzipped. …
```

**Timing on the voice.** Every shared card starts from zero when its clip starts, not on load (about a second earlier): the recorder adds `clock=take` to the URL and fires a `take` event on the page as soon as it's filming, and the card waits for it (`commons/clock.js`). Title and outro just enter then. The others take `at`, in the same seconds as an action, since the voice starts at `lead`: the word *n* falls at about `lead` + *n* / 2.6, on the real voice's pace once it's in. Put each entrance on the word that names it. Times left out follow the last one at the card's own step.

#### title.html

| Param | Default | |
| :- | :- | :- |
| `line` | `Write the sentence.` | the white half |
| `accent` | `Get the translation.` | the green half, after it |

About 40 characters in all keep the line as wide as the logo; one line holds up to about 80.

#### outro.html

`credits` comes from the recorder: the lines of the video's track in `commons/bkmusic/credits.md`, shown at the bottom only when the video has music. The three lines (npm, Marketplace, GitHub) are written in the file: change them there, for every video. With no params from the scene, it's the plain closing.

| Param | Default | |
| :- | :- | :- |
| `still` | none | any value: the card is already composed on the first frame, no entrance. For a scene that carries on the one before on the same card: the cut doesn't show |
| `stamp` | none | a rubber stamp pressed on the card, bottom right, with a thud: one line, or `small|BIG|small` |
| `stampAt` | `1` | when it lands |
| `qr` | none | an image beside the stamp, on white: a file next to the card, such as `coffee-qr.svg` (buymeacoffee.com/giancarlogy, as in `.github/FUNDING.yml`) |
| `qrLabel` | none | a line under the QR |
| `qrAt` | `1.5` | when it comes in |

Stamp and QR keep to the right-hand column: the music credits, centered at the bottom, are owed and stay readable. A new QR: `npx qrcode@1.5.4 -t svg -e M -q 0 -d "#0b0f0d" -l "#ffffff" -o commons/<name>.svg "<url>"`, then a phone to check it reads.

#### question.html

| Param | Default | |
| :- | :- | :- |
| `question` | `Another i18n library?` | white, 128 px: about 30 characters on a line |
| `words` | `JSX`, `Vite`, `VS Code` | one per line, in a row under the question, dots between them. They wait barely visible, then light up in green with a small pop. Three or four short ones |
| `at` | from 1.6, every 0.6 | one per word |

The question and the waiting words come in at zero.

#### beats.html

| Param | Default | |
| :- | :- | :- |
| `title` | `LLM auto-translation` | white, 88 px |
| `code` | none | a command under the title, monospace, green |
| `beats` | 💰, ✋, 🛡️ with *Cost first*, *Asks before spending*, *Every result validated* | one tile per line: `big`, or `big\|small`. `big` is green and as large as its tile allows (128 px down to 48): a number or an emoji stays big, a long word shrinks. `small` wraps under it |
| `at` | from 1.5, every 1.2 | one per tile: it lands with a small hit and a green flash |
| `note` | none | a small grey line at the bottom |
| `noteAt` | 0.8 | when the note shows |

Three tiles is the sweet spot; four fit. Title and command come in at zero.

#### together.html

| Param | Default | |
| :- | :- | :- |
| `title` | none | a heading above the columns |
| `groups` | the ten features of the root README's comparison, in four groups (JSX, VS Code, Vite, production) | one column per line: `Heading\|item\|item…`. Each item gets a drawn ✓ |
| `at` | from 0.8, every 1.4 | one per column: when it comes in; its items follow 0.25 s later |
| `beat` | 0.3 | seconds between two items of a column |
| `note` | none | a small grey line at the bottom |
| `noteAt` | 1 s after the last item | when the note shows |

0.7 s after the last item every tick glows once: a good frame for the poster. Four columns hold items of about 30 characters on two lines, up to four items each; fewer columns, more room.

#### A new card

Reuse first: a param often does it. When none fits:

1. **Where.** Shared, for more than one video: `commons/`, and a row in the table above with its params. One video only: in the project folder, as `card: cards/<name>.html`.
2. **The page.** 1920 × 1080 CSS pixels, `overflow: hidden`, the background of the other cards, colors from `site/theme/tokens.css` (dark), Segoe UI and Consolas: system fonts, nothing from the network. The logo is `../../theme/logo.svg` from `commons/`, with `filter: brightness(2.1)`.
3. **The params.** Read them from `location.search`, with a default for each, so the card shows something sensible on its own.
4. **On the voice.** Load `clock.js` (`<script src="clock.js">` from `commons/`, `../../commons/clock.js` from a project) and use what it puts on `window.card`:

   | | |
   | :- | :- |
   | `card.param(name, fallback)` | a param, or its fallback |
   | `card.list(name, fallback)` | a list param: one array per line, its parts split on `\|` |
   | `card.times(count, { name, first, step })` | `count` times from the param `name` (default `at`); the missing ones from `first`, every `step` seconds |
   | `card.at(seconds, fn)` | runs `fn` that many seconds after zero |

   At zero, `<html>` gets the class `go`: hide the entrances under `html:not(.go)` and start them under `.go`, so nothing moves before the clip.
5. **Look at it.** Open the file in Chrome with its params in the URL: it starts on load. With `clock=take` in the URL it waits, until `dispatchEvent(new Event("take"))` in the console. Then a `--silent` rehearsal, and its `contact.jpg`.

## On stage

<!-- LINKED-DATA: facts read from the sources, not from the pipeline. Selectors and row labels: idePlugin/src/webViews/commandBar/commandBar.mjs (ACTIONS, ICONS, data-cmd) and idePlugin/src/views/results/markedRows.mjs (GLYPHS, row label), which point back here; Project's languages: idePlugin/src/webViews/project/projectWebview.mjs (data-open); Settings' styles: idePlugin/src/webViews/optional/optionalWebview.mjs (.stile, data-value). Marks in the app: lib/errorSolve.js (ERROR_SOLVE_DEFAULTS.mark). Sync's output: lib/dev/vite/updateLanguage.js; its terminal: idePlugin/src/core/cliRunner.mjs (SECONDS). The site: site/landing/src/siteLanguage.js (the remembered language), site/landing/src/main.jsx (hashes to the playground), site/landing/src/Compare.jsx (the table, .col-us), site/theme/LanguageSwitch.jsx (.lang-switch). -->

What the `.md` shows, and where it comes from: the fixture for lines and texts, `idePlugin/src` for the panel, `lib/` for the app. What a conversion needs most often:

- **One session, one state.** What a scene types, saves or syncs is still there in the next one.
- **The app reloads** when a language file changes (a save, a Sync), and comes back in the source language. A `.jsx` edit is a hot update: the language stays.
- **In development the app marks** a sentence missing in the current language with 🔸 before the source text, and one translated here but missing in another language with 🔹.
- **The panel** opens from `.activitybar [aria-label^="viteTranslate"]`: Selector, Results, Project.
  - Project's buttons are `vscode-button[data-cmd="sync"]` and `[data-cmd="llm"]`: more precise than their text.
  - A Results row reads `<glyph> <sentence>`: 🔄 not synced, 🔸 untranslated, 🔹 missing in another language, ‼️ malformed. `waitFor: { text: "🔄 You have three new messages.", exact: false }` waits for the extension to see a new sentence.
- **Sync** runs in the terminal panel and is done in about 1.5 s. The source language reports `1 key(s) added, 0 removed`, each other language `1 key(s) missing`; there the new key lands as `key: null` under `# ----to be translated`. Open the file right away, then `waitFor: { text: "null" }` before the `find`: the key is surely written.
  - The terminal closes itself 10 s after the CLI ends, and the editor jumps. Hide it on the next cut with `key: Control+J`.
  - Keys typed into it close it at once: keep the focus in the editor.
- **Project's languages** are `#langs vscode-tree-item[data-open$="fr-FR.yml"]`. With a Results row picked first, the click opens the file right on its key, cursor on the value. The focus stays in the panel's webview, though: `click` the value in the editor before any key, then `key: Control+D` selects it. A `find` would find the search box already seeded with that word, and not move.
  - After that click the panel redraws its rows and moves the focus to the first language. Its tooltip (the file's full path) used to show up and stay. Fixed in the extension (`focusShowsTip` in `idePlugin/src/webViews/tooltip/tooltipScript.mjs`): it reaches a take built with `--rebuild-ide`, or from a `.vsix` built after it.
- **Settings** opens from `vscode-icon[data-cmd="settings"]` and takes the panel; Back is `vscode-button[data-cmd="close"]`. Its Highlight style opens with `details#highlight > summary`; each style is `.stile[data-value="<id>"]` (ids in `idePlugin/package.json`), and a click restyles the open editors at once. The first eleven fit without scrolling. Highlighter is faint on a dark theme (⚠ next to it). The palette's "Choose highlight style…" does the same, but its list covers the top lines of the editor.
- **A build in the terminal:** `key: Control+Backquote` opens one, `type` writes in it (PowerShell keeps what's typed before its prompt), `key: Enter` runs it. Its text is found by `waitFor` and `mark` only with `"terminal.integrated.gpuAcceleration": "off"` in `vscode.settings`: WebGL draws pixels. Maximize the panel (`View: Toggle Maximized Panel`) so the output doesn't scroll under the marks. A new terminal takes the focus a moment after it opens and closes a palette already open: `wait: 0.6` before the next `command` (which reopens the palette once, if it closes before the typing). `npm run build` prints viteTranslate's block 2–3 s after Enter and is done within a second: one chunk per language, except the source one, preloaded in the main bundle.
- **A split** gives VS Code 62% of the width: with the panel open, about 55 columns of code fit. Keep the line that matters short, or tune `split` or `zoom.vscode`.
- **A split-panel** shows the terminal the panel has. Kill the earlier ones behind a card (`command: "Terminal: Kill All Terminals"`), so the strip opens on a fresh one, and set `"terminal.integrated.tabs.enabled": false` in `vscode.settings`: no tab list beside the strip. The LLM's run from the panel (Translate) lands there, each line whole.
- **The published site** (sepoina.github.io/viteTranslate) in an `app` scene, with `url`:
  - Every page remembers the last language in localStorage `viteTranslate.site.language` (`site/landing/src/siteLanguage.js`), and Edge cases and the restaurant fall back to Italian: `storage: { "viteTranslate.site.language": en-US }` starts each scene in English.
  - The landing sends any `#hash` to the playground (`site/landing/src/main.jsx`, for old links): open it bare, with `anchor: '[data-section="compare"]'`.
  - Language buttons: `.lang-switch button:has-text("FR")`. The restaurant's is a menu: `summary:has(.ph-globe-hemisphere-west)` (its label is translated), then `details[open] a:has-text("Français")`.
  - The restaurant is about 18,000 CSS px tall, with 14 lazy images and blocks that slide in once as they come into view: `preload: true` before scrolling it. Its bottom is `.site-footer`; the bar with the globe stays on top.
  - The comparison table is `[data-section="compare"] table`, 677 CSS px tall: whole on screen only with `zoom.app` about 1.3 or less. Its viteTranslate column is `.col-us`, marked with `all: true`.
  - `app.style` doesn't reach these pages: it dresses the fixture's own app only.
- **The pointer** stays where it last clicked, hover included, until the next click on that page.

## Commands

From `site/video`, after a one-off `npm install` (a standalone package, not a workspace of the repo):

| Command | Does |
| :- | :- |
| `node uty/run.mjs <project> check` | does `storyboard.yaml` match `storyboard.md`? Which scenes don't |
| `node uty/run.mjs <project> stamp` | declares it does (after adapting it); refuses if the scenes differ |
| `node uty/run.mjs <project>` | `tts`, `record`, `compose` |
| `node uty/run.mjs <project> all` | `tts`, `record`, `preview`, `compose` |
| `node uty/run.mjs <project> tts record preview` | just those steps, in that order |
| `--silent` | mute voice of the estimated length: no key, no cost. Real lines still valid stay |
| `--force` | re-voice every line, cache or not |
| `--headed` | watch Chrome while it records |
| `--rebuild-ide` | rebuild the extension `.vsix` before installing it |
| `--stale` | run even if `storyboard.yaml` is behind (rehearsals only) |
| `--full` | `record` shoots every scene, even those that match their take |
| `--from <scene>` | `record` shoots from that scene, keeping the clips before it as they are: [Partial takes](#partial-takes) |
| `--to <scene>` | `record` stops after that scene: shoot only what you're checking |
| `node uty/live.mjs` | follow every run live: what the VS Code task and the window run |

Needs Node 18+, Chrome and VS Code installed (its `code serve-web` runs the editor; your own VS Code profile is never touched), and an [OpenRouter](https://openrouter.ai) key in `OPENROUTER_API_KEY`, looked up in this order: environment, `site/video/.env.local`, `site/video/.env` (both git-ignored), the keyring via `npx vitetranslate --llm-key-set`. The first `record` downloads the VS Code server into `.cache/` (a minute, once).

## Watching a run

<!-- LINKED-DATA: uty/live.mjs (the view, its heartbeat, the window), uty/run.mjs (when it opens one), the task "video: live" in .vscode/tasks.json at the repo root. Change one, change the others. -->

Every run shows live, line by line: the steps (`▶`), each line voiced, each scene shot, warnings in yellow, the error that stopped it in red. It's `uty/live.mjs` following the `log/run.log` of every project. Opened halfway through a run, it starts from that run's first line.

- **In VS Code** it's the task **video: live** (`.vscode/tasks.json` at the repo root), a tab of the Terminal panel. It starts with the folder if VS Code allows automatic tasks (it may ask once; the setting is `task.allowAutomaticTasks`). If it didn't start, use Terminal › Run Task › video: live.
- **Nobody following?** When `tts`, `record`, `preview` or `compose` start and no live view is on, `run.mjs` opens one in a Windows Terminal window (a plain console if there's no Windows Terminal) and says so in its first line. Later runs find it and reuse it. A live view counts as on if it has touched `.cache/live.beat` in the last 3 s.
- **A run from your own terminal** opens nothing: you're already watching it. Neither do `check` and `stamp`: they're instant.

**For an agent.** Run the commands as usual. The user follows them in the live view, so your tool's output is for you. Say what a run does before you start it. A run takes minutes: `record` about 1.5 to 4, `compose` about 2 (the final's two passes), and the first `record` takes a minute more for the VS Code server. Give the command a timeout of 5 minutes or more, or run it in the background and read the project's `log/run.log`. One run at a time: runs share the VS Code in `.cache/` and the app's port.

## Folders

```text
site/video/
  README.md             this file
  uty/                  the pipeline (run.mjs is the entry point)
  commons/              shared pieces: the cards (clock.js times those on the voice), app stage CSS, the coffee QR
    bkmusic/            background music: the tracks (local only) and credits.md
  .cache/               VS Code server, extension, settings: the "controlled copy"; live.beat (a live view is on)
  projects/index.md     where each video stands, what's next, and the travel log
  projects/<project>/
    storyboard.md       the story, in Italian: the source of truth
    storyboard.yaml     the shooting script, in English: generated, tunable
    audio/              per line <id>.wav (trimmed) and <id>.raw.wav (as received); manifest.json (the TTS cache)
    capture/            the copied app, raw clips per scene, strips/ (a frame a second per scene), takes.json (with fingerprints)
    preview/            960x540 cut + contact.jpg (one frame per scene)
    output/             <project>.mp4, <project>.srt, poster.jpg, credits.txt (with music)
    log/                run.log (every run, timed), vscode.log, app.log, error-*.png
```

What git keeps is in [rule 6](#rules-for-agents); everything else is rebuilt by a run.

## The pipeline

1. **tts** — each `say` becomes `audio/<scene>.wav` (OpenRouter `/audio/speech`, PCM wrapped in WAV). Cached by text + voice. The silence around the line is trimmed, keeping 0.15 s before the first word (the breath) and 0.1 s after the last. The take as received stays in `<scene>.raw.wav`, and every run trims again from it: the margins can be tuned without paying for the voice again. With `--silent`, a line already voiced for real, with the same text and voice, keeps its voice.
2. **record** — copies the `fixture` into `capture/`, starts its `vite dev` and an isolated VS Code with the repo's extension, then plays the scenes in one session. Each scene lasts at least as long as its line. It shoots from the first scene that changed since the last take: see [Partial takes](#partial-takes).
3. **preview** — a quick low-res cut and a contact sheet.
4. **compose** — the final cut: scenes in a row, each page in its place (side by side in a split, the app over VS Code's corner in a split-panel), voice in place, fade in and out (`fade`), subtitles, poster. A subtitle holds two lines of about 42 characters, and breaks where the voice pauses: after a full stop, then after a comma or a colon, never after an article or a preposition; two sentences share a cue only if the line breaks between them on a pause. Every line is brought to -16 LUFS (generated one by one, they come out louder or softer), its peaks limited to -1.5 dB, with 10 ms fades at its edges against clicks. Then the [music](#music), if any, goes under the voice, ducked around every line, and its credits go to `output/credits.txt`. The scenes are cut as near-lossless intermediates (CRF 10); the final video is encoded once from them, in two passes at the bitrate `output.mbPerMinute` asks for (60 MB a minute: about 8 Mbit/s, AAC 192 kbit/s), so the bits go to scrolls and fades rather than to still cards. A screen that doesn't move costs nothing at any quality: when the video can't use the bits, x264 stops at near-lossless (an average QP under 1, and a harmless "2pass curve failed to converge") and the file comes out lighter. compare weighs about 29 MB a minute. The preview copies the segments as they are, fast.

Something broke? Start from `log/`: `run.log` has every run with timestamps, `error-*.png` shows each page at the moment it failed, `vscode.log` and `app.log` hold the servers' output.

## Partial takes

<!-- LINKED-DATA: this is impronte(), piano() and the scene loop in uty/record.mjs, the --full/--from/--to options in uty/run.mjs, and the scenes check at the top of uty/compose.mjs. Change one, change the others. -->

A scene to fix shouldn't cost the whole take. `record` keeps what still holds and shoots the rest.

- **Fingerprints.** `takes.json` keeps one for the *stage*: the fixture's files, the settings, the setup, zoom, lead and tail, the extension's `.vsix`, the pipeline's code. And one per scene, chained: the scene's YAML, its voice, its card file, and the fingerprint of the scene before. A changed scene changes all those after it too, since they inherit its state.
- **From the first change.** `record` keeps every scene up to the first changed one, and shoots from there to the end. A changed stage shoots everything. Nothing changed: nothing to shoot, at once.
- **Fast-forward.** The servers and the setup still start (about 40 s). The kept scenes are played without filming, to rebuild the state: their actions and waits, no marks, no voice time. Only the last one before the cut plays at full length, so what runs on the clock (a reload, Sync's terminal closing after 10 s) reaches the first filmed scene as in a full take. Their clips stay.
- **Saved as it goes.** `takes.json` is written after every filmed scene. A run that stops halfway, an error or `--to`, picks up from there next time.
- **Strips.** Every filmed scene leaves `capture/strips/NN-<id>.jpg`: a frame a second, four per row, left to right, the pages in their place as in the cut. They land while the run goes on.
- **By hand.** `--full` shoots everything. `--from <scene>` shoots from there and keeps the clips before it *as they are*, even if the stage changed, with a warning: use it when you know a change touches only that scene and the later ones, like an extension fix seen in one scene only. Those kept scenes then take the new fingerprints. `--to <scene>` stops after that scene.
- **Partial takes and the cut.** `preview` cuts what there is, with a warning. `compose` refuses until the takes cover every scene of the YAML.

On `compare` (11 scenes): a full take 172 s; from scene 8 on, 131 s; scene 9 alone (`--from llm --to llm`), 91 s.

## Field notes

What earlier sessions learned the hard way. Stage facts are in [On stage](#on-stage); this is about working.

**A take, step by step.**

- **Check before you shoot.** Unsure what an action shows or prints? Copy the fixture into `projects/<project>/capture/<fixture>` (git-ignored; its `node_modules` resolve from the folders above) and try it there. That's how the build's output was found to have no chunk for the source language.
- **One scene at a time.** To check a scene, shoot only up to it with `record --to <scene>`, then look at its strip. Don't stop a run by killing it: its `vite dev` and VS Code may stay up, and the app's port stays busy.
- **Strips first, then frames.** A strip shows the scene's flow: what appears and when. For a detail, pull a frame from the cut. A scene starts at the sum of the takes before it in `capture/takes.json`:

  ```sh
  node -e "const f=require('ffmpeg-static'),{spawnSync}=require('child_process');spawnSync(f,['-y','-ss','87.4','-i','projects/<p>/output/<p>.mp4','-frames:v','1','-vf','scale=960:-1','frame.jpg'])"
  ```

- **Look for what nobody asked for.** Tooltips, suggestion popups, a find box, a panel left open: they don't fail a run, only the frames show them.

**Timing on the real voice.**

- Find the pauses of each line with `silencedetect`. A word right after a pause starts at `lead` + the pause's end; in between, count syllables:

  ```sh
  node -e "const f=require('ffmpeg-static'),{spawnSync}=require('child_process');const r=spawnSync(f,['-i','projects/<p>/audio/<id>.wav','-af','silencedetect=noise=-35dB:d=0.12','-f','null','-'],{encoding:'utf8'});console.log([...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m=>m[1]).join(' '))"
  ```

- A click takes 0.6–1.3 s from its `wait` to the click: the pointer glides first. Start the glide a little before the word.
- "Actions ran past the voice" by a second or two is fine where the screen still has something to show; otherwise trim the `wait`s.

**Cards.**

- Look at a new card before shooting it. Open its `file://` URL with params and `clock=take` in headless Chrome (`playwright-core` from `node_modules`, `channel: "chrome"`), `dispatchEvent(new Event("take"))`, then take screenshots at the `at` times.
- Grid tiles with `1fr` grow with their text: use `minmax(0, 1fr)`, or measuring overflow finds nothing to shrink.

**Traps met on stage.** Details in [On stage](#on-stage).

- Clicking a panel row leaves the focus in its webview: keys go nowhere until a click in the editor.
- `find` on the word the cursor is in does nothing, since the search box comes seeded with it: `key: Control+D`.
- The palette's lists cover the top of the editor.
- The terminal's text is invisible to `waitFor` and `mark` unless the GPU renderer is off.
- Marks vanish at every cut: a mark can't "stay" into the next scene.
- **The panel stays empty, Settings' gear isn't found:** VS Code is in Restricted Mode, where the extension doesn't run, because the user settings (the ones that turn trust off) didn't save. It happened now and then. `preparaVscode` checks the status bar after the reload, writes them again up to three times, then stops with that reason. The setup waits for Project's Sync button (`waitFor`, 60 s), so a panel that never loads stops the run before the first take.
- This VS Code opens the user settings in a modal editor, and calls the theme "Dark Modern" (with the old "Default Dark Modern" the server rewrites the file on its own).
- **Durations:** count the real voice at the pace of the estimate. In `compare` the real lines came out within a few percent of `--silent`'s, some longer. Fit the video to its music with the real voice in.
- Changing anything in `uty/` changes the stage: the next `record` shoots everything. Use `--from` when the change can't touch the scenes before.
