# outro

The logo and where to find viteTranslate; the music credits at the bottom. Good for: the closing, and a last word after it (with `still`, a stamp, a QR). In the YAML: `card: outro`.

## Params

| Param | Default | |
| :- | :- | :- |
| `lines` | `` `npm i @sepoina/vitetranslate` ``, `VS Code Marketplace: **viteTranslate**`, `github.com/sepoina/viteTranslate` | one per line; `` `code` `` becomes a chip, `**this**` goes bold |
| `credits` | from the recorder | the lines of the video's track in `commons/bkmusic/credits.md`, only when the video has music |

And the common ones: `note`, `stamp`, `qr`, `corner`, `still` ([README.md § "Cards"](../../../README.md#cards)). `qr` is a file next to this sheet: `coffee-qr.svg` is buymeacoffee.com/giancarlogy, as in `.github/FUNDING.yml`.

## Built from

`stack(logo, lines(lines))` in the body; `credits` in the foot.

## How it adapts

- The logo is 85 % of `--logo`. As many lines as needed: ten short ones fit, the body tightened.
- Stamp and QR sit over the bottom right corner, or the one `corner` names (top right is free: the logo is centered); the check stops them from covering a line.
- **The limit:** about twenty lines with the credits don't fit (`too-much`).

## Timeline

| When | What | Effect |
| :- | :- | :- |
| 0 | the logo | `rise` |
| 0.35 + 0.25 × i | each line | `rise` |
| 1.1 | the credits | `rise` |
| `stampAt` (1) | the stamp, with a thud on the frame | `stamp` (also when `still`) |
| `qrAt` (1.5) | the QR | `rise` |

## Targets for `anim`

| Selector | Is |
| :- | :- |
| `.logo` | the logo |
| `.lines li` | the lines |
| `.chip` | the npm command |
| `.credits` | the music credits |
| `.stamp`, `.qr` | the stamp, the QR |

## Variants

`default` (quick2's `outro`) · `credits` (compare's `outro`) · `coffee` (compare's `coffee`) · `stamp-top` (compare2's `coffee`: the stamp top right, no QR) · `more-lines` · `too-much` (error). `node commons/cli/card.mjs outro <variant>`.

## Example

```yaml
- id: coffee
  stage: card
  card: outro # outro's card, already composed (still): the cut doesn't show
  params:
    still: 1
    stamp: Free|Open source|Apache-2.0
    stampAt: 2.9
    qr: coffee-qr.svg
    qrLabel: ☕ Buy me a coffee
    qrAt: 4.7
```

A new QR: `npx qrcode@1.5.4 -t svg -e M -q 0 -d "#0b0f0d" -l "#ffffff" -o commons/components/outro/<name>.svg "<url>"`, then a phone to check it reads.
