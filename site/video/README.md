# Demo videos

Scripted, reproducible demo videos of viteTranslate. A story written in Italian goes in; an mp4 with English narration and subtitles comes out. Nobody touches the mouse: Playwright drives a real VS Code (with the extension) and the app in Chrome, an AI voice reads the lines, ffmpeg cuts.

Change a sentence, run it again: only that line is re-voiced, everything is re-shot the same way.

**This file commands `site/video`.** Whatever happens in this folder (stories, storyboards, the pipeline in `commons/cli/`, takes and cuts) follows it, and `AGENTS.md` sends every agent here. It speaks to whoever writes a story, whoever runs the pipeline, and the editor's LLM (Claude Code, Copilot, any agent in VS Code) that converts one. Where each video stands, and how it got there: [projects/index.md](projects/index.md).

## How a video is made

1. **Write the story** in `projects/<project>/storyboard.md`, in Italian: scenes, what is shown, what is said. It is the source of truth; the format is in [storyboard.md](#storyboardmd).
2. **Have it converted.** Ask the LLM in VS Code:
   > Convert `site/video/projects/<project>/storyboard.md` into `storyboard.yaml` following `site/video/README.md`.

   It writes `storyboard.yaml` (English, executable), touching only the scenes that changed, and stamps it: see [Converting](#converting).
3. **Rehearse** for free: `node commons/cli/run.mjs <project> tts record preview --silent`, then look at `preview/contact.jpg` and `preview/<project>.mp4`. Whoever starts it, the run shows live in VS Code: see [Watching a run](#watching-a-run).
4. **Tune** at the level you need. Content (a sentence, a scene, the order) → `storyboard.md`, then back to step 2. Technique (a wait, a selector, a hold) → `storyboard.yaml`, directly.
5. **Final cut** with the real voice: `node commons/cli/run.mjs <project>`. The mp4 goes to YouTube; the repo keeps the `.srt` and `poster.jpg`.

## Rules for agents

1. **Read this file first**, and [projects/index.md](projects/index.md), before touching anything in `site/video`.
2. **`storyboard.md` wins** (next section). Never edit it, except to add a missing id to a heading, and say so.
3. **Ask, don't guess.** A `.md` that is ambiguous, a scene that can't be shot as written: ask the user.
4. **Rehearse with `--silent`.** The real voice spends the user's OpenRouter credit: run it only when they ask. A `--silent` run keeps the real lines whose text and voice haven't changed, and writes silence only for the others.
5. **The user watches every run live.** Run the commands as usual, and `run.mjs` makes sure they see it ([Watching a run](#watching-a-run)). Say what a run does before starting it. Give it a long timeout, and never start two runs at once.
6. **Nothing generated goes in git.** `audio/`, `capture/`, `preview/`, `log/` and the mp4 are rebuilt by a run; the repo keeps `projects/index.md`, the two storyboards, the `.srt`, `credits.txt` and `poster.jpg`. The tracks of `commons/bkmusic` stay local too; its `credits.md` goes in.
7. **Change the pipeline, change this file.** A change in `commons/cli/` that alters keys, actions, steps or commands updates this file in the same go.
8. **Something failed?** Start from the project's `log/`: what's in it is under [The pipeline](#the-pipeline). A `!` under a scene is a probe warning ([Probes](#probes)): either a real defect (fix the YAML or the director) or a false alarm (fix the probe). Don't leave it unexplained.
9. **Keep the travel log.** A session that changes something here (a project, the pipeline, this file) ends with an entry at the top of the log in [projects/index.md](projects/index.md): the date, what was done, what was decided and why, what is left. Update its table and its "Next" list in the same go.
10. **Write down what you learned.** A trap, a measure, a trick that saved a run: it goes in [Field notes](#field-notes), so the next session starts from it. Stage facts (selectors, what the app does) go in [On stage](#on-stage).
11. **Parametrize, don't patch.** A change a story asks of a card (a position, a size, a timing, a part shown or not) that another video could want becomes a param of its prototype, or of every prototype in `commons/layout/`: the old behavior stays the default, so the other videos don't move. It goes in the sheet (and in [Cards](#cards) when it's common), with a variant and a test. Never a one-off `look`, `anim` or CSS in a single YAML for what a param could do.

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
- **Scena**: where the scene is shot: `card`, `app`, `vscode`, `split` (VS Code and the app side by side) `split-panel` (a split with VS Code's terminal under both, full width), `stack` (a vertical video: code, preview and terminal, three 16:9 windows in a column: see [Vertical](#vertical)) or `tower` (the same three windows in a tall frame, with the camera sliding over them: see [Tower](#tower)). The field, not the `##` block it sits in. An `app` scene can show any web page, not only the fixture: a published site, say.
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

- **Camera, cut, speed and format**: zoom where the eye should go, hide a wait or show it quicker, come out as a GIF. Ask for it in **Si vede** and in the header; the LLM turns it into [`camera`](#camera), [`before`](#cut), [`speed`](#speed) and [`output.gif`](#gif):

| In **Si vede** / the header | In the YAML |
| :- | :- |
| *la camera stringe su X*, *si avvicina a X* | `camera: { text \| selector: X }`, an action; the scene's own `camera:` is its first frame |
| *la camera scivola su X* | the same: it glides, `time: 0.5` by default |
| *di colpo* (the camera) | `time: 0` |
| *la camera torna larga*, *tutto il quadro* | `camera: full` |
| *senza stacco*, *la camera resta dov'era* | the scene's `camera: keep` |
| *taglio*, *l'attesa non si vede* | `before:`, in the scene after the wait, with the waiting actions |
| *in accelerato*, *a doppia velocità*, *a 1,5×* (an action, a wait, a typing) | `speed: 2` before it and `speed: 1` after: the wait is seen, quicker, not cut. Not in a scene with a voice |
| **Formato:** *GIF larga N px, F fps* | `output.gif: { width: N, fps: F }`, and usually `fade: [0, 0]` |

## Converting

The LLM, step by step. From `site/video`:

1. **`node commons/cli/run.mjs <project> check`.** It says which scenes are new, changed or gone, and whether the header changed. "Never stamped" means a full conversion.
2. **Touch only what `check` lists.** Copy every other scene as it is: it carries tuning someone paid for. A changed header means reviewing the top keys (title, voice, fixture, poster).
3. **Map** each scene of the `.md` to one of the YAML, same id, same order:
   - **Scena** → `stage`. A `card` uses the shared prototypes in `commons/components/` unless the `.md` asks for something else; with an `app`, `split` or `split-panel` stage, `app.style` is `@commons/layout/app-dark.css` on the same terms. Pick the prototype from the gallery and the sheets ([Cards](#cards)), and put what it shows *on a word* in its `at`. Content past a sheet's limit is a question for the user, not a `look` at random; `anim` only when the `.md` asks for a movement the prototype doesn't make. A page other than the fixture's app goes in the scene's `url`.
   - **Si dice** → `say`, in English. Adapt, don't translate: spoken register, short sentences, contractions welcome, same meaning and same beats. About 2.6 words a second (the real Leda ran at 2.75): check the total against **Durata**. Names of products, code and keys stay as written. Never promise what the root `README.md` and `doc/` don't describe.
   - **Si vede** → `do`. Open the fixture's files to find the real line numbers and texts (`goto`, `find`, `click`); what the panel and the app show is in [On stage](#on-stage). Start with a short `wait` so the viewer can read the screen; let the voice lead, the hands follow.
   - **Timing.** The voice starts `lead` (0.4 s) into the scene: the word *n* falls at about 0.4 + n / 2.6 s. Once the real voice is in, use its own pace: words over the line's `duration` in `audio/manifest.json`. Put each action on its word, and budget the list with the times in the [action table](#storyboardyaml).
   - **Wait for what is seen.** When the `.md` says something shows up (a panel row, a translated sentence), end on a `waitFor` for it rather than a guessed `wait`: the take can't cut before it's there.
   - **Marks** (*si cerchia*, *si sottolinea*, *una freccia indica*…) → `mark`, with the words of the [table](#storyboardmd) and the keys of [Marks](#marks). The mark lands on the word that names the thing, and comes before the hand acts on it (mark, then click). A mark the `.md` doesn't ask for is content: don't add it. To mark something that is about to show up, `waitFor` it first. Once drawn, a mark stays whole long enough for the eye to find it: see [Marks](#marks).
   - **Cut** (*taglio*, *l'attesa non si vede*) → `before` of the scene *after* the wait: the previous scene ends on what started it (the click), the next one waits in its `before` ([Cut](#cut)). A scene that already looks right after the wait needs nothing else.
   - **Speed** (*in accelerato*, *a 2×*) → `speed` around the stretch ([Speed](#speed)). A wait the story wants *seen* goes quicker, not into a `before`: the viewer follows it.
   - **Camera** → the scene's `camera:` for its first frame, then `camera` actions where the eye moves ([Camera](#camera)). Read each `rect` off the strips of a first rehearsal: they are the whole frame, so a position there is a frame position. *Senza stacco* is `camera: keep`.
   - **Format** (*GIF larga N px*) → `output.gif` ([GIF](#gif)), and `fade: [0, 0]` when the story asks for no fades.
   - **Voce** → `voice.voice` and `voice.instructions` (in English). **Progetto filmato** → `fixture`. **Copertina** → `poster`. **Titolo** → `title`.
   - **Musica** → `music`: the track's file name in `track`. *Discreta*: the defaults; *appena percettibile*: `max: -14, min: -32`; *presente*: `max: -4, min: -20`. Other words about it (*entra piano*, *si ferma prima della chiusura*) go to the keys of [Music](#music).
4. **`node commons/cli/run.mjs <project> stamp`.** It refuses if the YAML's scene ids or order differ from the `.md`.
5. **Rehearse:** `node commons/cli/run.mjs <project> tts record preview --silent`, then look at `preview/contact.jpg` (one frame per scene) and `log/`. The user watches it live: [For an agent](#watching-a-run) has the timeouts. Fix the technique in the YAML; technique alone needs no new `stamp`.
   - `contact.jpg` shows the middle of each scene. To see how a scene ends, pull a frame from `preview/<project>.mp4` at its start + duration (`capture/takes.json`) with the `ffmpeg-static` binary of `node_modules`.
   - With `--silent` each line lasts an estimate. Once the real voice is in, re-time the actions tied to a word.
   - Check each scene as it lands, in `capture/strips/`. One to fix: fix it and run `record` again, which starts from there ([Partial takes](#partial-takes)).
6. **Report** what changed, and anything in the `.md` that could not be shot.

The [rules for agents](#rules-for-agents) hold throughout: the `.md` is never edited, gaps are asked, not guessed.

## storyboard.yaml

<!-- LINKED-DATA: the keys, defaults and actions below are what commons/cli/storyboard.mjs (DEFAULTS, ACTIONS, loadProject) accepts and commons/cli/director.mjs runs, the action times included (its pauses and delays); the shape of `camera` is commons/cli/camera.mjs (controllaCamera). Change one, change the other. -->

```yaml
# Generated from storyboard.md (the source of truth) following site/video/README.md.
title: viteTranslate quick start
fixture: demo/Vite_8/quickApp          # copied fresh before every take
app: { port: 5199, style: "@commons/layout/app-dark.css" }
poster: { scene: fallback, at: 2.5 }
voice: { model: google/gemini-3.8-flash-lite-tts, voice: Leda, instructions: Relaxed and clear. }
setup:                                 # played before recording
  - click: { selector: '.activitybar [aria-label^="viteTranslate"]' }
  - open: src/App.jsx
scenes:
  - id: title
    stage: card
    card: title                        # a prototype of commons/components
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

**Top level** — `title`; `fixture` (a repo folder with a `package.json`); `app.port`, `app.style` (CSS injected in the app); `vscode.settings` (merged over the defaults in `commons/cli/director.mjs`), `vscode.style` (CSS), `vscode.env` (names of environment variables handed to VS Code and its terminals, such as a key for `--llm-translate`: the values are looked up like the voice's key, never written in the YAML); `output` (`width`, `height`, `fps`, default 1920×1080×30; a bigger 16:9, such as 2560×1440 (2K) or 3840×2160, keeps the layout and adds pixels: see [Resolution](#resolution); `mbPerMinute` 60, the most the final mp4 may weigh, in MB per minute as Windows counts them, about 8 Mbit/s: changing it needs `compose` only; `gif` `{ width, fps, colors }` makes a looping GIF too, after `compose`: see [GIF](#gif); `web` `{ width, fps, crf, webm }` makes a video for a web page: see [Web video](#web-video)); `zoom` (`vscode` 1.2, `app` 1.6, `card` 1: a page's CSS viewport is 1920×1080 / zoom, at any `output`); `voice` (`model`, `voice`, `instructions`, `sampleRate` 24000, `apiKeyEnv` `OPENROUTER_API_KEY`); `lead` 0.4 and `tail` 0.6 seconds of silence around each line; `split` 0.62 (VS Code's share of a split, and of the top of a split-panel); `panel` 0.3 (the share of the height of VS Code's panel in a split-panel); `fade` `[0.5, 0.7]` (seconds of the video's fade from black at the start, to black at the end); `typeDelay` 55 ms per key; `mark` (the defaults of every mark in the video, with the keys of the [Marks](#marks) table); `music` (the background music: see [Music](#music)); `look` (the cards' knobs and tokens for the whole video: see [Cards](#cards)); `poster`; `setup`; `scenes`; `source` (written by `stamp`).

**Scene** — `id`, `stage` (`vscode`, `app`, `split`, `split-panel`, `stack`, `tower`, `card`), `card`, `params`, `look` and `anim` (for `stage: card`: see [Cards](#cards)), `url` (a stage with the app: the page it shows, loaded before the clip starts), `storage` (with `url`: localStorage entries written on that page's origin before it loads, such as a site's remembered language), `anchor` (with `url`: a CSS selector the page opens scrolled to, its entrance animations done; use it instead of a `#hash`, which a site may route elsewhere), `preload` (with `url`: `true` scrolls the page through once before the clip, top to bottom and back, so its lazy images are loaded and its once-only entrance animations done; for a scene that scrolls far), `before` (actions played before the clip starts filming: their time is not in the video, a jump cut; no `mark`, `unmark` or `camera`: see [Cut](#cut)), `camera` (the first frame: `full`, `keep`, `selection`, `rect` or a target, or `window` in a tower; no `time` or `ease`; not on cards: see [Camera](#camera)), `say`, `instructions` (voice direction for this line, added to `voice.instructions`), `do`, `hold`. A scene lasts `max(actions, lead + voice + tail) + hold`.

**split-panel** — VS Code fills the frame, and the app covers its top right corner (`split` of the width to VS Code, as in a split) down to VS Code's panel. The panel (the terminal) stays uncovered below, full width, `panel` of the height: long lines, like an LLM's run, don't wrap. Before the clip, the panel is opened if closed and its border dragged to that height.

**Files** — `@commons/…` is `site/video/commons/`; anything else is relative to the project folder. `card` takes a prototype by name instead (`card: beats`, `card: ./components/<name>`): see [Cards](#cards). `@commons/layout/app-dark.css` is the `app.style` of the demo apps.

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
| `scroll: { selector: "#call-forms" }` | the page glides to the target, easing in and out; also `text`, `page`, `block: center`, `offset` (px of the 1920 × 1080 frame left above it, for a fixed top bar), `time`, `ease` (`cubic`; `sine` for a long run, such as a whole page: at its fastest 1.6 times the average speed, not 3, so it glides instead of jumping) | `time` (1 s) |
| `mark: { text: Sync }` · `mark: selection` | draw a hand-drawn mark around the target: see [Marks](#marks) | its `draw` (0.6 s) |
| `unmark` · `unmark: 0.8` | fade every mark out, in seconds | 0.4 s, or as written |
| `camera: { text: Translate, width: 960 }` · `camera: full` | the camera glides to that frame: see [Camera](#camera) | about 0.1 s: it doesn't wait, the glide is made in `compose` |
| `speed: 2` · `speed: 1` | the video runs at that speed from here on: see [Speed](#speed) | 0 s: the shooting is the same, `compose` remaps the time |

Clicks, marks and waits search the page and every frame in it, the extension's webviews included. Default page: `app` on app stages, `vscode` elsewhere.

### Resolution

<!-- LINKED-DATA: FRAME and the output check in commons/cli/storyboard.mjs; the factor `k` and the Chrome per page in commons/cli/director.mjs (apri, palco's dimensiona, pannello); the crop and the screencast margin in commons/cli/recorder.mjs. Change one, change the others. -->

Every video is drawn on a **1920 × 1080 frame**: zoom, splits, marks, offsets, cards. `output` only says how many pixels it gets.

> [!TIP]
> **Recommended: 1920×1080**, the default. Captured at device pixels it's sharp (no upscaling), the actions keep the pace they were tuned at, and it weighs about 28 MB a minute. 2K adds pixels but slows the actions down, and every scene's timing has to be tuned again (compare2, October 2026).

```yaml
output: { width: 2560, height: 1440 } # 2K: the same video, 4/3 sharper
```

- **Same layout.** Each page keeps a CSS viewport of 1920×1080 / zoom; Chrome draws it with `zoom × output.width / 1920` pixels per CSS px. The same lines of code fit, the same cards, the marks in the same place, only sharper. Nothing in the YAML changes but `output`.
- **Captured at device pixels.** Every page has its own Chrome, launched with `--force-device-scale-factor` at its scale (and the same `deviceScaleFactor` in its context, so `devicePixelRatio` stays right for canvases). With the scale only emulated, Chrome's screencast sends frames the size of the CSS viewport: VS Code at zoom 1.2 came as 1600×900 and was upscaled. Now no frame is upscaled; a pixel of rounding is cropped.
- **16:9, or 9:16 for a [vertical](#vertical) video**: even, at least 1920×1080 (2560×1440, 3840×2160) or 1080×1920. Anything else stops the YAML (another shape would change the layout).
- **Weight.** `mbPerMinute` stays the ceiling (60, about 8 Mbit/s). compare2 at 2K weighs 33 MB a minute: sharp text on flat backgrounds compresses well (the upscaled frames of before took 46). YouTube takes it as 1440p.
- **Cost.** Scrolls as smooth as at 1080p. At 2K the actions slow down: typing and clicks in VS Code took 1–2 s more in some of compare2's scenes, so the timings tuned at 1080p shift (marks shorter than 1.5 s, a longer video). At 1080p, captured at device pixels, they stay close to before (a few tenths, extension 0.8 s). `compose` takes about 3 minutes instead of 2. A changed `output` shoots everything.

### Vertical

<!-- LINKED-DATA: FRAME_VERTICALE, frameDi and the checks of the `stack` stage in commons/cli/storyboard.mjs; the `stack` view and its windows in palco, and pannello's `cima`, in commons/cli/director.mjs; the clips' `finestre` in commons/cli/record.mjs; `crop` in impagina, commons/cli/compose.mjs. Change one, change the others. -->

For YouTube Shorts, Instagram Reels and TikTok: `output: { width: 1080, height: 1920 }` is a **9:16 frame**, drawn on 1080 × 1920 (a bigger one, 1440 × 2560, only adds pixels). It has two stages: `stack` and `card`. The 16:9 stages (`vscode`, `app`, `split`, `split-panel`) and `camera` stop the YAML there.

`stack` puts three 16:9 windows, each as wide as the frame, one above the other, with a little black between them:

| Window | Is |
| :- | :- |
| **Code** (top) | VS Code above its panel: the sidebar (the LLM page, with Translate) and the editor |
| **Preview** (middle) | the app, in its own 16:9 page |
| **Terminal** (bottom) | VS Code's panel: the terminal where `--llm-translate` runs |

```yaml
output: { width: 1080, height: 1920 }
zoom: { vscode: 1.2, app: 1.2 }        # a window is 1080 wide: 900 CSS px at 1.2
vscode:
  settings: { "terminal.integrated.fontSize": 14, "terminal.integrated.gpuAcceleration": "off" }
setup:
  - command: "View: Set Panel Alignment to Justify"
  …
scenes:
  - id: translate
    stage: stack
    do: [ … ]
```

- **One VS Code, two windows.** The page is shot once, as tall as two windows plus the status bar. The director drags the panel's border to the height of a window, and `compose` crops the clip in two: the part above the border is Code, the one from the border down Terminal (`crop` in the clip's entry of `takes.json`; the same file listed twice).
- **Panel alignment.** Without help the panel sits beside the sidebar, which runs the whole height: the terminal window would be a third narrower, and a report line wraps. `command: "View: Set Panel Alignment to Justify"` in the `setup` runs the panel under the sidebar, the full 900 CSS px. (The setting `workbench.panel.alignment` didn't do it: VS Code keeps the layout in its state.)
- **The terminal's zoom.** The window shows one report line whole if the type is small enough: `terminal.integrated.fontSize` sets it apart from the code's (about 14 for the LLM's report, 90 columns; 16 wraps it). It is not 100%, and doesn't need to be.
- **No camera.** All three windows are always in view: the viewer sees the sentence typed, the page react and the terminal answer, with no move. `speed` works as everywhere.
- **Cards** are drawn on the vertical frame too: the forge follows its container, and a text that wraps awkwardly takes a `look: { type-scale: 0.7 }`. A long claim on one line (gif20t's first one, "One workflow. From code to every language.") needs it. `node commons/cli/card.mjs <project> <scene>` looks at it in the vertical frame.
- **GIF.** `output.gif` works (`width` 480 gives 480 × 853), but a vertical GIF is heavy: the video is the product.

### Tower

<!-- LINKED-DATA: TORRE, TORRE_VUOTO, TORRE_FINESTRE, finestraTorre and filtroPan in commons/cli/camera.mjs; the checks of the `tower` stage and of `camera: { window }` in commons/cli/storyboard.mjs; the `tower` view, its windows and `this.tela` in palco, and `window` in rettangolo, in commons/cli/director.mjs; `take.tela` in commons/cli/record.mjs; the canvas and filtroPan in segmento, commons/cli/compose.mjs. Change one, change the others. -->

The same three windows as `stack`, for a **16:9 video**: `stage: tower`. They stand in a tall frame, one above the other, and the camera slides over it, one whole window at a time. Where [Vertical](#vertical) shows them all at once to a phone, the tower shows one to a screen, big enough that nothing needs zooming.

| Window | Is |
| :- | :- |
| **preview** (top) | the app, in its own 16:9 page |
| **code** (middle) | VS Code above its panel: the sidebar (the LLM page, with Translate) and the editor |
| **terminal** (bottom) | VS Code's panel: the terminal where `--llm-translate` runs |

```yaml
zoom: { vscode: 2, app: 2 }            # a window is 1920 × 1080 of the frame: 960 × 540 CSS px at 2
setup:
  - command: "View: Set Panel Alignment to Justify"
  …
scenes:
  - id: write
    stage: tower
    camera: { window: preview }        # the first frame
    do:
      - camera: { window: code, time: 0.9 }       # slides down, the actions go on
      - …
      - camera: { window: terminal, time: 0 }     # a jump: no transition
```

- **The frame is 1920 × 3320**: three windows of 1920 × 1080 and 40 px of black between them. It is the video's width at any `output` (2K scales it like everything else).
- **`camera: { window: preview | code | terminal, time, ease }`** is the only camera there. `time: 0` is a cut; any other `time` slides, through what lies between (code to preview is one window, terminal to preview two). `keep` works as everywhere. A target (`text`, `selector`, `rect`), `full`, `selection`, `width` and `pad` stop the YAML: the camera doesn't zoom, because a crop in a tall frame isn't a `zoompan` (it only takes the aspect of its input). It is ffmpeg's `crop`, at the frame's real pixels (`filtroPan`).
- **No camera at all** in a scene: the top window, the preview.
- **A window is a page.** Zoom 2 gives the preview and VS Code each 960 × 540 CSS px (about the width of a VS Code in a split, 990); the terminal's type 15 is then 30 px of the frame, 12.5 on a GIF 800 wide. Zoom 1.2 reads well on the mp4 and not on a GIF. At the stage's default type for the terminal (16, `VSCODE_SETTINGS`) the window holds 104 columns and the report fills them to the last one (the rules, the seconds counter at the right edge), so a line can wrap: 5% less is 15.2, and `terminal.integrated.fontSize` takes whole sizes, so 15: 111 columns, the report (about 107) has room. (13.3 was read as 13, 17% under 16: the report shrank and left the window half empty.)
- **VS Code is shot once**, as in `stack`: the panel's border is dragged to the height of a window, `compose` crops the clip in two. The `setup` runs the panel under the sidebar, as in [Vertical](#vertical).
- **`take.tela`** in `takes.json` is the tall frame in video pixels; `compose` assembles the clips on it, then `filtroPan` crops the window. The strips in `capture/strips/` show the whole tower.
- **Cards** are scenes like the others: the tower is for the stages with pages.

### Marks

<!-- LINKED-DATA: these keys and defaults are MARK_TARGET and MARK_STYLE in commons/cli/storyboard.mjs, opzioniSegno in commons/cli/director.mjs and DEFAULTS in commons/cli/marker.js. The engine was born in the "Stage Marker Lab" prototype. Change one, change the others. -->

A hand-drawn highlighter over the page (`commons/cli/marker.js`). The pen lands, presses and tapers off; the line trembles a little, like hand-drawn animation. It's drawn above everything, the extension's webviews included, and below the pointer.

```yaml
- mark: { text: Sync }                                    # a green circle: the defaults
- mark: { selector: 'vscode-button[data-cmd="sync"]', shape: arrow }
- find: "null"
- mark: selection                                         # the editor's selection: how code is marked
- mark: { page: app, text: Français, shape: box, color: amber, dim: 0.3 }
- unmark
```

**Where.** Like `click`: `text` (with `exact: false` for a part), `selector`, `role` + `name`, `page`, `timeout`. Or `selection` (`mark: selection`, or `selection: true` among other keys): the editor's selection, after a `find`. Code is split into many small pieces on screen, and a text search on it doesn't hold. A block, such as a paragraph, is as wide as its column: the mark goes around its text. Buttons and inline elements keep their own box. `all: true` goes around every visible match together: the cells of a table column, which no single element holds. `after` is the seconds before the next action (default: the draw time).

**How.** Sizes are pixels of the 1920 × 1080 frame, at any page zoom and any `output`: at 2K they grow with the rest.

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
| `from` | the side with room | `arrow` only: the side its tail comes from, `left`, `right` (level, the tip at the target's mid-height), `top-left`, `top-right`, `bottom-left` or `bottom-right`. For a target with other things around it (gif20t's sentence has buttons under it: from below the arrow crossed one) |

A mark's shape depends on its scene, its number in the scene and the seed: every take draws it the same way. A `mark:` at the top of the YAML sets the defaults for the whole video, with the keys of this table (`mark: { color: amber }`).

**Long enough to be seen.** The eye has to find the mark, then what's inside it: a mark that vanishes too soon is a flash nobody follows. Once drawn, a mark stays whole for **at least 1.5 s**, and **2 s** when it's on words to read. It stays whole until a newer mark dims it, an `unmark`, or the cut. Make room with a `hold` on the scene, or a `wait` before what comes next. `record` checks the 1.5 s and warns under the scene (`! mark … stays whole 0.4 s`).

Marks don't follow the page. A mark is drawn where its target is at that moment, and every mark vanishes at a cut and on a reload. Mark when the layout is still: not while the terminal opens or the page reloads.

### Camera

<!-- LINKED-DATA: these keys and defaults are CAMERA_* in commons/cli/camera.mjs (controllaCamera checks them for commons/cli/storyboard.mjs), a_camera and rettangolo in commons/cli/director.mjs, the first frame in commons/cli/record.mjs, and filtroCamera's use in commons/cli/compose.mjs (segmento); the tower's `window` is in [Tower](#tower). Change one, change the others. -->

A 16:9 crop of the frame that glides from one framing to the next. The director measures each target while it shoots, where the elements exist, and `record` writes the keyframes in `capture/takes.json`; `compose` applies them with ffmpeg's `zoompan`. So the cut can be redone without shooting again, and the framing follows the layout. The mp4, the preview, the GIF and the contact sheet have the camera. The strips in `capture/strips/` don't: they are the whole frame, which is where you read a `rect` from.

```yaml
- id: translate
  stage: split-panel
  camera: keep                          # opens where the last scene ended
  do:
    - camera: { rect: [0, 150, 700] }   # glides to the panel in 0.5 s, and goes on: it doesn't wait
    - wait: 0.5
    - click: { selector: '#actions .azione[data-value="translate"]' }
```

| Key | Default | What it does |
| :- | :- | :- |
| a target | none | `text`, `selector`, `role` + `name`, `page`, `exact`, `timeout`, as for `click`; or `rect: [x, y, width]`, pixels of the frame; or `full` (the whole frame), `selection` (the editor's selection), `keep` (the scene's own only: where the last scene ended); in a [tower](#tower) only `window: preview \| code \| terminal` and `keep` |
| `width` | the target plus `pad` | the crop's width, 480 to 1920 frame pixels, centred on the target |
| `pad` | `40` | the room around the target, when there's no `width` |
| `time` | `0.5` | seconds the glide lasts; `0` is a cut |
| `ease` | `cubic` | `cubic`, `sine` or `linear` |

- **Frame pixels.** Everything is measured on the 1920 × 1080 frame, like marks and offsets: the same at any `output`.
- **Always 16:9, never under 480 wide** (a 4× zoom). Narrower, the picture goes soft.
- **The scene's `camera:` is its first frame**, measured before the clip starts, so the first frames are never the whole frame. It takes no `time` or `ease`. No `camera:`, the scene starts on the whole frame. Not on a card (it moves with `anim`), and not in `setup` or `before`: none of them is filmed.
- **A move doesn't wait.** It starts when its action does, and the actions after it go on while it glides. One that starts before the last has ended gets a warning (`camera: a move starts … before the last one ends`).
- **A crop is clamped to the frame.** Aimed at text in the app, it can pull in a strip of the code next to it. On a split-panel (`split` 0.62) the app is x 1190 to 1920, so `rect: [1190, 165, 730]` frames the app and nothing else.
- **Sharpness.** The mp4 at 1920 enlarges the pixels of a crop (soft past 2×). A GIF at 800 px shows a crop 800 wide at the size it was shot.

**Pull back, push in.** A shift from one framing to another can go through the whole frame, so the eye sees where it is before it goes there:

```yaml
- camera: { rect: [0, 0, 1920], time: 0.55, ease: sine }   # pull back: quick, gentle at both ends
- wait: 0.8                                                # the move, and a breath at the wide
- camera: { rect: [1190, 165, 730], time: 0.7 }            # push in: slower, it settles
- wait: 1.8                                                # the move (0.7 s), then the new framing holds 1.1 s
```

A shift takes 1.5 s. Out is quicker than in. The camera doesn't wait, so the `wait` after each camera action is its move plus what follows: each new framing holds for what the eye has to read (a typed line 0.9 s, a new sentence 1.1 s, a terminal's result 1.3 s, a result to take in 2 s) before the next move, and the camera moves only when there's something new to look at.

### Cut

<!-- LINKED-DATA: `before` is checked in commons/cli/storyboard.mjs (loadProject) and played by commons/cli/record.mjs, before the recorders start. Change one, change the other. -->

`before` is a list of actions a scene plays after the stage is set and before its clip starts filming. Their time isn't in the video: a jump cut. It is for a wait: an LLM's run, a reload, a build.

```yaml
- id: french
  stage: split-panel
  before:
    - waitFor: { text: "Full translate!", exact: false, timeout: 90 }   # the run is never on screen
    - wait: 1.5                                                         # the reload, back in English
  do:
    - click: { page: app, text: Français }
```

- The cut falls on a scene's edge: the scene before ends on what started the wait (the click), the next one waits in its `before`.
- No `mark`, `unmark` or `camera` there: nobody would see them.
- A kept scene ([Partial takes](#partial-takes)) plays its `before` again, to rebuild the state. The probes check its actions as the others'.
- The editor's focus can be lost while the stage is set (see [Field notes](#field-notes)): a `before` is also the place to give it back.

### Speed

<!-- LINKED-DATA: SPEED_* and the runs (tratti) in commons/cli/speed.mjs (controllaVelocita checks the shape for commons/cli/storyboard.mjs), a_speed in commons/cli/director.mjs, and filtroVelocita's use in commons/cli/compose.mjs (segmento). Change one, change the others. -->

`speed: 2` makes the video run at that speed from there on, until the next `speed` or the end of the scene; `speed: 1` is real time. It is for a wait that should be *seen*, not cut: a typing that can go quicker, the pointer's long way, an LLM's run. The viewer follows what happens, faster, instead of meeting a jump.

```yaml
- speed: 1.5            # the typing
- type: "<p><Trans>Nice to see you, {name}!</Trans></p>"
- save
- speed: 1
- speed: 2              # the pointer's way to Translate, and the LLM's run
- click: { selector: '#actions .azione[data-value="translate"]' }
- waitFor: { text: "Full translate!", exact: false, timeout: 90 }
- speed: 1              # the result holds at real time
```

- **`do` stays in real seconds.** Shooting doesn't change: a `wait: 2` lasts 2 s. The video shows a stretch divided by its speed (that `wait` at 2× is 1 s). `record` saves the keys in `takes.json`, in shot seconds; `compose` remaps the time with `setpts`, after the camera: its glides go at the speed of the rest, and a glide can straddle a change.
- **A number from 0.25 to 8.** Under 1 it is slow motion.
- **A scene starts at 1×.** The speed doesn't carry over to the next one.
- **Not in a scene with a voice** (`say`): the voice would go out of step. Not in `setup` or `before` either: they aren't filmed.
- **Lengths.** The scene lasts less in the video than it was shot: `compose` says so (`speed: translate shot in 7.7 s, 5.8 s in the video`). The cut, the GIF, the poster's `at` and the contact sheet follow the video. The strips of `capture/strips/` show the shot. `music.toEnd` counts shot seconds: don't mix the two.
- **Choose what is worth seeing.** At 2× the eye follows a pointer or a line that builds up, not a paragraph. Come back to 1× before what has to be read.

### GIF

<!-- LINKED-DATA: `output.gif` is checked in commons/cli/storyboard.mjs and made by gif() in commons/cli/compose.mjs. It's left out of the stage's fingerprint (impronte in commons/cli/record.mjs). Change one, change the others. -->

```yaml
output: { gif: { width: 800, fps: 12, colors: 128 } }
fade: [0, 0]
```

After `compose`, `output/<project>.gif` comes out next to the mp4, looping forever. It's made in two passes from the near-lossless segments, not from the final mp4 (no second compression): `palettegen` takes the colors the video really uses, `paletteuse` dithers with them.

- `width` 160 to 1920 (the height follows, 16:9), `fps` from 1 up to `output.fps`, `colors` 2 to 256 (256 when left out): the size of the palette.
- Changing it needs `compose` only, like `mbPerMinute`. Without `output.gif`, a GIF an older `compose` left is removed. `preview` makes none.
- For a clean loop, `fade: [0, 0]`, and a last scene the first one can follow.
- Weight: gif20t (29.8 s, 800 px, 12 fps, sliding windows) is 3.4 MB at 96 colors, 2.9 at 64, 2.6 at 48 and 2.3 at 32; from 48 down the orange of the terminal's report goes green, so 64. (A camera that zooms weighs more: a 21 s GIF with zoom-and-pull-back moves was 5.0 MB at 96 colors and 4.4 at 64, and 5.3 MB at 256 colors, 4.4 at 128, before its speed changes.) A heavier one: fewer `colors` first, then fewer fps, then a narrower width. A coarser dither (`bayer_scale` 3 or 2) doesn't help: on that one it came out heavier, 5.8 and 6.0 MB.

### Web video

<!-- LINKED-DATA: `output.web` is checked in commons/cli/storyboard.mjs and made by videoWeb() in commons/cli/compose.mjs. Like `output.gif` it's left out of the stage's fingerprint (impronte in commons/cli/record.mjs). The output files are ignored by site/video/.gitignore (`*.web.*`). Change one, change the others. -->

For a web page that shows the video by itself, muted and in a loop (a landing's demo): the GIF is the wrong tool there, five to ten times heavier and sharper in neither.

```yaml
output: { web: { width: 960 } }
fade: [0, 0]
```

After `compose`, next to the mp4: `output/<project>.web.mp4` (H.264), `.web.webm` (VP9) and `.web.webp` (a poster). Like the GIF, they're made from the near-lossless segments, not from the final mp4, and they have no sound.

- `width` an even number, 160 to 1920 (the height follows). `fps` from 1 up to `output.fps`, which it takes when left out. `crf` 18 to 40, 30 when left out: the x264 quality, the higher the lighter; the webm goes at `crf + 8` (VP9 has another scale). `webm: false` skips the webm (a page that serves only the mp4).
- The mp4 has its index up front (`faststart`): it starts playing before it is all downloaded. Serve the webm first (`<source>` order), the mp4 after.
- The poster is the project's `poster` frame, or the first one without it: `<video poster>` shows it while the file loads.
- Loop, mute and autoplay belong to the `<video>` element, not to the file: `autoplay muted loop playsinline`. A page that autoplays should stop on `prefers-reduced-motion` and offer a pause (WCAG 2.2.2, a loop that lasts more than 5 s).
- Changing it needs `compose` only. Without `output.web`, the files an older `compose` left are removed. `preview` makes none. They are not kept in git (`*.web.*` in `site/video/.gitignore`): the page keeps its own copy, as the landing does with its poster.
- Weight: gif20t (29.8 s) at 960 px, 30 fps: mp4 crf 30 about 600 kB, webm crf 38 about 340 kB; the GIF of the same story is 2.9 MB.

### Music

<!-- LINKED-DATA: these keys and defaults are MUSIC_DEFAULTS in commons/cli/music.mjs. Change one, change the other. -->

A track of `commons/bkmusic` under the voice, the way a voice-over does it: it goes down just before every line, nearly disappears while the voice speaks, and comes back up in the pauses. Nothing chases the voice: the times of the lines are known, so the volume curve is written exactly (`commons/cli/music.mjs`). The track is measured and brought to its level, whatever its master, and it loops if it's shorter than the video (never with `toEnd`).

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

<!-- LINKED-DATA: the prototypes and their params are commons/components/<name>/ (the .js reads them, the .md describes them, variants.yaml shows them); the forge is commons/layout/card.html, card.css, motion.js, clock.js, layout.js, parts.js, described by commons/layout/darkStyle.md; the URL is urlCard() in commons/cli/director.mjs, the take is ciak(), called by commons/cli/record.mjs right after the recorders start; `card`, `look` and `anim` are checked in commons/cli/storyboard.mjs. Change one, change the others. -->

A card is a full-screen page between the screens of the app: a title, a question, a few figures, a list. It's played live by the recorder on a 1920 × 1080 frame (sharper with a bigger `output`, same layout), so it animates. Every card is a **prototype** of the forge: a short script in `commons/components/<name>/` that one page, `commons/layout/card.html`, plays. Sizes come from a few knobs, colors from the site, motion from GSAP on one timeline; text wraps and shrinks to its box like a web page, and what still doesn't fit stops the take before it starts. The forge's manual, for whoever makes a prototype, is [commons/layout/darkStyle.md](commons/layout/darkStyle.md).

| Prototype | Shows | Good for |
| :- | :- | :- |
| [`title`](commons/components/title/title.md) | the logo, a line with a green half, and (`words`) a second line whose words light up one by one | the opening, a closing claim |
| [`question`](commons/components/question/question.md) | a big question, then a few words lighting up below it | a hook; a question and its answer in keywords |
| [`beats`](commons/components/beats/beats.md) | a title, a command, then tiles landing one by one | three facts, three figures, three steps |
| [`together`](commons/components/together/together.md) | columns of ticked items, filling one after another | a summary: what's in, grouped |
| [`outro`](commons/components/outro/outro.md) | logo, npm, Marketplace, GitHub; music credits at the bottom | the closing, and a last word after it |

Each sheet has the prototype's params, how it adapts and where its limit is, its timeline, the selectors `anim` can aim at, and its variants.

**In the YAML.** `stage: card`, `card` (a prototype by name: `card: beats`; one of the project's own: `card: ./components/<name>`, in `projects/<p>/components/<name>/<name>.js`) and `params`. Params reach the card as a query string, every value a string. A list holds one item per line, and `|` splits an item into its parts: write it as a YAML block scalar. Times are seconds, comma-separated. A param left out takes its default; the recorder also adds `credits` when the video has music.

```yaml
- id: bundle
  stage: card
  card: beats
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

**Params every prototype has.**

| Param | Default | |
| :- | :- | :- |
| `note` | none | a small grey line at the bottom |
| `noteAt` | 1 (together: after the last item) | when it shows |
| `stamp` | none | a rubber stamp pressed over the card, in its `corner`, with a thud: one line, or `small\|BIG\|small` |
| `stampAt` | 1 | when it lands |
| `qr` | none | an image on white, under the stamp: a file next to the prototype, such as outro's `coffee-qr.svg` |
| `qrLabel`, `qrAt` | none, 1.5 | a line under the QR; when it comes in |
| `corner` | `bottom-right` | where stamp and QR sit: `bottom-right`, `top-right`, `bottom-left`, `top-left` |
| `still` | none | any value: the card is already composed on the first frame, no entrance (stamp and QR still come in). For a scene that carries on the one before on the same card: the cut doesn't show |

Stamp and QR sit over the card and move nothing; the card stops if they'd cover its content.

**A new param.** What a card can't do yet, but a story asks, is added to the prototype (or to the forge, for all of them) as a param, with the old behavior as its default: the components grow with every video ([rule 11](#rules-for-agents)).

**`look`**: the forge's knobs and the site's tokens, by name without `--` ([darkStyle.md § Knobs and scales](commons/layout/darkStyle.md#knobs-and-scales)). At the top of the YAML for every card of the video, in a card scene for that card only (merged over the top).

```yaml
look: { type-scale: 0.92, tempo: 1.1 }   # top level: a calmer, slightly smaller video
- id: llm
  stage: card
  card: beats
  look: { cols-max: 3, accent: "#fbbf24" }  # this card: three tiles a row, in amber
```

A name that isn't a knob or a token stops the take.

**`anim`**: movement the prototype doesn't do, on its timeline. Each entry has one of `fx` (an effect of [darkStyle.md § Motion](commons/layout/darkStyle.md#motion), its other keys are its config), `set`, `to`, `from` (GSAP vars), `fromTo` (`[from vars, to vars]`), plus `target` (a CSS selector: the sheet lists them) and `at` (seconds, default 0).

```yaml
anim:
  - { fx: glow, target: .tile, at: 6.5 }
  - { to: { opacity: 0.4, duration: 0.6 }, target: .note, at: 9 }
  - { fromTo: [{ x: -40 }, { x: 0, duration: 0.5 }], target: h1, at: 0 }
```

A wrong shape stops the YAML (`check`); an unknown effect or a selector that matches nothing stops the take.

**Timing on the voice.** Every card starts from zero when its clip starts, not on load (about a second earlier): the recorder adds `clock=take` to the URL and fires a `take` event on the page as soon as it's filming. Title and outro just enter then. The others take `at`, in the same seconds as an action, since the voice starts at `lead`: the word *n* falls at about `lead` + *n* / 2.6, on the real voice's pace once it's in. Put each entrance on the word that names it. Times left out follow the last one at the prototype's own step.

**Looking at cards** without shooting, from `site/video`:

| Command | Does |
| :- | :- |
| `node commons/cli/card.mjs <project> <scene> [--at 0.5,1,2.4]` | a scene as the YAML has it: frames and a `contact.jpg` in `projects/<p>/preview/cards/<scene>/` |
| `node commons/cli/card.mjs <prototype> [<variant>] [--at …]` | a prototype, with one of its variants: in `.cache/cards/<prototype>/<variant>/` |
| `node commons/cli/card.mjs --gallery [--open]` | every variant of every prototype at the end of its timeline, in `.cache/gallery/index.html`; a click shows one live. Exits with 1 if a variant doesn't give the outcome it declares |

Without `--at`, a frame every 0.5 s to the end of the timeline. Frames are taken by stopping the timeline at that instant: the same every time.

**A new prototype.** Reuse first: a param, a `look`, an `anim` often do it. When none fits, follow [darkStyle.md § Forging](commons/layout/darkStyle.md#forging): a folder, a short script made of the shared parts, its variants (one past the limit), the gallery, its sheet and a row in the table above. Shared for more than one video, in `commons/components/`; one video only, in the project.

## On stage

<!-- LINKED-DATA: facts read from the sources, not from the pipeline. Selectors and row labels: packages/idePlugin/src/webViews/commandBar/commandBar.mjs (ACTIONS, ICONS, data-cmd) and packages/idePlugin/src/views/results/markedRows.mjs (GLYPHS, row label), which point back here; Project's languages: packages/idePlugin/src/webViews/project/projectWebview.mjs (data-open); Settings' styles: packages/idePlugin/src/webViews/optional/optionalWebview.mjs (.stile, data-value). Marks in the app: lib/errorSolve.js (ERROR_SOLVE_DEFAULTS.mark). Sync's output: lib/dev/vite/updateLanguage.js; its terminal: packages/idePlugin/src/core/cliRunner.mjs (SECONDS). The site: site/landing/src/siteLanguage.js (the remembered language), site/landing/src/main.jsx (hashes to the playground), site/landing/src/Compare.jsx (the table, .col-us), site/theme/LanguageSwitch.jsx (.lang-switch). -->

What the `.md` shows, and where it comes from: the fixture for lines and texts, `packages/idePlugin/src` for the panel, `lib/` for the app. What a conversion needs most often:

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
  - After that click the panel redraws its rows and moves the focus to the first language. Its tooltip (the file's full path) used to show up and stay. Fixed in the extension (`focusShowsTip` in `packages/idePlugin/src/webViews/tooltip/tooltipScript.mjs`): it reaches a take built with `--rebuild-ide`, or from a `.vsix` built after it.
- **Settings** opens from `vscode-icon[data-cmd="settings"]` and takes the panel; Back is `vscode-button[data-cmd="close"]`. Its Highlight style opens with `details#highlight > summary`; each style is `.stile[data-value="<id>"]` (ids in `packages/idePlugin/package.json`), and a click restyles the open editors at once. The first eleven fit without scrolling. Highlighter is faint on a dark theme (⚠ next to it). The palette's "Choose highlight style…" does the same, but its list covers the top lines of the editor.
- **A build in the terminal:** `key: Control+Backquote` opens one, `type` writes in it (PowerShell keeps what's typed before its prompt), `key: Enter` runs it. Its text is found by `waitFor` and `mark` only with `"terminal.integrated.gpuAcceleration": "off"` in `vscode.settings`: WebGL draws pixels. Maximize the panel (`View: Toggle Maximized Panel`) so the output doesn't scroll under the marks. A new terminal takes the focus a moment after it opens and closes a palette already open: `wait: 0.6` before the next `command` (which reopens the palette once, if it closes before the typing). `npm run build` prints viteTranslate's block 2–3 s after Enter and is done within a second: one chunk per language, except the source one, preloaded in the main bundle.
- **A split** gives VS Code 62% of the width: with the panel open, about 55 columns of code fit. Keep the line that matters short, or tune `split` or `zoom.vscode`. Its terminal is as narrow: a CLI's report wraps in pieces there. Where a scene shows one, use a split-panel.
- **The LLM page** (Project's `vscode-button[data-cmd="llm"]`): its actions are `#actions .azione[data-value="translate"]` and the other ids of `LLM_ACTIONS` (`packages/idePlugin/src/core/syncCommand.mjs`), shown as rows: icon, name, description. Translate runs `--llm-translate` in the panel's terminal. The page checks the key, the settings and a ping in about 1.5 s: wait before the click.
- **A split-panel** shows the terminal the panel has. Kill the earlier ones behind a card (`command: "Terminal: Kill All Terminals"`), so the strip opens on a fresh one, and set `"terminal.integrated.tabs.enabled": false` in `vscode.settings`: no tab list beside the strip. The LLM's run from the panel (Translate) lands there, each line whole, and ends on `✔ < 1 new key français. Full translate! / 2s.`: `waitFor` it. The app's column is x 1190 to 1920 of the frame (`split` 0.62), down to the panel's top (about 756); the panel opens with a new terminal, which takes the focus (see [Field notes](#field-notes)).
- **The published site** (sepoina.github.io/viteTranslate) in an `app` scene, with `url`:
  - Every page remembers the last language in localStorage `viteTranslate.site.language` (`site/landing/src/siteLanguage.js`), and Edge cases and the restaurant fall back to Italian: `storage: { "viteTranslate.site.language": en-US }` starts each scene in English.
  - The landing sends any `#hash` to the playground (`site/landing/src/main.jsx`, for old links): open it bare, with `anchor: '[data-section="compare"]'`.
  - Language buttons: `.lang-switch button:has-text("FR")`. The restaurant's is a menu: `summary:has(.ph-globe-hemisphere-west)` (its label is translated), then `details[open] a:has-text("Français")`.
  - The restaurant is about 18,000 CSS px tall, with 14 lazy images and blocks that slide in once as they come into view: `preload: true` before scrolling it. Its bottom is `.site-footer`; the bar with the globe stays on top.
  - The comparison table is `[data-section="compare"] table`, 677 CSS px tall: whole on screen only with `zoom.app` about 1.3 or less. Its viteTranslate column is `.col-us`, marked with `all: true`.
  - `app.style` doesn't reach these pages: it dresses the fixture's own app only.
- **The pointer** (the drawn one) stays where it last clicked until the next click on that page. The real mouse, and its hover, leave for the corner at every cut.

## Commands

From `site/video`, after a one-off `npm install` (a standalone package, not a workspace of the repo):

| Command | Does |
| :- | :- |
| `node commons/cli/run.mjs <project> check` | does `storyboard.yaml` match `storyboard.md`? Which scenes don't |
| `node commons/cli/run.mjs <project> stamp` | declares it does (after adapting it); refuses if the scenes differ |
| `node commons/cli/run.mjs <project>` | `tts`, `record`, `compose` |
| `node commons/cli/run.mjs <project> all` | `tts`, `record`, `preview`, `compose` |
| `node commons/cli/run.mjs <project> tts record preview` | just those steps, in that order |
| `--silent` | mute voice of the estimated length: no key, no cost. Real lines still valid stay |
| `--force` | re-voice every line, cache or not |
| `--headed` | watch Chrome while it records |
| `--rebuild-ide` | rebuild the extension `.vsix` before installing it |
| `--stale` | run even if `storyboard.yaml` is behind (rehearsals only) |
| `--full` | `record` shoots every scene, even those that match their take |
| `--from <scene>` | `record` shoots from that scene, keeping the clips before it as they are: [Partial takes](#partial-takes) |
| `--to <scene>` | `record` stops after that scene: shoot only what you're checking |
| `--probe` | `record` writes, under each scene, what the probes saw for each action: where the click landed, when the page reacted and settled ([Probes](#probes)) |
| `--strict` | `record` stops at the first probe warning |
| `node commons/cli/card.mjs …` | look at a scene's card, a prototype, or the gallery of them all, without shooting: [Cards](#cards) |
| `npm test` | the tests of the forge, the storyboard and the probes (`commons/test/`, Chrome as in a take) |
| `node commons/cli/live.mjs` | follow every run live: what the VS Code task and the window run |

Needs Node 18+, Chrome and VS Code installed (its `code serve-web` runs the editor; your own VS Code profile is never touched), and an [OpenRouter](https://openrouter.ai) key in `OPENROUTER_API_KEY`, looked up in this order: environment, `site/video/.env.local`, `site/video/.env` (both git-ignored), the keyring via `npx vitetranslate --llm-key-set`. The first `record` downloads the VS Code server into `.cache/` (a minute, once).

## Watching a run

<!-- LINKED-DATA: commons/cli/live.mjs (the view, its heartbeat, the window), commons/cli/run.mjs (when it opens one), the task "video: live" in .vscode/tasks.json at the repo root. Change one, change the others. -->

Every run shows live, line by line: the steps (`▶`), each line voiced, each scene shot, warnings in yellow, the error that stopped it in red. It's `commons/cli/live.mjs` following the `log/run.log` of every project. Opened halfway through a run, it starts from that run's first line.

- **In VS Code** it's the task **video: live** (`.vscode/tasks.json` at the repo root), a tab of the Terminal panel. It starts with the folder if VS Code allows automatic tasks (it may ask once; the setting is `task.allowAutomaticTasks`). If it didn't start, use Terminal › Run Task › video: live.
- **Nobody following?** When `tts`, `record`, `preview` or `compose` start and no live view is on, `run.mjs` opens one in a Windows Terminal window (a plain console if there's no Windows Terminal) and says so in its first line. Later runs find it and reuse it. A live view counts as on if it has touched `.cache/live.beat` in the last 3 s.
- **A run from your own terminal** opens nothing: you're already watching it. Neither do `check` and `stamp`: they're instant.

**For an agent.** Run the commands as usual. The user follows them in the live view, so your tool's output is for you. Say what a run does before you start it. A run takes minutes: `record` about 1.5 to 4, `compose` about 2 (the final's two passes), and the first `record` takes a minute more for the VS Code server. Give the command a timeout of 5 minutes or more, or run it in the background and read the project's `log/run.log`. One run at a time: runs share the VS Code in `.cache/` and the app's port.

## Folders

```text
site/video/
  README.md             this file
  commons/              the machinery every video shares
    cli/                the pipeline (run.mjs is the entry point; card.mjs looks at cards; probe.js/.mjs the probes)
    test/               npm test
    layout/             the card forge (card.html, card.css and its scripts, darkStyle.md), app-dark.css for the demo apps
    components/<name>/  a prototype: <name>.js, its sheet <name>.md, variants.yaml, its files (outro: the coffee QR)
    bkmusic/            background music: the tracks (local only) and credits.md
  .cache/               VS Code server, extension, settings: the "controlled copy"; live.beat (a live view is on);
                        cards/ and gallery/ (card.mjs)
  projects/index.md     where each video stands, what's next, and the travel log
  projects/<project>/
    storyboard.md       the story, in Italian: the source of truth
    storyboard.yaml     the shooting script, in English: generated, tunable
    audio/              per line <id>.wav (trimmed) and <id>.raw.wav (as received); manifest.json (the TTS cache)
    capture/            the copied app, raw clips per scene, strips/ (a frame a second per scene), takes.json (with fingerprints)
    preview/            960x540 cut + contact.jpg (one frame per scene)
    output/             <project>.mp4, <project>.gif (with output.gif), <project>.web.mp4 + .web.webm + .web.webp (with output.web), <project>.srt, poster.jpg, credits.txt (with music)
    components/         the project's own card prototypes, if any (card: ./components/<name>)
    fixture/            the project's own app, if it has one (gif20t: quickApp plus an `llm` block): `fixture: site/video/projects/<project>/fixture`
    log/                run.log (every run, timed), vscode.log, app.log, card.log, probe.jsonl, error-*.png
```

What git keeps is in [rule 6](#rules-for-agents); everything else is rebuilt by a run.

## The pipeline

1. **tts** — each `say` becomes `audio/<scene>.wav` (OpenRouter `/audio/speech`, PCM wrapped in WAV). Cached by text + voice. The silence around the line is trimmed, keeping 0.15 s before the first word (the breath) and 0.1 s after the last. The take as received stays in `<scene>.raw.wav`, and every run trims again from it: the margins can be tuned without paying for the voice again. With `--silent`, a line already voiced for real, with the same text and voice, keeps its voice.
2. **record** — copies the `fixture` into `capture/`, starts its `vite dev` and an isolated VS Code with the repo's extension, then plays the scenes in one session. A scene's `before` plays first, unfilmed ([Cut](#cut)); its camera keyframes are measured as it goes ([Camera](#camera)). Each scene lasts at least as long as its line. It shoots from the first scene that changed since the last take: see [Partial takes](#partial-takes).
3. **preview** — a quick low-res cut and a contact sheet.
4. **compose** — the final cut: scenes in a row, each page in its place (side by side in a split, the app over VS Code's corner in a split-panel), the [camera](#camera)'s crop where a scene has one, then its [speed](#speed) changes, voice in place, fade in and out (`fade`), subtitles, poster. A subtitle holds two lines of about 42 characters, and breaks where the voice pauses: after a full stop, then after a comma or a colon, never after an article or a preposition; two sentences share a cue only if the line breaks between them on a pause. Every line is brought to -16 LUFS (generated one by one, they come out louder or softer), its peaks limited to -1.5 dB, with 10 ms fades at its edges against clicks. Then the [music](#music), if any, goes under the voice, ducked around every line, and its credits go to `output/credits.txt`. The scenes are cut as near-lossless intermediates (CRF 10); the final video is encoded once from them, in two passes at the bitrate `output.mbPerMinute` asks for (60 MB a minute: about 8 Mbit/s, AAC 192 kbit/s), so the bits go to scrolls and fades rather than to still cards. A screen that doesn't move costs nothing at any quality: when the video can't use the bits, x264 stops at near-lossless (an average QP under 1, and a harmless "2pass curve failed to converge") and the file comes out lighter. compare weighs about 29 MB a minute at 1920×1080; compare2, captured at device pixels, about 28 at 1920×1080 and 33 at 2560×1440. With `output.gif`, the [GIF](#gif) is made from the same segments. The preview copies the segments as they are, fast.

Something broke? Start from `log/`: `run.log` has every run with timestamps, `error-*.png` shows each page at the moment it failed, `vscode.log` and `app.log` hold the servers' output, `card.log` the cards' console errors, `probe.jsonl` what the probes heard ([Probes](#probes)).

## Partial takes

<!-- LINKED-DATA: this is impronte(), piano() and the scene loop in commons/cli/record.mjs, the --full/--from/--to options in commons/cli/run.mjs, and the scenes check at the top of commons/cli/compose.mjs. Change one, change the others. -->

A scene to fix shouldn't cost the whole take. `record` keeps what still holds and shoots the rest.

- **Fingerprints.** `takes.json` keeps one for the *stage*: the fixture's files, the settings, the setup, zoom, lead and tail, the extension's `.vsix`, the pipeline's code (the probes included). And one per scene, chained: the scene's YAML, its voice, its card (the prototype's folder, the forge in `commons/`, the site's tokens, the GSAP version, the music credits, the video's `look`), and the fingerprint of the scene before. A changed scene changes all those after it too, since they inherit its state. `output.mbPerMinute`, `output.gif` and `output.web` are in none of them: they change the cut, not the take.
- **From the first change.** `record` keeps every scene up to the first changed one, and shoots from there to the end. A changed stage shoots everything. Nothing changed: nothing to shoot, at once.
- **Fast-forward.** The servers and the setup still start (about 40 s). The kept scenes are played without filming, to rebuild the state: their `before`, actions and waits, no marks, no camera, no speed, no voice time. Only the last one before the cut plays at full length, so what runs on the clock (a reload, Sync's terminal closing after 10 s) reaches the first filmed scene as in a full take. Their clips stay.
- **Saved as it goes.** `takes.json` is written after every filmed scene. A run that stops halfway, an error or `--to`, picks up from there next time.
- **Strips.** Every filmed scene leaves `capture/strips/NN-<id>.jpg`: a frame a second, four per row, left to right, the pages in their place as in the cut. They land while the run goes on.
- **By hand.** `--full` shoots everything. `--from <scene>` shoots from there and keeps the clips before it *as they are*, even if the stage changed, with a warning: use it when you know a change touches only that scene and the later ones, like an extension fix seen in one scene only. Those kept scenes then take the new fingerprints. `--to <scene>` stops after that scene, and `takes.json` forgets the scenes after it, clips included: the next `record` shoots them again. A camera `keep` after a kept scene starts where that scene's last keyframe left it.
- **Partial takes and the cut.** `preview` cuts what there is, with a warning. `compose` refuses until the takes cover every scene of the YAML.

On `compare` (11 scenes): a full take 172 s; from scene 8 on, 131 s; scene 9 alone (`--from llm --to llm`), 91 s.

## Probes

<!-- LINKED-DATA: the events are commons/cli/probe.js (in every frame) and commons/cli/probe.mjs (Sonde: the log, the summary); the checks are in commons/cli/director.mjs (avvisa, the a_* actions, fuoco, igiene, ciak), wired by commons/cli/record.mjs; --probe and --strict are in commons/cli/run.mjs. The overlay selectors (SOPRA, APERTI in probe.js) are facts of On stage. Change one, change the others. -->

A take doesn't only film: it listens. A small script in every frame of every page, the extension's webviews included, hears what really happens (clicks, focus, keys, the page changing, tooltips, layout shifts) and writes it to `log/probe.jsonl`. After each action the director asks it whether the action did what it should. It never acts and never draws: a warning goes under the scene with a `!`, and the take goes on.

| Action | Checks | Warning |
| :- | :- | :- |
| `click` | nothing covers the target; the click lands on it; the drawn pointer sits where the real one clicked | `the target is covered by …` · `no click reached the page` · `landed on …, not on the target` · `the drawn pointer is N px from the real one` |
| `type` | the focus is in an editor; the keys reach one | `the focus is on … not in an editor` · `N of M keys reached an editor` |
| `key` | the keys reach the page | `no key reached the page` |
| `goto` | the status bar's line (and column) | `the cursor is on line N` |
| `find` | a selection as long as the text | `nothing selected` · `N characters selected, expected M` |
| `save` | the active tab isn't dirty any more, within 1 s | `the file still has unsaved changes` |
| `command` | the palette has closed, within 1 s | `the palette is still open` |
| `mark` | the target is still while drawn, and on screen | `the target moved N px while drawn` · `partly off screen` |
| card | the take started the card | `the take didn't start the card` |
| the cut | no tooltip during the clip; nothing left open | `a tooltip showed up: …` · `at the cut: still open: …` |

Checks run only on what's filmed (never in fast-forward), and read the page after the action, in a pause that's there anyway: a take lasts as long as without them (a tenth or two more on scenes full of clicks). Warnings after the setup print as `! setup: …`.

- **`--strict`**: the first warning stops the take, with its error screenshots.
- **`--probe`**: under each scene, a line per action from the log, computed after the cut: `· click {"text":"Sync"} · hit vscode-button[data-cmd="sync"] · reaction 35 ms · still at 640 ms`. *Reaction*: the page's first change after the action; *still*: when it stopped changing.

Each warning is either a real defect (fix the YAML or the director) or a false alarm (fix the probe). The webviews write themselves with `document.open`, which wipes a page's listeners: the probe notices and listens again.

## Field notes

What earlier sessions learned the hard way. Stage facts are in [On stage](#on-stage); this is about working.

**A take, step by step.**

- **Check before you shoot.** Unsure what an action shows or prints? Copy the fixture into `projects/<project>/capture/<fixture>` (git-ignored; its `node_modules` resolve from the folders above) and try it there. That's how the build's output was found to have no chunk for the source language.
- **One scene at a time.** To check a scene, shoot only up to it with `record --to <scene>`, then look at its strip. Don't stop a run by killing it: its `vite dev` and VS Code may stay up, and the app's port stays busy.
- **Strips first, then frames.** A strip shows the scene's flow: what appears and when. For a detail, pull a frame from the cut. A scene starts at the sum of the takes before it in `capture/takes.json`:

  ```sh
  node -e "const f=require('ffmpeg-static'),{spawnSync}=require('child_process');spawnSync(f,['-y','-ss','87.4','-i','projects/<p>/output/<p>.mp4','-frames:v','1','-vf','scale=960:-1','frame.jpg'])"
  ```

- **Look for what nobody asked for.** Tooltips, suggestion popups, a find box, a panel left open: they don't fail a run. The probes warn about them under the scene ([Probes](#probes)); the frames show what they look like.

**Timing on the real voice.**

- Find the pauses of each line with `silencedetect`. A word right after a pause starts at `lead` + the pause's end; in between, count syllables:

  ```sh
  node -e "const f=require('ffmpeg-static'),{spawnSync}=require('child_process');const r=spawnSync(f,['-i','projects/<p>/audio/<id>.wav','-af','silencedetect=noise=-35dB:d=0.12','-f','null','-'],{encoding:'utf8'});console.log([...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m=>m[1]).join(' '))"
  ```

- A click takes 0.6–1.3 s from its `wait` to the click: the pointer glides first. Start the glide a little before the word.
- "Actions ran past the voice" by a second or two is fine where the screen still has something to show; otherwise trim the `wait`s.
- Sharpness is decided at the capture, not at the encode: Chrome's screencast follows the browser's scale factor, not the one Playwright emulates. Measure a frame's size before tuning bitrates.
- A live LLM's run varies from take to take (compare2's llm-preview: 7.7 to 11.9 s), and with `music.toEnd` it moves the end. Read `the video runs N s past the track` after each take; a slow one is worth `record --from` that scene. To give the video more music, `delay` (the track comes in later); `start` cuts the track's head, so it ends sooner.

**Cards.**

- Look at a card with `node commons/cli/card.mjs`, not with Chrome by hand: it stops the timeline at the instants you ask, the same every time, and says what doesn't fit.
- A box with `1fr` grows with its text: use `minmax(0, 1fr)`, or measuring overflow finds nothing to shrink.
- An element with `container-type` can't be a subgrid: its rows fall back to `none`. That's why a tile in a grid isn't a container.
- A hidden grid item frees its row: an empty head sent the body to an `auto` row, 0 px tall. Place regions on their rows.

**Traps met on stage.** Details in [On stage](#on-stage).

- Clicking a panel row leaves the focus in its webview: keys go nowhere until a click in the editor.
- The real mouse resting on a clicked tab shows its tooltip (the file's full path) a moment later. The probes caught it opening compare's llm-preview: after dragging the panel's border, `pannello()` put the real mouse back where the drawn one was, on the tab. Now the real mouse goes to the corner at every cut and after that drag; the drawn one stays.
- `find` on the word the cursor is in does nothing, since the search box comes seeded with it: `key: Control+D`.
- The palette's lists cover the top of the editor.
- The terminal's text is invisible to `waitFor` and `mark` unless the GPU renderer is off.
- Marks vanish at every cut: a mark can't "stay" into the next scene.
- **The panel stays empty, Settings' gear isn't found:** VS Code is in Restricted Mode, where the extension doesn't run, because the user settings (the ones that turn trust off) didn't save. It happened now and then. `preparaVscode` checks the status bar after the reload, writes them again up to three times, then stops with that reason. The setup waits for Project's Sync button (`waitFor`, 60 s), so a panel that never loads stops the run before the first take.
- This VS Code opens the user settings in a modal editor, and calls the theme "Dark Modern" (with the old "Default Dark Modern" the server rewrites the file on its own).
- **Durations:** count the real voice at the pace of the estimate. In `compare` the real lines came out within a few percent of `--silent`'s, some longer. Fit the video to its music with the real voice in.
- Changing anything in `commons/cli/` changes the stage: the next `record` shoots everything. Use `--from` when the change can't touch the scenes before.

**Camera, cut and GIF** (October 2026).

- **A split's terminal is too narrow for an LLM's report.** At 62% of the width the lines wrap in pieces: `waitFor` doesn't find `Full translate!` (it timed out after 90 s, on a run that had finished in a second), and at 800 px nobody reads it. The scene is a split-panel.
- **The panel a split-panel opens brings a new terminal, which takes the focus.** The editor's cursor goes (Monaco hides it): `camera` aimed at `.monaco-editor .cursors-layer .cursor` says "not found", and the first `key` would have gone to the terminal. A `before` with `command: "View: Focus Active Editor Group"` gives the focus back, unfilmed.
- **A reasoning model spends its output thinking** (92% for `deepseek/deepseek-v4.1-flash` through OpenRouter) and the run ends on a four-line warning, with the result line above it. The fixture's `llm` block carries `providerOptions: { reasoning: { enabled: false } }` ([docs, reasoning models](https://sepoina.github.io/viteTranslate/docs/llm/price/#reasoning-models)): the run takes under a second and ends on `Full translate!`. Check what a CLI prints by running it by hand in a copy of the fixture under `capture/` (a scratch folder there doesn't go in git).
- **Read a crop off a strip.** A strip is four frames a row at a quarter of their size: multiply what you measure by 4. A crop aimed at a text next to the frame's edge is clamped and pulls in the neighbour (a strip of code beside the app): give a `rect` instead.
- **A jump cut after a click isn't understood; the run at 2× is.** Hiding the LLM's wait in a `before` leaves the viewer a jump. Showing it with `speed` and running the LLM at 2× was no better: the report went by in 1.2 s and couldn't be read. What reads: speed only the pointer's way (2×) and play the run at 1.5× (gif20t: the report takes 3 to 5 s on screen) or at real time: the command, the sync report, the request and the result are all legible. When the camera zooms on the terminal, its crop has to be wide enough for the report's longest line (`rect: [680, 652, 760]` in a split-panel; at 560 wide it cut the right of the lines).
- **A first frame by `selector` or `text` follows the layout, a `rect` doesn't.** A project whose fixture and stage never change can use `rect` throughout. Use a target where the layout can move.
- **`SOVRACAMPIONA`** (`camera.mjs`) is 2: the frame is doubled before `zoompan`, which rounds x and y to a pixel of its input. If a slow glide trembles, raise it to 3, then 4 (slower, more memory).
- **Vertical: the panel sat beside the sidebar.** The terminal window was a third narrower and the LLM's report wrapped ("1 api reque…", "0500)" on its own line). The setting `workbench.panel.alignment` changed nothing; the command `View: Set Panel Alignment to Justify` in the `setup` did ([Vertical](#vertical)).
- **A claim on a vertical card.** At the default type scale gif20t's first claim, "One workflow. From code to every language.", broke after "From", mid green. `look: { type-scale: 0.7 }` keeps it on one line.
- **Tower (gif20t): the status bar peeked under the terminal.** VS Code is shot as tall as two windows plus a margin; at zoom 2 its status bar is 44 px, the margin was 40, and 8 px of it showed at the bottom of the terminal window. The margin now follows the zoom (`22 × zoom` plus 8, at least 40).
- **Tower: a crop in a tall frame isn't a `zoompan`.** `zoompan` crops in the aspect of its input, so a 16:9 window of a 1920 × 3320 frame comes out squeezed. The tower's camera is `crop` with an expression for y ([Tower](#tower)): it slides, it can't zoom.
- **Tower: the LLM's run sets the length.** At real time the run takes 4 to 7 s (the `npx` start, the model's answer): the translate scene is the longest, and its length changes from take to take. gif20t shows it at 1.5×, after a slide to the terminal.
- **Tower: right after the click the terminal still shows its old prompt.** The click opens a new terminal tab a moment later; a camera that reached the terminal at once showed an empty PowerShell prompt. A short `wait` after the click (0.5 s) and a slide (0.9 s) bring the camera there when the command is running.
- **`record --to <scene>` leaves `takes.json` with the scenes up to it**: the later takes and clips are gone. `compose` then refuses until a plain `record` has shot the rest.
- **An empty `.srt` is written for a video with no voice.** `compose` writes it anyway.
- **Typing costs more than `typeDelay`.** The real keyboard adds about 25 ms a key: 46 characters at 45 ms took 3 s, not 2.1. Budget a scene from its `takes.json` duration after a first shot, not from the sum of its actions.
