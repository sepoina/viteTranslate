import { defineConfig } from "rolldown";
import { transformSync } from "@babel/core";
import packageJson from "./package.json" with { type: "json" };

const banner = `/**
 * ${packageJson.name} v${packageJson.version}
 * ${packageJson.description}
 */`;

// Compila i file .jsx (componente React) via Babel prima del bundle.
//
// `development: false` è dichiarato invece che lasciato al default. In preset-react 7 il
// default è già `false`, quindi oggi non cambia niente; il punto è che un default che
// seguisse NODE_ENV — o che si ribaltasse in una major futura — produrrebbe `jsxDEV` da
// "react/jsx-dev-runtime" invece di `jsxs`, e il bundle PUBBLICATO dipenderebbe
// dall'ambiente di chi lo costruisce. Dichiararlo toglie la domanda: qui il preset resta
// pinnato a ^7 e nessun test esercita la 8, quindi la garanzia deve stare nel comando.
function babelJsx() {
  return {
    name: "babel-jsx",
    transform(code, id) {
      if (!/\.jsx$/.test(id)) return null;
      const result = transformSync(code, {
        filename: id,
        presets: [["@babel/preset-react", { runtime: "automatic", development: false }]],
        babelrc: false,
        configFile: false,
        sourceMaps: true,
      });
      return result?.code ? { code: result.code, map: result.map } : null;
    },
  };
}

// "module" in più di prima: extractMarkers.js carica @babel/core pigramente con
// createRequire(import.meta.url), e createRequire arriva da lì.
const pluginExternal = ["path", "fs", "url", "vm", "module", "@babel/core"];

// Esportato, non solo usato: test/measureReactBundle.mjs lo importa da qui per verificare che
// il bundle runtime non importi nient'altro (vedi reactBundleSize.test.mjs). Una seconda
// copia della lista in un file di test renderebbe quella verifica una verifica della copia —
// aggiungere un external qui e dimenticarlo là, o il contrario, non farebbe rumore.
export const componentExternal = [
  "react", "react/jsx-runtime", "react/jsx-dev-runtime",
  // risolto a build-time dal consumer via il plugin vitetranslate, non dal bundle della libreria
  "virtual:vitetranslate/languages",
];

export default defineConfig([
  // --- Plugin Babel/Vite (ESM) ---
  {
    input: "lib/index.js",
    output: { file: "lib/dist/vitetranslate.es.js", format: "esm", sourcemap: true, banner },
    external: pluginExternal,
  },
  // --- Plugin Babel/Vite (CJS) ---
  {
    input: "lib/index.js",
    output: {
      file: "lib/dist/vitetranslate.cjs",
      format: "cjs",
      sourcemap: true,
      banner,
      exports: "named",
    },
    external: pluginExternal,
  },

  // --- Componente React (ESM) ---
  {
    input: "lib/react/index.js",
    output: { file: "lib/dist/react.es.js", format: "esm", sourcemap: true, banner },
    external: componentExternal,
    plugins: [babelJsx()],
  },
  // --- Componente React (CJS) ---
  {
    input: "lib/react/index.js",
    output: {
      file: "lib/dist/react.cjs",
      format: "cjs",
      sourcemap: true,
      banner,
      exports: "named",
    },
    // Il CJS non ha un bundler che fornisce import.meta.env (niente Vite in mezzo),
    // quindi si comporta sempre come produzione: reso esplicito per non generare warning.
    transform: { define: { "import.meta.env": "{}" } },
    external: componentExternal,
    plugins: [babelJsx()],
  },
]);
