// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// `<localeDir>/.llm/context.md`, lettura e riscrittura parziale. La sottocartella è la
// ragione per cui questo posto funziona: `listLanguageFiles.js` filtra su `.yml`,
// `localeSignature()` di `fastVerify.js` filtra su `isFile()` a livello di `localeDir` — il
// contenuto di `.llm/` non invalida il fast path — e il watcher del dev server filtra su
// `.yml`, quindi scrivere qui non fa ricaricare il browser.

import fs from "fs";
import path from "path";

const GENERATED_OPEN_RE = /<!-- vitetranslate:generated [^\n]*-->/;
const GENERATED_CLOSE = "<!-- /vitetranslate:generated -->";

export function contextDir(localeDir) {
  return path.join(localeDir, ".llm");
}

export function contextFilePath(localeDir) {
  return path.join(contextDir(localeDir), "context.md");
}

function gitignorePath(localeDir) {
  return path.join(contextDir(localeDir), ".gitignore");
}

/**
 * Crea `.llm/` se non c'è, e vi scrive `.gitignore` (con dentro `runs.log`) **solo la prima
 * volta che la cartella nasce**. Se qualcuno cancella poi il `.gitignore`, non si ricrea: ha
 * deciso lui. La condizione è sull'esistenza della cartella, non del file.
 */
export function ensureContextDir(localeDir) {
  const dir = contextDir(localeDir);
  const isNewDir = !fs.existsSync(dir);
  fs.mkdirSync(dir, { recursive: true });
  if (isNewDir) fs.writeFileSync(gitignorePath(localeDir), "runs.log\n", "utf8");
  return dir;
}

/** Il testo del file, o `null` se non esiste. Non lancia per altri motivi di I/O: un file
 *  illeggibile vale "non c'è", come ovunque nel resto della libreria. */
export function readContextFile(localeDir) {
  try {
    return fs.readFileSync(contextFilePath(localeDir), "utf8");
  } catch {
    return null;
  }
}

export function writeContextFile(localeDir, text) {
  ensureContextDir(localeDir);
  fs.writeFileSync(contextFilePath(localeDir), text, "utf8");
}

export function hasGeneratedMarkers(text) {
  return typeof text === "string" && GENERATED_OPEN_RE.test(text) && text.includes(GENERATED_CLOSE);
}

/** Un file che esiste ma non ha i marcatori è scritto a mano da qualcuno: non si tocca mai. */
export function isUnmanaged(existingText) {
  return existingText !== null && !hasGeneratedMarkers(existingText);
}

/**
 * Sostituisce solo la regione generata. Su un file nuovo (`existingText === null`) crea il
 * file per intero, col template delle note umane sotto. Va chiamata solo quando
 * `existingText === null` oppure `hasGeneratedMarkers(existingText)` è vero: su un file senza
 * marcatori è un errore di chi chiama, non un caso da gestire qui (vedi `isUnmanaged`).
 *
 * @param {string | null} existingText
 * @param {string} body - il markdown generato dal modello (le sezioni fisse)
 * @param {{ date: string, keys: number, model: string }} meta
 */
export function replaceGeneratedRegion(existingText, body, meta) {
  const openLine = `<!-- vitetranslate:generated ${meta.date} · ${meta.keys} keys · ${meta.model} -->`;
  const block = `${openLine}\n${body.trim()}\n${GENERATED_CLOSE}`;

  if (existingText === null) {
    return (
      `${block}\n\n` +
      "## Notes from the team\n" +
      "<!-- Everything outside the generated block is yours and is never overwritten. -->\n"
    );
  }

  if (!hasGeneratedMarkers(existingText)) {
    throw new Error("replaceGeneratedRegion: existingText has no generated markers — check isUnmanaged() first.");
  }

  const openMatch = existingText.match(GENERATED_OPEN_RE);
  const openIdx = openMatch.index;
  const closeIdx = existingText.indexOf(GENERATED_CLOSE);
  const before = existingText.slice(0, openIdx);
  const after = existingText.slice(closeIdx + GENERATED_CLOSE.length);
  return `${before}${block}${after}`;
}

/**
 * Decide se rigenerare, per `context.mode === "auto"`: file assente, o le chiavi cresciute di
 * `refreshEvery` dall'ultima generazione, o cresciute del 25%. `"manual"` e `"off"` non
 * rigenerano mai da soli (il primo solo su `--context` esplicito, gestito dal chiamante).
 *
 * @param {{
 *   mode: string, existingText: string | null,
 *   keysNow: number, keysAtGeneration?: number, refreshEvery: number,
 * }} params
 */
export function shouldRegenerate({ mode, existingText, keysNow, keysAtGeneration, refreshEvery }) {
  if (mode !== "auto") return false;
  if (existingText === null) return true;
  if (!hasGeneratedMarkers(existingText)) return false;

  const at = keysAtGeneration ?? 0;
  if (keysNow - at >= refreshEvery) return true;
  if (at > 0 && keysNow >= at * 1.25) return true;
  return false;
}
