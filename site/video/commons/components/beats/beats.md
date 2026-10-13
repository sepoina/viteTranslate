# beats

A title, a command, then tiles landing one by one on the voice. Good for: three facts, three figures, three steps. In the YAML: `card: beats`.

## Params

| Param | Default | |
| :- | :- | :- |
| `title` | `LLM auto-translation` | the headline |
| `code` | none | a command under the title, one line that shrinks to fit |
| `beats` | 💰, ✋, 🛡️ with *Cost first*, *Asks before spending*, *Every result validated* | one tile per line: `big`, or `big\|small` |
| `at` | from 1.5, every 1.2 | one per tile |

And the common ones: `note`, `stamp`, `qr`, `still` ([README.md § "Cards"](../../../README.md#cards)).

## Built from

`stack(headline, chip, tiles(beats, bigSmall))` in the body.

## How it adapts

- 1 to 4 tiles on one row; more go on balanced rows, the short one centered (5 → 3 + 2, 7 → 4 + 3). Eight short ones fit.
- `big` stays on one line, as large as its tile allows: a number or an emoji stays huge, a long word shrinks. `small` wraps; the bigs of a row keep the same top.
- A two-line title, a long command and three tiles with long small lines still fit, the body tightened.
- **The limit:** twelve long tiles don't fit (`too-much`).

## Timeline

| When | What | Effect |
| :- | :- | :- |
| 0 | the title | `rise` |
| 0.25 | the command | `rise` |
| `at` | each tile | `hit` |
| `noteAt` (1) | the note | `fade` |

## Targets for `anim`

| Selector | Is |
| :- | :- |
| `h1` | the title |
| `.chip` | the command |
| `.tile` | the tiles |
| `.big`, `.small` | the two lines of a tile |
| `.note` | the note |

## Variants

`default` · `production` (compare's `bundle`) · `command` (compare's `llm`) · `four` · `seven` (4 + 3) · `long-texts` · `too-much` (error) · `qr-over-tiles` (error: the QR can't sit on the content). `node commons/cli/card.mjs beats <variant>`.

## Example

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
    at: 2.9, 4.75, 8.0 # "Zero", "five", "precompiled"
    note: "ICU plurals, select, numbers and dates: compiled at build time"
    noteAt: 6.5 # "ICU"
```
