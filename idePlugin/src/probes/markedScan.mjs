// La scansione delle voci marcate di UN progetto, file per file, con la loro riga: il lavoro della
// sonda di Marked (markedProbe.mjs, che ne è solo l'ingresso). Node puro, nessun `vscode`.
//
// Usa il codice del progetto: la libreria installata — `@sepoina/vitetranslate` e il suo
// `@babel/core`, risolti dalla cartella del progetto (la cwd) — così le voci sono quelle che
// troverebbe `vtranslate-cli`, macro comprese, e l'estensione non si porta dietro Babel. Stessi
// passi di lib/dev/vite/uty/scanSource.js: walkSource, il pre-scarto mayHaveMarkers,
// extractMarkers senza riscrittura. Solo, una tabella per file invece di una per progetto: la
// tabella dice quali chiavi esistono, non dove stanno.
//
// Della libreria si usa solo l'export dichiarato `@sepoina/vitetranslate/ide/scan`
// (lib/ide/scan.js), versionato da IDE_API: è il contratto, e questa estensione ne chiede almeno
// IDE_API_MIN. Una libreria senza l'export (pubblicata prima della 4.6.4-rc.3) non si legge a
// metà: è TOO_OLD, e la sezione facoltativa dice come aggiornarla.
//
// Da dove vengono le voci di un file, dal più economico:
//   1. l'overlay: quello che la scansione precedente ha letto da sé, ripassato dall'estensione
//      (stesso [mtimeMs, size]: il file non è cambiato da allora);
//   2. l'indice che scrive la sync (lib/dev/vite/uty/markerIndex.js, `markers.json`), se vale per
//      questa libreria e questo input: stesso [mtimeMs, size] dell'ultima sync;
//   3. il file letto: se il contenuto ha lo stesso hash dell'overlay o dell'indice (un file
//      toccato, salvato identico) le voci sono quelle; altrimenti Babel. Solo qui si carica.
// L'overlay restituito contiene i file dei punti 1 e 3: quelli cambiati dopo la sync.
//
// Le posizioni arrivano da `onMarker`, la callback di extractMarkers.
//
// Ogni voce porta i suoi problemi (`problems`), gli stessi nomi di errorSolve.mark più uno:
//   - malformed: un avviso dell'estrazione su quella voce (stessa riga e colonna nel messaggio).
//     Un avviso che non cade su nessuna voce — un "_%_" spaiato, una macro rifiutata — diventa
//     una voce a sé, senza chiave (`id: null`): è proprio il testo che non si tradurrà;
//   - notSynced: la chiave manca da almeno un file di lingua (o i file non ci sono): va
//     lanciato il sync. Finché non lo si fa, lo stato delle traduzioni non si giudica;
//   - untranslated: `null` in tutte le lingue di destinazione;
//   - notFullyTranslated: tradotta in qualcuna, `null` in almeno un'altra.
// Le tabelle si leggono a ogni scansione, con readLanguageFile della libreria come fa `--status`:
// il giudizio non sta nell'indice né nell'overlay, perché i file di lingua cambiano per conto loro.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Gli avvisi della libreria sono colorati per il terminale.
const senzaColori = (testo) => String(testo).replace(/\x1b\[[0-9;]*m/g, "");

// La posizione citata in un avviso della libreria: `"src/App.jsx:12:5"`.
const DOVE_RE = /:(\d+):(\d+)"/;

// Il testo di un avviso senza il file, che nella sezione si vede già: `nested markers: "…"`.
const senzaFile = (messaggio) => messaggio.replace(/ in "[^"]*"/, "");

// probe.mjs descrive una RegExp come { $regexp: "/.../flags" }: la si ricostruisce.
function autoWrapDa(valore) {
  const r = /^\/(.*)\/([a-z]*)$/s.exec(valore?.$regexp ?? "");
  if (r) return new RegExp(r[1], r[2]);
  return valore === true;
}

const stessoStat = (stat, entry) => Array.isArray(stat) && stat[0] === entry.mtimeMs && stat[1] === entry.size;

// La versione del contratto `./ide/scan` che questa estensione richiede (IDE_API in
// lib/ide/scan.js). Si alza solo quando la sonda comincia a usare un export nuovo: allora la
// libreria che lo porta si pubblica prima della .vsix (AGENTS.md, "REGOLE DI RILASCIO").
export const IDE_API_MIN = 1;

// La prima versione della libreria con quell'IDE_API: IDE_API_MIN detto all'utente, nella testata
// di Settings e nella pagina del guasto. Sale con IDE_API_MIN. Le rc contano come la loro versione
// (olderThan): la prima con l'export è la 4.6.4-rc.3.
export const LIB_MIN = "4.6.4";

// I guasti della libreria stessa: manca, è troppo vecchia, non si riesce a caricare. Con questi
// Results non ha niente da mostrare, e la sezione facoltativa prende il posto di Results e Project
// per dire come rimediare (OptionalView, il modo "library").
export const LIBRARY_PROBLEMS = new Set(["NO_LIBRARY", "TOO_OLD", "UNREADABLE_LIBRARY"]);

/**
 * Uno scanner per il progetto della cwd. Tiene i moduli della libreria già caricati: in un
 * processo che resta vivo (scanWorker.mjs) Babel si carica una volta sola.
 *
 * @returns {{ scan: (opzioni: object, overlay?: object) => Promise<object>, readonly babel: boolean }}
 */
export function createScanner() {
  let libreria = null; // { pkgDir, version, ideApi, walkSource, mayHaveMarkers, …, indice, hash, loadExtractMarkers }
  // `ideApi`, se l'export c'è: lo mostra VERSION, in Settings (versionsState in inspectorState.mjs).
  const troppoVecchia = (version, ideApi) => ({
    ok: false, code: "TOO_OLD", error: `@sepoina/vitetranslate ${version} is too old for this extension`, version,
    ...(typeof ideApi === "number" && { ideApi }),
  });
  let extractMarkers = null;

  // La libreria della cwd, caricata una volta. Se sul disco cambia versione sotto un processo
  // vivo (npm install), i moduli in memoria sono di un'altra: STALE_WORKER, e chi ci ha lanciati
  // ne apre un altro.
  async function carica(cwd) {
    let pkgDir;
    try {
      pkgDir = libreria?.pkgDir ?? path.dirname(createRequire(path.join(cwd, "package.json")).resolve("@sepoina/vitetranslate/package.json"));
    } catch {
      return { ok: false, code: "NO_LIBRARY", error: "@sepoina/vitetranslate is not installed in this project" };
    }
    let version;
    try {
      ({ version } = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")));
    } catch (error) {
      if (libreria) return { ok: false, code: "STALE_WORKER", error: "the library changed on disk" };
      throw error;
    }
    if (libreria) {
      return libreria.version === version ? { ok: true } : { ok: false, code: "STALE_WORKER", error: "the library changed on disk" };
    }
    // L'ingresso dichiarato per l'estensione. Una libreria che non lo ha è di prima del contratto.
    let ingresso;
    try {
      ingresso = createRequire(path.join(cwd, "package.json")).resolve("@sepoina/vitetranslate/ide/scan");
    } catch {
      // ERR_PACKAGE_PATH_NOT_EXPORTED: pubblicata prima dell'export
      return troppoVecchia(version);
    }
    // L'export c'è ma non si carica (un'installazione rotta): non è un guasto della scansione ma
    // della libreria, e lo si dice così.
    let api;
    try {
      api = await import(pathToFileURL(ingresso).href);
    } catch (error) {
      return {
        ok: false, code: "UNREADABLE_LIBRARY", version,
        error: `@sepoina/vitetranslate ${version} can't be read by this extension: ${senzaColori(error?.message ?? error).split("\n")[0]}`,
      };
    }
    // Un IDE_API assente o più basso del minimo: manca qualcosa che la sonda usa.
    if (!(api.IDE_API >= IDE_API_MIN)) return troppoVecchia(version, api.IDE_API);
    libreria = {
      pkgDir, version, ideApi: api.IDE_API,
      walkSource: api.walkSource, mayHaveMarkers: api.mayHaveMarkers, listFiles: api.listFiles,
      isLanguageFileName: api.isLanguageFileName, tagFromFileName: api.tagFromFileName, readLanguageFile: api.readLanguageFile,
      indice: { readMarkerIndex: api.readMarkerIndex, autoWrapKey: api.autoWrapKey },
      hash: api.hash,
      loadExtractMarkers: api.loadExtractMarkers,
    };
    return { ok: true };
  }

  /**
   * @param {object} opzioni - { baseDir, srcDir, localeDir, sourceLanguage, autoWrap } come li ha
   *   risolti probe.mjs; baseDir assoluto o relativo alla cwd (la cartella del progetto)
   * @param {Record<string, object>} [overlay] - quello restituito dalla scansione precedente
   * @returns {Promise<object>} `{ ok, version, ideApi, scanned, languages, files, warnings, overlay,
   *   origin, index }`, o `{ ok: false, code, error }`; mai un rifiuto
   */
  async function scan(opzioni, overlay = {}) {
    try {
      const cwd = process.cwd();
      const baseDir = path.resolve(cwd, opzioni.baseDir ?? ".");
      const srcRoot = path.join(baseDir, opzioni.srcDir ?? "src");
      const localeDir = path.join(baseDir, opzioni.localeDir ?? "locale");

      const caricata = await carica(cwd);
      if (!caricata.ok) return caricata;
      const L = libreria;
      const version = L.version;
      if (!fs.existsSync(srcRoot)) {
        return { ok: false, code: "NO_SRCDIR", error: `srcDir not found: ${path.relative(cwd, srcRoot) || "."}`, version, ideApi: L.ideApi };
      }
      const inizio = Date.now();
      const files = [];
      const warnings = [];

      // Le tabelle di lingua: tag -> { chiave: testo | null }. Una tabella che non si legge non
      // si giudica: è `--status` a dire perché.
      const tabelle = new Map();
      const errori = new Map(); // tag -> perché la sua tabella non si legge
      let nomi = [];
      try {
        nomi = L.listFiles(localeDir).filter(L.isLanguageFileName);
      } catch {
        // localeDir assente: nessuna tabella, ogni voce è da sincronizzare
      }
      for (const nome of nomi) {
        try {
          tabelle.set(L.tagFromFileName(nome), L.readLanguageFile(path.join(localeDir, nome))?.table ?? {});
        } catch (error) {
          // illeggibile o fuori formato: non si giudica, ma lo si dice (stats, sotto)
          errori.set(L.tagFromFileName(nome), senzaColori(error?.message ?? error).split("\n")[0]);
        }
      }
      const sorgente = opzioni.sourceLanguage;
      const destinazioni = [...tabelle.keys()].filter((tag) => tag !== sorgente);

      // Per ogni file di lingua: quante chiavi della sorgente gli mancano (assenti o `null`), o
      // perché non si legge. Lo mostra Translations in Project. Senza tabella sorgente leggibile
      // non c'è un metro: `missing` resta null.
      const chiaviSorgente = tabelle.has(sorgente) ? Object.keys(tabelle.get(sorgente)) : null;
      const stats = {};
      for (const [tag, t] of tabelle) {
        const missing = tag === sorgente || !chiaviSorgente ? (tag === sorgente ? 0 : null) : chiaviSorgente.filter((k) => t[k] == null).length;
        stats[tag] = { keys: chiaviSorgente?.length ?? null, missing };
      }
      for (const [tag, error] of errori) stats[tag] = { error };

      // Una sorgente che manca va sincronizzata; una che non si legge no: come le altre tabelle
      // illeggibili non si giudica, e lo dice il suo stat (il sync non ripara uno YAML rotto).
      const problemiDi = (id) => {
        const assente = [...tabelle].filter(([, t]) => !(id in t)).map(([tag]) => tag);
        if (!tabelle.has(sorgente) && !errori.has(sorgente)) assente.unshift(sorgente ?? "source language");
        if (assente.length) return [{ kind: "notSynced", detail: assente }];
        const mancanti = destinazioni.filter((tag) => tabelle.get(tag)[id] === null);
        if (!mancanti.length) return [];
        return [{ kind: mancanti.length === destinazioni.length ? "untranslated" : "notFullyTranslated", detail: mancanti }];
      };

      // L'indice della sync vale solo per questa libreria e per lo stesso input.
      const autoWrap = autoWrapDa(opzioni.autoWrap);
      const letto = L.indice.readMarkerIndex(baseDir);
      const valido = !!letto
        && letto.pkgVersion === version
        && typeof letto.srcDir === "string" && path.join(baseDir, letto.srcDir) === srcRoot
        && typeof letto.localeDir === "string" && path.join(baseDir, letto.localeDir) === localeDir
        && letto.autoWrap === L.indice.autoWrapKey(autoWrap);
      const indice = valido ? letto : null;
      const precedente = overlay ?? {};
      const nuovo = {};
      const origin = { index: 0, overlay: 0, parsed: 0 };

      const elenco = L.walkSource(srcRoot, localeDir, baseDir);
      for (const entry of elenco) {
        const o = precedente[entry.rel];
        const stat = [entry.mtimeMs, entry.size];
        let dati = null; // { entries, warnings } grezzi, come li dà l'estrazione
        if (o && stessoStat(o.stat, entry)) {
          nuovo[entry.rel] = o;
          if (o.none) continue;
          origin.overlay++;
          dati = o;
        } else if (indice && stessoStat(indice.files?.[entry.rel], entry)) {
          dati = indice.marked?.[entry.rel] ?? null;
          if (!dati) continue;
          origin.index++;
        } else {
          let code;
          try {
            code = fs.readFileSync(entry.path, "utf8");
          } catch (error) {
            files.push({ rel: entry.rel, path: entry.path, entries: [], error: error.message });
            continue;
          }
          if (!L.mayHaveMarkers(code)) {
            nuovo[entry.rel] = { stat, none: true };
            continue;
          }
          const h = L.hash(code);
          const noto = o?.hash === h ? o : indice?.marked?.[entry.rel]?.hash === h ? indice.marked[entry.rel] : null;
          if (noto) {
            dati = { entries: noto.entries, warnings: noto.warnings };
            if (noto === o) origin.overlay++;
            else origin.index++;
          } else {
            // Caricato alla prima occorrenza, come fa scanSource: è qui che manca Babel, se manca.
            extractMarkers ??= await L.loadExtractMarkers();
            const table = {};
            const entries = [];
            const avvisi = [];
            try {
              extractMarkers(code, {
                filename: entry.path, table, rewrite: false, baseDir, autoWrap, hints: {},
                warn: (message, kind = "marker") => avvisi.push({ kind, message }),
                onMarker: (voce) => entries.push(voce),
              });
            } catch (error) {
              if (error?.code === "VT_NO_BABEL") throw error;
              files.push({ rel: entry.rel, path: entry.path, entries: [], error: senzaColori(error?.message ?? error).split("\n")[0] });
              continue;
            }
            dati = { entries, warnings: avvisi };
            origin.parsed++;
          }
          nuovo[entry.rel] = { stat, hash: h, entries: dati.entries, warnings: dati.warnings };
        }

        // Il giudizio, su una copia: le voci dell'overlay tornano all'estensione così come sono.
        const avvisi = (dati.warnings ?? []).map((w) => ({ rel: entry.rel, kind: w.kind, message: senzaColori(w.message) }));
        warnings.push(...avvisi);
        const entries = dati.entries.map((v) => ({ ...v, problems: problemiDi(v.id) }));
        for (const avviso of avvisi) {
          const dove = DOVE_RE.exec(avviso.message);
          const [line, column] = dove ? [Number(dove[1]), Number(dove[2])] : [null, null];
          const problema = { kind: "malformed", detail: senzaFile(avviso.message) };
          const sue = entries.filter((v) => v.id !== null && v.line === line && v.column === column);
          if (sue.length) for (const v of sue) v.problems.unshift(problema);
          else entries.push({ id: null, text: problema.detail, line, column, problems: [problema] });
        }
        entries.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0));
        if (entries.length) files.push({ rel: entry.rel, path: entry.path, entries });
      }
      // Nell'ordine di walkSource, come prima: le voci da indice e overlay si mescolano alle altre.
      return {
        ok: true, version, ideApi: L.ideApi, scanned: elenco.length, languages: { source: sorgente, targets: destinazioni, stats }, files, warnings,
        overlay: nuovo,
        origin,
        index: valido ? "used" : letto ? "mismatch" : "none",
        ms: Date.now() - inizio,
      };
    } catch (error) {
      return { ok: false, code: error?.code ?? null, error: senzaColori(error?.message ?? error) };
    }
  }

  return {
    scan,
    /** Vero se questo processo ha già caricato Babel: tenerlo vivo ha senso solo allora. */
    get babel() {
      return extractMarkers !== null;
    },
  };
}
