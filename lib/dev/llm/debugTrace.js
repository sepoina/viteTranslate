// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Il registro di --llm-debug: una cartella per run, con un file numerato per ogni domanda,
// risposta o errore. Cartella pigra (niente su disco finché non arriva la prima write), mai
// fatale (un errore di scrittura spegne la trace per il resto del run, non lo ferma), e ogni
// testo passa per `redact` prima di toccare il disco.

import fs from "fs";
import path from "path";
import { contextDir, ensureContextDir } from "./contextFile.js";
import { redact } from "./apiKey.js";
import { logEchoColored } from "../../utility.js";

const STAMP_DIR_RE = /^\d{12}(-\d+)?$/;

/** `2026-09-18 15:41:07` -> `"260918154107"`: ordinabile per nome, ora locale. */
export function debugStamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    pad(date.getFullYear() % 100) +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

/** L'oggetto se `text` è JSON valido, altrimenti `text` così com'è. Usato da fetchDriver.js e
 *  callModel.js per tracciare corpi di richiesta/risposta senza doverli riparsare a mano. */
export function tryParseJson(text) {
  if (typeof text !== "string") return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function replacer(_key, value) {
  if (value === Infinity) return "Infinity";
  if (typeof value === "function") return "[function]";
  return value;
}

/** La prima cartella libera fra `base`, `base-2`, `base-3`, … */
function uniqueDir(base) {
  if (!fs.existsSync(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
}

/**
 * @param {{ localeDir: string, now?: Date }} params
 * @returns {{
 *   write(label: string, data: string | object): void,
 *   setSecret(key: string | undefined): void,
 *   readonly dir: string | null,
 *   readonly count: number,
 * }}
 */
export default function createDebugTrace({ localeDir, now = new Date() }) {
  let dir = null;
  let count = 0;
  let secret;
  let dead = false;

  return {
    write(label, data) {
      if (dead) return;
      try {
        if (dir === null) {
          ensureContextDir(localeDir);
          const base = path.join(contextDir(localeDir), debugStamp(now));
          dir = uniqueDir(base);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, ".gitignore"), "*\n", "utf8");
        }
        count += 1;
        const ext = typeof data === "string" ? "txt" : "json";
        const body = typeof data === "string" ? data : JSON.stringify(data, replacer, 2);
        const safeLabel = label.replace(/[^A-Za-z0-9._-]/g, "_");
        const fileName = `${String(count).padStart(3, "0")}-${safeLabel}.${ext}`;
        fs.writeFileSync(path.join(dir, fileName), redact(body, secret), "utf8");
      } catch (e) {
        logEchoColored("llm", `debug trace: cannot write (${e.message}) — tracing off for this run`, "warning");
        dead = true;
      }
    },
    setSecret(key) {
      secret = key;
    },
    get dir() {
      return dir;
    },
    get count() {
      return count;
    },
  };
}

/** Le cartelle di trace esistenti, ordinate per nome (= per data). Mai un throw. */
export function listDebugTraces(localeDir) {
  try {
    return fs
      .readdirSync(contextDir(localeDir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && STAMP_DIR_RE.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}
