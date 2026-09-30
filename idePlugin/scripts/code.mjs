// I comandi di contorno dell'estensione, lanciati dagli script `ide:*` della radice:
//
//   node idePlugin/scripts/code.mjs package   # dist/ → idePlugin/vitetranslate-ide-<versione>.vsix
//   node idePlugin/scripts/code.mjs install   # installa quel .vsix nell'editor
//   node idePlugin/scripts/code.mjs dev       # apre il repo in una finestra "Extension Development Host"
//
// L'editor è `code`; per VSCodium: `VT_CODE_CLI=codium npm run ide:install`.
// Presuppongono `npm run ide:build` già fatto: gli script della radice lo concatenano.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IDE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = dirname(IDE_DIR);
const manifest = JSON.parse(readFileSync(join(IDE_DIR, "package.json"), "utf8"));
const VSIX = join(IDE_DIR, `${manifest.name}-${manifest.version}.vsix`);
const CLI = process.env.VT_CODE_CLI || "code";

function esegui(comando, argomenti, cwd = REPO_DIR) {
  // shell su Windows: `code` e `npx` lì sono file .cmd, che spawn da solo non lancia.
  const r = spawnSync(comando, argomenti, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.error) {
    console.error(`[idePlugin] could not run "${comando}": ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const comando = process.argv[2];
if (!existsSync(join(IDE_DIR, "dist", "extension.cjs"))) {
  console.error("[idePlugin] dist/extension.cjs is missing: run `npm run ide:build` first.");
  process.exit(1);
}

if (comando === "package") {
  // --no-dependencies: il bundle non ha dipendenze a runtime, e così vsce non chiama npm (che in
  // un workspace npm come questo repo risponderebbe per la radice, non per idePlugin/).
  //
  // Il npx è quello accanto al `node` in uso, non il primo nel PATH: sotto `npm run` il PATH
  // comincia con i node_modules/.bin di tutte le cartelle sopra il repo, e un npx vecchio lì dentro
  // nasconde quello vero (lo scambia per "comando non trovato: package").
  const npx = join(dirname(process.execPath), process.platform === "win32" ? "npx.cmd" : "npx");
  esegui(existsSync(npx) ? npx : "npx", ["--yes", "@vscode/vsce@3", "package", "--no-dependencies", "--out", VSIX], IDE_DIR);
} else if (comando === "install") {
  if (!existsSync(VSIX)) {
    console.error(`[idePlugin] ${VSIX} is missing: run \`npm run ide:package\` first.`);
    process.exit(1);
  }
  esegui(CLI, ["--install-extension", VSIX, "--force"]);
  console.log("[idePlugin] installed. No viteTranslate icon in the Activity Bar yet? Run \"Developer: Reload Window\".");
} else if (comando === "dev") {
  esegui(CLI, [`--extensionDevelopmentPath=${IDE_DIR}`, REPO_DIR]);
} else {
  console.error("usage: node idePlugin/scripts/code.mjs <package|install|dev>");
  process.exit(1);
}
