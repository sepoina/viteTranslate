// I comandi di contorno dell'estensione, uno o più di fila, nell'ordine dato:
//
//   node idePlugin/scripts/code.mjs build     # src/ → dist/ (rolldown.config.mjs), più i codicons
//   node idePlugin/scripts/code.mjs package   # dist/ → idePlugin/vitetranslate-ide-<versione>.vsix
//   node idePlugin/scripts/code.mjs install   # installa quel .vsix nell'editor
//   node idePlugin/scripts/code.mjs dev       # apre il repo in una finestra "Extension Development Host"
//
// Li lanciano gli script di idePlugin/package.json (un workspace del repo) e gli `ide:*` della
// radice, con la stessa riga: `node … code.mjs build package`, mai `npm run` dentro `npm run`.
// Sotto `npm run` il PATH comincia con i node_modules/.bin di tutte le cartelle sopra il repo, e
// un npm vecchio lì dentro (6.x, trovato davvero) prende il posto di quello vero: non conosce `-w`
// e rilancia la build della libreria, o si pianta. Qui si usa solo il `node` in uso, e il npx
// accanto a lui.
//
// L'editor è `code`; per VSCodium: `VT_CODE_CLI=codium npm run ide:install`.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IDE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = dirname(IDE_DIR);
const manifest = JSON.parse(readFileSync(join(IDE_DIR, "package.json"), "utf8"));
const VSIX = join(IDE_DIR, `${manifest.name}-${manifest.version}.vsix`);
const CLI = process.env.VT_CODE_CLI || "code";

function esegui(comando, argomenti, cwd = REPO_DIR) {
  // shell su Windows: `code` e `npx` lì sono file .cmd, che spawn da solo non lancia. La shell però
  // riceve una riga sola: un percorso con spazi (C:\Program Files\nodejs\npx.cmd) va tra virgolette.
  const shell = process.platform === "win32" && comando !== process.execPath;
  const q = (s) => (shell && /\s/.test(s) ? `"${s}"` : s);
  const r = spawnSync(q(comando), argomenti.map(q), { cwd, stdio: "inherit", shell });
  if (r.error) {
    console.error(`[idePlugin] could not run "${comando}": ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const COMANDI = {
  // rolldown è una devDependency di idePlugin: lo si risolve da qui (nel workspace sta nel
  // node_modules della radice) e se ne lancia il bin col node in uso.
  build() {
    const require = createRequire(join(IDE_DIR, "package.json"));
    const pkg = require.resolve("rolldown/package.json");
    const { bin } = JSON.parse(readFileSync(pkg, "utf8"));
    const cli = join(dirname(pkg), typeof bin === "string" ? bin : bin.rolldown);
    esegui(process.execPath, [cli, "-c", join(IDE_DIR, "rolldown.config.mjs")], IDE_DIR);
    // Le icone della webview (vscode-icon le cerca in un <link id="vscode-codicon-stylesheet">):
    // il css e il font di @vscode/codicons, accanto a webview.js. Il css punta al font con un
    // percorso relativo, quindi basta che stiano nella stessa cartella.
    const codicons = dirname(require.resolve("@vscode/codicons/package.json"));
    for (const file of ["codicon.css", "codicon.ttf"]) copyFileSync(join(codicons, "dist", file), join(IDE_DIR, "dist", file));
    // Il lanciatore del CLI su Windows senza node nel PATH (cliLaunch in syncCommand.mjs): src/ non
    // finisce nel .vsix, dist/ sì.
    copyFileSync(join(IDE_DIR, "src", "core", "runAsNode.cmd"), join(IDE_DIR, "dist", "runAsNode.cmd"));
  },
  package() {
    dist();
    // --no-dependencies: il bundle non ha dipendenze a runtime, e così vsce non chiama npm (che in
    // un workspace npm come questo repo risponderebbe per la radice, non per idePlugin/). Lo stesso
    // fa `"vsce": { "dependencies": false }` in idePlugin/package.json, per un `vsce package` a mano.
    const npx = join(dirname(process.execPath), process.platform === "win32" ? "npx.cmd" : "npx");
    esegui(existsSync(npx) ? npx : "npx", ["--yes", "@vscode/vsce@3", "package", "--no-dependencies", "--out", VSIX], IDE_DIR);
  },
  install() {
    if (!existsSync(VSIX)) {
      console.error(`[idePlugin] ${VSIX} is missing: run \`npm run ide:package\` first.`);
      process.exit(1);
    }
    esegui(CLI, ["--install-extension", VSIX, "--force"]);
    console.log("[idePlugin] installed. No viteTranslate icon in the Activity Bar yet? Run \"Developer: Reload Window\".");
  },
  dev() {
    dist();
    esegui(CLI, [`--extensionDevelopmentPath=${IDE_DIR}`, REPO_DIR]);
  },
};

function dist() {
  if (existsSync(join(IDE_DIR, "dist", "extension.cjs"))) return;
  console.error("[idePlugin] dist/extension.cjs is missing: run `npm run ide:build` first.");
  process.exit(1);
}

const comandi = process.argv.slice(2);
if (!comandi.length || comandi.some((c) => !Object.hasOwn(COMANDI, c))) {
  console.error("usage: node idePlugin/scripts/code.mjs <build|package|install|dev>...");
  process.exit(1);
}
for (const c of comandi) COMANDI[c]();
