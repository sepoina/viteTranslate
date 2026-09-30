// Build dell'estensione: `npm run ide:build` dalla radice del repo.
//
// L'estensione esce in CommonJS (dist/extension.cjs): è il formato che ogni VS Code e ogni
// VSCodium caricano senza chiedere niente. I sorgenti restano ESM come il resto del repo, e
// configFiles.js viene preso da lib/ e impacchettato qui dentro: la lista dei nomi di vite.config
// è una sola, quella del CLI. La sonda esce a parte (dist/probe.mjs) perché gira in un altro
// processo: ESM, così fa `await import()` del config come lo fa il CLI. Lo stesso per la sonda delle
// voci marcate (dist/markedProbe.mjs), che importa la libreria installata nel progetto.
import { defineConfig } from "rolldown";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";

const qui = (file) => fileURLToPath(new URL(file, import.meta.url));
const nodeBuiltins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

export default defineConfig([
  {
    input: qui("./src/extension.mjs"),
    platform: "node",
    // `vscode` non esiste su disco: lo fornisce l'editor a runtime.
    external: ["vscode", ...nodeBuiltins],
    output: { file: qui("./dist/extension.cjs"), format: "cjs", sourcemap: true },
  },
  {
    input: qui("./src/probe.mjs"),
    platform: "node",
    external: nodeBuiltins,
    output: { file: qui("./dist/probe.mjs"), format: "esm" },
  },
  {
    input: qui("./src/markedProbe.mjs"),
    platform: "node",
    external: nodeBuiltins,
    output: { file: qui("./dist/markedProbe.mjs"), format: "esm" },
  },
]);
