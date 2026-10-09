// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// La riscrittura dei marcatori (4.7.0): `--rewriteMarker [start] [end]` porta i sorgenti dai
// delimitatori ora scritti nel codice (`from`, di serie `_%_`) a quelli di vite.config (`to`).
// Riscrive solo i delimitatori, mai il testo che racchiudono: la chiave di una voce non dipende
// dai delimitatori (invariante 26), e il comando lo VERIFICA prima di scrivere — stesse chiavi,
// stesso stato delle traduzioni, oppure non scrive neanche un byte.
//
// Due parti: `planRewrite`, pura (un file in, un file out), e il comando, che fa la verifica
// globale su tutti i file e poi scrive tutto o niente.

import fs from "fs";
import path from "path";
import { markerSyntaxOf, mayHaveMarkers, DEFAULT_MARKERS } from "../../../markerSyntax.js";
import { parseSource } from "../../babel/extractMarkers.js";
import { loadExtractMarkers } from "./loadConfig.js";
import walkSource from "./walkSource.js";
import listLanguageFiles from "./listLanguageFiles.js";
import readLanguageFile from "./readLanguageFile.js";
import { tagFromFileName } from "./languageFileFormat.js";
import shortPath from "./shortPath.js";
import { logEchoColored, logRule, logWarning, logError, logBullet, logCommand, colorize } from "../../../utility.js";
import { CLI_NAME } from "./cliName.js";

// Gli spazi che JSX toglie ai bordi di un testo: non `trim()`, che toglierebbe anche un U+00A0
// scritto letterale, che per JSX è testo.
const BORDI = /^[ \t\r\n]+|[ \t\r\n]+$/g;
const SORGENTI_DI_MODULO = new Set(["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"]);

// Visita generica guidata dalle VISITOR_KEYS, col genitore.
function visita(n, genitore, keys, fn) {
  if (!n || typeof n.type !== "string") return;
  fn(n, genitore);
  for (const k of keys?.[n.type] ?? Object.keys(n)) {
    if (k === "loc" || k.endsWith("Comments")) continue;
    const v = n[k];
    if (Array.isArray(v)) for (const c of v) visita(c, n, keys, fn);
    else if (v && typeof v === "object") visita(v, n, keys, fn);
  }
}

/**
 * Il codice di un file con i marcatori `from` riscritti in `to`. Pura: nessun disco. Riscrive solo i
 * delimitatori, mai il testo; un marcatore che l'estrazione non riconoscerebbe può restare com'è o
 * cambiare: lo dice il confronto delle chiavi, che è il vero controllo.
 *
 * @param {string} code
 * @param {string} filename
 * @param {{ start: string, end: string }} from
 * @param {{ start: string, end: string }} to
 * @returns {{ code: string, count: number }} count = marcatori riscritti (una coppia = 1)
 */
export function planRewrite(code, filename, from, to) {
  const { ast, visitorKeys } = parseSource(code, filename);
  const f = markerSyntaxOf(from.start, from.end);
  const edits = []; // [inizio, fine, testo nuovo]
  let count = 0;
  const apri = (pos) => edits.push([pos, pos + f.start.length, to.start]);
  const chiudi = (pos) => edits.push([pos - f.end.length, pos, to.end]);

  visita(ast.program, null, visitorKeys, (node, genitore) => {
    if (node.type === "StringLiteral") {
      if (SORGENTI_DI_MODULO.has(genitore?.type)) return;
      const raw = code.slice(node.start + 1, node.end - 1); // senza virgolette, escape compresi
      if (f.wraps(raw)) { apri(node.start + 1); chiudi(node.end - 1); count++; }
    } else if (node.type === "TemplateLiteral") {
      // Gli offset di un TemplateElement coprono il solo testo grezzo (verificato).
      const primo = node.quasis[0];
      const ultimo = node.quasis[node.quasis.length - 1];
      const a = code.slice(primo.start, primo.end);
      const z = code.slice(ultimo.start, ultimo.end);
      if (node.quasis.length === 1 ? f.wraps(a) : a.startsWith(f.start) && z.endsWith(f.end)) {
        apri(primo.start); chiudi(ultimo.end); count++;
      }
    } else if (node.type === "JSXElement" || node.type === "JSXFragment") {
      // I testi fra i figli, in ordine: uno avvolto per intero, o l'apertura di una frase spezzata da
      // tag e valori che si chiude in un testo successivo dello stesso genitore. Con inizio e fine
      // uguali, un delimitatore solo in un testo è l'apertura se nessuno è aperto, altrimenti la
      // chiusura (`<p>_%_hi <b>x</b>_%_</p>`): per questo lo stato `aperto` è per genitore.
      let aperto = false;
      for (const c of node.children) {
        if (c.type !== "JSXText") continue;
        const grezzo = code.slice(c.start, c.end);
        const t = grezzo.replace(BORDI, "");
        if (t === "") continue;
        const da = c.start + grezzo.indexOf(t);
        const a = da + t.length;
        if (aperto) {
          if (t.endsWith(f.end)) { chiudi(a); aperto = false; count++; }
          continue;
        }
        if (f.wraps(t)) { apri(da); chiudi(a); count++; }
        else if (t.startsWith(f.start)) { apri(da); aperto = true; }
      }
    }
  });

  edits.sort((x, y) => y[0] - x[0]);
  let out = code;
  for (const [s, e, testo] of edits) out = out.slice(0, s) + testo + out.slice(e);
  return { code: out, count };
}

const stessi = (a, b) => a.start === b.start && a.end === b.end;
const mostra = (m) => `${m.start}…${m.end}`;
const quanti = (n, cosa) => `${n} ${cosa}${n === 1 ? "" : "s"}`;

/** Il testo di una voce, accorciato per la riga di log. */
const cita = (t) => (t.length <= 40 ? t : `${t.slice(0, 40)}…`);

/**
 * Estrae le chiavi di un file con i due insiemi di delimitatori sulla stessa tabella: i marcatori
 * di `markers` e quelli già migrati (`to`). Gli avvisi non interessano qui: li dà la sync.
 */
function estrai(extractMarkers, code, entry, config, tavola, info, markersList) {
  for (const markers of markersList) {
    extractMarkers(code, {
      filename: entry.path, table: tavola, rewrite: false, baseDir: config.baseDir,
      autoWrap: config.autoWrap, markers, warn: () => {},
      onMarker: (v) => { info[v.id] ??= { rel: entry.rel, text: v.text, line: v.line, column: v.column }; },
    });
  }
}

/** Lo stato delle traduzioni per un insieme di chiavi: per lingua, quante sono tradotte. */
function statoLingue(localeDir, chiavi) {
  const righe = [];
  let nomi = [];
  try { nomi = listLanguageFiles(localeDir); } catch { /* la cartella non esiste ancora */ }
  for (const file of nomi) {
    const tag = tagFromFileName(file);
    let table;
    try { ({ table } = readLanguageFile(path.join(localeDir, file))); } catch { continue; }
    table ??= {};
    let tradotte = 0;
    let daTradurre = 0;
    let daSincronizzare = 0;
    for (const k of chiavi) {
      if (!(k in table)) daSincronizzare++;
      else if (table[k] === null) daTradurre++;
      else tradotte++;
    }
    righe.push({ tag, tradotte, daTradurre, daSincronizzare });
  }
  return righe;
}

const riassunto = (chiavi, righe) =>
  [quanti(chiavi.size, "key"), ...righe.map((r) =>
    `${r.tag} ${r.tradotte}/${chiavi.size}${r.daSincronizzare ? ` (${r.daSincronizzare} unsynced)` : ""}`)].join(" · ");

/**
 * Il comando. Si decide SOLO dal setup e dagli argomenti, prima di leggere un sorgente: un comando
 * che si attiva o meno a seconda di cosa trova nel codice sarebbe imprevedibile.
 *
 * @param {object} p
 * @param {object} p.config - la config risolta (`vitetranslateConfig`): baseDir, srcDir, localeDir, markers, autoWrap
 * @param {{ start: string, end: string }} p.from - i marcatori ORA nei sorgenti (già validati)
 * @param {boolean} p.write - `false`: prova a vuoto, nessuna scrittura
 * @returns {Promise<{ exitCode: number }>}
 */
export default async function rewriteMarkers({ config, from, write }) {
  const to = config.markers ?? DEFAULT_MARKERS;

  // Passo 1: inefficace quando `from` e `to` coincidono. Nessun file letto.
  if (stessi(from, to)) {
    const serie = stessi(to, DEFAULT_MARKERS);
    logError(serie
      ? `nothing to rewrite: vite.config uses the default markers ("${mostra(to)}"). To switch, set markerStart/markerEnd ` +
        `(or marker) in vite.config first; to go back to "${DEFAULT_MARKERS.start}", name the markers your source uses now: ` +
        `--rewriteMarker "≼" "≽".`
      : `nothing to rewrite: "${mostra(to)}" are already the markers in vite.config. Name the markers your source ` +
        `uses now, if they are not "${DEFAULT_MARKERS.start}": --rewriteMarker "§".`);
    return { exitCode: 1 };
  }

  const extractMarkers = await loadExtractMarkers();
  const srcRoot = path.join(config.baseDir, config.srcDir);
  const localeDir = path.join(config.baseDir, config.localeDir);
  let files;
  try {
    files = walkSource(srcRoot, localeDir, config.baseDir);
  } catch (e) {
    throw new Error(`cannot read srcDir "${config.srcDir}" (resolved to "${shortPath(srcRoot)}"): ${e.message}`);
  }

  // Passo 2-4: per ogni file il piano, e le chiavi prima (con i marcatori di partenza e con quelli
  // già migrati) e dopo (il codice riscritto, coi marcatori di arrivo).
  const prima = {}; const infoPrima = {};
  const dopo = {}; const infoDopo = {};
  const cambiati = []; // { path, rel, nuovo, count }
  const bloccanti = []; // file coi marcatori di partenza che non si parsano
  let marcatori = 0;
  for (const entry of files) {
    let code;
    try { code = fs.readFileSync(entry.path, "utf8"); } catch { continue; }
    const conFrom = mayHaveMarkers(code, from);
    const conTo = mayHaveMarkers(code, to);
    if (!conFrom && !conTo) continue;
    let piano = { code, count: 0 };
    try {
      if (conFrom) piano = planRewrite(code, entry.path, from, to);
      estrai(extractMarkers, code, entry, config, prima, infoPrima, [from, to]);
      estrai(extractMarkers, piano.code, entry, config, dopo, infoDopo, [to]);
    } catch (e) {
      // Un file che non si parsa e contiene i marcatori di partenza BLOCCA la scrittura: i suoi
      // marcatori resterebbero vecchi senza che il confronto delle chiavi lo veda.
      if (e?.code === "VT_NO_BABEL") throw e;
      if (conFrom) bloccanti.push(`${entry.rel}: ${String(e.message).split("\n")[0]}`);
      continue;
    }
    if (piano.count > 0 && piano.code !== code) {
      cambiati.push({ path: entry.path, rel: entry.rel, nuovo: piano.code, count: piano.count });
      marcatori += piano.count;
    }
  }

  // Passo 5: le tabelle di lingua, per i due insiemi di chiavi.
  const chiaviPrima = new Set(Object.keys(prima));
  const chiaviDopo = new Set(Object.keys(dopo));
  const righePrima = statoLingue(localeDir, chiaviPrima);
  const righeDopo = statoLingue(localeDir, chiaviDopo);
  const mancano = [...chiaviPrima].filter((k) => !chiaviDopo.has(k)).map((k) => ({ k, lato: "only before", i: infoPrima[k], t: prima[k] }));
  const nuove = [...chiaviDopo].filter((k) => !chiaviPrima.has(k)).map((k) => ({ k, lato: "only after", i: infoDopo[k], t: dopo[k] }));
  const divergono = [...mancano, ...nuove];

  // Passo 6: il rapporto.
  logRule();
  logEchoColored("rewrite", `${colorize("nome", mostra(from))}  →  ${colorize("nome", mostra(to))}${write ? "" : "          (dry run)"}`);
  logEchoColored("files", `${cambiati.length} to change, ${quanti(marcatori, "marker")}`);
  logEchoColored("before", riassunto(chiaviPrima, righePrima));
  logEchoColored("after", riassunto(chiaviDopo, righeDopo));

  const nienteScritto = write ? " Nothing was written." : "";
  if (divergono.length) {
    logWarning(`the rewrite would change what gets translated: ${divergono.length} key(s) differ (listed below).${nienteScritto}`);
    for (const d of divergono.slice(0, 10)) {
      const dove = d.i ? `${d.i.rel}:${d.i.line}:${d.i.column}` : "?";
      logBullet(`${colorize("nome", `"${dove}"`)} "${cita(d.t ?? "")}" (${d.lato}, key ${d.k})`);
    }
    if (divergono.length > 10) logBullet(`… and ${divergono.length - 10} more`);
  }
  if (bloccanti.length) {
    logWarning(`${quanti(bloccanti.length, "file")} contain "${from.start}" markers but could not be parsed, so they could not be rewritten — ` +
      `fix them first (listed below).${nienteScritto}`);
    for (const b of bloccanti) logBullet(b);
  }
  if (divergono.length || bloccanti.length) {
    logRule();
    return { exitCode: 1 };
  }

  if (!write) {
    logEchoColored("ok", `same keys, same status — run without DryRun to write`, "ok");
    logCommand(`npx ${CLI_NAME} --rewriteMarker${from.start === DEFAULT_MARKERS.start && from.end === DEFAULT_MARKERS.end ? "" : ` ${JSON.stringify(from.start)}${from.start === from.end ? "" : ` ${JSON.stringify(from.end)}`}`}`);
    logRule();
    return { exitCode: 0 };
  }

  // Passo 8-9: tutto torna, si scrive. Cambiano solo i delimitatori: fine riga e BOM restano
  // quelli del file. Se una scrittura fallisce ci si ferma: le chiavi sono le stesse nei file
  // scritti e in quelli no, e rilanciare il comando riprende da lì.
  const scritti = [];
  for (let i = 0; i < cambiati.length; i++) {
    const c = cambiati[i];
    try {
      fs.writeFileSync(c.path, c.nuovo, "utf8");
      scritti.push(c);
    } catch (e) {
      const restanti = cambiati.slice(i);
      logError(`writing stopped at "${c.rel}": ${e.message}. ${quanti(scritti.length, "file")} ${scritti.length === 1 ? "was" : "were"} rewritten, ` +
        `${restanti.length} ${restanti.length === 1 ? "was" : "were"} not (listed below). Keys are unchanged either way: ` +
        `fix the problem and run the same command again to finish.`);
      for (const r of restanti) logBullet(r.rel);
      logRule();
      return { exitCode: 1 };
    }
  }
  logEchoColored("ok", `${quanti(scritti.length, "file")} rewritten, same keys, same status. Translation tables and caches catch up on the next sync.`, "ok");
  logRule();
  return { exitCode: 0 };
}
