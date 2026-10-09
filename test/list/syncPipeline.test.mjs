// Il lato Node della sincronizzazione: updateLanguage + updateAllSubLanguages + guardMassErase.
//
// È l'unica parte della libreria che SCRIVE sui file dell'utente, e l'unica in cui uno sbaglio
// non si vede come un render storto ma come traduzioni sparite. Gli altri test coprono
// l'estrazione e la compilazione, cioè quello che succede *dopo* che le tabelle esistono; qui
// si verifica come le tabelle nascono, si aggiornano e — soprattutto — come si difendono.
//
// Ogni caso gira in una cartella temporanea sua, così l'ordine dei test non conta e un caso che
// fallisce non ne trascina altri.
//
//   node test/list/syncPipeline.test.mjs
import fs, { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, symlinkSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import updateLanguage from "../../lib/dev/vite/updateLanguage.js";
import { printSyncSummary } from "../../lib/dev/vite/uty/syncReport.js";
import { detectMassErase } from "../../lib/dev/vite/uty/guardMassErase.js";
import runSync from "../../lib/dev/vite/syncCore.js";
import { syncIo } from "../../lib/dev/vite/uty/syncIo.js";
import { scanPath } from "../../lib/dev/vite/uty/scanRecord.js";
import { markerIndexPath } from "../../lib/dev/vite/uty/markerIndex.js";
import { sessionPath } from "../../lib/dev/vite/uty/sessionStore.js";
import readLanguageFile from "../../lib/dev/vite/uty/readLanguageFile.js";
import { languageFileName } from "../../lib/dev/vite/uty/languageFileFormat.js";
import { placeholderShape, convertPlaceholders } from "../../lib/dev/vite/uty/placeholderShape.js";
import listLanguageFiles from "../../lib/dev/vite/uty/listLanguageFiles.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(50), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const SEPARATORE = "----to be translated";
const temporanee = [];

/** Una cartella locale usa e getta, con il suo piccolo mondo di file lingua. */
function progetto() {
  const localeDir = mkdtempSync(join(tmpdir(), "vt-sync-"));
  temporanee.push(localeDir);

  const percorso = (tag) => join(localeDir, languageFileName(tag));
  const api = {
    localeDir,
    /** La configurazione che cli.js costruisce, con la tabella appena "scansionata". */
    servizio: (tabella) => ({
      localeDir,
      sourceLanguage: "it-IT",
      sourceTable: { ...tabella },
      notTranslated: {},
    }),
    /**
     * Una sincronizzazione completa, con l'output del comando catturato invece che stampato.
     * `esito` è quello che updateLanguage restituisce: da lì in poi il comando non racconta
     * più i propri passi mentre li fa, li riferisce — e quello che va verificato è il
     * riferito, non come chi chiama sceglie di stamparlo.
     */
    sync: async (tabella) => {
      const servizio = api.servizio(tabella);
      let esito;
      const detto = await zitto(async () => { esito = await updateLanguage(servizio); });
      return { detto, esito, servizio };
    },
    testo: (tag) => readFileSync(percorso(tag), "utf8"),
    scrivi: (tag, testo) => writeFileSync(percorso(tag), testo, "utf8"),
    tabella: (tag) => readLanguageFile(percorso(tag)).table,
    file: () => readdirSync(localeDir).sort(),
    mtime: (tag) => statSync(percorso(tag)).mtimeMs,
    percorso,
  };
  return api;
}

/** Esegue zitta una funzione rumorosa, restituendo tutto quello che avrebbe stampato. */
async function zitto(fn) {
  const originali = { log: console.log, warn: console.warn, error: console.error };
  let raccolto = "";
  const raccogli = (...pezzi) => { raccolto += pezzi.join(" ") + "\n"; };
  console.log = console.warn = console.error = raccogli;
  try {
    await fn();
  } finally {
    Object.assign(console, originali);
  }
  return raccolto;
}

/** Synchronous twin of `zitto`, for pure functions that only print. */
function zittoSync(fn) {
  const originali = { log: console.log, warn: console.warn, error: console.error };
  let raccolto = "";
  console.log = console.warn = console.error = (...pezzi) => { raccolto += pezzi.join(" ") + "\n"; };
  try {
    fn();
  } finally {
    Object.assign(console, originali);
  }
  return raccolto;
}

/** Le chiavi di un file lingua, divise da quello che il serializzatore ha marcato come da tradurre. */
function sezioni(testo) {
  const [prima, dopo = ""] = testo.split(SEPARATORE);
  // Una voce per riga, a colonna 0: le righe indentate o che cominciano per "#" non lo sono.
  const chiavi = (pezzo) => [...pezzo.matchAll(/^([A-Za-z_][A-Za-z0-9_.-]*):/gm)].map((m) => m[1]);
  return { tradotte: chiavi(prima), daTradurre: chiavi(dopo) };
}

const backup = (p, tipo) => p.file().filter((f) => f.includes(`.bak-${tipo}-`));
/** Il contenuto del primo backup di quel tipo, o "" se non ne è stato salvato nessuno. */
const testoBackup = (p, tipo) => {
  const [primo] = backup(p, tipo);
  return primo === undefined ? "" : readFileSync(join(p.localeDir, primo), "utf8");
};

// ------------------------------------------------------------------ creazione da zero
console.log("\n== creazione da zero ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao", App_b: "Mondo" });

  eq("scrive solo la lingua sorgente", "it-IT.yml", p.file().join(","));
  const t = p.tabella("it-IT");
  eq("chiavi scritte", "App_a,App_b", Object.keys(t).sort().join(","));
  eq("valori scritti", "Ciao,Mondo", [t.App_a, t.App_b].join(","));
  eq("niente da tradurre", false, p.testo("it-IT").includes(SEPARATORE));
  eq("intestazione: 0 mancanti", true, /missing key: 0/.test(p.testo("it-IT")));
  eq("intestazione con TableVersion", true, /TableVersion: \d+/.test(p.testo("it-IT")));
}

// --------------------------------------------------------------- una lingua in più
console.log("\n== una lingua nuova (file creato vuoto a mano) ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao", App_b: "Mondo" });
  p.scrivi("en-US", "");
  const { esito } = await p.sync({ App_a: "Ciao", App_b: "Mondo" });

  eq("nessun backup: un file vuoto non ha nulla da perdere", 0, backup(p, "corrupted").length);
  eq("riconosciuto come lingua nuova", "new language, was empty", esito.languages.find((l) => l.tag === "en-US")?.note);
  eq("con le sue chiavi da tradurre", 2, esito.languages.find((l) => l.tag === "en-US")?.missing);
  const { tradotte, daTradurre } = sezioni(p.testo("en-US"));
  eq("niente è ancora 'tradotto'", "", tradotte.join(","));
  eq("tutto il resto è da tradurre", "App_a,App_b", daTradurre.join(","));
  const t = p.tabella("en-US");
  eq("le chiavi nuove valgono null", "null,null", [JSON.stringify(t.App_a), JSON.stringify(t.App_b)].join(","));
  eq("intestazione: 2 mancanti", true, /missing key: 2/.test(p.testo("en-US")));

  // Il file della lingua sorgente segnala le chiavi che mancano ALTROVE: è lì che si vede
  // che c'è ancora lavoro da fare, senza aprire tutte le lingue una per una.
  eq("la sorgente elenca le chiavi non tradotte altrove", "App_a,App_b", sezioni(p.testo("it-IT")).daTradurre.join(","));
}

// ------------------------------------------------------- traduzione fatta a mano
console.log("\n== traduzione completata a mano ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao", App_b: "Mondo" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao", App_b: "Mondo" });
  p.scrivi("en-US", p.testo("en-US").replace("App_a: null", 'App_a: "Hello"').replace("App_b: null", 'App_b: "World"'));
  await p.sync({ App_a: "Ciao", App_b: "Mondo" });

  eq("la sezione da tradurre sparisce", false, p.testo("en-US").includes(SEPARATORE));
  const t = p.tabella("en-US");
  eq("le traduzioni restano", "Hello,World", [t.App_a, t.App_b].join(","));
  eq("intestazione: 0 mancanti", true, /missing key: 0/.test(p.testo("en-US")));
  eq("la sorgente non elenca più nulla", false, p.testo("it-IT").includes(SEPARATORE));

  // Il caso che motivava "incomplete": una sub-lingua che si completa fa riscrivere anche il
  // file della lingua sorgente (la sua sezione "to be translated" cambia). Confermato sopra.
  // Qui si verifica l'altra metà: una volta riscritti, un'altra sync a codice fermo non li
  // tocca di nuovo — il confronto è sugli mtime, non sul contenuto, perché una riscrittura
  // inutile produrrebbe comunque gli stessi byte (a parte il timestamp) e passerebbe liscia.
  const prima = { it: p.mtime("it-IT"), en: p.mtime("en-US") };
  await p.sync({ App_a: "Ciao", App_b: "Mondo" });
  eq("la sorgente non viene ritoccata", prima.it, p.mtime("it-IT"));
  eq("la sub-lingua completata non viene ritoccata", prima.en, p.mtime("en-US"));
}

// ------------------------------------------------------------------- idempotenza
console.log("\n== una seconda sync a codice fermo non riscrive niente ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao", App_b: "Mondo" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao", App_b: "Mondo" });
  const prima = { it: p.mtime("it-IT"), en: p.mtime("en-US") };
  const { esito } = await p.sync({ App_a: "Ciao", App_b: "Mondo" });

  // Il confronto è sulla mtime e non sul contenuto: l'intestazione ha un timestamp al minuto,
  // quindi una riscrittura inutile produrrebbe comunque gli stessi byte e passerebbe liscia.
  eq("la lingua sorgente non viene toccata", prima.it, p.mtime("it-IT"));
  eq("la sub-lingua non viene toccata", prima.en, p.mtime("en-US"));
  eq("e lo dice", false, esito.written);
  eq("senza chiavi cambiate", "no changes detected", esito.action);
}

// ------------------------------------------------------ chiavi che vanno e vengono
console.log("\n== chiavi rimosse dal codice ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao", App_b: "Mondo" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao", App_b: "Mondo" });
  p.scrivi("en-US", p.testo("en-US").replace("App_a: null", 'App_a: "Hello"').replace("App_b: null", 'App_b: "World"'));
  await p.sync({ App_a: "Ciao" }); // App_b non esiste più nei sorgenti

  eq("sparisce dalla sorgente", "App_a", Object.keys(p.tabella("it-IT")).join(","));
  eq("sparisce anche dalle sub-lingue", "App_a", Object.keys(p.tabella("en-US")).join(","));
}

console.log("\n== stesso testo, id nuovo: la traduzione si eredita ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao" });
  p.scrivi("en-US", p.testo("en-US").replace("App_a: null", 'App_a: "Hello"'));
  // Il marcatore si è spostato in un altro file: stesso testo, prefisso (e quindi id) diverso.
  await p.sync({ Altro_a: "Ciao" });

  const t = p.tabella("en-US");
  eq("la chiave nuova prende la traduzione della vecchia", "Hello", t.Altro_a);
  eq("la vecchia non resta in giro", undefined, t.App_a);
  eq("e non risulta da tradurre", false, p.testo("en-US").includes(SEPARATORE));
}

console.log("\n== una traduzione vuota è una traduzione ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao" });
  p.scrivi("en-US", p.testo("en-US").replace("App_a: null", 'App_a: ""'));
  await p.sync({ App_a: "Ciao" });

  // La distinzione è fra null (mai tradotta) e stringa vuota (tradotta con niente, per esempio
  // un'etichetta che in questa lingua non si scrive). Trattarle allo stesso modo rimetterebbe a
  // null una scelta deliberata a ogni sync.
  eq("la stringa vuota resta", "", (p.tabella("en-US")).App_a);
  eq("e non torna sotto il separatore", false, p.testo("en-US").includes(SEPARATORE));
}

// ------------------------------------------------------------------- file rovinati
console.log("\n== file di lingua non leggibile ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao" });
  p.scrivi("en-US", p.testo("en-US").replace("App_a: null", 'App_a: "Hello"'));
  const salvato = p.testo("en-US");
  p.scrivi("en-US", 'App_a: Hello senza virgolette'); // valore non quotato
  const { detto } = await p.sync({ App_a: "Ciao" });

  eq("backup salvato", 1, backup(p, "corrupted").length);
  eq("il backup contiene il file com'era", true, testoBackup(p, "corrupted").includes("App_a: Hello senza virgolette"));
  eq("lo dice a chiare lettere", true, detto.includes("corrupted"));
  eq("il file torna valido", "App_a", Object.keys(p.tabella("en-US")).join(","));
  eq("e riparte da tradurre", true, p.testo("en-US").includes(SEPARATORE));
  eq("il file precedente non è stato perso", true, salvato.includes("Hello"));
}

console.log("\n== lingua sorgente non leggibile ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao" });
  p.scrivi("it-IT", "questa non e' una voce }{");
  const { detto } = await p.sync({ App_a: "Ciao" });

  eq("backup salvato", 1, backup(p, "corrupted").length);
  eq("lo dice", true, detto.includes("corrupted"));
  eq("la sorgente viene rigenerata dalla scansione", "Ciao", (p.tabella("it-IT")).App_a);
}

// ------------------------------------------------- quello che non si apre non si riscrive
console.log("\n== un file di cui non sappiamo niente resta dov'e' ==");
{
  // Una CARTELLA chiamata come un file di lingua: nasce da un mkdir sbagliato, da un archivio
  // scompattato male, da un tool che ci mette dentro i suoi file. Passava ogni controllo —
  // il nome finisce per ".yml" — e falliva molto piu' avanti, con un EISDIR in mezzo a un
  // messaggio che parlava di sintassi, dopo aver lasciato lì un backup vuoto.
  const p = progetto();
  await p.sync({ App_a: "Ciao" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao" });
  mkdirSync(p.percorso("de-DE"));
  const { detto } = await p.sync({ App_a: "Ciao", App_b: "Nuova" });

  eq("nessun backup inventato", 0, backup(p, "corrupted").length);
  eq("la cartella e' ancora una cartella", true, statSync(p.percorso("de-DE")).isDirectory());
  eq("e non compare fra le lingue", false, detto.includes("de-DE"));
  eq("le altre lingue si sincronizzano lo stesso", true, "App_b" in p.tabella("en-US"));
}
{
  // The SOURCE language that cannot be opened. Decision D5 (4.7.1) reverses the old behavior:
  // before, the sub-languages were synced anyway while the source was "left untouched". Now
  // an unreadable file stops the whole sync before ANY table is written, so a half-synced
  // project cannot happen (VT_LANGUAGE_UNREADABLE).
  const p = progetto();
  await p.sync({ App_a: "Ciao" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao" });
  rmSync(p.percorso("it-IT"));
  mkdirSync(p.percorso("it-IT"));
  const prima = readFileSync(p.percorso("en-US"));
  let errore = null;
  await zitto(async () => {
    try { await updateLanguage(p.servizio({ App_a: "Ciao", App_b: "Nuova" })); } catch (e) { errore = e; }
  });

  eq("D5: the sync rejects", "VT_LANGUAGE_UNREADABLE", errore?.code);
  eq("the message names the file", true, errore?.message.includes("it-IT.yml"));
  eq("and says nothing was touched", true, errore?.message.includes("No language table was touched"));
  eq("paths lists the unreadable file", true, errore?.paths?.length === 1 && errore.paths[0].endsWith("it-IT.yml"));
  eq("the sub-language bytes are unchanged", true, prima.equals(readFileSync(p.percorso("en-US"))));
  eq("the folder is still a folder", true, statSync(p.percorso("it-IT")).isDirectory());
  eq("nessun backup vuoto lasciato in giro", 0, backup(p, "corrupted").length);
}

console.log("\n== il backup e' una copia, non una trascrizione ==");
{
  // Un file di lingua salvato in UTF-16 (il Blocco note di Windows alla voce "Unicode") e'
  // uno dei modi in cui un file diventa "corrotto" per noi. Il backup lo scriveva ridecodificato
  // come UTF-8: ogni byte che la decodifica non aveva saputo leggere diventava un carattere di
  // sostituzione, e siccome subito dopo l'originale veniva riscritto, quella era la fine del
  // contenuto. Adesso si copiano i byte.
  const p = progetto();
  await p.sync({ App_a: "Ciao" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao" });
  const originale = Buffer.from('__builder__: {"v":1}\nApp_a: "citt\u00e0 perduta"\n', "utf16le");
  writeFileSync(p.percorso("en-US"), originale);
  await p.sync({ App_a: "Ciao" });

  const nomi = backup(p, "corrupted");
  eq("backup salvato", 1, nomi.length);
  const copia = readFileSync(join(p.localeDir, nomi[0]));
  eq("byte per byte come l'originale", true, originale.equals(copia));
  eq("il file torna leggibile", true, p.tabella("en-US") !== undefined);
}

// -------------------------------------------------------------- guardia anti-azzeramento
console.log("\n== guardia: quando la cancellazione non sembra una pulizia ==");
{
  const nuovo = async (tabella = { A_1: "uno", A_2: "due", A_3: "tre", A_4: "quattro" }) => {
    const p = progetto();
    await p.sync(tabella);
    p.scrivi("en-US", "");
    await p.sync(tabella);
    return p;
  };

  {
    const p = await nuovo();
    const { detto } = await p.sync({ A_1: "uno", A_2: "due", A_3: "tre" });
    eq("una chiave su quattro: nessun backup per una pulizia normale", 0, backup(p, "erased").length);
    eq("e nessun avviso", false, detto.includes("WARNING"));
  }
  {
    const p = await nuovo();
    const { detto } = await p.sync({});
    eq("scansione a vuoto: motivo riconoscibile", true, detto.includes("found no marked string at all"));
    eq("backup di OGNI file lingua", 2, backup(p, "erased").length);
    const salvato = backup(p, "erased").find((f) => f.startsWith("en-US"));
    eq("il backup contiene le traduzioni", true, salvato !== undefined && readFileSync(join(p.localeDir, salvato), "utf8").includes("A_1"));
    eq("e dice come ripristinare", true, detto.includes("restore the '.bak-erased-*' files"));
  }
  {
    const p = await nuovo();
    await p.sync({ A_1: "uno", A_2: "due" });
    eq("metà tabella in un colpo: backup di ogni file", 2, backup(p, "erased").length);
  }
}

console.log("\n== detectMassErase: pura, riconosce il sospetto e non scrive niente ==");
{
  const prima = { A_1: "uno", A_2: "due", A_3: "tre", A_4: "quattro" };
  const rumore = (fn) => { let r; const detto = zittoSync(() => { r = fn(); }); return { r, detto }; };
  {
    const { r, detto } = rumore(() => detectMassErase({ previousTable: prima, sourceTable: { A_1: "uno", A_2: "due", A_3: "tre" } }));
    eq("una chiave su quattro: null", null, r);
    eq("niente da dire", "", detto);
  }
  {
    const { r, detto } = rumore(() => detectMassErase({ previousTable: prima, sourceTable: {} }));
    eq("scansione a vuoto: 4 chiavi", 4, r.erased.length);
    eq("causa", "the scan found no marked string at all", r.cause);
    eq("stampa l'avviso", true, detto.includes("ERASED translations detected"));
  }
  {
    const { r } = rumore(() => detectMassErase({ previousTable: prima, sourceTable: { A_1: "uno", A_2: "due" } }));
    eq("metà tabella: 2 chiavi", 2, r.erased.length);
    eq("causa con il conteggio", "2 of 4 keys would be removed at once", r.cause);
  }
  {
    const { r, detto } = rumore(() => detectMassErase({ previousTable: null, sourceTable: {} }));
    eq("progetto nuovo (nessuna tabella precedente): null", null, r);
    eq("e nessuna riga", "", detto);
  }
}

// ------------------------------------------------------------ contenuti ostili
console.log("\n== testi che il round-trip su file non deve alterare ==");
{
  const difficili = {
    App_1: 'virgolette "doppie" e \'singole\'',
    App_2: "backslash \\ e a capo \n vero",
    App_3: "unicode: però è così — 中文 🐅",
    App_4: "segnaposto %s e markup <b>grassetto</b>",
    App_5: "chiusura di script </script> e commento */",
    App_6: "dollaro $& $1 ${x} e backtick `",
    App_7: "",
    App_8: "  spazi ai bordi  ",
  };
  const p = progetto();
  await p.sync(difficili);
  const t = p.tabella("it-IT");
  for (const [chiave, valore] of Object.entries(difficili)) {
    eq(`round-trip ${chiave}`, valore, t[chiave]);
  }

  // Il separatore è un commento dentro l'oggetto: un valore che lo contiene non deve poter
  // spostare la riga di confine quando il file viene riletto.
  const p2 = progetto();
  await p2.sync({ App_a: `finto ${SEPARATORE}------`, App_b: "vero" });
  p2.scrivi("en-US", "");
  await p2.sync({ App_a: `finto ${SEPARATORE}------`, App_b: "vero" });
  const t2 = await p2.tabella("en-US");
  eq("un valore che imita il separatore non confonde la rilettura", "null,null", [JSON.stringify(t2.App_a), JSON.stringify(t2.App_b)].join(","));
  eq("e la sorgente lo conserva intatto", `finto ${SEPARATORE}------`, (await p2.tabella("it-IT")).App_a);
}

// ------------------------------------------------ ICU che non combacia col sorgente
console.log("\n== ICU: traduzione con argomenti diversi dal sorgente ==");
{
  const p = progetto();
  const sorgente = { App_a: "Ciao {nome}", App_b: "Hai {0, plural, one {# file} other {# file}}" };
  await p.sync(sorgente);
  p.scrivi("en-US", 'App_a: "Hi {name}"\nApp_b: "You have {0, plural, one {# file} other {# files}}"\n');
  const { esito } = await p.sync(sorgente);
  const en = esito.languages.find((l) => l.tag === "en-US");
  // Nessuna chiave manca, ma App_a verrebbe scartata dal compilatore (invariante 21).
  eq("esito: nessuna chiave mancante", 0, en?.missing);
  eq("esito: una ICU che non combacia", 1, en?.icuMismatch);
  const riepilogo = await zitto(async () => printSyncSummary(esito, "it-IT"));
  eq("riepilogo: niente 'all ok!'", false, riepilogo.includes("all ok"));
  eq("riepilogo: la segnala", true, riepilogo.includes("1 ICU key(s) not matching the source"));
}

// ------------------------------------------------- il comando, dalla riga di comando
console.log("\n== vtranslate-cli: trovare la config ==");
{
  const HERE = dirname(fileURLToPath(import.meta.url));
  const CLI = join(resolve(HERE, "../.."), "lib/dev/vite/cli.js");
  const PLUGIN = pathToFileURL(join(resolve(HERE, "../.."), "lib/index.js")).href;

  /** Un progetto finto completo — sorgente marcato compreso — su cui lanciare il comando. */
  function progettoCompleto(nomeConfig, config) {
    const radice = mkdtempSync(join(tmpdir(), "vt-cli-"));
    temporanee.push(radice);
    mkdirSync(join(radice, "src"));
    writeFileSync(join(radice, "package.json"), '{ "type": "module" }');
    writeFileSync(join(radice, "src", "App.jsx"), 'export const a = "_%_Ciao dal comando_%_";\n');
    if (nomeConfig) writeFileSync(join(radice, nomeConfig), config);
    return radice;
  }

  const CONFIG_JS = `
import { vitetranslate } from ${JSON.stringify(PLUGIN)};
export default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" })] };
`;
  // La forma a funzione di { command, mode }: comunissima appena la config guarda l'ambiente.
  const CONFIG_FUNZIONE = `
import { vitetranslate } from ${JSON.stringify(PLUGIN)};
export default ({ mode }) => ({ plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" })], mode });
`;
  // Annotazioni di tipo vere: è ciò che rende il file un .ts e non un .js con un'altra estensione.
  const CONFIG_TS = `
import { vitetranslate } from ${JSON.stringify(PLUGIN)};
const localeDir: string = "locale";
export default { plugins: [vitetranslate({ localeDir, sourceLanguage: "it-IT" })] };
`;

  const lancia = (radice) => {
    const esito = spawnSync(process.execPath, [CLI], { cwd: radice, encoding: "utf8" });
    return { ...esito, uscita: (esito.stdout ?? "") + (esito.stderr ?? "") };
  };
  const tradotta = (radice) => {
    const nome = languageFileName("it-IT");
    const file = join(radice, "locale", nome);
    return readdirSync(join(radice, "locale")).includes(nome) && readFileSync(file, "utf8").includes("Ciao dal comando");
  };

  for (const [nome, config] of [["vite.config.js", CONFIG_JS], ["vite.config.mjs", CONFIG_JS], ["vite.config.js (a funzione)", CONFIG_FUNZIONE]]) {
    const radice = progettoCompleto(nome.split(" ")[0], config);
    const { status } = lancia(radice);
    eq(`${nome}: il comando gira`, 0, status);
    eq(`${nome}: la tabella è stata scritta`, true, tradotta(radice));
  }

  // --add su una cartella locale che non esiste ancora: l'intestazione conta anche la sorgente,
  // che il sync scrive subito dopo (prima diceva "only source language" sopra due lingue).
  {
    const radice = progettoCompleto("vite.config.js", CONFIG_JS);
    const esito = spawnSync(process.execPath, [CLI, "--add", "en-US"], { cwd: radice, encoding: "utf8" });
    const uscita = ((esito.stdout ?? "") + (esito.stderr ?? "")).replace(/\x1b\[[0-9;]*m/g, "");
    eq("--add da zero: il comando gira", 0, esito.status);
    eq("--add da zero: intestazione con 2 lingue", true, /translations: "locale" \(2 languages\)/.test(uscita));
  }

  // TypeScript: i tipi li toglie Node stesso, dalla 23.6 senza flag. Su un Node più vecchio il
  // comando deve comunque spiegarsi, invece di lasciare passare un errore di sintassi grezzo.
  {
    const radice = progettoCompleto("vite.config.ts", CONFIG_TS);
    const { status, uscita } = lancia(radice);
    if (process.features.typescript) {
      eq("vite.config.ts: il comando gira", 0, status);
      eq("vite.config.ts: la tabella è stata scritta", true, tradotta(radice));
    } else {
      eq("vite.config.ts su Node senza type stripping: spiegato", true, uscita.includes("does not strip TypeScript types"));
    }
  }

  // Nessuna config: il messaggio deve dire dove ha guardato, non lasciare un ERR_MODULE_NOT_FOUND
  // su un file che l'utente non ha mai scritto.
  {
    const radice = progettoCompleto(null, "");
    const { status, uscita } = lancia(radice);
    eq("senza config: esce in errore", 1, status);
    eq("senza config: elenca i nomi cercati", true, uscita.includes("vite.config.ts") && uscita.includes("no Vite config found"));
  }

  // 4.5.0 — `llm` assente: l'output deve restare esattamente quello di prima. Nessuna delle
  // righe nuove (il suggerimento di syncReport.js, l'etichetta "llm") deve comparire per chi
  // aggiorna dalla 4.4 senza toccare vite.config.
  {
    const radice = progettoCompleto("vite.config.js", CONFIG_JS);
    const { status, uscita } = lancia(radice);
    eq("llm assente: il comando gira comunque", 0, status);
    eq("llm assente: nessuna menzione di \"llm\" nell'output", false, /\bllm\b/i.test(uscita));
  }

  // Config valida ma senza il plugin: l'errore deve nominare il file che ha effettivamente letto.
  {
    const radice = progettoCompleto("vite.config.mjs", "export default { plugins: [] };\n");
    const { status, uscita } = lancia(radice);
    eq("senza il plugin: esce in errore", 1, status);
    eq("senza il plugin: nomina il file letto", true, uscita.includes("vite.config.mjs"));
  }
}

console.log("\n== placeholderShape / convertPlaceholders (piano 4.6.4), i 5 casi verificati nel piano ==");
{
  const casi = [
    ["Ciao <b>%s</b>", "Ciao <b>{username}</b>", "Hi <b>%s</b>", "Hi <b>{username}</b>"],
    ["%s lingue · versione&nbsp;<b>%s</b>", "{1} lingue · versione&nbsp;<b>{version}</b>",
      "%s languages · version&nbsp;<b>%s</b>", "{1} languages · version&nbsp;<b>{version}</b>"],
    ["Ciao {0}, hai {1} file", "Ciao {name}, hai {1} file", "{1}件のファイル、{0}さん", "{1}件のファイル、{name}さん"],
    ["Hai {0} file", "Hai {count} file", "{0, plural, one {# file} other {# files}}", "{count, plural, one {# file} other {# files}}"],
    ["Ciao %s", "Ciao {name}", "Hi %s and %s", null],
  ];
  for (const [vecchioSorgente, nuovoSorgente, traduzione, atteso] of casi) {
    const { shape: shapeV, tokens: from } = placeholderShape(vecchioSorgente);
    const { shape: shapeN, tokens: to } = placeholderShape(nuovoSorgente);
    eq(`stessa forma: ${vecchioSorgente} <-> ${nuovoSorgente}`, shapeV, shapeN);
    eq(`conversione: ${JSON.stringify(traduzione)}`, atteso, convertPlaceholders(traduzione, { from, to }));
  }
}

console.log("\n== rename con conversione dei segnaposto: la traduzione segue la chiave (4.6.4) ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao %s" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao %s" });
  p.scrivi("en-US", p.testo("en-US").replace("App_a: null", 'App_a: "Hi %s"'));
  // Il sorgente e' passato alla macro: stesso testo a meno della FORMA del segnaposto — "%s"
  // diventato "{name}". Chiave diversa (un'altra conversione a monte l'avrebbe cambiata comunque).
  await p.sync({ App_b: "Ciao {name}" });

  const t = p.tabella("en-US");
  eq("la chiave nuova eredita la traduzione CONVERTITA", "Hi {name}", t.App_b);
  eq("la vecchia chiave non resta in giro", undefined, t.App_a);
  eq("e non risulta da tradurre", false, p.testo("en-US").includes(SEPARATORE));
}

console.log("\n== rename con conversione: conteggio sbagliato -> null, mai un valore inventato ==");
{
  const p = progetto();
  await p.sync({ App_a: "Ciao %s" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao %s" });
  // Due "%s" nella traduzione contro un solo segnaposto nel sorgente vecchio: la conversione
  // non è sicura, e una voce a null è meglio di una che mostra l'argomento sbagliato.
  p.scrivi("en-US", p.testo("en-US").replace("App_a: null", 'App_a: "Hi %s %s"'));
  await p.sync({ App_b: "Ciao {name}" });

  const t = p.tabella("en-US");
  eq("la conversione non sicura non si eredita: resta null", null, t.App_b);
  eq("e la chiave torna da tradurre", true, p.testo("en-US").includes(SEPARATORE));
}

// ============================================================= 4.7.1: safer synchronization
// Decisions D1 (incomplete scan), D5 (two-phase sync), D6 (conflict check) of doc/ImplementationPlans/4_7_1.md.
import backupLanguageFile from "../../lib/dev/vite/uty/backupLanguageFile.js";
import { existsSync } from "node:fs";

const HERE_SAFE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE_SAFE, "../..");

/** Runs `fn` with some `syncIo` functions replaced; always restores them. */
async function withIo(overrides, fn) {
  const saved = {};
  for (const name of Object.keys(overrides)) saved[name] = syncIo[name];
  Object.assign(syncIo, overrides);
  try {
    return await fn();
  } finally {
    Object.assign(syncIo, saved);
  }
}
const ioError = (code, message = code) => Object.assign(new Error(message), { code });

/** Every file under `dir` (recursive) -> content, so "nothing was touched" is one comparison. */
function photo(dir) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, name.name);
      if (name.isDirectory()) walk(full);
      else out[full] = readFileSync(full).toString("base64");
    }
  };
  walk(dir);
  return out;
}
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/** A complete little project: sources with markers, a node_modules (so scan/session records exist). */
function projectWithSources(sources) {
  const root = mkdtempSync(join(tmpdir(), "vt-safe-"));
  temporanee.push(root);
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "node_modules"));
  writeFileSync(join(root, "package.json"), '{ "type": "module" }');
  const api = {
    root,
    locale: join(root, "locale"),
    config: { baseDir: root, srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT" },
    setSources(files) {
      rmSync(join(root, "src"), { recursive: true, force: true });
      mkdirSync(join(root, "src"));
      for (const [name, code] of Object.entries(files)) writeFileSync(join(root, "src", name), code);
    },
    sync: async (extra = {}) => {
      let result;
      await zitto(async () => { result = await runSync({ config: api.config, ...extra }); });
      return result;
    },
    /** `sync` that returns the error instead of throwing it. */
    syncFails: async (extra = {}) => {
      let error = null;
      await zitto(async () => { try { await runSync({ config: api.config, ...extra }); } catch (e) { error = e; } });
      return error;
    },
    lang: (tag) => join(root, "locale", languageFileName(tag)),
    read: (tag) => readFileSync(api.lang(tag), "utf8"),
  };
  api.setSources(sources);
  return api;
}
const SRC_OK = { "App.jsx": 'export const a = "_%_Ciao_%_"; export const b = "_%_Mondo_%_";\n' };
// A marked file the parser cannot read: it is skipped by the scan.
const SRC_BROKEN = { ...SRC_OK, "Broken.jsx": 'export const c = "_%_Rotto_%_"; const = ;\n' };

console.log("\n== D1: a scan with skipped files stops the sync and touches no table ==");
{
  const p = projectWithSources(SRC_OK);
  await p.sync();
  writeFileSync(p.lang("en-US"), "");
  await p.sync();
  eq("healthy project: scan record written", true, existsSync(scanPath(p.root)));

  p.setSources(SRC_BROKEN);
  const locale = photo(p.locale);
  const session = readFileSync(sessionPath(p.root), "utf8");
  rmSync(markerIndexPath(p.root), { force: true });
  const error = await p.syncFails();

  eq("rejects VT_SCAN_INCOMPLETE", "VT_SCAN_INCOMPLETE", error?.code);
  eq("paths: one skipped file", 1, error?.paths?.length);
  eq("paths: names it with the reason", true, /Broken\.jsx: /.test(error?.paths?.[0] ?? ""));
  eq("message: how many files", true, error?.message.includes("1 file(s)"));
  eq("message: no table touched", true, error?.message.includes("No language table was touched"));
  eq("message: fix and run again", true, error?.message.includes("Fix the file(s) and run again"));
  eq("every locale byte unchanged", true, same(locale, photo(p.locale)));
  eq("the scan record is removed", false, existsSync(scanPath(p.root)));
  eq("the marker index is written anyway", true, existsSync(markerIndexPath(p.root)));
  eq("no success session recorded", session, readFileSync(sessionPath(p.root), "utf8"));

  // --status on the same fixture reads and reports: not a single write anywhere.
  writeFileSync(scanPath(p.root), "{}"); // pretend a record exists, --status must not remove it
  const all = photo(p.root);
  const status = await p.sync({ soloStato: true });
  eq("--status still answers", true, status.stato !== null);
  eq("--status: no file written, removed or created", true, same(all, photo(p.root)));

  // The same project, fixed: the sync works again.
  p.setSources(SRC_OK);
  const ok = await p.syncFails();
  eq("fixed: the sync runs", null, ok);
  eq("fixed: the scan record is back", true, existsSync(scanPath(p.root)));

  // The command line: exit code 1 and a readable message, once.
  p.setSources(SRC_BROKEN);
  writeFileSync(join(p.root, "vite.config.js"),
    `import { vitetranslate } from ${JSON.stringify(pathToFileURL(join(REPO, "lib/index.js")).href)};\n` +
    `export default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" })] };\n`);
  const before = photo(p.locale);
  const cli = spawnSync(process.execPath, [join(REPO, "lib/dev/vite/cli.js")], { cwd: p.root, encoding: "utf8" });
  const out = (cli.stdout ?? "") + (cli.stderr ?? "");
  eq("CLI: exit code 1", 1, cli.status);
  eq("CLI: says the scan is incomplete", true, out.includes("incomplete"));
  eq("CLI: the message is printed once", 1, out.split("No language table was touched").length - 1);
  eq("CLI: no table touched", true, same(before, photo(p.locale)));
}

console.log("\n== D5: a table is never written before every backup is done ==");
{
  const p = projectWithSources(SRC_OK);
  await p.sync();
  for (const tag of ["en-US", "fr-FR"]) writeFileSync(p.lang(tag), "");
  await p.sync();
  p.setSources({ "App.jsx": "export const nothing = 1;\n" }); // complete scan that finds nothing: mass erase

  // Order of the operations that matter.
  const log = [];
  const realWrite = syncIo.writeFileSync;
  const realRename = syncIo.renameSync;
  await withIo({
    writeFileSync: (...a) => { if (String(a[0]).includes(".bak-")) log.push("backup"); return realWrite(...a); },
    renameSync: (...a) => { log.push("table"); return realRename(...a); },
  }, () => p.sync());
  eq("three backups (every language file)", 3, log.filter((x) => x === "backup").length);
  eq("then the table writes", true, log.filter((x) => x === "table").length >= 1);
  eq("all backups come before the first table write", true, log.lastIndexOf("backup") < log.indexOf("table"));

  // A failing backup on the second file: nothing is overwritten, the first backup stays.
  const q = projectWithSources(SRC_OK);
  await q.sync();
  for (const tag of ["en-US", "fr-FR"]) writeFileSync(q.lang(tag), "");
  await q.sync();
  q.setSources({ "App.jsx": "export const nothing = 1;\n" });
  const locale = photo(q.locale);
  let n = 0;
  const error = await withIo({
    writeFileSync: (...a) => {
      if (String(a[0]).includes(".bak-") && ++n === 2) throw ioError("EIO", "disk exploded");
      return realWrite(...a);
    },
  }, () => q.syncFails());
  eq("rejects VT_BACKUP_FAILED", "VT_BACKUP_FAILED", error?.code);
  eq("message: nothing was overwritten", true, error?.message.includes("Nothing was overwritten"));
  eq("the cause is kept", "EIO", error?.cause?.code);
  const stillThere = readdirSync(q.locale).filter((f) => f.includes(".bak-"));
  eq("the first backup is kept", 1, stillThere.length);
  const withoutBackups = Object.fromEntries(Object.entries(photo(q.locale)).filter(([f]) => !f.includes(".bak-")));
  eq("no table changed", true, same(locale, withoutBackups));
  eq("no scan record left behind", false, existsSync(scanPath(q.root)));
}

console.log("\n== D5: an unreadable sub-language stops the sync before any write ==");
{
  const p = projectWithSources(SRC_OK);
  await p.sync();
  for (const tag of ["en-US", "fr-FR"]) writeFileSync(p.lang(tag), "");
  await p.sync();
  p.setSources({ "App.jsx": 'export const a = "_%_Ciao_%_"; export const n = "_%_Nuova_%_";\n' });
  const locale = photo(p.locale);
  const realRead = syncIo.readFileSync;
  const error = await withIo({
    readFileSync: (f, ...a) => { if (String(f).endsWith("fr-FR.yml")) throw ioError("EACCES"); return realRead(f, ...a); },
  }, () => p.syncFails());
  eq("rejects VT_LANGUAGE_UNREADABLE", "VT_LANGUAGE_UNREADABLE", error?.code);
  eq("lists the file with its reason", true, /fr-FR\.yml cannot be read \(EACCES\)/.test(error?.message ?? ""));
  eq("paths", true, error?.paths?.length === 1 && error.paths[0].endsWith("fr-FR.yml"));
  eq("every table unchanged (the source included)", true, same(locale, photo(p.locale)));
}

console.log("\n== D5: a write failing half way reports what was written and clears the scan record ==");
{
  const p = projectWithSources(SRC_OK);
  await p.sync();
  for (const tag of ["de-DE", "en-US", "fr-FR"]) writeFileSync(p.lang(tag), "");
  await p.sync();
  p.setSources({ "App.jsx": 'export const a = "_%_Ciao_%_"; export const n = "_%_Nuova_%_";\n' });
  const before = { it: p.read("it-IT"), de: p.read("de-DE"), en: p.read("en-US"), fr: p.read("fr-FR") };
  const session = readFileSync(sessionPath(p.root), "utf8");
  eq("a scan record exists before the failure", true, existsSync(scanPath(p.root)));

  const realRename = syncIo.renameSync;
  const error = await withIo({
    renameSync: (from, to) => { if (String(to).endsWith("en-US.yml")) throw ioError("EIO", "write failed"); return realRename(from, to); },
  }, () => p.syncFails());
  eq("rejects VT_WRITE_FAILED", "VT_WRITE_FAILED", error?.code);
  eq("written lists the first sub-language", "de-DE.yml", (error?.written ?? []).join(","));
  eq("the message names it", true, error?.message.includes("de-DE.yml") && error.message.includes("run the sync again"));
  eq("the failing file is named", true, error?.filePath?.endsWith("en-US.yml"));
  // "Mondo" was dropped from the code and "Nuova" added: the keys of every table change.
  const keysOf = (text) => [...text.matchAll(/^(App_\w+):/gm)].map((m) => m[1]).sort().join(",");
  eq("the first sub-language was replaced", true, keysOf(p.read("de-DE")) !== keysOf(before.de));
  eq("the failing one is untouched", before.en, p.read("en-US"));
  eq("the later one is untouched", before.fr, p.read("fr-FR"));
  eq("the source is untouched", before.it, p.read("it-IT"));
  eq("no temporary file left behind", 0, readdirSync(p.locale).filter((f) => f.includes(".vt-tmp-")).length);
  eq("the scan record is cleared", false, existsSync(scanPath(p.root)));
  eq("no success session recorded", session, readFileSync(sessionPath(p.root), "utf8"));

  // A rerun completes the job.
  const again = await p.syncFails();
  eq("rerun: succeeds", null, again);
  eq("rerun: the source has the new key", true, p.read("it-IT").includes("Nuova"));
  eq("rerun: every sub-language follows the source", true, ["de-DE", "en-US", "fr-FR"].every((t) => keysOf(p.read(t)) === keysOf(p.read("it-IT"))));
}

console.log("\n== backups: distinct names, raw bytes, a failure is an error ==");
{
  const dir = mkdtempSync(join(tmpdir(), "vt-bak-"));
  temporanee.push(dir);
  const file = join(dir, "en-US.yml");
  const raw = Buffer.from([0xff, 0xfe, 0x41, 0x00, 0xe0, 0x9f]); // not valid UTF-8
  const realNow = Date.now;
  Date.now = () => 1700000000000;
  let a, b;
  try {
    await zitto(async () => {
      a = backupLanguageFile(file, "en-US.yml", raw, { kind: "corrupted", reason: "test" });
      b = backupLanguageFile(file, "en-US.yml", raw, { kind: "corrupted", reason: "test" });
    });
  } finally {
    Date.now = realNow;
  }
  eq("two backups in the same millisecond: two files", true, a !== b && existsSync(a) && existsSync(b));
  eq("names keep the kind and the stamp", true, a.includes(".bak-corrupted-1700000000000-"));
  eq("raw bytes preserved (first)", true, raw.equals(readFileSync(a)));
  eq("raw bytes preserved (second)", true, raw.equals(readFileSync(b)));

  let type = null;
  try { backupLanguageFile(file, "en-US.yml", "not a Buffer", { kind: "corrupted", reason: "x" }); } catch (e) { type = e.name; }
  eq("a string instead of the snapshot bytes: TypeError", "TypeError", type);

  let failed = null;
  const realW = syncIo.writeFileSync;
  await zitto(async () => {
    await withIo({ writeFileSync: () => { throw ioError("ENOSPC", "no space"); } }, () => {
      try { backupLanguageFile(file, "en-US.yml", raw, { kind: "erased", reason: "x" }); } catch (e) { failed = e; }
    });
  });
  eq("a failed backup throws VT_BACKUP_FAILED", "VT_BACKUP_FAILED", failed?.code);
  eq("with the file and the cause", true, failed?.filePath === file && failed?.cause?.code === "ENOSPC");
  eq("syncIo is restored", true, realW === syncIo.writeFileSync);
}

console.log("\n== unreadable language links block sync, default discovery stays unchanged ==");
{
  const p = progetto();
  await p.sync({ App_a: "Hello" });
  const before = p.testo("it-IT");
  const target = join(p.localeDir, "target.data");
  const link = join(p.localeDir, "fr-FR.yml");
  let linked = true;
  try { symlinkSync(target, link); } catch (e) {
    if (e.code !== "EPERM") throw e;
    linked = false;
    console.log("  skip  symlink creation is not permitted here");
  }
  if (linked) {
    eq("default listing excludes the dangling link", false, listLanguageFiles(p.localeDir).includes("fr-FR.yml"));
    eq("sync listing retains it", true, listLanguageFiles(p.localeDir, { includeUnreadableLinks: true }).includes("fr-FR.yml"));
    let error;
    try { await p.sync({ App_a: "Changed", App_b: "New" }); } catch (e) { error = e; }
    eq("dangling sub-language blocks the sync", "VT_LANGUAGE_UNREADABLE", error?.code);
    eq("error names the link", true, error?.paths.includes(link));
    eq("source bytes unchanged", before, p.testo("it-IT"));
    eq("link is preserved", true, lstatSync(link).isSymbolicLink());

    writeFileSync(target, 'App_a: "Bonjour"\n');
    const realStat = fs.statSync;
    try {
      fs.statSync = (file, ...args) => {
        if (String(file) === link) throw Object.assign(new Error("access denied"), { code: "EACCES" });
        return realStat(file, ...args);
      };
      eq("default listing excludes inaccessible link", false, listLanguageFiles(p.localeDir).includes("fr-FR.yml"));
      eq("sync listing retains inaccessible link", true, listLanguageFiles(p.localeDir, { includeUnreadableLinks: true }).includes("fr-FR.yml"));
    } finally { fs.statSync = realStat; }

    mkdirSync(join(p.localeDir, "de-DE.yml"));
    eq("strict listing still excludes directories", false, listLanguageFiles(p.localeDir, { includeUnreadableLinks: true }).includes("de-DE.yml"));
    await p.sync({ App_a: "Hello", App_b: "New" });
    eq("valid link remains a link after sync", true, lstatSync(link).isSymbolicLink());
    eq("valid link receives new keys", true, readFileSync(target, "utf8").includes("App_b: null"));
    eq("valid link keeps its translation", true, readFileSync(target, "utf8").includes('App_a: "Bonjour"'));
  }
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
