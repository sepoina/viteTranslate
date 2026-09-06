// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import { loadExtractMarkers } from "./loadConfig.js";
import walkSource from "./walkSource.js";
import shortPath from "./shortPath.js";
import { hash } from "../../babel/markerCore.js";
import { colorize } from "../../../utility.js";
import { SOURCE_OPEN } from "../../../markerSyntax.js";

/**
 * Scansione di `srcDir`: popola `service.sourceTable` con quello che c'è nel CODICE adesso.
 * Non scrive niente, e per questo la condividono la sincronizzazione e `--status` — che
 * altrimenti risponderebbe alla domanda "sono allineate?" confrontando le tabelle fra loro
 * invece che col sorgente, cioè non rispondendo affatto.
 *
 * Non stampa NIENTE, nemmeno l'intestazione: i due comandi la vogliono uguale ma in mezzo a
 * blocchi diversi, e finché la metteva qui dentro `--status` doveva zittire l'intera funzione
 * per rifarsi la propria — cioè le due intestazioni erano due, e potevano divergere.
 *
 * @param {object} service - stato della sessione; `service.sourceTable` viene mutata qui
 * @param {string} srcRoot - la cartella dei sorgenti, già risolta
 * @returns {Promise<{ files: Array<{path: string, rel: string, mtimeMs: number, size: number}>,
 *   skipped: string[], warnings: Array<{kind: string, message: string}>,
 *   marked: Record<string, number> }>}
 */
export default async function scanSource(service, srcRoot) {
  let files;
  try {
    files = walkSource(srcRoot, service.localeDir, service.baseDir);
  } catch (e) {
    throw new Error(`cannot read srcDir "${service.srcDir}" (resolved to "${shortPath(srcRoot)}"): ${e.message}`);
  }

  // Scansione solo per il suo effetto collaterale: popolare service.sourceTable (stessa
  // tabella condivisa tra tutti i file di questa scansione). Il codice trasformato non
  // servirebbe a nessuno, quindi `rewrite: false` si ferma al parse e non lo produce
  // affatto — prima veniva generato per intero, file per file, e buttato.
  //
  // Un file illeggibile o non parsabile viene saltato con un avviso, non fa cadere l'intera
  // sincronizzazione: è un comando di "prebuild", e interromperlo su un file qualsiasi
  // lascerebbe le tabelle a metà senza dire quale file l'ha causato.
  // Marcatori annidati e collisioni di id: l'estrazione li segnalerebbe da sé sulla console,
  // col prefisso del plugin, che è la forma giusta dentro l'output di Vite ma non qui — nel
  // mezzo di una sincronizzazione uscirebbe fuori colonna, come una riga di un altro programma.
  // Passandole un canale, il messaggio entra nella colonna del comando come tutti gli altri.
  //
  // Gli avvisi si raccolgono e si stampano dopo: l'intestazione conta le chiavi trovate,
  // quindi può uscire solo a scansione finita, e un avviso stampato mentre la scansione gira
  // comparirebbe prima della riga che dice di quale progetto si sta parlando.
  // Il tipo viaggia insieme al messaggio perché i due comandi ne fanno usi diversi: --status
  // li elenca tutti, la sincronizzazione tiene a conteggio i malformati (vedi printWarnings).
  const warnings = [];
  const avviso = (message, kind = "marker") => warnings.push({ kind, message });

  const skipped = [];
  // percorso relativo (come lo scrive walkSource) -> hash del contenuto, solo i file marcati:
  // è ciò che permette a una sync successiva di riconoscere, senza rileggerli, i file che non
  // contengono nulla da tradurre (vedi buildScanRecord in fastVerify.js).
  const marked = {};
  // Caricato alla prima riga marcata trovata, non prima: un progetto in cui non c'è ancora
  // nessun marcatore non ha motivo di pretendere Babel per scoprire che non c'è niente da fare.
  let extractMarkers = null;
  for (const entry of files) {
    let code;
    try {
      code = fs.readFileSync(entry.path, "utf8");
    } catch (e) {
      skipped.push(`${shortPath(entry.path)}: ${e.message}`);
      continue;
    }
    if (!code.includes(SOURCE_OPEN)) continue;
    marked[entry.rel] = hash(code);
    extractMarkers ??= await loadExtractMarkers();
    try {
      extractMarkers(code, { filename: entry.path, table: service.sourceTable, rewrite: false, baseDir: service.baseDir, warn: avviso });
    } catch (e) {
      skipped.push(`${shortPath(entry.path)}: ${e.message.split("\n")[0]}`);
    }
  }

  // Nessun marcatore in tutto il progetto: non è un errore — un progetto appena configurato
  // sta esattamente così — ma è anche la forma che prende uno `srcDir` puntato sulla cartella
  // sbagliata, e senza dirlo l'unico indizio sarebbe una tabella vuota in fondo all'output.
  if (Object.keys(service.sourceTable).length === 0) {
    avviso(
      `no marker found in ${colorize("nome", `"${shortPath(srcRoot)}"`)} (${files.length} file(s) scanned): ` +
      `there is nothing to translate yet. Wrap a string in _%_..._%_ to start, ` +
      `or check that "srcDir" points where your components are.`,
      "empty",
    );
  }

  return { files, skipped, warnings, marked };
}
