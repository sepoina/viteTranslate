# viteTranslate — demo minimale · Vite 8 + React 19 (solo JS/JSX)

Il setup più piccolo che mostri la libreria all'opera: nessun TypeScript, ESLint 10 in flat
config, tre lingue (`it-IT` sorgente, `en-US`, `zh-CN`) e due soli file di codice —
[`src/main.jsx`](src/main.jsx) monta `<TranslateContainer>`, [`src/App.jsx`](src/App.jsx) traduce
i testi e ruota la lingua con `useTranslateLanguage()`.

I testi da tradurre stanno **nel sorgente**, marcati con `_%_..._%_`: non ci sono chiavi da
inventare. Le tabelle in [`src/locale/`](src/locale) le genera il comando di sync, leggendo i
marcatori dal codice.

## Dove trovare il resto

- **Pagina del progetto** — [github.com/sepoina/viteTranslate](https://github.com/sepoina/viteTranslate): README, API e [architettura](https://github.com/sepoina/viteTranslate/blob/main/doc/structure.md)
- **Playground live** — [sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/), sorgente in [`playground/`](https://github.com/sepoina/viteTranslate/tree/main/playground)
- **Pacchetto npm** — [@sepoina/vitetranslate](https://www.npmjs.com/package/@sepoina/vitetranslate)
- **Offrimi un caffè** ☕ — [buymeacoffee.com/giancarlogy](https://buymeacoffee.com/giancarlogy)

Il playground è la versione ricca — markup nelle traduzioni, segnaposto, lingue caricate
pigramente, code splitting. Questa cartella è il contrario: il minimo indispensabile per
partire.

## Uso

```bash
npm install
npm run dev      # dev server
npm run build    # build di produzione (Rolldown)
npm run preview  # anteprima della build
npm run lint     # ESLint
```

Le tabelle non le aggiorna il dev server: le scrive il comando
`vitetranslate-prepare-translation-table`, qui esposto come `npm run prebuild` e già agganciato a
`npm run build` dal ciclo di vita di npm. Quindi dopo aver aggiunto o cambiato un testo marcato
nel sorgente, `npm run prebuild` (o direttamente `npm run build`) è il passo che porta la novità
nei file di `src/locale/`. In dev il salvataggio di un file di lingua ricarica la pagina, così la
traduzione appena scritta si vede subito.

## StackBlitz

Importa lo zip da [stackblitz.com](https://stackblitz.com) (New project > Import).
Vite 8 usa Rolldown: in WebContainer viene installato automaticamente il binding WASM.

Se ti serve la riga 7 di Vite, o React 18, la stessa app è in [`demo/Vite_7/minimal`](../../Vite_7/minimal).
