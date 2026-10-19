// Le versioni: quella di viteTranslate nei package.json delle demo (test/syncDemoDeps.mjs --check), e quelle
// che package-lock.json ripete per la radice e per ogni workspace (idePlugin compreso). Una versione cambiata
// a mano in un package.json lascia indietro il lockfile: la CI non fallisce, ma il lockfile resta vecchio.
// Il fix allinea le demo (npm run sync:demos) e poi il lockfile (npm install --package-lock-only).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nonSoddisfatte } from "../syncDemoDeps.mjs";
import { npm } from "./spawnNpm.mjs";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "../..");

export const name = "demos";
export const description = "the viteTranslate version in every demo, the versions in package-lock.json";

/**
 * I pacchetti del repo la cui versione in package-lock.json non è quella del loro package.json.
 * @param {string} [radice]
 * @returns {string[]} una riga per pacchetto: "idePlugin: 0.9.4 in the lockfile, 0.9.5 in package.json"
 */
export function lockIndietro(radice = RADICE) {
  const lockFile = join(radice, "package-lock.json");
  if (!existsSync(lockFile)) return [];
  const lock = JSON.parse(readFileSync(lockFile, "utf8"));
  const righe = [];
  // La radice è la voce "", i workspace sono le voci fuori da node_modules/.
  for (const [percorso, voce] of Object.entries(lock.packages ?? {})) {
    if (percorso.includes("node_modules/")) continue;
    const pkgFile = join(radice, percorso, "package.json");
    if (!existsSync(pkgFile)) continue;
    const versione = JSON.parse(readFileSync(pkgFile, "utf8")).version;
    if (versione !== undefined && voce.version !== versione) {
      righe.push(`${percorso || "(root)"}: ${voce.version ?? "(none)"} in the lockfile, ${versione} in package.json`);
    }
  }
  return righe;
}

export async function fix() {
  const righe = [];
  if (nonSoddisfatte().length) {
    const r = spawnSync(process.execPath, [join(RADICE, "test/syncDemoDeps.mjs")], { cwd: RADICE, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`test/syncDemoDeps.mjs failed: ${(r.stdout ?? "") + (r.stderr ?? "")}`);
    righe.push(`demo dependencies aligned (${r.stdout.trim().split("\n").join("; ")})`);
  }
  if (lockIndietro().length) {
    const { status, coda } = await npm(["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"]);
    if (status !== 0) throw new Error(`npm install --package-lock-only failed:\n${coda.join("\n")}`);
    righe.push("package-lock.json aligned to the package.json versions");
  }
  return righe;
}

export async function run({ log = () => {} } = {}) {
  log("node test/syncDemoDeps.mjs --check (writes nothing)");
  const r = spawnSync(process.execPath, [join(RADICE, "test/syncDemoDeps.mjs"), "--check"], { cwd: RADICE, encoding: "utf8" });
  const lines = [];
  if (r.status !== 0) lines.push("demo dependencies out of date: run npm run sync:demos", ...((r.stdout ?? "") + (r.stderr ?? "")).trim().split("\n"));
  log("comparing the versions in package-lock.json with each package.json");
  const lock = lockIndietro();
  if (lock.length) lines.push("package-lock.json out of date: run npm install --package-lock-only", ...lock);
  return { level: lines.length ? "ko" : "ok", lines };
}
