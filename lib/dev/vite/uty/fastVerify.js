// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync",
// "Fast verify: the two-stage check".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// `fastVerify` non lancia MAI: qualunque imprevisto vale `fresh: false`, cioè "fai il giro
// lungo". Il rischio vero è uno solo — dire "non è cambiato niente" quando invece qualcosa era
// cambiato — quindi ogni ramo dubbio produce `fresh: false` invece di propagare un errore.
//
// `buildScanRecord` sta in questo stesso file di proposito: chi legge la firma di
// config/locale (qui sotto) e chi la scrive (buildScanRecord) devono restare d'accordo sul
// formato, e separarli in due file vorrebbe dire due copie della stessa idea che possono
// divergere.

import fs from "fs";
import path from "path";
import { readScan } from "./scanRecord.js";
import { findConfigFile } from "./configFiles.js";
import walkSource from "./walkSource.js";
import { hash } from "../../babel/markerCore.js";
import { SOURCE_OPEN } from "../../../markerSyntax.js";
import { pkgVersion } from "./sessionStore.js";
import { BUILDER_VERSION } from "./builderVersion.js";

/**
 * Firma della cartella delle tabelle: quanti file diretti ci sono, l'hash dei loro nomi
 * ordinati, e l'mtime più recente. `null` se la cartella non si legge: che sia sparita o
 * diventata illeggibile, chi confronta la tratta allo stesso modo ("locale-changed").
 */
function localeSignature(dir) {
  let names;
  try {
    names = fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
  } catch {
    return null;
  }
  let maxMtimeMs = 0;
  for (const name of names) {
    const stat = fs.statSync(path.join(dir, name), { throwIfNoEntry: false });
    if (stat && stat.mtimeMs > maxMtimeMs) maxMtimeMs = stat.mtimeMs;
  }
  return { count: names.length, maxMtimeMs, namesHash: hash(names.join("\n")) };
}

const sameLocale = (a, b) =>
  !!a && !!b && a.count === b.count && a.maxMtimeMs === b.maxMtimeMs && a.namesHash === b.namesHash;

/**
 * L'oggetto da passare a `writeScan` (vedi scanRecord.js). Calcola da sé le due firme che
 * devono essere lette alla fine di una sync: quella di `localeDir` (dopo le scritture, così le
 * scritture della sync stessa non si presentano come una modifica altrui al giro successivo) e
 * quella di `vite.config.*`.
 *
 * @param {object} p
 * @param {string} p.baseDir
 * @param {string} p.srcDir - come scritto in vite.config, non risolto
 * @param {string} p.localeDir - come scritto in vite.config, non risolto
 * @param {string} p.sourceLanguage
 * @param {boolean} p.simpleLog
 * @param {number} p.keys - chiavi trovate dall'ultima scansione
 * @param {number} p.warnings - avvisi sui marcatori prodotti dall'ultima scansione
 * @param {Array<{ rel: string, mtimeMs: number, size: number }>} p.entries - da walkSource,
 *   già stattate a inizio scansione
 * @param {Record<string, number>} p.marked - percorso relativo -> hash del contenuto, solo i
 *   file che contenevano "_%_"
 * @returns {object}
 */
export function buildScanRecord({ baseDir, srcDir, localeDir, sourceLanguage, simpleLog, keys, warnings, entries, marked }) {
  const configFile = findConfigFile(baseDir);
  const configStat = configFile ? fs.statSync(path.join(baseDir, configFile)) : null;

  const files = {};
  for (const e of entries) files[e.rel] = [e.mtimeMs, e.size];

  return {
    builder: BUILDER_VERSION,
    config: configFile ? { file: configFile, mtimeMs: configStat.mtimeMs, size: configStat.size } : null,
    srcDir,
    localeDir,
    sourceLanguage,
    simpleLog: simpleLog === true,
    keys,
    warnings,
    files,
    marked,
    locale: localeSignature(path.join(baseDir, localeDir)),
  };
}

/**
 * Verifica se, rispetto al record dell'ultima sync, non c'è del lavoro da rifare — senza mai
 * caricare `vite.config` e senza scrivere niente.
 *
 * @param {{ baseDir: string, expect?: { srcDir: string, localeDir: string,
 *   sourceLanguage: string } | null }} p
 * @returns {{ fresh: true, checked: number, changed: number, warnings: number, keys: number,
 *   srcDir: string, localeDir: string, simpleLog: boolean }
 *   | { fresh: false, reason: string, detail?: string, others?: number }}
 */
export default function fastVerify({ baseDir, expect = null }) {
  try {
    const record = readScan(baseDir);
    if (!record) return { fresh: false, reason: "no-record" };
    if (record.pkgVersion !== pkgVersion() || record.builder !== BUILDER_VERSION) {
      return { fresh: false, reason: "version-changed" };
    }

    // Chi ci chiama dal plugin ha la config VERA in mano, non quella che il record dice di
    // avere usato. Le due possono divergere senza che vite.config.* cambi mtime: una variabile
    // d'ambiente letta dalla config, una config passata inline, un secondo progetto in monorepo
    // che condivide lo stesso node_modules e quindi lo stesso scan.json. La CLI non può passare
    // questo parametro — non ha ancora caricato niente, ed è tutto il punto di --fastverify —
    // quindi resta facoltativo e il percorso CLI non cambia di un byte.
    if (expect && (record.srcDir !== expect.srcDir
                || record.localeDir !== expect.localeDir
                || record.sourceLanguage !== expect.sourceLanguage)) {
      return { fresh: false, reason: "config-mismatch", detail: expect.localeDir };
    }

    // config: stesso file, stesso mtime, stessa dimensione. È il perno di tutto: è ciò che
    // autorizza a non importare la config vera.
    const configFile = findConfigFile(baseDir);
    if (!configFile || !record.config || configFile !== record.config.file) {
      return { fresh: false, reason: "config-changed", detail: configFile ?? record.config?.file };
    }
    const configStat = fs.statSync(path.join(baseDir, configFile), { throwIfNoEntry: false });
    if (!configStat || configStat.mtimeMs !== record.config.mtimeMs || configStat.size !== record.config.size) {
      return { fresh: false, reason: "config-changed", detail: configFile };
    }

    // locale: conteggio, hash dei nomi, mtime massimo.
    const localeAbs = path.join(baseDir, record.localeDir);
    if (!sameLocale(localeSignature(localeAbs), record.locale)) {
      return { fresh: false, reason: "locale-changed", detail: record.localeDir };
    }

    // sorgenti, stadio 1: solo stat.
    const srcRoot = path.join(baseDir, record.srcDir);
    const entries = walkSource(srcRoot, localeAbs, baseDir);
    const seen = new Set();
    const toRead = [];
    for (const e of entries) {
      seen.add(e.rel);
      const prev = record.files?.[e.rel];
      if (!prev || prev[0] !== e.mtimeMs || prev[1] !== e.size) toRead.push(e);
    }

    // sparizioni: un file marcato del record non più presente nell'albero. Copre sia la
    // cancellazione sia lo spostamento — un confronto sui soli mtime non vedrebbe mai il
    // secondo, perché rinominare un file non cambia il suo mtime. Controllata PRIMA di leggere
    // i file del mucchio, perché un file rinominato appare anche come "nuovo" nello stadio 2, e
    // qui deve vincere la sparizione, non un falso "source-changed" sul nuovo percorso.
    for (const rel of Object.keys(record.marked ?? {})) {
      if (!seen.has(rel)) return { fresh: false, reason: "source-gone", detail: rel };
    }

    // sorgenti, stadio 2: lettura dei soli file del mucchio.
    let first = null;
    let others = 0;
    for (const e of toRead) {
      let code;
      try {
        code = fs.readFileSync(e.path, "utf8");
      } catch {
        return { fresh: false, reason: "unreadable", detail: e.rel };
      }
      const hasMarker = code.includes(SOURCE_OPEN);
      const wasMarked = Object.prototype.hasOwnProperty.call(record.marked ?? {}, e.rel);

      let reason = null;
      if (hasMarker && (!wasMarked || hash(code) !== record.marked[e.rel])) reason = "source-changed";
      else if (!hasMarker && wasMarked) reason = "markers-removed";
      if (!reason) continue; // né marcato né lo era, o marcato e identico: irrilevante

      if (!first) first = { reason, detail: e.rel };
      else if (first.reason === reason) others++;
    }
    if (first) return { fresh: false, reason: first.reason, detail: first.detail, others };

    return {
      fresh: true,
      checked: entries.length,
      changed: toRead.length,
      warnings: record.warnings ?? 0,
      keys: record.keys ?? 0,
      srcDir: record.srcDir,
      localeDir: record.localeDir,
      simpleLog: record.simpleLog === true,
    };
  } catch (error) {
    return { fresh: false, reason: "unreadable", detail: error?.message };
  }
}
