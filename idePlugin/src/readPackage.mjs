// Il package.json accanto al vite.config, e le versioni davvero installate delle dipendenze che
// contano per viteTranslate. Solo lettura di file: nessun codice del progetto viene eseguito,
// quindi vale anche in Restricted Mode.
import fs from "node:fs";
import path from "node:path";

// Le dipendenze che il pannello nomina, in quest'ordine. Le altre non dicono niente su
// viteTranslate e allungherebbero la lista.
export const WATCHED = ["@sepoina/vitetranslate", "vite", "react", "react-dom", "@vitejs/plugin-react", "@babel/core"];

/**
 * La versione installata di `name` vista da `dir`: risale le cartelle cercando
 * node_modules/<name>/package.json, come fa la risoluzione di Node. Letta dal file e non con
 * `require.resolve`, perché un pacchetto può non esportare "./package.json".
 *
 * @returns {string | null}
 */
export function installedVersion(dir, name) {
  for (let cartella = dir; ; cartella = path.dirname(cartella)) {
    const file = path.join(cartella, "node_modules", name, "package.json");
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, "utf8")).version ?? null;
      } catch {
        return null;
      }
    }
    if (path.dirname(cartella) === cartella) return null;
  }
}

/**
 * @param {string} dir - la cartella del progetto
 * @returns {{ ok: true, name, version, scripts, deps: {name, wanted, installed}[] } | { ok: false, missing?: true, error: string }}
 */
export default function readPackage(dir) {
  const file = path.join(dir, "package.json");
  if (!fs.existsSync(file)) return { ok: false, missing: true, error: "no package.json next to vite.config" };
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { ok: false, error: `package.json is not valid JSON: ${error.message}` };
  }
  const dichiarate = { ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies };
  const deps = [];
  for (const name of WATCHED) {
    const wanted = dichiarate[name] ?? null;
    const installed = installedVersion(dir, name);
    // Né dichiarata né installata: non c'entra con questo progetto.
    if (wanted === null && installed === null) continue;
    deps.push({ name, wanted, installed });
  }
  return { ok: true, name: pkg.name ?? null, version: pkg.version ?? null, scripts: pkg.scripts ?? {}, deps };
}
