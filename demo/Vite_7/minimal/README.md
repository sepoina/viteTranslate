# Vite 7 + React 18 (solo JS/JSX)

Setup minimale, senza TypeScript, con ESLint 10 in flat config. È la stessa app della cartella
`Vite_8`, portata sulla riga 7 di Vite e su React 18 — la combinazione più probabile in un
progetto esistente, ed è anche il minimo che la libreria dichiara di supportare
(`react: ^18.0.0 || ^19.0.0`). Il sorgente dell'app è identico a quello della copia React 19:
niente nel runtime della libreria richiede il 19.

## Uso

```bash
npm install
npm run dev      # dev server
npm run build    # build di produzione (Rollup)
npm run preview  # anteprima della build
npm run lint     # ESLint
```

## Cosa cambia rispetto alla versione Vite 8

| | Vite 8 | Vite 7 |
| --- | --- | --- |
| bundler di build | Rolldown | Rollup |
| pre-bundling in dev | passa dai plugin del progetto | processo esbuild separato |
| `react` / `react-dom` | `^19` | `^18` |
| `@vitejs/plugin-react` | `^6` | `^5` — il 6 richiede `vite ^8.0.0` |
| pacchetti Rolldown | `rolldown`, `@rolldown/binding-wasm32-wasi` | non servono |

Nel codice dell'app e nel `vite.config.js` **non cambia nulla**: le differenze stanno tutte nel
`package.json`.

Vale la pena sapere perché, però. Su Vite 7 il pre-bundling delle dipendenze gira in un processo
esbuild separato, che non vede i plugin del progetto e quindi non sa risolvere
`virtual:vitetranslate/languages` — l'id che il plugin genera. Fino alla **2.2.1** il dev server
moriva in partenza e serviva un `optimizeDeps: { exclude: ['@sepoina/vitetranslate'] }` scritto a
mano qui; dalla **2.2.2** l'esclusione la dichiara il plugin stesso, quindi la configurazione
resta identica a quella della copia Vite 8. Su Vite 8 il problema non si presenta: lì l'optimizer
passa dal plugin container.

## StackBlitz

Importa lo zip da https://stackblitz.com (New project > Import).
Vite 7 usa Rollup e esbuild, entrambi già disponibili in WebContainer: nessun binding WASM da
installare.
