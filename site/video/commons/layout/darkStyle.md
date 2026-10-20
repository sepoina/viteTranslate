# The dark style: the forge's manual

How the videos look, and how to make a card. The cards are a small web layout, adaptive and parametric: a few knobs set every size, the site sets every color, GSAP moves everything on one timeline. Prototypes are short compositions of shared parts; there's a gallery to see them all.

<!-- LINKED-DATA: the values described here live in commons/layout/card.css (knobs, scales, frame, primitives, the parts' look), commons/layout/motion.js (curves, effects), commons/layout/layout.js (adapting, the check), commons/layout/parts.js (parts), commons/layout/clock.js (timeline, boot), site/theme/tokens.css (colors), commons/layout/app-dark.css (the demo apps), VSCODE_SETTINGS / FRECCIA / CURSORE in commons/cli/director.mjs and COLORS / DEFAULTS in commons/cli/marker.js. Change one, change this file. -->

| Where | What |
| :- | :- |
| [card.css](card.css) | knobs, scales, the frame, primitives, the look of the parts |
| [motion.js](motion.js) | curves and effects |
| [layout.js](layout.js) | `look`, balanced grids, one-line fit, the body that tightens, the final check |
| [parts.js](parts.js) | the parts |
| [clock.js](clock.js) | the timeline, the boot, the API a prototype gets (`card.*`) |
| [card.html](card.html) | the one page that plays every prototype |
| [components/](../components/) | the prototypes: `<name>.js`, its sheet `<name>.md`, its `variants.yaml` |
| `site/theme/tokens.css` | every color, the site's own |

## Knobs and scales

Every size comes from these. Change one and every prototype follows. In the YAML, `look:` sets any knob or token, for the whole video (top level) or for one card scene (merged over the top):

```yaml
look: { type-scale: 0.92, tempo: 1.1 }   # a calmer, slightly smaller video
```

| Knob | Default | |
| :- | :- | :- |
| `density` | 1 | every space, times this |
| `space-base`, `space-ratio` | 8px, 1.5 | the space scale: step 0, and from a step to the next |
| `type-scale` | 1 | every type size, times this |
| `type-base`, `type-ratio` | 34px, 1.25 | the type scale: step 0 (text in a column), and the ratio |
| `type-min` | 26px | nothing smaller: still readable on a phone |
| `fit` | 1 | set by layout.js on the body when the content is too much (down to 0.7) |
| `tempo` | 1 | every effect's duration, times this (entrance times stay on the voice) |
| `cols-max` | 4 | the most items on a row of a grid |
| `measure` | 1680px | the widest a block of content gets |
| `safe-x`, `safe-y` | 120px, 96px | the frame's margins |
| `radius` | 28px | a tile; a chip has a third of it |
| `logo` | 900px | the logo's width |
| `qr-size` | 172px | the QR's side |

**Scales** at stock knobs, in px:

| Space | 2xs | xs | s | m | l | xl | 2xl | 3xl |
| :- | -: | -: | -: | -: | -: | -: | -: | -: |
| | 5 | 8 | 12 | 18 | 27 | 40 | 61 | 91 |

| Type | fine | small | text | body | lead | heading | display | hero |
| :- | -: | -: | -: | -: | -: | -: | -: | -: |
| | 22 → 26 | 27 | 34 | 42 | 53 | 83 | 104 | 130 |

`fine` sits under `type-min`, so it shows at 26.

**Why the scales are declared twice.** A custom property resolves where it's declared. The scales are on `:root` and again on `.knobs` (the body region): a knob set on the body, like `--fit`, reaches the scales only there. A knob set on any other element does nothing.

## Color

Only the site's tokens (`site/theme/tokens.css`, dark: `card.html` forces `data-theme="dark"`). No hex in prototypes or parts; the one exception is the QR's white, commented in `card.css`.

| Token | Role |
| :- | :- |
| `--surface` → `--bg` → `--bg-deep` | the frame's radial background |
| `--surface-2`, `--line-soft` | a tile and its border |
| `--text-hi` | headlines |
| `--text`, `--code-text`, `--lead` | body text, small text in tiles, lines and leads |
| `--faint`, `--quiet`, `--muted` | the note, the credits (first line `--muted`) |
| `--accent` | the green: big lines, chips, words, ticks, the stamp; the glows of motion.js (as rgba) |
| `--accent-soft` | the tick's disc |
| `--surface`, `--line` | a chip |
| `--marquee-dim` | the dots between words |
| `--logo-filter` | brightens the grey logo |

## The frame

`card.html` is the same for every prototype:

| Region | Is |
| :- | :- |
| `.frame-head` | above the body; hidden when empty |
| `.frame-body` (`.knobs`) | the content, centered; a size container (`cqi`, `cqb`). `safe center`: too much content overflows downwards, where it's measured |
| `.frame-foot` | below: the note, the credits |
| `.frame-over` | over everything, in the corner of `data-corner` (the `corner` param, bottom right by default), `--space-2xl` from the edge: stamp, QR. It moves nothing, so a `still` scene can add them to the card before it without the cut showing |

The boot (`card.boot()`): `look` → the prototype's script (`card.define`) → its parts in the regions and its entrances on the timeline → the common parts (note, stamp, QR) → images and fonts loaded → `arrange` → `anim` → `check` → `card.ready`. The recorder waits for `ready` and stops on `card.errors`; the take starts the timeline (`card.tl.play(0)`).

## Primitives

| Primitive | Does | Params | Adapts |
| :- | :- | :- | :- |
| `.stack` | centered column | `--gap` (`--space-2xl`), `--measure` | grows in height; text wraps within `--measure` |
| `.cluster` | a row that wraps, centered | `--gap` (`--space-xl`) | more rows |
| `.grid` | items in balanced rows, at most `--cols-max` a row | `--gap` (`--space-xl`), `--cols-max` | layout.js sets `--cols` (5 → 3 + 2, 7 → 4 + 3), `--tracks` (two per column: a short last row is centered) and `--rows` (each item's inner rows) |
| `.tile` | a box on the surface; a container on its own | `--pad` (`--space-xl`) | in a `.grid` its inner rows are a subgrid: they line up with its neighbours'. There it isn't a container (a contained element can't be a subgrid) |
| `.t-<role>` | type role: `fine` … `hero` | — | `max(--type-min, min(--type-<role>, <k>cqi))`: follows its container's width. `<k>` is 12.5cqi up to `body`, 10 for `lead`, 8.3 from `heading` |
| `[data-fit]` | one line, as large as its box allows | — | layout.js starts from the role's full size and goes down to `--type-min` |

## Parts

What a prototype is made of (`parts.js`). Each builds its piece from plain data and says how it enters (`data-enter`); the prototype says where and when.

| Part | Data | Look | Adapts | Enters with |
| :- | :- | :- | :- | :- |
| `stack(...nodes)` | nodes (nulls skipped) | `.stack` | — | — |
| `logo()` | — | `--logo` wide, `--logo-filter` | shrinks with its column | `rise` |
| `headline(text, { role, tag })` | a string | `heading` (or the role given), `--text-hi`, balanced | wraps | `rise` |
| `lead(line, accent)` | two strings | `lead`, `--lead`, the accent bold in `--accent` | wraps, balanced | `rise` |
| `chip(text)` | a command | `body`, monospace, `--accent` on `--surface` | one line, shrinks to fit | `rise` (y 28) |
| `tiles(items, fill)` | a list, a fill function | a `.grid` of `.tile` | balanced rows | `hit` |
| `bigSmall(tile, [big, small])` | two strings | big: `hero`, `--accent`; small: `body`, `--code-text` | big on one line that shrinks; small wraps | (the tile's) |
| `words(list, { role })` | strings | `display` (or the role given), `--accent`, dots `--marquee-dim` | the row wraps | words `pop`, dots `light` |
| `group(tile, [heading, ...items])` | strings | heading `text` in `--accent`; items `text` with a drawn tick | items wrap | items `rise` (0.5 s), the tick's path `draw` |
| `lines(list)` | strings; `` `code` `` → chip, `**bold**` | `body`, `--lead` | wrap | `rise` |
| `note(text)` | a string | `small`, `--faint`, in the foot | wraps | `fade` |
| `credits(lines)` | strings | `fine`, `--quiet`, the first `--muted`, in the foot | — | `rise` (y 20) |
| `stamp(text)` | `one line` or `small\|BIG\|small` | `lead`, `--accent`, the `#ink` filter, over | — | the `stamp` effect |
| `qr(src, label)` | an image, a line | on white, `--qr-size`, over | — | `rise` (y 20, 0.6 s) |
| `common()` | the params `note`, `stamp`, `qr` (+ `noteAt` 1, `stampAt` 1, `qrAt` 1.5), `corner` (`bottom-right`; also `top-right`, `bottom-left`, `top-left`: anything else is an error) | — | — | — |

A prototype moves `noteAt`'s default with `card.noteAt = t` (together puts it after the last item).

## Adapting

The same order for every prototype:

1. **Text follows its container** (`cqi`).
2. **It wraps** (`text-wrap: balance` on headlines and leads).
3. **Grids add rows**, balanced.
4. **The body tightens**: spaces and type together, `--fit` down by 0.04 to 0.7.
5. **Error.** Still too much: `layout.check` writes it in `card.errors` and the take stops before it starts.

`check` runs with every entrance done, then goes back to zero:

| Message | Means |
| :- | :- |
| `doesn't fit: the content needs W×H px, the body has W×H` | too much, even tightened |
| `<el>: the text runs N px past its box` | a line that can't wrap or shrink further |
| `<el>: past the edge of the frame` | outside 1920 × 1080 (the CSS frame at any output resolution) |
| `the QR covers <el>` · `the stamp covers <el>` | the layer over sits on the content |
| `look: no token --x` | a `look` key that isn't a knob or a token |
| `no effect "x" in motion.js (…)` · `anim[i]: no element matches "…"` | an `anim` that can't run |

## Motion

GSAP 3.15 (`site/video/node_modules`, never from the network). **Rules:** time zero is the take, not the load; everything sits on `card.tl` at an absolute time; each thing enters on the word that names it; no CSS `animation`, `transition` or `setTimeout` for the look; what enters is hidden by its effect (`fromTo`), not by CSS, so `still` and `seek` work; no element animated by GSAP has a `transform` in CSS.

| Curve | Is | For |
| :- | :- | :- |
| `vt` | cubic-bezier(.2, .7, .2, 1) | entrances: a quick start, a soft landing |
| `vt.out` | (0, 0, .58, 1) | lights, fades, glows |
| `vt.press` | (.6, 0, .9, .4) | the stamp: speeding up to the hit |

| Effect | Does | Defaults |
| :- | :- | :- |
| `rise` | up from below, fading in | `y` 24, 0.9 s, `stagger` 0 |
| `hit` | up, a little past full size, a green flash on the border | 0.7 s |
| `pop` | from barely visible (0.08), a small pop, a glow that settles | 0.6 s |
| `light` | from the current opacity to `to` | `to` 1, 0.35 s |
| `fade` | fades in | 0.8 s |
| `draw` | an SVG stroke drawn | 0.4 s, `length` 30 |
| `glow` | a glow once, back to the current background | 1.2 s |
| `thud` | a small shake, as from a blow | 0.2 s, `x` 2, `y` 3 |
| `stamp` | pressed from 2.4×, tilted, with a `thud` on `shake` | 0.3 s, `angle` −10, `shake` `.frame`, `thudAt` 0.22 |

Every duration is times `--tempo`. `light` and `glow` start from the current state; the others set both ends.

## The other stages

As they are today; they don't use the forge.

- **VS Code** (`VSCODE_SETTINGS` in `commons/cli/director.mjs`): Dark Modern, editor 18 px on a 28 px line, no minimap, no suggestions, no auto-closing, solid cursor; terminal 16 px. Zoom 1.2 in the YAML's `zoom.vscode`. Notifications hidden by CSS.
- **The app stage** (`app-dark.css`): the demo apps dressed in the site's colors, Segoe UI 24 px, the buttons on one row; zoom 1.6.
- **The pointer** (`FRECCIA`, `CURSORE`): a white arrow with a dark outline and a soft shadow, gliding on a cubic curve (350–900 ms); a green ripple on the click.
- **Marks** (`commons/cli/marker.js`): green `#4ade80` (the site's accent), amber, coral, white; a 10 → 3 px brush that trembles: see README.md § "Marks".
- **The fade** of the whole video: 0.5 s from black, 0.7 s to black (`fade`).

## Forging

**A new prototype.**

1. A folder `commons/components/<name>/` (shared) or `projects/<p>/components/<name>/` (one video only; `card: ./components/<name>`).
2. `<name>.js`: `card.define(({ param, list, times, head, body, foot, over, parts, enter, fx, at }) => { … })`. Build with parts, append them to a region, put each entrance on its time with `enter(node, t)`. A default for every param, so it shows something on its own.
3. Times: `times(count, { first, step })` reads `at`; the defaults follow the voice's pace (about 2.6 words a second).
4. `variants.yaml`: the default, the real use, two "more" (more items, longer texts), one past the limit with `expect: error`. Keys: `name`, `params`, `look`, `anim`, `expect`, `note`.
5. `node commons/cli/card.mjs <name> <variant>`, then `node commons/cli/card.mjs --gallery`.
6. The sheet `<name>.md` (the template is any other sheet), and a row in README.md § "Cards".

A prototype stays short: the sixth one tried, a title and numbered tiles, took 9 lines.

**A new part or effect.** A part goes in `parts.js` with its look in `card.css` (tokens and scales only) and a row in [Parts](#parts); an effect is one `fx(...)` call in `motion.js` and a row in [Motion](#motion). No part without a prototype that uses it, and a variant that shows it. `parts.js` stays under 250 lines, `layout.js` under 150: past that, ask before splitting.
