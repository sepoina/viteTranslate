// La seconda sonda: elenca le voci marcate di UN progetto, file per file, con la loro riga.
//
// Gira in un processo figlio come probe.mjs (vedi runProbe.mjs), e per la stessa ragione di
// fondo: usa il codice del progetto. Qui non il vite.config ma la libreria installata —
// `@sepoina/vitetranslate` e il suo `@babel/core`, risolti dalla cartella del progetto — così le
// voci sono quelle che troverebbe `vtranslate-cli`, macro comprese, e l'estensione non si porta
// dietro Babel. Stessi passi di lib/dev/vite/uty/scanSource.js: walkSource, il pre-scarto
// mayHaveMarkers, extractMarkers senza riscrittura. Solo, una tabella per file invece di una
// per progetto: la tabella dice quali chiavi esistono, non dove stanno.
//
// Le posizioni arrivano da `onMarker`, aggiunto a extractMarkers dopo la 4.6.3. Con una libreria
// più vecchia la callback non viene mai chiamata: le voci si prendono dalla tabella, senza riga.
//
// Ogni voce porta i suoi problemi (`problems`), gli stessi nomi di errorSolve.mark più uno:
//   - malformed: un avviso dell'estrazione su quella voce (stessa riga e colonna nel messaggio).
//     Un avviso che non cade su nessuna voce — un "_%_" spaiato, una macro rifiutata — diventa
//     una voce a sé, senza chiave (`id: null`): è proprio il testo che non si tradurrà;
//   - notSynced: la chiave manca da almeno un file di lingua (o i file non ci sono): va
//     lanciato il sync. Finché non lo si fa, lo stato delle traduzioni non si giudica;
//   - untranslated: `null` in tutte le lingue di destinazione;
//   - notFullyTranslated: tradotta in qualcuna, `null` in almeno un'altra.
// Le tabelle si leggono con readLanguageFile della libreria, come fa `--status`.
//
//   argv[2] = JSON { baseDir, srcDir, localeDir, sourceLanguage, autoWrap } come li ha risolti
//             probe.mjs; baseDir assoluto o relativo alla cwd (la cartella del progetto)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

function rispondi(messaggio) {
  if (process.send) process.send(messaggio, () => process.exit(0));
  else {
    process.stdout.write(JSON.stringify(messaggio) + "\n");
    process.exit(0);
  }
}

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

try {
  const opzioni = JSON.parse(process.argv[2] ?? "{}");
  const cwd = process.cwd();
  const baseDir = path.resolve(cwd, opzioni.baseDir ?? ".");
  const srcRoot = path.join(baseDir, opzioni.srcDir ?? "src");
  const localeDir = path.join(baseDir, opzioni.localeDir ?? "locale");

  let pkgDir;
  try {
    pkgDir = path.dirname(createRequire(path.join(cwd, "package.json")).resolve("@sepoina/vitetranslate/package.json"));
  } catch {
    rispondi({ ok: false, code: "NO_LIBRARY", error: "@sepoina/vitetranslate is not installed in this project" });
  }
  if (pkgDir) {
    const lib = (rel) => import(pathToFileURL(path.join(pkgDir, "lib", rel)).href);
    const { default: walkSource } = await lib("dev/vite/uty/walkSource.js");
    const { mayHaveMarkers } = await lib("markerSyntax.js");
    const { listFiles } = await lib("dev/vite/uty/listLanguageFiles.js");
    const { isLanguageFileName, tagFromFileName } = await lib("dev/vite/uty/languageFileFormat.js");
    const { default: readLanguageFile } = await lib("dev/vite/uty/readLanguageFile.js");
    const { version } = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));

    if (!fs.existsSync(srcRoot)) {
      rispondi({ ok: false, code: "NO_SRCDIR", error: `srcDir not found: ${path.relative(cwd, srcRoot) || "."}`, version });
    } else {
      const inizio = Date.now();
      const files = [];
      const warnings = [];

      // Le tabelle di lingua: tag -> { chiave: testo | null }. Una tabella che non si legge non
      // si giudica: è `--status` a dire perché.
      const tabelle = new Map();
      let nomi = [];
      try {
        nomi = listFiles(localeDir).filter(isLanguageFileName);
      } catch {
        // localeDir assente: nessuna tabella, ogni voce è da sincronizzare
      }
      for (const nome of nomi) {
        try {
          tabelle.set(tagFromFileName(nome), readLanguageFile(path.join(localeDir, nome))?.table ?? {});
        } catch {
          // illeggibile o fuori formato
        }
      }
      const sorgente = opzioni.sourceLanguage;
      const destinazioni = [...tabelle.keys()].filter((tag) => tag !== sorgente);

      const problemiDi = (id) => {
        const assente = [...tabelle].filter(([, t]) => !(id in t)).map(([tag]) => tag);
        if (!tabelle.has(sorgente)) assente.unshift(sorgente ?? "source language");
        if (assente.length) return [{ kind: "notSynced", detail: assente }];
        const mancanti = destinazioni.filter((tag) => tabelle.get(tag)[id] === null);
        if (!mancanti.length) return [];
        return [{ kind: mancanti.length === destinazioni.length ? "untranslated" : "notFullyTranslated", detail: mancanti }];
      };
      let extractMarkers = null;
      const elenco = walkSource(srcRoot, localeDir, baseDir);
      for (const entry of elenco) {
        let code;
        try {
          code = fs.readFileSync(entry.path, "utf8");
        } catch (error) {
          files.push({ rel: entry.rel, path: entry.path, entries: [], error: error.message });
          continue;
        }
        if (!mayHaveMarkers(code)) continue;
        // Caricato alla prima occorrenza, come fa scanSource: è qui che manca Babel, se manca.
        extractMarkers ??= (await lib("dev/babel/extractMarkers.js")).default;
        const table = {};
        const entries = [];
        const avvisi = [];
        try {
          extractMarkers(code, {
            filename: entry.path, table, rewrite: false, baseDir, autoWrap: autoWrapDa(opzioni.autoWrap), hints: {},
            warn: (message, kind = "marker") => avvisi.push({ rel: entry.rel, kind, message: senzaColori(message) }),
            onMarker: (voce) => entries.push(voce),
          });
        } catch (error) {
          if (error?.code === "VT_NO_BABEL") throw error;
          files.push({ rel: entry.rel, path: entry.path, entries: [], error: senzaColori(error?.message ?? error).split("\n")[0] });
          continue;
        }
        warnings.push(...avvisi);
        // Libreria senza onMarker: le voci ci sono, le righe no.
        if (!entries.length) for (const [id, text] of Object.entries(table)) entries.push({ id, text, line: null, column: null });
        for (const voce of entries) voce.problems = problemiDi(voce.id);
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
      rispondi({ ok: true, version, scanned: elenco.length, languages: { source: sorgente, targets: destinazioni }, files, warnings, ms: Date.now() - inizio });
    }
  }
} catch (error) {
  rispondi({ ok: false, code: error?.code ?? null, error: senzaColori(error?.message ?? error) });
}
