// Build dell'estensione: `npm run build` in idePlugin/ (un workspace del repo), o `npm run ide:build`
// dalla radice: tutti e due passano da scripts/code.mjs build.
//
// L'estensione esce in CommonJS (dist/extension.cjs): è il formato che ogni VS Code e ogni
// VSCodium caricano senza chiedere niente. I sorgenti restano ESM come il resto del repo, e
// configFiles.js viene preso da lib/ e impacchettato qui dentro: la lista dei nomi di vite.config
// è una sola, quella del CLI. Allo stesso modo markerSyntax.js: i delimitatori e i nomi della macro
// che evidenziazione e Results leggono sono quelli della libreria. La sonda esce a parte (dist/probe.mjs) perché gira in un altro
// processo: ESM, così fa `await import()` del config come lo fa il CLI. Lo stesso per la sonda delle
// voci marcate (dist/markedProbe.mjs), che importa la libreria installata nel progetto, e per il
// runner dei task del CLI (dist/cliRunner.mjs), che gira nel terminale del task. E gli script
// delle webview di Selector, Project e della sezione facoltativa (dist/webview.js,
// dist/projectWebview.js, dist/optionalWebview.js), che girano in un browser.
//
// Tutto esce minificato: i sorgenti sono molto commentati, e nel .vsix i commenti pesavano quasi
// metà del codice. Per leggere uno stack dell'estensione c'è dist/extension.cjs.map, che resta
// fuori dal .vsix (.vscodeignore) ma accanto alla build di sviluppo.
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
    output: { file: qui("./dist/extension.cjs"), format: "cjs", sourcemap: true, minify: true },
  },
  {
    input: qui("./src/probes/probe.mjs"),
    platform: "node",
    external: nodeBuiltins,
    output: { file: qui("./dist/probe.mjs"), format: "esm", minify: true },
  },
  {
    input: qui("./src/probes/markedProbe.mjs"),
    platform: "node",
    external: nodeBuiltins,
    output: { file: qui("./dist/markedProbe.mjs"), format: "esm", minify: true },
  },
  // Quello che lanciano i task del CLI (cliTasks.mjs): il CLI, poi il conto alla rovescia che
  // chiude il terminale.
  {
    input: qui("./src/core/cliRunner.mjs"),
    platform: "node",
    external: nodeBuiltins,
    output: { file: qui("./dist/cliRunner.mjs"), format: "esm", minify: true },
  },
  // Lo script della sezione Selector: gira nella webview, cioè in un browser. Porta con sé i
  // componenti di @vscode-elements/elements (e Lit) che importa, niente altro.
  {
    input: qui("./src/webViews/selector/webview.mjs"),
    platform: "browser",
    output: { file: qui("./dist/webview.js"), format: "esm", minify: true },
  },
  // Lo script della sezione Project: i file di lingua e la barra dei comandi.
  {
    input: qui("./src/webViews/project/projectWebview.mjs"),
    platform: "browser",
    output: { file: qui("./dist/projectWebview.js"), format: "esm", minify: true },
  },
  // Lo script della sezione facoltativa (Help, il pannello LLM e Inspector, al posto di Results).
  {
    input: qui("./src/webViews/optional/optionalWebview.mjs"),
    platform: "browser",
    output: { file: qui("./dist/optionalWebview.js"), format: "esm", minify: true },
  },
]);
