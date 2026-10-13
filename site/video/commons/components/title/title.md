# title

The logo, then a line with a green half. Good for: the opening. In the YAML: `card: title`.

## Params

| Param | Default | |
| :- | :- | :- |
| `line` | `Write the sentence.` | the first half |
| `accent` | `Get the translation.` | the green half, after it |

And the common ones: `note`, `stamp`, `qr`, `still` ([README.md § "Cards"](../../../README.md#cards)).

## Built from

`stack(logo, lead(line, accent))` in the body.

## How it adapts

- About 80 characters hold on one line; longer, it wraps on balanced lines.
- A paragraph still fits, the body tightened: it's a title card, keep it short.
- **The limit:** two long paragraphs don't fit (`too-much`).

## Timeline

| When | What | Effect |
| :- | :- | :- |
| 0 | the logo | `rise`, 1 s |
| 0.45 | the line | `rise`, 1 s |

## Targets for `anim`

| Selector | Is |
| :- | :- |
| `.logo` | the logo |
| `.lead` | the line |
| `.lead b` | its green half |

## Variants

`default` (compare and quick2) · `other-words` · `long-line` · `two-lines` · `too-much` (error). `node commons/cli/card.mjs title <variant>`.

## Example

```yaml
- id: title
  stage: card
  card: title
  params: { line: Write the sentence., accent: Get the translation. }
```
