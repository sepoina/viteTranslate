# viteTranslate — LLM restaurant demo · Vite 8 + React 19

[`llmTranslate`](../../../demo/Vite_8/llmTranslate) fills a page of eight sentences. This one fills a **whole landing
page**: *viteTranslate*, a seafood restaurant that doesn't exist (every mention of its name links
back to this project), with a story, a menu, three tasting
menus, a booking form and a FAQ — 228 sentences written in `it-IT`, and `en-US`, `fr-FR`, `de-DE`,
`ja-JP` shipped at `null`. The language dropdown sits top right.

**Live:** [sepoina.github.io/viteTranslate/llmrestaurant/](https://sepoina.github.io/viteTranslate/llmrestaurant/)

```bash
npm install
cp .env.example .env.local     # paste your key after the `=`
vitetranslate --llm-translate  # estimate first, then it asks before spending anything
npm run dev
```

Same environment as `llmTranslate` (same commands, same `llm` block except `budget: 'normal'` — $1 per
run, $5 per day — because 228 sentences × 4 languages is a bigger bill than eight): read its
[README](../../../demo/Vite_8/llmTranslate/README.md) for the flags, the validator, the model class and where the logs land.

## What's worth a look

- **Text in data, not only in JSX** — menu items, FAQ, image `alt`s live in plain arrays
  (`Menu.jsx`, `photos.js`) as `_%_…_%_` strings, rendered with `<Translate t={item.name} />`.
- **Numbers never go through the tables** — prices and dates are formatted by `Intl` in the
  language on screen (`28 €`, `€28`); only the words around them are translated: `"%s all'etto"`.
- **Attributes too** — `placeholder`, `aria-label`, `title`, `alt` and `document.title` go through
  `useTranslateToString()`.
- **The language sticks** — picking one saves it in `localStorage` (only once it's really on
  screen, via `onDone`); on the next visit `Root.jsx` hands it to `initialLanguage`, if it still
  exists among the tables. `useTranslateLanguage()` works outside the container, so the check
  needs no table loaded.
- **A brief for the model** — [`locale/.llm/context.md`](locale/.llm/context.md) already carries the
  team notes (proper names, dish names, register); the first run writes the generated part above them.

## Only CDN, no UI dependency

[Pico CSS](https://picocss.com) (forms, buttons, the dropdown, the FAQ accordion),
[Phosphor Icons](https://phosphoricons.com) and Google Fonts are linked in `index.html`;
`src/restaurant.css` adds palette, typography and layout. Photos come from
[Unsplash](https://unsplash.com/license), hot-linked, with a sand-coloured placeholder while they
load (or if they never do). Every source is listed in the page footer.
