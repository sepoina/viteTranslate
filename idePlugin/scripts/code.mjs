// I comandi di contorno dell'estensione, uno o più di fila, nell'ordine dato:
//
//   node idePlugin/scripts/code.mjs build     # src/ → dist/ (rolldown.config.mjs), più i codicons
//   node idePlugin/scripts/code.mjs package   # dist/ → idePlugin/vitetranslate-ide-<versione>.vsix
//   node idePlugin/scripts/code.mjs install   # installa quel .vsix nell'editor
//   node idePlugin/scripts/code.mjs dev       # apre il repo in una finestra "Extension Development Host"
//   node idePlugin/scripts/code.mjs check     # si può pubblicare? commit pulito, versione nuova, libreria su npm
//   node idePlugin/scripts/code.mjs test      # i test dell'estensione e dell'ingresso ./ide/scan
//   node idePlugin/scripts/code.mjs upload    # apre la pagina del publisher e mostra il .vsix da caricare
//   node idePlugin/scripts/code.mjs tag       # versione sul Marketplace → tag ide-v<versione> su HEAD, e push
//
// Pubblicare a mano, finché il Marketplace non accetta l'OIDC di publish_extension.yml:
// `npm run ide:release` (check test build package upload), poi, a upload verificato, `npm run ide:tag`.
// `check` è lo stesso del workflow: AGENTS.md, "REGOLE DI RILASCIO", vuole la stessa verifica ovunque.
//
// Li lanciano gli script di idePlugin/package.json (un workspace del repo) e gli `ide:*` della
// radice, con la stessa riga: `node … code.mjs build package`, mai `npm run` dentro `npm run`.
// Sotto `npm run` il PATH comincia con i node_modules/.bin di tutte le cartelle sopra il repo, e
// un npm vecchio lì dentro (6.x, trovato davvero) prende il posto di quello vero: non conosce `-w`
// e rilancia la build della libreria, o si pianta. Qui si usa solo il `node` in uso, e il npx
// accanto a lui.
//
// L'editor è `code`; per VSCodium: `VT_CODE_CLI=codium npm run ide:install`.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IDE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = dirname(IDE_DIR);
const manifest = JSON.parse(readFileSync(join(IDE_DIR, "package.json"), "utf8"));
const VSIX = join(IDE_DIR, `${manifest.name}-${manifest.version}.vsix`);
const CLI = process.env.VT_CODE_CLI || "code";
// L'id sul Marketplace, e il vsce di package, show e del controllo. Il publish OIDC del workflow
// ne usa un altro (VSCE in publish_extension.yml): solo quello ha bisogno della 4.0.1.
const ID = `${manifest.publisher}.${manifest.name}`;
const VSCE = "@vscode/vsce@3";
const LIB = "@sepoina/vitetranslate";

// npx e npm accanto al node in uso, come per il resto (vedi sopra): non quelli che il PATH di
// `npm run` mette davanti.
function bin(nome) {
  const accanto = join(dirname(process.execPath), process.platform === "win32" ? `${nome}.cmd` : nome);
  return existsSync(accanto) ? accanto : nome;
}

// Un errore che ferma tutto. In GitHub Actions come annotazione, che si vede nel riepilogo del run.
function ferma(messaggio) {
  console.error(process.env.GITHUB_ACTIONS === "true" ? `::error::${messaggio}` : `[idePlugin] ${messaggio}`);
  process.exit(1);
}

function lancia(comando, argomenti, opzioni) {
  // shell su Windows: `code` e `npx` lì sono file .cmd, che spawn da solo non lancia. La shell però
  // riceve una riga sola: un percorso con spazi (C:\Program Files\nodejs\npx.cmd) va tra virgolette.
  // E la riga gliela si dà già composta: argomenti a parte con la shell sono deprecati (DEP0190), e
  // Node li unirebbe allo stesso modo.
  const shell = process.platform === "win32" && comando !== process.execPath;
  const q = (s) => (/\s/.test(s) ? `"${s}"` : s);
  const r = shell ? spawnSync([comando, ...argomenti].map(q).join(" "), { ...opzioni, shell }) : spawnSync(comando, argomenti, opzioni);
  if (r.error) ferma(`could not run "${comando}": ${r.error.message}`);
  return r;
}

function esegui(comando, argomenti, cwd = REPO_DIR) {
  const r = lancia(comando, argomenti, { cwd, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// Come esegui, ma l'uscita torna come testo invece di andare a schermo; un codice diverso da 0 non
// ferma niente: lo guarda chi chiama.
function leggi(comando, argomenti, cwd = REPO_DIR) {
  const r = lancia(comando, argomenti, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}

// Le versioni di questa estensione sul Marketplace, [] se non c'è ancora: `vsce show --json` per
// un'estensione che non esiste stampa "undefined". Se il Marketplace non risponde ci si ferma,
// meglio che tirare a indovinare.
function marketplace() {
  const r = leggi(bin("npx"), ["--yes", VSCE, "show", ID, "--json"]);
  if (!r.ok) ferma(`could not ask the Marketplace about ${ID}:\n${r.err.trim()}`);
  const testo = r.out.trim();
  if (testo === "undefined") return [];
  try {
    return (JSON.parse(testo).versions ?? []).map((v) => v.version);
  } catch {
    ferma(`unexpected answer from vsce show:\n${testo.slice(0, 300)}`);
  }
}

// La pagina nel browser e il file nella sua cartella, coi programmi del sistema. Staccati e senza
// aspettarli: explorer.exe esce con 1 anche quando va tutto bene. Su Windows gli argomenti passano
// così come sono: `/select,"…"` vuole le virgolette solo attorno al percorso.
function apri(url, file) {
  const comandi = {
    win32: [["cmd", ["/c", "start", '""', url]], ["explorer", [`/select,"${file}"`]]],
    darwin: [["open", [url]], ["open", ["-R", file]]],
  }[process.platform] ?? [["xdg-open", [url]], ["xdg-open", [dirname(file)]]];
  for (const [comando, argomenti] of comandi) {
    spawn(comando, argomenti, { stdio: "ignore", detached: true, windowsVerbatimArguments: true }).on("error", () => {}).unref();
  }
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
    esegui(bin("npx"), ["--yes", VSCE, "package", "--no-dependencies", "--out", VSIX], IDE_DIR);
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
  // Si può pubblicare? Tre condizioni, la prima che manca ferma tutto. Le stesse in locale
  // (ide:release) e su GitHub (publish_extension.yml).
  async check() {
    // 1. Il .vsix viene da un commit: il tag ide-v<versione> segna quello, e su GitHub si
    //    impacchetta quello. Contano solo i file tracciati: gli scarti dei test non fermano niente.
    const stato = leggi("git", ["status", "--porcelain", "--untracked-files=no"]);
    if (!stato.ok) ferma(`git status failed:\n${stato.err.trim()}`);
    if (stato.out.trim()) ferma(`uncommitted changes, commit them first (the .vsix must come from a commit):\n${stato.out.trimEnd()}`);
    // 2. La versione non è già sul Marketplace: chi pubblica ha dimenticato di alzarla.
    if (marketplace().includes(manifest.version)) ferma(`${ID}@${manifest.version} is already on the Marketplace: raise "version" in idePlugin/package.json.`);
    // 3. Su npm c'è la libreria che porta l'IDE_API dell'estensione (AGENTS.md, "REGOLE DI
    //    RILASCIO"). LIB_MIN e olderThan (il suffisso -rc non conta) vengono dall'estensione stessa:
    //    una regola sola, quella con cui giudica la libreria dell'utente. Vale "latest" e, finché
    //    l'estensione è in preview, anche "next": tolta la preview la regola torna rigida da sola.
    const { LIB_MIN } = await import("../src/probes/markedScan.mjs");
    const { olderThan } = await import("../src/webViews/optional/settings/inspectorState.mjs");
    const tags = manifest.preview === true ? ["latest", "next"] : ["latest"];
    const pubblicate = tags.map((tag) => [tag, leggi(bin("npm"), ["view", `${LIB}@${tag}`, "version"]).out.trim()]);
    console.log(`[idePlugin] ${pubblicate.map(([tag, v]) => `npm ${tag}: ${v || "(none)"}`).join(", ")}; needed: ${LIB_MIN}`);
    const pronta = pubblicate.find(([, v]) => v && !olderThan(v, LIB_MIN));
    if (!pronta) ferma(`no ${LIB} on npm (${tags.join(", ")}) reaches ${LIB_MIN}: publish the library first (AGENTS.md, REGOLE DI RILASCIO).`);
    console.log(`[idePlugin] ready to publish ${ID}@${manifest.version}, library ${pronta[1]} on ${pronta[0]}.`);
  },
  // Gli stessi test del workflow: quelli dell'estensione e dell'ingresso ./ide/scan che Results legge.
  test() {
    esegui(process.execPath, [join(REPO_DIR, "test", "run.mjs"), "idePlugin", "ideScan"]);
  },
  // Il Marketplace non accetta ancora l'OIDC di publish_extension.yml, e un PAT nel repo non lo
  // vogliamo: il .vsix si carica a mano dalla pagina del publisher. Qui la si apre e si mostra il file.
  upload() {
    if (!existsSync(VSIX)) ferma(`${VSIX} is missing: run \`npm run ide:package\` first.`);
    const pagina = `https://marketplace.visualstudio.com/manage/publishers/${manifest.publisher}`;
    apri(pagina, VSIX);
    console.log(
      [
        `[idePlugin] ${basename(VSIX)} is ready: upload it on ${pagina}`,
        "  first time:  New extension > Visual Studio Code > drop the .vsix",
        "  later:       the extension's ... menu > Update > drop the .vsix",
        "  Once Microsoft has verified it (a few minutes): npm run ide:tag",
      ].join("\n"),
    );
  },
  // Dopo un upload a mano, come fa il workflow dopo un publish: il tag ide-v<versione> su HEAD, e il
  // push. Solo quando la versione è davvero sul Marketplace. HEAD è il commit del .vsix se nel
  // frattempo non ne hai fatti altri: check lo voleva pulito.
  tag() {
    const tag = `ide-v${manifest.version}`;
    if (!marketplace().includes(manifest.version)) ferma(`${ID}@${manifest.version} is not on the Marketplace yet (Microsoft may still be verifying it): try again in a few minutes.`);
    if (leggi("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`]).ok) {
      console.log(`[idePlugin] ${tag} is already on origin.`);
      return;
    }
    // Un tag locale rimasto da un push non riuscito si riusa, non si rifà.
    if (!leggi("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]).ok) esegui("git", ["tag", tag, "HEAD"]);
    esegui("git", ["push", "origin", `refs/tags/${tag}`]);
    console.log(`[idePlugin] ${tag} pushed.`);
  },
};

function dist() {
  if (existsSync(join(IDE_DIR, "dist", "extension.cjs"))) return;
  console.error("[idePlugin] dist/extension.cjs is missing: run `npm run ide:build` first.");
  process.exit(1);
}

const comandi = process.argv.slice(2);
if (!comandi.length || comandi.some((c) => !Object.hasOwn(COMANDI, c))) {
  console.error(`usage: node idePlugin/scripts/code.mjs <${Object.keys(COMANDI).join("|")}>...`);
  process.exit(1);
}
for (const c of comandi) await COMANDI[c]();
