# question

A big question, then its answer in a few words lighting up on the voice. Good for: a hook; a question and its answer in keywords. In the YAML: `card: question`.

## Params

| Param | Default | |
| :- | :- | :- |
| `question` | `Another i18n library?` | the headline, `hero` size |
| `words` | `JSX`, `Vite`, `VS Code` | one per line; they wait barely visible, then light up |
| `at` | from 1.6, every 0.6 | one per word |

And the common ones: `note`, `stamp`, `qr`, `still` ([README.md § "Cards"](../../../README.md#cards)).

## Built from

`stack(headline(question, hero), words(words))` in the body.

## How it adapts

- About 25 characters of question on a line; longer, two balanced lines.
- Three or four short words on one row; longer ones wrap on two rows.
- **The limit:** a three-line question with a dozen words doesn't fit (`too-much`).

## Timeline

| When | What | Effect |
| :- | :- | :- |
| 0 | the question | `rise`, 1 s |
| 0.3 | the row of words, waiting | `rise`, 1 s |
| `at` | each word, and the dot before it | `pop`; the dot `light` |

## Targets for `anim`

| Selector | Is |
| :- | :- |
| `h1` | the question |
| `.cluster` | the row of words |
| `.word`, `.dot` | the words, the dots between them |

## Variants

`default` · `hook` (compare's `hook`) · `four-words` · `long` · `too-much` (error). `node commons/cli/card.mjs question <variant>`.

## Example

```yaml
- id: hook
  stage: card
  card: question
  params:
    question: Another i18n library?
    words: |
      JSX
      Vite
      VS Code
    at: 9.1, 10.0, 11.0 # "In your JSX, in Vite, in VS Code"
```
