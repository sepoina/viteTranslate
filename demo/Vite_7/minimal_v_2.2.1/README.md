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
| `optimizeDeps.exclude` | non serve | serve con la 2.2.1, vedi `vite.config.js` |

L'ultima riga è l'unica differenza che si vede nel codice: con la **2.2.1** il pre-bundling di
Vite 7 non riesce a risolvere `virtual:vitetranslate/languages` (lo genera il plugin, che
esbuild non vede) e il dev server non parte. L'esclusione in `vite.config.js` lo risolve; dalla
versione successiva la dichiara il plugin stesso e quelle righe si possono togliere.

## StackBlitz

Importa lo zip da https://stackblitz.com (New project > Import).
Vite 7 usa Rollup e esbuild, entrambi già disponibili in WebContainer: nessun binding WASM da
installare.
