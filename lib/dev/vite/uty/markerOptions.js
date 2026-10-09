// Architettura d'insieme: doc/structure.md § "Fase 0 — Autoring: il marcatore".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// I delimitatori del progetto (4.7.0): `marker`, `markerStart`, `markerEnd`, controllati alla
// costruzione del plugin come `localeDir`. Due lettori: il plugin (vitetranslate.js) e il comando di
// riscrittura (rewriteMarkers.js), che controlla con le stesse regole i delimitatori di partenza.

import { SOURCE_OPEN, SOURCE_CLOSE, PLACEHOLDER } from "../../../markerSyntax.js";

// Ognuno ha già un significato in uno dei posti dove un marcatore può stare:
//   < > { }  JSX, i tag del dialetto, gli slot <0>, gli argomenti ICU
//   " ' `    chiuderebbero la stringa o il template che lo contiene
//   \        un escape: il testo scritto non sarebbe quello letto
//   &        un'entità HTML nel testo JSX
const VIETATI = ["<", ">", "{", "}", '"', "'", "`", "\\", "&"];

/**
 * Cosa non va in un delimitatore, o null.
 * @param {unknown} value
 * @param {string} name - il nome dell'opzione, per il messaggio
 * @returns {string | null}
 */
export function markerProblem(value, name) {
  if (typeof value !== "string" || value === "") {
    return `${name} must be a non-empty string (got ${typeof value === "string" ? '""' : String(value)})`;
  }
  const q = JSON.stringify(value);
  if (/\s/u.test(value)) return `${name} ${q} contains whitespace: JSX trims and folds it, so the marker would never match`;
  if (/[\u0000-\u001f\u007f]/.test(value)) return `${name} ${q} contains a control character`;
  const c = VIETATI.find((ch) => value.includes(ch));
  if (c) return `${name} ${q} contains ${JSON.stringify(c)}, which already means something in JSX, strings or messages (not allowed: < > { } " ' \` \\ &)`;
  if (value.includes(PLACEHOLDER)) return `${name} ${q} contains "${PLACEHOLDER}", the placeholder`;
  return null;
}

/** Cosa non va nella coppia, o null: due delimitatori diversi non devono contenersi a vicenda. */
export function markerPairProblem(start, end) {
  if (start === end || (!start.includes(end) && !end.includes(start))) return null;
  return `markerStart ${JSON.stringify(start)} and markerEnd ${JSON.stringify(end)} overlap: one contains the other, ` +
    `so a closing marker would also read as an opening one. Pick two that don't, or the same one twice (marker)`;
}

// Le chiavi cercate senza badare a maiuscole, come autoWrap: "markerstart" vale "markerStart".
function leggi(defs, nome) {
  const k = Object.keys(defs ?? {}).find((x) => x.toLowerCase() === nome.toLowerCase());
  return k === undefined ? undefined : defs[k];
}

/**
 * I delimitatori dalle opzioni del plugin. Vince lo specifico: `markerStart ?? marker ?? "_%_"`.
 * @returns {{ start: string, end: string }}
 * @throws {Error} con tutti i problemi trovati, uno per riga
 */
export function resolveMarkers(defs) {
  const marker = leggi(defs, "marker");
  const ms = leggi(defs, "markerStart");
  const me = leggi(defs, "markerEnd");
  const problemi = [];
  for (const [nome, v] of [["marker", marker], ["markerStart", ms], ["markerEnd", me]]) {
    if (v === undefined) continue;
    const p = markerProblem(v, nome);
    if (p) problemi.push(p);
  }
  if (problemi.length === 0) {
    const coppia = markerPairProblem(ms ?? marker ?? SOURCE_OPEN, me ?? marker ?? SOURCE_CLOSE);
    if (coppia) problemi.push(coppia);
  }
  if (problemi.length) throw new Error(`[vitetranslate] invalid marker option:\n  - ${problemi.join("\n  - ")}`);
  return { start: ms ?? marker ?? SOURCE_OPEN, end: me ?? marker ?? SOURCE_CLOSE };
}
