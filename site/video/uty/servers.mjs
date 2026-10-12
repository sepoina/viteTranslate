// I due server di una ripresa: VS Code nel browser (`code serve-web`) e il `vite dev` del progetto
// copiato in capture/. Entrambi partono su una porta libera e si spengono con stop(), albero dei
// processi compreso.
//
// VS Code è una "copia controllata": dati del server, estensioni e impostazioni stanno in
// site/video/.cache/vscode, mai nel profilo dell'utente. L'estensione installata è quella del
// repo (idePlugin/<nome>-<versione>.vsix, costruita con `code.mjs build package` se manca), non
// quella del Marketplace: il video mostra la prossima release.
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { CACHE_DIR, REPO_DIR } from "./storyboard.mjs";

const IS_WIN = process.platform === "win32";

export function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (IS_WIN) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

/** Aspetta una riga dell'output che passi `re`; rifiuta se il processo esce prima o scade il tempo. */
function aspettaRiga(child, re, ms, nome) {
  return new Promise((ok, ko) => {
    let buf = "";
    const timer = setTimeout(() => ko(new Error(`${nome}: no "${re}" within ${ms / 1000} s\n${buf.slice(-800)}`)), ms);
    const leggi = (d) => {
      buf += d;
      const m = re.exec(buf);
      if (m) {
        clearTimeout(timer);
        ok(m);
      }
    };
    child.stdout.on("data", leggi);
    child.stderr.on("data", leggi);
    child.on("exit", (code) => {
      clearTimeout(timer);
      ko(new Error(`${nome} exited (${code}) before it was ready\n${buf.slice(-800)}`));
    });
  });
}

// ---------------------------------------------------------------- VS Code

function trovaCodeTunnel() {
  const candidati = [
    process.env.VT_VIDEO_CODE_TUNNEL,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs/Microsoft VS Code/bin/code-tunnel.exe"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Microsoft VS Code/bin/code-tunnel.exe"),
  ].filter(Boolean);
  const trovato = candidati.find((c) => existsSync(c));
  if (trovato) return { command: trovato, args: ["serve-web"] };
  if (!IS_WIN) return { command: "code", args: ["serve-web"] }; // macOS/Linux: il `code` del PATH
  throw new Error("VS Code not found: set VT_VIDEO_CODE_TUNNEL to its bin/code-tunnel.exe");
}

/** Il code-server del server web scaricato da serve-web (cli/serve-web/<commit>/bin): il più recente. */
function trovaCodeServer(cliDir) {
  const base = join(cliDir, "serve-web");
  if (!existsSync(base)) return null;
  const nome = IS_WIN ? "code-server.cmd" : "code-server";
  const trovati = readdirSync(base)
    .map((d) => join(base, d, "bin", nome))
    .filter((f) => existsSync(f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return trovati[0] ?? null;
}

const percorsoVsix = () => {
  const manifest = JSON.parse(readFileSync(join(REPO_DIR, "idePlugin/package.json"), "utf8"));
  return { manifest, vsix: join(REPO_DIR, "idePlugin", `${manifest.name}-${manifest.version}.vsix`) };
};

/** Quale .vsix si installerebbe adesso (nome, dimensione, data), o null se va costruito: entra nell'impronta del palco (record.mjs). */
export function vsixStamp() {
  const { vsix } = percorsoVsix();
  if (!existsSync(vsix)) return null;
  const s = statSync(vsix);
  return `${basename(vsix)}|${s.size}|${s.mtimeMs}`;
}

/** Il .vsix dell'estensione del repo; lo costruisce se manca o se `rebuild`. */
function vsixDelRepo({ rebuild }) {
  const { manifest, vsix } = percorsoVsix();
  if (rebuild || !existsSync(vsix)) {
    console.log(`  building ${manifest.name} ${manifest.version}…`);
    const r = spawnSync(process.execPath, [join(REPO_DIR, "idePlugin/scripts/code.mjs"), "build", "package"], { stdio: "inherit" });
    if (r.status !== 0 || !existsSync(vsix)) throw new Error("the extension build failed");
  }
  return vsix;
}

// A server spento: con serve-web acceso, il server riscrive extensions.json a modo suo e la
// cartella appena installata sparisce (l'installazione dice "successfully" lo stesso).
function installaEstensione({ cliDir, serverDir, rebuild }) {
  const codeServer = trovaCodeServer(cliDir);
  const vsix = vsixDelRepo({ rebuild });
  const { publisher, name, version } = JSON.parse(readFileSync(join(REPO_DIR, "idePlugin/package.json"), "utf8"));
  const installata = join(serverDir, "extensions", `${publisher}.${name}-${version}`);
  const s = statSync(vsix);
  const timbro = `${vsix}|${s.size}|${s.mtimeMs}`;
  const fileTimbro = join(serverDir, "vt-extension.txt");
  if (existsSync(installata) && existsSync(fileTimbro) && readFileSync(fileTimbro, "utf8") === timbro) return;
  console.log(`  installing ${vsix.split(/[\\/]/).pop()} into the isolated VS Code…`);
  const r = spawnSync(`"${codeServer}" --server-data-dir "${serverDir}" --install-extension "${vsix}" --force`, {
    shell: true,
    encoding: "utf8",
  });
  if (r.status !== 0 || !existsSync(installata)) throw new Error(`extension install failed:\n${r.stdout}\n${r.stderr}`);
  writeFileSync(fileTimbro, timbro);
}

// `env`: variabili in più per il server, e quindi per i suoi terminali (vscode.env dello YAML).
function avviaServeWeb({ serverDir, cliDir, log, env = {} }) {
  const { command, args } = trovaCodeTunnel();
  const child = spawn(
    command,
    [...args, "--host", "127.0.0.1", "--port", "0", "--without-connection-token", "--accept-server-license-terms",
      "--disable-telemetry", "--server-data-dir", serverDir, "--cli-data-dir", cliDir],
    { stdio: ["ignore", "pipe", "pipe"], shell: !IS_WIN, env: { ...process.env, ...env } },
  );
  const out = createWriteStream(log, { flags: "a" });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  const stop = () => killTree(child);
  return aspettaRiga(child, /Web UI available at (http\S+)/, 60_000, "serve-web").then(
    ([, url]) => ({ url: url.replace(/\/$/, ""), stop }),
    (e) => {
      stop();
      throw e;
    },
  );
}

/**
 * @param {{ settings: object, rebuild?: boolean, log: string, env?: Record<string, string> }} p
 * @returns {Promise<{ url: string, stop: () => void }>}
 */
export async function startVscode({ settings, rebuild = false, log, env = {} }) {
  const serverDir = join(CACHE_DIR, "vscode/server");
  const cliDir = join(CACHE_DIR, "vscode/cli");
  // Le impostazioni "Machine" del server valgono per tutte le finestre; quelle con scope
  // "application" (fiducia, editor di avvio) le scrive anche director.mjs nelle impostazioni utente.
  mkdirSync(join(serverDir, "data/Machine"), { recursive: true });
  writeFileSync(join(serverDir, "data/Machine/settings.json"), JSON.stringify(settings, null, 2));
  writeFileSync(log, "");

  if (!trovaCodeServer(cliDir)) {
    // Prima volta: il server vero si scarica alla prima richiesta (la pagina risponde subito, il
    // download continua in .staging-…). Ci vuole un minuto; poi si spegne per installare.
    console.log("  downloading the VS Code server (first run only)…");
    const primo = await avviaServeWeb({ serverDir, cliDir, log });
    try {
      const fine = Date.now() + 300_000;
      while (!trovaCodeServer(cliDir)) {
        if (Date.now() > fine) throw new Error(`serve-web downloaded no server in ${cliDir}`);
        await fetch(primo.url, { signal: AbortSignal.timeout(300_000) }).catch(() => {});
        await new Promise((r) => setTimeout(r, 2000));
      }
    } finally {
      primo.stop();
    }
  }
  installaEstensione({ cliDir, serverDir, rebuild });
  return avviaServeWeb({ serverDir, cliDir, log, env });
}

// ---------------------------------------------------------------- vite dev

/**
 * Il dev server del progetto copiato. Vite e le dipendenze arrivano dai node_modules della
 * radice del repo, risalendo le cartelle: capture/ resta dentro il repo apposta.
 * @returns {Promise<{ url: string, stop: () => void }>}
 */
export async function startApp({ dir, port, log }) {
  const req = createRequire(join(dir, "package.json"));
  const pkgVite = req.resolve("vite/package.json");
  const binVite = join(dirname(pkgVite), JSON.parse(readFileSync(pkgVite, "utf8")).bin.vite);
  const child = spawn(process.execPath, [binVite, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", BROWSER: "none" },
  });
  const out = createWriteStream(log);
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  const stop = () => killTree(child);
  try {
    await aspettaRiga(child, /Local:\s+http/, 60_000, "vite dev");
    return { url: `http://127.0.0.1:${port}/`, stop };
  } catch (e) {
    stop();
    throw e;
  }
}
