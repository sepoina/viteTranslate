<!-- LINKED-DATA: README.md § Quick start shows these files step by step. Change a step there, change this demo too. -->

# viteTranslate — quickApp · Vite 8 + React 19

The [quick start](https://github.com/sepoina/viteTranslate#-quick-start), finished: what you get
after its six steps, nothing more. One sentence in [`src/App.jsx`](src/App.jsx), English as the
source language, French filled in by hand, two buttons to switch.

```bash
npm install
npm run dev
```

## Try the loop

- **Change the sentence** in `src/App.jsx` and restart `npm run dev`: the key follows, the
  French translation is left `null` to fill again.
- **Add a language**: `npx vitetranslate --add de-DE`, then fill the `null` in `locale/de-DE.yml`.
- **Check where you stand**: `npx vitetranslate --status`.

## Where to go next

- **The full tour**: the [playground](https://sepoina.github.io/viteTranslate/playground/), live.
- **More to start from**: the other demos, from minimal to LLM-translated, at the bottom of the
  [site](https://sepoina.github.io/viteTranslate/).
- **Every option**: the [guides](https://github.com/sepoina/viteTranslate#guides).

Open it on [StackBlitz](https://stackblitz.com/github/sepoina/viteTranslate/tree/main/demo/Vite_8/quickApp?file=src/App.jsx),
or grab the [zip](https://sepoina.github.io/viteTranslate/zip/demo/vite8-quick-app.zip).
