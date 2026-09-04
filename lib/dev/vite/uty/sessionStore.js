// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync",
// "The cross-session cache".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import path from "path";
import { ownPackageJson } from "./ownPackage.js";

// Stessa convenzione di Vite ("<baseDir>/node_modules/.vite/"): dentro node_modules la cache
// è già fuori da git in ogni progetto, e sparisce con un reinstall — che è esattamente la
// semantica giusta per uno spazio di comodo fra una sessione e l'altra.
const SESSION_REL = ["node_modules", ".viteTranslate", "session.json"];
const SCHEMA_VERSION = 1;

// Da `ownPackage.js`, non da un conteggio di cartelle a partire da qui: questo file gira sia
// come sorgente (`lib/dev/vite/uty/`) sia dentro il bundle pubblicato (`lib/dist/`), che sta a
// una profondità diversa — vedi il commento lì.
let cachedPkgVersion;
function pkgVersion() {
  if (cachedPkgVersion === undefined) cachedPkgVersion = ownPackageJson()?.version ?? "";
  return cachedPkgVersion;
}

/** Il percorso del file di sessione, senza toccare il disco. */
export function sessionPath(baseDir) {
  return path.join(baseDir, ...SESSION_REL);
}

/**
 * Legge la sessione precedente. Non lancia mai: un errore di I/O, un JSON corrotto, o una
 * `version` diversa da quella attesa valgono tutti "nessuna sessione precedente" — uno stato
 * già previsto ovunque nel resto della libreria.
 *
 * @param {string} baseDir
 * @returns {object | null}
 */
export function readSession(baseDir) {
  try {
    const data = JSON.parse(fs.readFileSync(sessionPath(baseDir), "utf8"));
    if (data?.version !== SCHEMA_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Aggiorna la sessione con un merge superficiale, scrivendo in modo atomico (file temporaneo
 * nella stessa cartella + rename): un `vite dev` e un `npx vtranslate-cli` in un altro
 * terminale, insieme, sono lo scenario normale, non l'eccezione.
 *
 * Non lancia mai e non crea `node_modules`: se manca (pnpm PnP, progetto non ancora
 * installato) esce senza scrivere, e da lì in poi tutto si comporta come "nessuna sessione
 * precedente". Una cache che si fa notare quando è rotta è peggio che non averla.
 *
 * @param {string} baseDir
 * @param {object} patch - campi da sovrascrivere; `version`, `updatedAt` e `pkgVersion` li
 *   mette questa funzione, non il chiamante.
 */
export function writeSession(baseDir, patch) {
  try {
    if (!fs.existsSync(path.join(baseDir, "node_modules"))) return;
    const target = sessionPath(baseDir);
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });

    const current = readSession(baseDir) ?? {};
    const next = {
      ...current,
      ...patch,
      version: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      pkgVersion: pkgVersion(),
    };

    const tmp = path.join(dir, `.session-${process.pid}-${Date.now()}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
    fs.renameSync(tmp, target);
  } catch {
    // Non lancia mai: vedi il commento sopra la funzione.
  }
}
