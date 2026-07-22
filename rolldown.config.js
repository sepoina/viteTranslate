import { defineConfig } from "rolldown";
import { transformSync } from "@babel/core";
import packageJson from "./package.json" with { type: "json" };

const banner = `/**
 * ${packageJson.name} v${packageJson.version}
 * ${packageJson.description}
 */`;

// Compila i file .jsx (componente React) via Babel prima del bundle.
function babelJsx() {
  return {
    name: "babel-jsx",
    transform(code, id) {
      if (!/\.jsx$/.test(id)) return null;
      const result = transformSync(code, {
        filename: id,
        presets: [["@babel/preset-react", { runtime: "automatic" }]],
        babelrc: false,
        configFile: false,
        sourceMaps: true,
      });
      return result?.code ? { code: result.code, map: result.map } : null;
    },
  };
}

const pluginExternal = ["path", "fs", "@babel/core"];
const componentExternal = [
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
    external: componentExternal,
    plugins: [babelJsx()],
  },
]);
