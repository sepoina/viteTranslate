# title

The logo, then a line with a green half, and (with `words`) a second line whose words light up one after another. Good for: the opening, the closing claim. In the YAML: `card: title`.

## Params

| Param | Default | |
| :- | :- | :- |
| `line` | `Write the sentence.` | the first half |
| `accent` | `Get the translation.` | the green half, after it |
| `words` | none | a second line under it, one word per line; they wait barely visible, then light up |
| `at` | from 1.6, every 0.5 | one per word |

And the common ones: `note`, `stamp`, `qr`, `still` ([README.md § "Cards"](../../../README.md#cards)).

## Built from

`stack(logo, stack.claim(lead(line, accent), words(words)))` in the body (`words` at `body` size, only if given). The claim and its words are one block: no gap, line spacing 160% (`.stack.claim` in card.css), so the words read as the claim's second line: in the second accent (`--accent-2`, cyan) at 80%, the dots between them the same, the words close together (`--gap` `--space-m`).

## How it adapts

- About 80 characters hold on one line; longer, it wraps on balanced lines.
- A paragraph still fits, the body tightened: it's a title card, keep it short.
- Four short words on one row; longer ones wrap on two rows.
- **The limit:** two long paragraphs don't fit (`too-much`).

## Timeline

| When | What | Effect |
| :- | :- | :- |
| 0 | the logo | `rise`, 1 s |
| 0.45 | the line | `rise`, 1 s |
| 0.9 | the row of words, waiting | `rise`, 1 s |
| `at` | each word, and the dot before it | `pop`; the dot `light` |

## Targets for `anim`

| Selector | Is |
| :- | :- |
| `.logo` | the logo |
| `.lead` | the line |
| `.lead b` | its green half |
| `.cluster` | the row of words |
| `.word`, `.dot` | the words, the dots between them |

## Variants

`default` (compare and quick2) · `other-words` · `long-line` · `two-lines` · `claim` (gif20t) · `too-much` (error). `node commons/cli/card.mjs title <variant>`.

## Example

```yaml
- id: title
  stage: card
  card: title
  params: { line: Write the sentence., accent: Get the translation. }
```

With the second line:

```yaml
  params:
    line: One toolchain.
    accent: Every user's language.
    words: |
      VS Code
      Vite
      LLM
      React
    at: 1.6, 2.1, 2.6, 3.1
```
