# Demo videos — projects and travel log

> [!NOTE]
> **For the human reviewer**
>
> - `site/video` turns a story into a narrated mp4: `storyboard.md` (Italian, source of truth) → `storyboard.yaml` (English, written by the editor's LLM per [README.md](../README.md)) → TTS → scripted takes → ffmpeg cut.
> - `stamp`/`check` tie the two files scene by scene: when the `.md` changes, every production step stops until the YAML is adapted.
> - Playwright drives the installed Chrome: the app (`vite dev` of a copied demo) and VS Code via `code serve-web`, isolated in `.cache/`, with the repo's extension.
> - Layout: `projects/` (one folder per video, with its `log/`, and this file), `commons/` (the machinery: `cli/` the pipeline, `layout/` the card forge, `components/` its prototypes, `test/`, `bkmusic/`). Standalone package, not a workspace.
> - This file is the travel log: one entry per working session, newest first, and the state of every project at the top.

> [!IMPORTANT]
> Every `tts` run without `--silent` spends on OpenRouter (a few cents per video; unchanged lines are cached). Videos never go in git: the mp4 goes to YouTube, the repo keeps `poster.jpg` and the `.srt`.

**Goal:** demos that can be rebuilt after every release: same story, same takes, new UI. A changed sentence costs one TTS line and a re-run, not an afternoon of screen recording.

## Where things stand

| | |
| :- | :- |
| Pipeline (`commons/cli/`) | check, stamp, tts, record, preview, compose working end to end; voice levelled to -16 LUFS in `compose`; hand-drawn marks (`mark`, `unmark`, `all` for a table column); background music ducked under the voice, credits on the closing card, `toEnd` to close on the track's own ending (never looping), `delay` for a later entrance; the video's `fade` from the YAML; stages `split-panel` (terminal under both pages) and any web page in the app (`url`, `anchor`, `storage`, `preload`), `scroll` (`ease: sine` for a whole page); the final encoded once in two passes, up to `output.mbPerMinute`; **a camera** (a 16:9 crop that glides, `camera`, measured while shooting and applied in `compose`), **a cut** (a scene's `before`, played unfilmed), **speed changes** (`speed: 2` … `speed: 1`: a stretch shown quicker or slower, in scenes with no voice), **a vertical 9:16 frame** (`stack`: three 16:9 windows in a column, one VS Code page cropped in two), **a tower** (`tower`: the same three windows in a tall frame of a 16:9 video, the camera sliding over them with `camera: { window }`, jumps included) **a GIF output** (`output.gif`, two passes from the segments, `colors` for the weight) and **a web video output** (`output.web`: a muted mp4 and webm and a webp poster, for a page's loop); subtitles broken on pauses; `--silent` keeps the real lines still valid; every run followed live (`live.mjs`, the VS Code task **video: live**); partial takes from the first changed scene, a strip of frames per scene; **the card forge** (`commons/layout/card.html`: knobs, the site's tokens, adaptive layout, GSAP on one timeline; five prototypes in `commons/components/` with their sheets and variants; `card: <name>`, `look`, `anim`; `node commons/cli/card.mjs` and its gallery); **probes** in every frame, webviews included (`log/probe.jsonl`, warnings under the scene, `--probe`, `--strict`) |
| [quickstart](quickstart/storyboard.md) | the README quick start in 7 scenes, about 55 s: YAML stamped, recorded at 1920×1080, 30 fps; voice still mute |
| [quick2](quick2/storyboard.md) | converted again from its `.md` (the YAML had been deleted) on the forge's `title` and `outro`, Ada's app with the buttons under the sentences. Real voice, six marks, music with a 4 s close, cut in `output/` at 1920×1080 captured at device pixels: **57.8 s**, no warnings. Web video for the landing: `output/gif20t.web.mp4` **601 kB**, `.web.webm` **341 kB**, `.web.webp` poster **7 kB** (960×540, 30 fps, no sound). Waiting for the user's viewing |
| [compare](compare/storyboard.md) | "Why viteTranslate", 19 scenes, real voice, cut in `output/`: 181.2 s, ending with the track (which comes in at 2 s); the coffee afterthought with a stamp and a QR on the closing card. 91 MB, near-lossless. Waiting for the user's viewing. The takes and `preview/` now wear the forge's cards (181.2 s); `output/` is still the old cut |
| [compare2](compare2/storyboard.md) | compare on the forge's cards, with `{name}` in the new sentence, voila's round trip EN → FR, the stamp top right and no QR. Real voice (compare's lines, same text), cut in `output/` at **1920×1080 captured at device pixels** (no upscaling): 188.2 s, 28 MB a minute, 7.0 s past the track (llm-preview took 9.3 s). No warnings. Waiting for the user's viewing |
| [gif20t](gif20t/storyboard.md) | the same story on **a tower**: three 16:9 windows one above the other in a tall frame (**preview** on top, **code** in the middle, **terminal** below) and a camera that slides over it, one whole window at a time, no zoom and **no jump**: every shift is a slide. It starts on the preview, slides down to the code (the typing), back up to the sentence in English, which a **wavering square** (`mark`, a box with a bigger tremble) puts in evidence; slides down again to the code for the click on Translate, slides on to the terminal a moment after it, where the run goes at 1.5×; slides up (two windows) to try Français, then English. The terminal's type is 15 (5% under the stage's 16: the report no longer fills the window to its last column and doesn't wrap). The closing card has the claim (**One toolchain. Every user's language.**) and, close under it (line spacing 160%), VS Code · Vite · LLM · React in cyan (`--accent-2` at 80%) with the middle dots, lighting up one after another (`title` with `words`). Speed as gif20, the run at 1.5×. Final cut: `output/gif20t.gif` **800×450, 12 fps, 29.8 s, 64 colors, 2.9 MB**, looping, plus the mp4 **29.9 s, 14.8 MB** (the length moves with the LLM's run: 26 to 30 s). No warnings. Own fixture (a copy of quickApp with an `llm` block). The first GIFs (gif10, gif20) and the vertical prototype (gif20v) were removed at the user's word: their work lives in the pipeline and in the log below. Waiting for the user's viewing |
| Real voice | works: the key is in `site/video/.env` (git-ignored) |
| Tests | `npm test`: storyboard (`card`, `look`, `anim`, `before`, `camera`, `output.gif`, the vertical output, the tower), the camera and the speed changes (`camera.mjs`'s and `speed.mjs`'s pure functions, their filters run by a real ffmpeg, the tower's pan checked on colored bands, the GIF and the web video), the forge in Chrome (scales, knobs, tempo, every variant, grids, subgrid, still, anim, repeatability), the probes. The rest of `commons/cli/` is checked by running it and reading frames |

## Next

- [ ] **gif20t**: the user watches `gif20t/preview/gif20t.mp4` (29.9 s) and decides: the slides (0.9 s a window, 1.3 s for two), the holds, the wavering square on the added sentence (1.5 s), the slide to the terminal 0.5 s after the click and the run at 1.5×, the terminal's type 15, the French and English, the words under the claim (cyan, 0.5 s apart). Composed at the user's word: the GIF at 12 fps, 64 colors, 2.9 MB, its type reads at 800 px (checked on frames of the code, the terminal, the French page, the card). 48 colors would be 2.6 MB and 32 colors 2.3 MB, but from 48 down the orange of the report's "1 key(s) missing" goes green; 96 is 3.4 MB. The length follows the LLM's run (4 to 8 s shot): it could be fixed by shooting the run once and reusing it, or accepted.
- [x] **The cut, the camera, the speed changes, the GIF output, the vertical frame and the tower**: done, see the log (2026-10-19).
- [ ] **The landing's translations:** six new `<Trans>` keys in `HeroVideo.jsx` are `null` in `site/landing/locale/en-US.yml` and `zh-CN.yml` (the page shows the Italian source until then). Run them: `cd site/landing && npx vitetranslate --llm-translate` (`--llm-dry-run` first). Then the user looks at the band on a real phone.
- [ ] **Decide what git keeps of gif20t's output:** `output/gif20t.gif` (2.9 MB, and a copy in `doc/workflow.gif`), `poster.jpg` and an **empty** `gif20t.srt` show as new files; only the mp4 is in `site/video/.gitignore`. `compose` could skip the `.srt` when no line has a voice.
- [ ] `compare2` and `quickstart` don't load (fixture deleted, folder gone): see the item below. Not caused by the camera work.
- [ ] **The first forging:** compare again with the new prototypes, looked at and tuned card by card (`node commons/cli/card.mjs <project> <scene>`), then a new cut. quick2: done.
- [ ] **compare2's fixture is gone from the working tree:** its YAML points at `site/video/projects/compare/fixture`, deleted with the rest of `projects/compare/`. Its next `record` fails until the fixture moves (into `projects/compare2/fixture`, say) and `fixture:` follows.
- [ ] More prototypes as the stories ask for them (a numbered `steps` took 9 lines in the review).
- [ ] The user watches `compare2/output/compare2.mp4`: the `{name}` sentence, voila's round trip, the stamp top right, the silence at the end.
- [ ] The probe on `key Enter` in a new terminal warns in about half the takes with the keys arriving (compare2's `build`): find why it doesn't always hear xterm's input.
- [ ] The probes' overlay selectors not met yet in a take: `.find-widget.visible`, the context menu.
- [ ] The user watches `compare/output/compare.mp4`: code and page in step, the restaurant's scroll, the coffee line's tone, the stamp.
- [ ] Scan the coffee QR from the screen with a phone (`commons/components/outro/coffee-qr.svg`: it should open buymeacoffee.com/giancarlogy).
- [ ] The site scenes hang on the published site and the network: a change to the site can move what they click (README § "On stage" lists it).
- [ ] `tts` warns "0.9 words/s" on `voila`, one word: the sampleRate check could skip lines under three words.
- [ ] Check that **video: live** starts with the folder: reopen the repo, and if VS Code asks, allow automatic tasks.
- [ ] Watch `quick2/output/quick2.mp4` (57.8 s, a little over the 55 asked): the music levels (`max`, `min`), whether six marks are too many, and against the user's copies (`quick2 - Copia*.mp4`).
- [ ] Less mechanical joins between lines, one try at a time: direction notes and punctuation in the conversion; then the neighbouring lines as context (a `voice.context` option); last, the whole narration in one call, cut on its silences.
- [ ] Real voice for `quickstart`: `node commons/cli/run.mjs quickstart all`, then re-time its waits as done for `quick2`.
- [ ] Split scenes cut long code lines on the right: try `split: 0.66` or a lower `zoom.vscode`.
- [ ] Swap the YouTube video in the root README once the cut is approved (`doc/youplay.png` could become `poster.jpg`).
- [ ] Small node tests for `subject.mjs` (parse, check, stamp), the rest of `storyboard.mjs`'s validation, `tts.mjs` (WAV header, trim) and the SRT builder.
- [ ] Phase 2: translate the narration with viteTranslate itself and render the video per language.

## Log

Newest first. An entry: what was done, what was decided and why, what is left. Warnings in **bold**.

### 2026-10-20 · A new claim on gif20t's closing card

- The user's question: "One workflow. From code to every language." read on its own, in English, can suggest translating *code* into other programming languages (*language* is both; the Italian *lingua* and *linguaggio* kept them apart). The user proposed **"One toolchain. Every user's language."** and asked to revise it everywhere. Agreed: the claim names the four tools that stand right under it, and says whose language it is. It sits on one line in the card.
- **What changed here:** `gif20t/storyboard.md` (the `Idea` line and the `pillars` scene, edited at the user's word, "everywhere": rule 2 of the README), `storyboard.yaml` (`pillars` params, stamped again), the forge's `title` sheet and its `claim` variant, and two field notes of the README that quoted the first claim (now said to be the first one). Outside this folder: the root `README.md`'s headline, the GitHub social preview (`doc/social/`), the campaign notes.
- **Shot:** `record compose --from pillars`. Only `pillars` was filmed (4.4 s); `write`, `translate` and `french` stay as they were, so the approved cut and the LLM's run don't move: still **29.9 s**, GIF 800×450, 12 fps, 64 colors, 2.9 MB, web mp4 **602 kB** (was 601), webm 341 kB, poster 7 kB, unchanged. Copied byte for byte to `doc/workflow.gif` and `site/landing/public/video/workflow.{mp4,webm,webp}`.
- **Warning:** the first `--from pillars` **failed**. In the fast-forward of `write` the new line was typed in the wrong place (`setup: goto 9: the cursor is on line 1`; the stage took 48 s to set up that time, with VS Code in Restricted Mode twice), `App.jsx` no longer parsed, `--llm-translate` refused to scan and `waitFor "Full translate!"` timed out at 90 s. `output/` was not touched. A second run, identical, went through (setup in about 14 s). Not investigated beyond that: it looks like a slow start of VS Code, not the claim. If it comes back, `goto` could wait for the editor to be ready, or the fast-forward could be skipped when every scene left to shoot is a card.
- **Left:** the user watches the new closing card (`gif20t/output/gif20t.mp4`, last 4.4 s). The landing's hero text and meta description still say their own version of the pitch (outside this folder).

### 2026-10-19 · The landing's loop: the hero's video band

- The user's idea, after seeing `gif20t.web.*`: do as the README does (the loop on top, a text link to the full video) instead of the YouTube thumbnail. I agreed, and said I had weighed the hero CSS comment too much: the band is under the hero, not beside its text. Confirmed with the click as pause/resume and the caption `In 30 secondi · Una frase, quattro pezzi: VS Code, Vite, LLM, React. · Il video completo su YouTube ↗`.
- **What changed** (`site/landing`): `HeroVideo.jsx` shows a `<video muted loop playsInline preload="none">` (webm, then mp4, the webp as poster) in the same 16:9 screen; an observer plays it at 40% in view and pauses it out of view; `prefers-reduced-motion` doesn't start it; the round button (and a click on the screen) pauses and resumes, and the reader's pause holds when it comes back. The YouTube link is in the caption, as a bordered pill. The play button, its pulse and `poster.webp` (95 kB, the YouTube thumbnail) are gone. Files: `public/video/workflow.{webm,mp4,webp}` = `gif20t.web.*` (341 + 601 + 7 kB). Their LINKED-DATA comments are in the component, in `site/README.md` (§ The video in the hero, rewritten) and in the gif20t YAML.
- **Checked in Chrome** (Playwright, the built site on a preview server): plays in view (the webm), the toggle pauses and resumes, a pause holds on re-entering the view, out of view it stops, reduced motion doesn't start it and the button does, no errors; at 390 px the band is dark in both themes; the toggle shrank on narrow screens (36 px, 44 on wide).
- **Translations:** the plugin wrote six keys (`HeroVideo_*`): Italian in `it-IT.yml`, `null` in `en-US.yml` and `zh-CN.yml`, and dropped the three old ones. Not translated by hand: the user runs viteTranslate. Until then the English and Chinese pages show the Italian caption (seen in the check).
- **Warnings:** the loop is 341 kB (webm) against the 95 kB poster it replaces, loaded only when the band comes near the screen; the type of the code is small on a phone (the story reads from the shapes, the caption explains).

### 2026-10-19 · output.web: the video for a web page

- The user's request, after the GIF went into the root README: the landing too. My answer: yes, as a muted looping `<video>` and not as a GIF (2.9 MB against the landing's 95 kB poster; a GIF can't be paused or stop on `prefers-reduced-motion`), in `Steps` and not in the hero. Then: add the parameter to `compose` and see the file.
- **`output.web: { width, fps?, crf?, webm? }`** (`storyboard.mjs` checks it, `videoWeb()` in `compose.mjs` makes it, README § Web video): from the near-lossless segments, as the GIF, an mp4 (x264, `crf` 30 of serie, `faststart`), a webm (VP9 at `crf + 8`) and a webp poster (the project's `poster` frame, or the first); no sound. `width` even, 160 to 1920. Left out of the stage fingerprint (`record.mjs`) like `gif`; `output/*.web.*` is in `site/video/.gitignore` (the page keeps its own copy). `run.mjs` prints the files. 6 new tests (144 in all).
- **gif20t:** `web: { width: 960 }` → `gif20t.web.mp4` 601 kB, `.web.webm` 341 kB (both 960×540, 29.87 s, 30 fps, no audio stream), `.web.webp` 7 kB. The text of the terminal reads at 960 px.
- **Found:** the project's poster (`poster: { scene: french, at: 2 }`) showed the page still in English: since the camera moves and the click comes later the French appears about 2.7 s into the scene. `at: 3.5` (the page in French, the pointer on Français). `poster.jpg` and the web poster follow.
- **Then:** the landing's component (the next entry up). **Side effect:** `record.mjs` changed (a destructuring and a comment): it is in the stage fingerprint, so the next `record` of any project shoots everything again; `compose` is not affected.

### 2026-10-19 · Only gif20t stays: gif10, gif20 and gif20v removed

- The user's request: delete gif10, gif20 and gif20v, keep gif20t, and copy its GIF into the root `doc/`. They were untracked in git, so what was in them is gone for good: their stories live in the log entries below, their work in the pipeline.
- **gif20t** had its fixture in gif20's folder: it moved into `projects/gif20t/fixture` (a copy, identical byte for byte) and `fixture:` follows. The fixture's content is what the takes' fingerprint hashes, so they stay valid: no new `record` needed. Its storyboard (`.md` and YAML) no longer cites gif20; `check` and `stamp` run clean.
- **The README** (site/video) lost the project names: the weights are gif20t's (3.4, 2.9, 2.6 and 2.3 MB at 96, 64, 48 and 32 colors) with the earlier zooming GIF's numbers kept as a comparison; the field note on speed names gif20t.
- **`doc/workflow.gif`:** a copy of `output/gif20t.gif` (800×450, 12 fps, 64 colors, 2.9 MB), for the repository's docs, shown at the top of the root `README.md` (above a text link to the YouTube video, in place of its thumbnail). The two carry LINKED-DATA comments: compose again, copy over, and the README follows. The extension's README (`packages/idePlugin/README.md`) doesn't show it: the Marketplace wants an absolute URL.

### 2026-10-19 · gif20t: the tower, three windows and a camera that slides

- The user's request: gif20v was only a vertical arrangement of VS Code's windows, not of the final output. Rethink: a canvas of three 16:9 windows (preview on top, extension and code in the middle, terminal below) and a camera that starts on the preview, **slides down** to the code (the user fills a new line), **slides up** to see the addition still in English, **jumps** (no transition) to the middle window where Translate is pressed, **jumps** to the terminal for the run, **slides up** to try the interface in French and English, then the closing card. Also: under "One workflow. From code to every language." a second line, the four terms appearing in sequence (not the small note). Then: always the preview first; the final GIF at 12 fps, optimized, only when the user says.
- **Pipeline:** a stage `tower` (16:9 output): the director builds the same two views as `stack` (the app; VS Code once, as tall as two windows plus the status bar) with the windows in a tall frame of 1920 × 3320 (`TORRE`, 40 px of black between windows), `take.tela` in `takes.json` says so, `compose` assembles the clips on it and `filtroPan` crops the window. The camera takes `window: preview | code | terminal` (and `keep`); `time: 0` is a jump. **No zoom:** `zoompan` crops in the aspect of its input, a tall frame isn't 16:9, so the tower's camera is `crop` with an expression for y (pan only; target, `full`, `width`, `pad` stop the YAML). The panel's margin follows the zoom (the status bar peeked under the terminal at zoom 2). README § Tower; 12 new tests (136 in all).
- **The card:** `title` has a `words` param (a second line under the claim, its words light up one after another, `at` for the times), made from `parts.words` with a `role` option (body size under the lead). A variant `claim` in its sheet. gif20 and gif20v keep the small note.
- **gif20t:** four scenes (`write`, `translate`, `french`, `pillars`), zoom 2 for VS Code and the app (a window is 960 × 540 CSS px, like the split of gif20, so the type reads at 800 px), the panel under the sidebar (command in `setup`). After the first preview the user asked, in turn: **an arrow** on the added sentence when the camera climbs back (the README's minimum 1.5 s, a second would have warned; from below it crossed the English button, so `mark` got a `from` option, `from: right`); and, after the click, **a moment then a slide** to the terminal with the run at **1.5×**. Then, seeing it: **no jumps at all** (the translate scene opens on the preview and slides down to the code), **a wavering square instead of the arrow** (`shape: box`, `boil: { size: 2.6, rate: 8 }`, `wobble: 1.2`), **the terminal's type 5% smaller** so the report doesn't wrap, and **the card's words close to the claim** (line spacing 160%). Last: the words in **cyan, `--accent-2` at 80%**, the middle dots between them, closer together (`.stack.claim` in card.css; the 80% is in `color-mix`, not `opacity`: `pop` and `light` animate it up to 1). The `from` option stays in `mark` for the next arrow. Then, at the user's word, `compose`: **`gif20t.gif` 800×450, 12 fps, 29.8 s (358 frames), 64 colors, 2.9 MB** (two passes, bayer 5; 32, 48 and 96 colors tried: 2.3, 2.6 and 3.4 MB; 64 kept, from 48 down the report's orange highlight goes green), and the mp4 **14.8 MB**.
- **Found:** a 16:9 crop of a tall frame can't be a `zoompan`; at zoom 2 the status bar (44 px) peeked 8 px under the terminal window (margin 40); right after the click the terminal still shows its old prompt (the new tab opens a moment later). **A wrong baseline:** the terminal's type was said to be 14 and 5% less 13.3; the stage's default is 16 (`VSCODE_SETTINGS`), the terminal takes whole sizes (13.3 → 13, which is 17% under 16 and left the report in half the window). 5% under 16 is 15.2, so 15. At 16 the window holds 104 columns and the report fills them (a line to the last column can wrap); at 15 it holds 111.
- **Warnings:** the GIF at 800 px shows a 1920 window at 0.42: the type is 12 px, readable on the frames I looked at, but a phone's small screen is the test; the pan is integer-pixel (`crop`), fine at 0.9 s but a very slow slide could stair-step; `capture/strips/` shows the whole tower, not what the camera sees; the length depends on the LLM's run, which changes from take to take (this one took 8 s shot).

### 2026-10-19 · gif20v: the first vertical video, three windows in a column

- The user's request: stack the three windows (Code, Preview, Terminal) vertically, each 16:9, the terminal's zoom chosen so its whole string shows, not necessarily 100%. It answers `note_internal.md` row 26 (YouTube Shorts / Reels / TikTok: "pipeline solo 16:9: decidere"). Asked, answered: **a 9:16 frame** (1080×1920) in the pipeline; **one VS Code page, two crops** (not two VS Code pages: the task's terminal isn't shared between pages); **a direct prototype**, no plan.
- **Pipeline:** `FRAME_VERTICALE` and `frameDi(output)` (`storyboard.mjs`: `output` can be 9:16, even, at least 1080×1920); a stage `stack` (only in a vertical output; a vertical output has only `stack` and `card`; no `camera` there); `palco` builds it: VS Code as tall as two windows plus the status bar, the app 16:9, then drags the panel's border to one window's height (`pannello({ cima })`); the views carry `finestre` (windows with their place and a `crop` of the clip); `takes.json` lists each window; `impagina` crops (`crop=w:h:x:y` before the scale) and lists the same file twice. `card.mjs <project> <scene>` uses the project's frame. README § Vertical; 7 new tests (124 in all).
- **Found:** the panel beside the sidebar made the terminal window narrow: lines wrapped and were cut. The setting `workbench.panel.alignment: justify` did nothing; the command `View: Set Panel Alignment to Justify` in the `setup` did, and the report fits in 900 CSS px with the terminal's type at 14 (13 left 12% free; 16 wraps). On the card, the claim broke after "From": `look: { type-scale: 0.7 }`.
- **gif20v:** four scenes (`write`, `translate`, `french`, `pillars`), no camera, speed as gif20, the claim on the card. Preview **19.3 s**. Not composed: waiting for the user.
- **Warnings:** the 14 px terminal type is small on a phone (1080 px shown at ~390 pt); `stack` windows are cropped from one clip, so the strips in `capture/strips/` show them composed, not the page; the GIF at 480 px is heavy (not measured).

### 2026-10-19 · gif20: gif10 at 20 seconds, with the pull back

- The user's request: ten seconds is too rushed; copy the storyboard to a new project, 20 s, with a zoom-out movement for the camera's shifts, and use cinematic timing sensibly. `projects/gif20/storyboard.md` (Italian) is gif10's, rewritten for the rhythm; the fixture is a copy of gif10's; no change to the pipeline for the movement: `rect: [0, 0, 1920]` with `time` and `ease` is already a valid `camera`.
- **The motif:** each of the three shifts (code → browser, browser → panel, terminal → browser) is a pull back to the whole frame (0.55 s, `sine`), a breath at the wide (0.25 s) and a push in on the next target (0.7 s, `cubic`). Out quicker than in. Each new framing holds for what the eye has to read: the typed line 0.9 s, the new sentence 1.1 s, the Translate row 1.1 s, the terminal's result 1.3 s, the French 2.2 s. The closing card is no longer `still`: the logo and the line come in, 2.5 s.
- **The whole frame is seen now, but only in passing and in the card:** the gif10 `.md` said "only in the card". The new `.md` says where it appears.
- **Timing:** first shot 21.1 s. The real keyboard costs ~25 ms a key more than `typeDelay`, so `write` ran 1 s over its sum. Trimmed without touching the reading holds (`typeDelay` 45 → 38, a 0.1 s here and there, the card 2.7 → 2.5): **20.23 s**.
- **GIF weight:** 5.3 MB at 256 colors, over the plan's 5 MB. The plan's first fallback, a coarser dither (`bayer_scale` 3, 2), went the wrong way (5.8, 6.0 MB). Measured: 128 colors 4.4 MB, 96 colors 4.1, 64 colors 3.7, 10 fps 4.7, 128 colors at 720 px 3.8. A side-by-side of the frames at 256 and 128 colors: the same at 800 px. **New optional key `output.gif.colors`** (2 to 256, 256 left out: gif10 doesn't change), checked in `storyboard.mjs`, applied by `gif()` in `compose.mjs`, two tests, README § GIF. gif20 uses 128: **4.4 MB**. Not recomposed gif10 (2.1 MB).
- **Speed instead of the cut** (the user, after seeing the idea: a jump after the click on Translate isn't understood). New action `speed` (`commons/cli/speed.mjs`, pure functions): `speed: 2` … `speed: 1` marks a stretch of the clip that the video shows quicker (or slower). The director saves the keys in `takes.json` in shot seconds; `compose` remaps the time with a piecewise `setpts` after the camera (its glides go at the same speed) and the scene's length in the video is the shot length divided. `do` stays in real seconds. Decided: **only in scenes with no voice** (it would put the voice out of step; an error otherwise), a scene starts at 1×, not in `setup`/`before`. Proof with ffmpeg's burnt-in timecode: the filter maps 1.5 s of a clip to 1.25 s of video, 2.5 s to 2.0 s, as the math says.
- **gif20 with speed:** no `before`. Typing at 1.5×; `speed: 2` for the pointer's arrival, the click, the camera down to the terminal and the run, then 1× on the result. The LLM's run takes about 2 s shot and is seen in about 1.2 s: the command starts, the report builds, `✔ < 1 new key français. Full translate!` lands. `write` 7.3 s shot, 6.2 in the video; `translate` 7.7 → 5.8. The user then found the run at 2× too fast to follow (1.2 s): **the run is at real time now** (about 2.5 s, legible), only the pointer's way stays at 2×; the terminal's crop widened to `[680, 652, 760]`. The closing card carries the claim (`title`: "One workflow." white, "From code to every language." green; the four pieces as a small note, 3 s). **Final: 21.1 s, 4.4 MB at 64 colors** (96 colors: 5.0 MB; the frames at 96 and 64 look the same at 800 px).
- `music.toEnd` counts shot seconds, not video seconds (documented in README § Speed): only matters for a video with music and speed.
- Tests: `npm test` 117 (102 at the start of the day, 104 after `colors`): `speed.mjs` (runs, lengths, the filter run by real ffmpeg, slow motion), the storyboard's rules. Dry-run of `npm run commit` was OK before `colors` and `speed`; run again at the end.
- Left: the user's viewing; the same two decisions of gif10 about what git keeps of `output/` (gif20's gif is 4.4 MB; the empty `.srt`).

### 2026-10-19 · gif10: the cut, the camera and the GIF output, shot

- **Pipeline** (three optional keys: whoever doesn't use them sees nothing change). A scene's `before` plays after the stage is set and before the recorders start: the LLM's wait is never filmed. A virtual `camera` (`commons/cli/camera.mjs`, pure functions): the scene's `camera:` is its first frame, the `camera` action glides (0.5 s, cubic) without waiting; the director measures targets while shooting, `compose` applies a `zoompan` over the frame doubled. `output.gif: { width, fps }`: after `compose`, a looping GIF in two passes from the segments, not in the stage's fingerprint. README: Camera, Cut, GIF, the tables for the `.md` and the conversion.
- **gif10** converted: fixture `projects/gif10/fixture` (quickApp, an `llm` block on OpenRouter's deepseek-v4.1-flash, `costGuard`), four scenes, `fade: [0, 0]`. Result: **10.7 s, GIF 800×450 at 12 fps, 2.1 MB, loops; mp4 8 MB**. No warnings. Checked on the GIF's own frames: legible code, terminal line and French; no flash of the whole frame at the joins (glide into `translate`, hard cut into `french`, clean entry of the card).
- **Asked the user, answered:** the three scenes moved from `split` to **`split-panel`** (their `.md` edited with their go-ahead): in a split the terminal is 62% wide, the LLM's line wraps and `waitFor` never found it (the first take timed out after 90 s). `camera.mjs` stays out of the stage's fingerprint (a compose-only change doesn't re-shoot; a change to `inquadra` needs `--full`).
- **Found:**
  - the model thought for 92% of its output and the run ended on a warning box: `providerOptions: { reasoning: { enabled: false } }` in the fixture, the run now takes under a second;
  - the panel a split-panel opens brings a terminal that takes the focus (cursor hidden, keys gone): a `before` in `write` focuses the editor;
  - a crop aimed at text in the app is clamped and drags a strip of code in: `rect`s measured on the strips instead;
  - `record --to` drops the later takes and their clips;
  - the plan named commit `580676a` for compare's old fixture: it is in `580676a^`.
- **Not shot again:** `quick2` and the others. Every project's next `record` shoots everything (`director.mjs` and `record.mjs` changed).
- **Warnings:**
  - **`compare2` and `quickstart` don't load** (fixture deleted, folder gone): already so before this work (item in "Next");
  - **the live view's task** (`video: live`) was left open by an older session with the path `uty/live.mjs` and fails: close that terminal and run the task again;
  - `output/` now holds a **GIF, an empty `.srt` and a poster that git would add**: asked, in "Next".
- Left: the user's viewing of the GIF. One cosmetic point: the terminal's crop (`rect: [710, 765, 560]` in `french`) cuts the command at its left edge, so it reads `-translate`.

### 2026-10-19 · gif10: the campaign GIF, story only

- The user's request: a 10-second GIF, simple and effective, written for the communication campaign (one workflow, from code to every language; the ecosystem VS Code · Vite · LLM · React as the distinctive trait). `projects/gif10/storyboard.md` written: four scenes, `write` → `translate` → `french` on one split, then the `pillars` card (1.5 s).
- Decided with the user: the LLM's wait is cut (compare2's live run took 9.3 s, the whole GIF has 10); 800 px wide, 12 fps, a camera that zooms where the attention goes (a full 1920 frame is unreadable at 800 px); a closing card with the logo and the four pieces, so the GIF carries its name when shared alone.
- Translate runs the sync itself (`--llm-translate`: "Sync, then fill the null keys"): no Sync click.
- `french` opens on the terminal's last line for half a second: proof that the cut hides no trick.
- **Not converted:** no `storyboard.yaml` until the pipeline has a cut, a camera and a GIF output, and the project has its fixture (in "Next").

### 2026-10-13 · quick2 converted again and cut

- The user's request: generate the video following the README. quick2's `storyboard.yaml` (and `audio/`) had been deleted: `check` said "no storyboard.yaml yet", so a full conversion. **Not blind:** the agent saw the old YAML in git while reading the folder; the new one follows the README and § "On stage", and ends up close to it.
- New against the old YAML: the cards are the forge's prototypes (`card: title`, `card: outro`), `app.style` is `@commons/layout/app-dark.css`, the setup waits for Project's Sync button (60 s) as compare2's does, `app` waits for "Bon retour" before its hold.
- Silent rehearsal, 58.6 s: one warning, `null` circled 1.3 s in `sync`, `hold` 1.6. `translate`'s box touched the buttons under the sentence (they now follow the JSX): `pad: 14`.
- Real voice at the user's request (7 lines, 45.4 s of speech), then the waits re-timed on its pauses (`silencedetect`): app 1.9, write 1.8, fallback 4.4, sync 1.5.
- `all`: every scene shot again (every line's voice changed, so every fingerprint), no warnings; write and sync's actions run 0.4 and 0.7 s past the voice, on their marks. `output/quick2.mp4` 57.8 s, 12 MB; `.srt`, `poster.jpg`, `credits.txt` written.
- **compare2's fixture** (`projects/compare/fixture`) is deleted in the working tree: in "Next".

### 2026-10-13 · compare2 back to Full HD, at device pixels

- The user's choice after the 2K take: 1920×1080, captured directly, no upscaling. compare2's `output` line removed.
- Full take with no warning at all (no short marks, no `key Enter`). Visibly sharper than compare's old 1080p (same crop of `fallback`: no halos around the letters). 86.8 MB for 188.2 s: **28 MB a minute**.
- README § Resolution recommends 1920×1080 at device pixels (the user's choice): sharp, the tuned pace, 28 MB a minute. Not written as "sharper than 2K": that pair was never compared with both captured right.
- 7.0 s past the track: llm-preview 9.3 s (7.8 in the best take), extension 0.8 s longer than with the old capture. A faster LLM take (`record --from llm-preview`) would bring it to about 5.5 s.

### 2026-10-13 · Capture at device pixels

- The user saw no gain from 2K and suspected the capture. Measured: with the scale factor only emulated by Playwright, Chrome's screencast sends CSS-sized frames (VS Code at zoom 1.2: 1600×900), which the recorder upscaled, at 1080p as at 2K. Compression was a small loss next to that.
- Fix (user's choice, 2K kept for now): a Chrome per page with `--force-device-scale-factor` = its scale, and the same `deviceScaleFactor` in the context (with the flag alone `devicePixelRatio` read 1). The recorder crops the pixel of rounding and gives the screencast a margin, so nothing is resampled.
- compare2 at 2K: code and app visibly sharper (same crops, old vs new); scrolls as smooth (restaurant 261 distinct frames, 235 before); **33 MB a minute** (46 before: the blurry upscale compressed worse).
- **The cost:** actions slower at 2K, 1–2 s more in write, extension, translate, restaurant: two marks under 1.5 s (`write`'s row, `build`'s `fr-FR-` box) and a 191.9 s video, 10.7 s past the track (llm-preview 10.1 s too). Not re-timed yet: first decide 2K or 1080p at device pixels.
- **Every project's next `record` shoots everything** (the pipeline changed): compare and quick2 get the sharper capture at 1080p too, and their timings may shift a little.

### 2026-10-13 · 2K output, same layout

- The user's request: compare2 in 2K rather than Full HD, proportions unchanged, 30–60 MB a minute.
- Every video is drawn on a 1920×1080 frame (`FRAME` in `storyboard.mjs`); a bigger 16:9 `output` multiplies each page's deviceScaleFactor by `output.width / 1920` (`k` in `director.mjs`) and leaves its CSS viewport as it was. Marks and `offset` stay in frame px, so they grow with the rest. Any other shape stops the YAML; two tests.
- compare2 at 2560×1440: full take with no new warning, scrolls as smooth as at 1080p (same count of distinct frames), the layout identical (frames checked). 141 MB for 185.9 s: **46 MB a minute**, under the 60 ceiling. `compose` 3 min instead of 2.
- README: § Resolution, and the frame named where sizes were "video px". **`record` of compare2 now shoots everything** whenever `output` changes.
- `build`'s `key Enter` probe warning came back (2 takes of 4): still a false alarm, the build ran.

### 2026-10-13 · compare2: stamp top right, no QR, a sentence with a value; the `corner` param

- The user's request on compare2's `storyboard.md`: no QR at the end, the "open source" stamp top right. The `.md` was edited at their request.
- The forge couldn't move the stamp: it gained a common param, `corner` (`bottom-right` by default, `top-right`, `bottom-left`, `top-left`; anything else stops the card), in `parts.js` and `card.css`. Sheets updated, outro's variant `stamp-top`, two tests. Other videos don't move.
- New README rule 11, "Parametrize, don't patch": what a story asks of a card becomes a param of the components, the old behavior as default.
- compare2's new sentence: `<b>{name}</b>, you have new messages.` instead of "You have three new messages.". A number in words read as "translate it all, word for word"; `{name}` (the prop the app already has) shows a value coming in from outside, untouched in French. No count, so no plurals to explain. The narration of `write` stays as it is (the user's choice).
- compare2's `voila`: after the French, a round trip English → French, each language still for 1.5 s and the pointer seen travelling (~0.5 s): about 6 s, to win back from other scenes' waits, since the video still ends with the track.
- **compare2 forged.** The YAML is compare's, scenes the `.md` didn't change kept as tuned; changed: `write`, `fallback`, `translate` (the `{name}` sentence: Results rows matched with their glyph, so the editor's line doesn't match too), `voila` (the round trip), `coffee` (`corner: top-right`, no `qr`). Fixture: compare's own, shared. `audio/` copied from compare: same lines, real voice at no cost.
- `write`'s circle lands 0.2 s earlier or later, as the panel shows the row: `hold: 1.1` keeps it whole 1.5 s.
- **Time.** The round trip adds ~4 s and compare had 0.3 s of slack. The agent first proposed `music.start: 4`, wrongly: `start` shortens the track, `delay` would lengthen it. The user chose to leave the music as it is: a short silence at the end, under the fade. The `.md`'s Durata and voila note say so now.
- **The LLM's pace moves the end:** llm-preview took 7.7, 11.9 and 7.8 s in three takes; with 11.9 the video ran 8.4 s past the track. A slow take is worth re-shooting `--from llm-preview`.
- `build` warned once `key Enter: no key reached the page`, while the build ran (strip checked): a probe false alarm in the terminal, not in the two takes before.
- The coffee link can go in the YouTube description.

### 2026-10-13 · compare2: a copy of compare's story

- The user's request: `projects/compare2/` with compare's `storyboard.md` only; another session converts it and builds the rest. Its fixture can be compare's own copy, `site/video/projects/compare/fixture` (the `.md` asks for "a copy of its own" of the quick start, with the language buttons first).

### 2026-10-13 · Tidy up: everything shared under commons/

- The user's request: `site/video` holds `commons/` (the machinery) and `projects/` (the videos). `uty/` → `commons/cli/`, `test/` → `commons/test/`, the whole forge (`card.html`, `card.css`, its four scripts, `darkStyle.md`) and `app-dark.css` → `commons/layout/`. Nothing was unused, nothing removed. The user picked the whole forge in `layout/` over splitting its css/html from its scripts.
- Commands are now `node commons/cli/run.mjs …`; `npm run video`, `npm test` and the task **video: live** follow. The YAMLs' `app.style` is `@commons/layout/app-dark.css`: **the next `record` of compare and quick2 shoots everything** (the stage's fingerprint holds the app settings).
- Older entries below keep the old paths: they tell what happened then.

### 2026-10-13 · The card forge, and probes in every frame

The user: "we're working on the forge; we'll forge later."

- **The forge.** One page, `commons/card.html`, plays every card. Sizes come from a few knobs (`card.css`), colors from the site's tokens, motion from GSAP 3.15 on one timeline started by the take and seekable to any instant. Text follows its container, wraps, grids add balanced rows, the body tightens down to 0.7; what still doesn't fit stops the take before it starts. The manual: `commons/darkStyle.md`.
- **Five prototypes** (title, question, beats, together, outro) in `commons/components/`, each a short composition of shared parts, with a sheet and variants (one past its limit). `card: beats` in the YAML; `look` and `anim` (the user picked the shape: `{ fx | set | to | from | fromTo, target, at }`). The old `*.html` cards are gone; the coffee QR lives with outro.
- **`node uty/card.mjs`**: a scene, a prototype, or the gallery of every variant (exit 1 if one doesn't give its outcome). The user looked at the gallery: go.
- **Probes**: a listener in every frame, the extension's webviews included. The director checks each filmed action (click landed, keys reached an editor, line, selection, save, palette, mark still) and warns under the scene. **Found:** the webviews write themselves with `document.open`, which wipes listeners: the probe re-arms. **Found:** a `removeAttribute` on a detached locator waited 30 s (the restaurant took 69 s): no probe read waits now, and a take lasts as before (±0.4 s).
- **True positive, fixed:** `llm-preview` opened on a tab's tooltip: after dragging the panel's border, `pannello()` put the real mouse back on the tab clicked in `translate`. Now it goes to the corner, there and at every cut. A `--strict` take of compare runs to the end.
- Learned: a container can't be a subgrid (a tile in a grid isn't one); a hidden grid item frees its row.
- Rehearsals: compare and quick2 shot whole on the forge, previews cut; `npm test` 65 green.

### 2026-10-13 · compare: code and page in step, a stamp, a QR, near-lossless

- The user asked for four changes, keeping every line already well read (18 kept, one new: `coffee`, 5.32 s):
  - **Code and page didn't match**: `app-dark.css` lifted the buttons with `order`, so the sentence typed under "Welcome back" showed up elsewhere. Now the page follows the JSX, and the fixture puts the buttons first in `App.jsx` (`goto: 11`).
  - **The ending**: a new scene, `coffee`, on outro's card with `still` (already composed: the cut doesn't show). "Oh, I almost forgot…", a rubber stamp "OPEN SOURCE" (green ink with gaps, an SVG filter) and, the user's pick over a written link, a QR for Buy me a coffee. `outro.html` takes `still`, `stamp`, `stampAt`, `qr`, `qrLabel`, `qrAt`; both keep to the right, clear of the music credits.
  - **Inside the track**, the user's choice over running past it: `music.delay: 2` (the user's idea) and ~2 s of holds cut (hook, extension, build, the site pages, compare, together). `translate` lost its fixed `wait: 1.5`: the French comes 1.3 s sooner. With `toEnd` the track never loops now: silence after it.
  - **The restaurant scrolls whole**: ~17,000 CSS px in 3.9 s, in French, then Japanese at the bottom. New: `preload` (the page scrolled through before the clip: 14 lazy images, blocks that slide in once) and `scroll`'s `ease: sine`.
  - **60 MB a minute**: `output.mbPerMinute`, segments as CRF 10 intermediates, the final encoded once in two passes. It came out at ~29 MB a minute (91 MB; the last cut weighed 28): x264 at an average QP under 1, near-lossless on the takes, and a still screen costs nothing. The user: fine, no further digging.
- **Found: a race in `build`**: the new terminal took the focus a moment after the palette opened, and the run stopped. `wait: 0.6` before the command, and `comando` reopens the palette once.
- Subtitles: two sentences share a cue only if they break on a pause ("free and open / source." was one; two older cues improved too).
- Result: `output/compare.mp4`, 181.2 s, on the track's end; the coffee line at 2:52–2:58, over the music's own fade; 2.5 s to black.

### 2026-10-13 · compare converted and shot: four new pipeline features

- The user said go: convert the new story and start. Before the YAML, the pipeline needed:
  - **`split-panel`**: VS Code fills the frame, the app covers its top right corner, the panel (the terminal) stays uncovered below, full width. Before the clip `palco` opens the panel and drags its border to `panel` (0.3) of the height. Clips now carry x, y, width and height; `impagina()` in `compose.mjs` lays them out for the cut and for the strips.
  - **Any web page in the app:** a scene's `url`, with `storage` (localStorage before the load) and `anchor` (opens scrolled there). `app.style` dresses the fixture's origin only. New action `scroll`; `mark` gets `all` (a table column).
  - **`fade`** at the top of the YAML (`[in, out]`, it was a constant 0.7 s at the end), and **`music.toEnd`**: `record` holds the last scene until the track ends.
  - **Subtitles** break on pauses: full stop, then comma or colon, never after an article or a preposition, 2 characters of slack over 42.
  - **`--silent` keeps real lines** whose text and voice haven't changed: the old "Next" item, done.
- Ada's app (`commons/app-dark.css`, shared with quick2): `order` lifts the buttons to the top, every sentence on its line, `nowrap`, smaller type. Measured in Chrome at the real widths with the longest plausible French: nothing wraps. `zoom.app` 1.25 for compare: the landing's table (677 CSS px) fits whole.
- **Found and fixed: Restricted Mode.** Yesterday's failing `--from translate` runs, and this morning's first take, had VS Code in Restricted Mode: the user settings (trust off) didn't save, so the extension didn't run and Project stayed empty. Intermittent; a bench of the setup alone saved fine. `preparaVscode` now checks the status bar after the reload and writes them again, up to three times. Also: the theme is "Dark Modern" (the server was rewriting "Default Dark Modern" by itself), the JSON goes in on one line, and the terminal's "Show suggestions" hint is off for every video.
- **Found: the landing sends any `#hash` to the playground** (old links). Hence `anchor`.
- The temporary tooltip probe (`VT_TIPDBG`) left in `record.mjs` by the previous session: removed.
- Takes:
  - mute: 187.7 s, 8.4 s past the track. The user chose two shorter lines (`write`, `fallback`) and shorter pauses, keeping a breath after `hook` and `together`; `tail` 0.4.
  - real voice (18 lines, run at the user's request): within a few percent of the estimate, some lines longer. Every `at` and word-bound `wait` re-timed on its pauses (`silencedetect`).
  - `translate`'s box stayed whole 1.2 s: `hold: 2`, shot again from there.
- Result: `output/compare.mp4`, 179.2 s. Narration ends at 2:53.9, Mirage fades by itself (-31 to -115 LUFS in the last 4 s), 2.5 s to black. Poster on the full list.
- README: the new keys, stage and action, § "On stage" (split-panel, the published site), § "Field notes" (Restricted Mode, durations).

### 2026-10-13 · compare: the story rewritten for 2:50

- The user reviewed the cut and asked for a new `storyboard.md`. Changes, by scene:
  - `hook`: one voice, one tone. "Fair question" sounded like a second speaker: the `.md` now asks to tie it to the next sentence and not to direct the question apart. The last line says what it means: your own environment, the ecosystem you work in, should help you.
  - No "we" in the narration: viteTranslate is the subject ("viteTranslate does the rest"). Header field **Soggetto**.
  - The app of Ada: buttons on top, sentences below, smaller type, nothing wraps. Header field **L'app di Ada**.
  - `build`: one circle only, on French's missing keys; the box on the French chunk stays.
  - `llm-preview`: the terminal as a full-width strip under code and page. After it, a new scene `voila` ("Voilà!", the user's "oplà"), at least 2 s later, on the French as it shows up.
  - New: `site` (a card: "See it live", the address, three tiles), then `playground`, `edge`, `restaurant`, live from the published site; `compare`, the landing's comparison table, the viteTranslate column boxed, argued by unity, not by the others' gaps. It's now the only scene naming the other libraries; `together` lost its note about them.
  - `translate`: the `.md` now has the line already agreed in the YAML ("what's waiting for a translation").
  - English: header field **Inglese**, for the lines and the subtitles.
- Decided with the user: all three site pages, live from the published site rather than screenshots; "Voilà!" for "oplà".
- Measured: Mirage lasts 2:59.2, steady up to ~170 s, then fades out by itself, silent by ~177 s. "2:50" is where the music starts to close: the story aims to end its narration there, the closing card holds to the end of the track, the video fades to black over 2 s at least.
- Rough budget: about 170 s up to `together`, about 177 s to the end of `outro`'s line. To be checked on the real voice; the holds and the `site` card are the first to trim.
- Found: the previous session's work is not in this log. It added `llm-preview`, with an `llm` block in the fixture and `vscode.env`, which the README's top-level keys didn't list (added now). The last `record --from translate` runs stopped on Settings' gear (in "Next").
- **Not converted:** the YAML needs four pipeline features first (in "Next"). `check` lists 6 new scenes and 10 changed.

### 2026-10-12 · The stuck tooltip, fixed in the extension

- Cause, in `packages/idePlugin/src/webViews/tooltip/tooltipScript.mjs`. Any `focusin` lit the tooltip, including the focus that Project's tree moves by itself to the first language when it redraws after a click. Once the editor had the focus, nothing hid it.
- Fix:
  - `focusShowsTip`: the focus lights a tooltip only if the page has the focus and the focus is keyboard focus (`:focus-visible`: Tab, a tree's arrows);
  - the webview window's `blur` hides it.
  - Pointer tooltips are unchanged.
- Decided: `:focus-visible` holds here because `vscode-tree-item` takes the focus on its own host (`item.focus()`), so the browser's heuristic sees it.
- Tested:
  - five cases in `test/list/idePluginProject.test.mjs`;
  - a real Chrome with the actual script in an iframe: click then a focus moved by script, Tab, the focus leaving the iframe. The old code fails the first one, as in the video.
- **Not shot again:** the user is changing the story. The next `record` needs `--rebuild-ide`. No version bump for the extension.

### 2026-10-12 · Partial takes, strips, field notes

- The user asked for three things: notes for future sessions in the README; re-shooting only from the scene that changed; checking each scene as soon as it's shot.
- **Partial takes** (`record.mjs`):
  - `takes.json` keeps a fingerprint of the stage and one per scene, chained;
  - `record` keeps the scenes up to the first changed one: they're played without filming, to rebuild the state, and keep their clips;
  - the last kept scene plays at full length, so what runs on the clock reaches the cut as in a full take;
  - `takes.json` is saved after every filmed scene.
  - Options: `--full`, `--from <scene>` (keeps the scenes before even if the stage changed, with a warning), `--to <scene>`.
  - `compose` now refuses takes that don't cover the YAML's scenes; `preview` cuts them with a warning.
- **Strips:** `capture/strips/NN-<id>.jpg`, a frame a second, written in the background while the run goes on.
- Decided:
  - Waits stay in a fast-forward: some wait for a reload, and a YAML doesn't say which.
  - Marks go: they only take time.
  - The stage includes the pipeline's own code: changing `uty/` shoots everything, unless `--from`.
- Tested on `compare`:
  - first run, no fingerprints yet: full, 172 s;
  - nothing changed: nothing to shoot, at once;
  - a `hold` changed in `translate`: kept 1–7, shot from 8, 131 s, the same frames as a full take;
  - `--from llm --to llm`: 91 s, and `compose` refused the partial takes;
  - a plain `record` then resumed from `together`. Cut again: 133.8 s.
- README: § "Partial takes"; § "Field notes" (how to check before shooting, strips then frames, timing on the real voice with `silencedetect`, checking a card, traps met); rule 10: write down what you learned.
- `servers.mjs` exports `vsixStamp()` for the stage fingerprint.

### 2026-10-12 · compare, shot with the real voice

- The user agreed to three changes to the story: `bundle` right after `build` (the cards at the end go from four to three), shorter lines for `extension` and `llm`, and a breath after `hook` and `together` so the music rises (`hold: 2.5`).
- Two more, needed to shoot it, written in the `.md`:
  - `build` boxes only `fr-FR-….js`: en-US, the source, is preloaded in the main bundle, so no chunk of its own. Its line says "French gets a chunk", not "every language".
  - `extension` picks the styles in Settings, not in the palette, whose list covers the new line. The circle from `write` couldn't stay either: marks go at every cut.
- Converted and stamped; **real voice** (11 lines, 105 s, run at the user's request), then every `at` and `wait` re-timed on its pauses (`silencedetect`).
- Four takes to a clean cut:
  - `find` after a click inside `null` did nothing: the search box comes seeded with "null", so typing "null" changes nothing. `key: Control+D` selects it.
  - The first language's tooltip stays stuck after clicking fr-FR: the focus lands on it when the panel redraws, and nothing hides it once the editor has the focus. **Still in the cut**, a fix for the extension (in "Next").
  - Highlighter is faint on a dark theme: the last style is Keyword mark.
  - Word suggestions popped up while typing in `fr-FR.yml`: `editor.wordBasedSuggestions` off, and `[yaml]` quick suggestions, in `VSCODE_SETTINGS`. **For every video.**
- Terminal: `Control+Backquote`, then `npm run build` typed in it. Its text is found only with `terminal.integrated.gpuAcceleration: "off"` (this project's `vscode.settings`), and the panel maximized so the marks don't drift.
- README § "On stage": Project's languages, Settings, a build in the terminal, the known tooltip.
- Result: `output/compare.mp4`, 133.6 s, poster on the complete list.

### 2026-10-12 · compare: the story and its cards

- `compare/storyboard.md`: "Why viteTranslate", about 2 minutes. A sentence goes from JSX to French in production, and every stop shows one row of the root README's comparison table; VS Code is the heart of it.
- First draft rewritten at the user's request: **positive tone**. Say what we built in, never what the others lack. The question "another i18n library?" opens it. The final card lists our ten features grouped by where they live (JSX, VS Code, Vite, production), with no column for the others: the comparison stays in the README.
- The user asked for the story "in commons": it went to `projects/compare/`, the empty folder made for it, since stories live in `projects/<project>/`.
- Three new shared cards: `question.html`, `beats.html` (used twice: LLM, production) and `together.html`. Checked frame by frame in headless Chrome.
- **Cards on the voice:** a card starts on load, but its clip starts 0.5 to 1 s later, never the same. Now `palco` adds `clock=take` to the card's URL and `ciak` fires a `take` event once the recorders are filming; `commons/clock.js` waits for it. The times in `at` are the voice's own seconds. Title and outro ignore it.
- Decided: LLM as a card, since quickApp has no `llm` block and every take would cost.
- README § "Cards", at the user's request, so the cards can be reused: what each one shows and is good for, its params with their defaults, how much text fits, a YAML example, timing on the voice, and how to write a new one (the page, `clock.js`'s API, how to look at it). Measured, not guessed: the title line holds about 80 characters, 40 stay within the logo.
- `title.html` and `outro.html` now wait for the take too: they entered on load, about a second before the clip, and most of their entrance was lost. **Every video changes a little:** its opening and closing cards now enter on camera. Checked in headless Chrome: hidden before the take, whole after it.
- Left: the build in the terminal, the conversion, the rehearsal.

### 2026-10-12 · Every run, live

- The user wants to watch a run while it goes, in VS Code. **A script can't open a VS Code terminal**: neither Node nor the `code` CLI can, and an extension just for this wasn't worth it.
- Picked by the user from three options: a VS Code task, with a window as the fallback.
  - `uty/live.mjs` follows every project's `log/run.log` and prints the new lines, with colours. Opened halfway through a run, it starts from that run's first line.
  - The task **video: live** (`.vscode/tasks.json` at the repo root) runs it in the Terminal panel and starts with the folder.
  - When a long step starts and no view has touched `.cache/live.beat` in the last 3 s, `run.mjs` opens a Windows Terminal window. A run from a terminal (a TTY) opens nothing.
- `record` now prints a line before the stage is set: there was half a minute with no output after "servers up".
- README:
  - rule 5 (the user watches every run: say what it does, long timeout, one at a time), so the old 5–8 are now 6–9;
  - the section "Watching a run", with a paragraph for agents;
  - the row for `live.mjs` in Commands.
- Tried for free (`quick2 preview`, run from the agent's shell):
  - the window opened and its follower kept beating after the run ended;
  - the second run found the view already on;
  - a log born after the start was followed, and a half-written line waited until it was complete.
- Left: the task itself, which needs the folder reopened (or Run Task) and maybe VS Code's permission for automatic tasks.

### 2026-10-12 · Two rules from the user: marks that last, music that closes

- **Marks** too short for the eye: in `quick2` the Results row was circled right at the cut, and `null` and the French sentence lasted about 1 s.
  - Rule: once drawn, a mark stays whole for at least 1.5 s, and 2 s on words to read, until a newer mark dims it, an `unmark` or the cut.
  - `record` checks it: `SEGNO_MINIMO` and `chiudiSegno` in `director.mjs`, and a warning under the scene.
  - It caught `null` at 0.8 s on the first try.
- **Music** fades out over 4 s at least: the default `fade` is now `[1.5, 4]`, and a shorter close stops the YAML (`FINE_MINIMA` in `music.mjs`).
- `quick2`:
  - holds raised: write 2, sync 1.3, translate 2;
  - no warning left; 54.8 s;
  - the music fades from 50.8 s to the end;
  - no `tts`, nothing spent.
- README: both rules, in "Marks" (and the conversion points there) and in the `fade` row of "Music".
- **`projects/quickstart` is gone from disk.** This session's removals were its own throwaway projects, by exact path, and `quickstart` was still there after them. Asked the user before touching its row here.

### 2026-10-12 · quick2 with marks and music

- The user added `**Musica:** Chris Haugen - Mirage` to `quick2/storyboard.md` and asked me to add the marks myself. Six, in the words of the README table:
  - app: a circle on Français before the click;
  - write: a circle on the new Results row;
  - fallback: an underline on the English sentence in the browser;
  - sync: an arrow on Sync, then a circle on `null`;
  - translate: a box around the French sentence.
- Converted as the README says (`check`: header and five scenes): `music` at the top, each mark on the word that names its thing, timed on the real voice in the cache. Stamped.
- `mark` on a block (a paragraph) now goes around its text, not around the whole column (`sagoma` in `director.mjs`, a Range inside the element's frame). Buttons keep their box.
- Rehearsed with `record preview compose` and no `tts`: the real voice stayed, nothing spent. 50.2 s; `translate` ends 0.3 s past its voice, for its box. A frame per mark checked: all six in place.
- **`--silent` writes silence over a real voice** (same file names, new hash): README rule 4 now says to rehearse with `record preview` once the real voice is in. A fix is in "Next".
- Left: the user listens to it.

### 2026-10-12 · Background music under the voice

- `music:` in the YAML (from **Musica:** in the `.md` header): a track of `commons/bkmusic` under the voice, mixed in `compose`.
- Ducking from the known times of the lines, not a sidechain compressor that chases the voice and pumps:
  - the volume curve is written in dB, down `before` (0.6 s) ahead of each line, back up in `after` (1 s);
  - lines closer than `bridge` (2 s) stay down together;
  - the music fades in at the start of the video and out at the end;
  - the track is measured and brought to its level, and loops if it's short.
- Decided with the user:
  - Levels in **dB under the voice**: `max: -8` in the pauses, `min: -26` while it speaks.
  - **Tracks out of git**, `credits.md` in, with the links to get them again.
- Credits are owed. They come from `commons/bkmusic/credits.md`: the track's bullet line plus the lines common to all tracks. Headings, `\#` and `---` rules are skipped: the user's file has both.
  - They show at the bottom of the closing card (`outro.html` reads a `credits` parameter the recorder passes to every card).
  - They go to `output/credits.txt` for the YouTube description.
  - A track without its line stops the YAML.
- Tested in a throwaway project (deleted after), with a mute voice:
  - loudness second by second: -39 to -50 LUFS under the lines, -25 to -28 in the pauses (targets -42 and -24), the dip starting 0.6 s ahead;
  - credits checked on the closing card;
  - `.gitignore` checked: the mp3 is ignored, `credits.md` is not.
- **The user edited `credits.md` meanwhile**: the license line and the link changed. The credits are read at every run, so the video follows the file.
- Left: music in a real story.

### 2026-10-12 · A hand-drawn highlighter; "Scena" for "Palco"

- Prototype first: a lab page ("Stage Marker Lab", a private artifact, not in the repo) on a mock of the split stage, tuned with the user. From it:
  - **Brush:** the outline of the line, tapering from 10 to 3 px.
  - **Dashes:** `stroke-dasharray` with a moving `stroke-dashoffset`, cut into short pieces so the taper holds. The user dropped the first try, dots placed by hand.
  - Padding raised to 22 px.
  - **Dim:** the earlier marks fade when a new one comes, down to a chosen opacity, 0 by default.
- In the pipeline:
  - `uty/marker.js` is an init script beside the fake pointer: an SVG layer above the webviews, below the pointer.
  - `mark` (targets like `click`, or `selection` for code) and `unmark` in `director.mjs`.
  - Every mark is cleared at a cut.
  - `storyboard.mjs` checks the mark keys, so a typo stops before the take.
  - A top-level `mark:` sets the video's defaults.
- Decided:
  - Sizes in video pixels, so a mark looks the same on VS Code (zoom 1.2) and on the app (1.6).
  - The seed comes from the scene and the mark's number: every take draws the same mark.
  - `feMorphology` was dropped: it thickens a whole shape evenly, it can't taper a line along its length.
- Tested in a throwaway project (deleted after): arrow on Sync, box on a Results row inside a webview, dotted circle on an editor selection, underline and amber circle in the app, earlier marks dimmed, `unmark`. Every target found, frames checked.
- README: a table of Italian words for *Si vede* (*si cerchia*, *si riquadra*, *una freccia indica*…) mapped to `mark`, the keys with their defaults, the conversion rule (mark on the word that names the thing, before the hand acts; no marks the `.md` doesn't ask for).
- **"Palco" is now "Scena"** in the `storyboard.md` field, by the user's choice: README and both storyboards updated, both projects stamped again (only the label changed). The README spells out that the field is not the `##` block. The code keeps `palco()`, where `scena` already names the scene object.
- Left: marks in a real story.

### 2026-10-12 · quick2 with the real voice, a levelled mix

- First real voice (run by the user): 7 lines, 39.4 s of voice, 2.75 words a second against the 2.6 estimated. 52.0 s of video; `write` and `sync` ran 1 s past their voice. The user kept that cut as `output/quick2 - Copia.mp4`.
- Measured: lines from -16.9 to -14.6 LUFS, three peaks above 0 dBTP. Generated one by one, they don't match.
- `compose`: every line to -16 LUFS, peaks limited to -1.5 dB, 10 ms fades at its edges. Result: segments between -16.8 and -16.1 LUFS, final -16.1 LUFS, peak -3.1 dBTP.
- `tts`:
  - a scene's `instructions` are added to the voice's, no longer replace them;
  - the trim keeps 0.15 s before the first word (the breath) and 0.1 s after the last;
  - the take as received stays as `<id>.raw.wav`, and every run trims again from it, for free.
  - **The current lines predate it:** no raw take, so breath and margins arrive with the next re-voice.
- `quick2` re-timed on the real voice: the save on "Save", `fr-FR.yml` on "In French", then a `waitFor` on `null` (Sync is done in about 1.5 s). No action past the voice; 49.9 s. Cache checked first: nothing re-voiced, nothing spent.
- Decided: an article on joining TTS files suggested crossfades. They don't apply here: lines never touch, there's a cut and a second of silence between them. What was missing was the level.
- Left: listen to it against the copy. The prosody still resets at every line: the tries are in "Next".

### 2026-10-12 · One README for site/video

- `readme.md` and `storyboard-spec.md` merged into [site/video/README.md](../README.md). People and agents now read one source of truth, and GitHub shows it when the folder opens.
- Order: the overview and the flow first, then the rules for agents, the format, the conversion, the YAML reference and "On stage", then commands, folders and pipeline.
- Duplicates gone: "storyboard.md wins", the ready-made request, the rehearsal and what git keeps are said once.
- References moved to `README.md`:
  - `AGENTS.md` § "REGOLE DI SITE/VIDEO", both lines;
  - `uty/subject.mjs` and `uty/storyboard.mjs`, comments and error messages;
  - the LINKED-DATA comments in `packages/idePlugin/`;
  - the header of both `storyboard.yaml`.
- **No size limit here:** `site/video/README.md` answers only to being complete (15.9 kB today). The 10 kB and compression rules are for the root README: decided by the user, written in `AGENTS.md` § "REGOLE DI SITE/VIDEO".
- Fixed on the way: a space lost in `markedRows.mjs` (`const GLYPHS = {`) by the previous session's edit.

### 2026-10-12 · quick2, a blind conversion

- `quick2/storyboard.md` is a copy of quickstart's, converted into `storyboard.yaml` from the spec, the fixture and the sources of `packages/idePlugin/` and `lib/` only. **Not fully blind:** quickstart's YAML had been opened before the rule was set.
- Two silent rehearsals, 53.7 s: every click and `waitFor` found its target, the 🔸 shows in `fallback`, the terminal says `1 key(s) added` in `sync`.
- Fix: Sync's terminal closed itself in the middle of `translate`, and the editor jumped. Now `key: Control+J` hides it on the cut.
- The spec gained what the conversion had to dig out:
  - `app.style` default;
  - placing each action on its word, and ending on a `waitFor` for what the `.md` says is seen;
  - frames from the end of a scene;
  - action times;
  - § "On stage" (reloads, marks, panel selectors, Sync's terminal, split width, pointer).
- Decided: stage facts live in the spec, not in one project's YAML, so a conversion finds them without copying another storyboard. LINKED-DATA comments back from `commandBar.mjs` (`data-cmd`) and `markedRows.mjs` (row labels).
- `site/video/project.md` became this file, the travel log; the spec's rule 8 has every session add an entry.
- Left: the real voice, then re-time the waits.

### 2026-10-12 · The pipeline and quickstart

- `uty/` built end to end: check, stamp, tts, record, preview, compose. `quickstart` written from the first cut, stamped, recorded and cut with a mute voice. `AGENTS.md` § "REGOLE DI SITE/VIDEO" sends every agent to the spec.
- Decided:
  - Content in the `.md`, technique in the YAML: a scene id links them, so re-converting one scene keeps the tuning of the others.
  - VS Code in the browser (`serve-web`) beats desktop window capture: exact viewport, no DPI, no notifications, same tool as the app.
  - Own recorder (CDP screencast → ffmpeg at constant fps): Playwright's `recordVideo` has a fixed low bitrate that blurs code.
  - The voice sets the pace: a scene lasts at least `lead + voice + tail`; actions run inside it.
  - Extension installed with the server off: with `serve-web` running, the install reports success and the folder vanishes.
  - Text goes into the Quick Open box itself, and the palette presses Enter only on the right entry: webviews steal focus, a blind Enter runs whatever is first.
- Left: the real voice (no key on this machine).
