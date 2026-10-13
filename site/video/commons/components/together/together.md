# together

Columns of ticked items, filling one after another; then every tick glows once. Good for: a summary, what's in, grouped. In the YAML: `card: together`.

## Params

| Param | Default | |
| :- | :- | :- |
| `title` | none | a headline above the columns |
| `groups` | the ten features of the root README's comparison, in four groups | one column per line: `Heading\|item\|item…` |
| `at` | from 0.8, every 1.4 | one per column; its items follow 0.25 s later |
| `beat` | 0.3 | seconds between two items of a column |

And the common ones: `note` (`noteAt`: 1 s after the last item), `stamp`, `qr`, `still` ([README.md § "Cards"](../../../README.md#cards)).

## Built from

`stack(headline(title), tiles(groups, group))` in the body.

## How it adapts

- 1 to 4 columns on a row, then balanced rows (6 → 3 + 3). The headings and the lists of a row line up.
- Items wrap: four columns hold items of about 30 characters on two lines, four each.
- **The limit:** six columns of four long items, with a title, don't fit (`too-much`).

## Timeline

| When | What | Effect |
| :- | :- | :- |
| 0 | the title | `rise` |
| `at` | each column | `rise`, 0.6 s |
| `at` + 0.25 + `beat` × i | each item; its tick 0.15 s later | `rise` 0.5 s; tick `draw` |
| last item + 0.7 | every tick, once: a good frame for the poster | `glow` |
| last item + 1 | the note | `fade` |

## Targets for `anim`

| Selector | Is |
| :- | :- |
| `h1` | the title |
| `.tile` | the columns |
| `.group h2` | their headings |
| `.group li` | the items |
| `.tick`, `.tick path` | the tick's disc, its stroke |

## Variants

`default` (compare's `together`) · `titled` · `six` (3 + 3) · `long-items` · `too-much` (error). `node commons/cli/card.mjs together <variant>`.

## Example

```yaml
- id: together
  stage: card
  card: together
  params:
    groups: |
      In your JSX|Keyless, natural text|ICU plurals, select, dates
      In VS Code|Official extension|LLM auto-translation
      In Vite|Official Vite plugin|Extraction in the Vite lifecycle|Lazy-loaded locales
      In production|Zero runtime dependencies|5 kB gzip runtime|No message parsing at runtime
    at: 3.4, 4.6, 5.6, 6.6
    beat: 0.25
```
