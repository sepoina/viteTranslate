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
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import updateLanguage from "../../lib/dev/vite/updateLanguage.js";
import guardMassErase from "../../lib/dev/vite/uty/guardMassErase.js";
import readLanguageFile from "../../lib/dev/vite/uty/readLanguageFile.js";
import { languageFileName } from "../../lib/dev/vite/uty/languageFileFormat.js";

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
      sourceTable: { __builder__: { v: 1, languageName: "italiano", incomplete: false }, ...tabella },
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
    tabella: (tag) => readLanguageFile(percorso(tag)),
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
  eq("chiavi scritte", "App_a,App_b", Object.keys(t).filter((k) => k !== "__builder__").sort().join(","));
  eq("valori scritti", "Ciao,Mondo", [t.App_a, t.App_b].join(","));
  eq("builder presente", 1, t.__builder__.v);
  eq("niente da tradurre", false, p.testo("it-IT").includes(SEPARATORE));
  eq("intestazione: 0 mancanti", true, /missing key: 0/.test(p.testo("it-IT")));
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
  eq("solo il builder è 'tradotto'", "__builder__", tradotte.join(","));
  eq("tutto il resto è da tradurre", "App_a,App_b", daTradurre.join(","));
  const t = p.tabella("en-US");
  eq("le chiavi nuove valgono null", "null,null", [JSON.stringify(t.App_a), JSON.stringify(t.App_b)].join(","));
  eq("incomplete: true", true, t.__builder__.incomplete);
  eq("il nome della lingua è il suo, non quello della sorgente", "American English", t.__builder__.languageName);

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
  eq("incomplete torna false", false, t.__builder__.incomplete);
  eq("la sorgente non elenca più nulla", false, p.testo("it-IT").includes(SEPARATORE));
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

  eq("sparisce dalla sorgente", "App_a", Object.keys(p.tabella("it-IT")).filter((k) => k !== "__builder__").join(","));
  eq("sparisce anche dalle sub-lingue", "App_a", Object.keys(p.tabella("en-US")).filter((k) => k !== "__builder__").join(","));
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
  eq("il file torna valido", "App_a", Object.keys(p.tabella("en-US")).filter((k) => k !== "__builder__").join(","));
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
  // La lingua SORGENTE che non si apre. Prima veniva rigenerata dalla sola scansione del
  // codice — cioe' sostituita da una tabella inventata — dopo un backup vuoto che diceva di
  // essere una copia. Le sub-lingue si sincronizzano comunque: il loro riferimento e' la
  // scansione, non questo file.
  const p = progetto();
  await p.sync({ App_a: "Ciao" });
  p.scrivi("en-US", "");
  await p.sync({ App_a: "Ciao" });
  rmSync(p.percorso("it-IT"));
  mkdirSync(p.percorso("it-IT"));
  const { detto, esito } = await p.sync({ App_a: "Ciao", App_b: "Nuova" });

  eq("lo dice", true, detto.includes("cannot be read"));
  eq("e non finge di averla riscritta", false, esito.written);
  eq("nessun backup vuoto lasciato in giro", 0, backup(p, "corrupted").length);
  eq("la sub-lingua riceve comunque la chiave nuova", true, "App_b" in p.tabella("en-US"));
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
    const esito = await zitto(async () => {
      const r = await guardMassErase(p.servizio({ A_1: "uno", A_2: "due", A_3: "tre" }), 0);
      eq("una chiave su quattro: nessun allarme", null, r);
    });
    eq("nessun backup per una pulizia normale", 0, backup(p, "erased").length);
    eq("e nessun avviso", false, esito.includes("WARNING"));
  }
  {
    const p = await nuovo();
    let r;
    const esito = await zitto(async () => { r = await guardMassErase(p.servizio({}), 0); });
    eq("scansione a vuoto: allarme", 4, r.erased.length);
    eq("motivo riconoscibile", true, esito.includes("found no marked string at all"));
    eq("backup di OGNI file lingua", 2, backup(p, "erased").length);
    const salvato = backup(p, "erased").find((f) => f.startsWith("en-US"));
    eq("il backup contiene le traduzioni", true, salvato !== undefined && readFileSync(join(p.localeDir, salvato), "utf8").includes("A_1"));
  }
  {
    const p = await nuovo();
    let r;
    await zitto(async () => { r = await guardMassErase(p.servizio({ A_1: "uno", A_2: "due" }), 0); });
    eq("metà tabella in un colpo: allarme", 2, r.erased.length);
    eq("backup di ogni file", 2, backup(p, "erased").length);
  }
  {
    // Un file saltato dalla scansione è un avviso, non un errore: il comando prosegue e le sue
    // chiavi risultano "non più presenti nel codice". È esattamente il caso in cui una sola
    // chiave persa vale un allarme, perché la perdita non dipende da ciò che si è scritto.
    const p = await nuovo();
    let r;
    const esito = await zitto(async () => { r = await guardMassErase(p.servizio({ A_1: "uno", A_2: "due", A_3: "tre" }), 1); });
    eq("un file saltato: allarme anche per una chiave sola", 1, r.erased.length);
    eq("motivo riconoscibile", true, esito.includes("skipped by the scan"));
    eq("backup di ogni file", 2, backup(p, "erased").length);
  }
  {
    const p = progetto();
    const r = await zitto(() => guardMassErase(p.servizio({}), 0));
    eq("progetto nuovo: niente da salvare, niente allarme", "", r.trim());
    eq("nessun file creato dalla guardia", 0, p.file().length);
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
export default { plugins: [vitetranslate({ localeDir: "src/locale", sourceLanguage: "it-IT" })] };
`;
  // La forma a funzione di { command, mode }: comunissima appena la config guarda l'ambiente.
  const CONFIG_FUNZIONE = `
import { vitetranslate } from ${JSON.stringify(PLUGIN)};
export default ({ mode }) => ({ plugins: [vitetranslate({ localeDir: "src/locale", sourceLanguage: "it-IT" })], mode });
`;
  // Annotazioni di tipo vere: è ciò che rende il file un .ts e non un .js con un'altra estensione.
  const CONFIG_TS = `
import { vitetranslate } from ${JSON.stringify(PLUGIN)};
const localeDir: string = "src/locale";
export default { plugins: [vitetranslate({ localeDir, sourceLanguage: "it-IT" })] };
`;

  const lancia = (radice) => {
    const esito = spawnSync(process.execPath, [CLI], { cwd: radice, encoding: "utf8" });
    return { ...esito, uscita: (esito.stdout ?? "") + (esito.stderr ?? "") };
  };
  const tradotta = (radice) => {
    const nome = languageFileName("it-IT");
    const file = join(radice, "src/locale", nome);
    return readdirSync(join(radice, "src/locale")).includes(nome) && readFileSync(file, "utf8").includes("Ciao dal comando");
  };

  for (const [nome, config] of [["vite.config.js", CONFIG_JS], ["vite.config.mjs", CONFIG_JS], ["vite.config.js (a funzione)", CONFIG_FUNZIONE]]) {
    const radice = progettoCompleto(nome.split(" ")[0], config);
    const { status } = lancia(radice);
    eq(`${nome}: il comando gira`, 0, status);
    eq(`${nome}: la tabella è stata scritta`, true, tradotta(radice));
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

  // Config valida ma senza il plugin: l'errore deve nominare il file che ha effettivamente letto.
  {
    const radice = progettoCompleto("vite.config.mjs", "export default { plugins: [] };\n");
    const { status, uscita } = lancia(radice);
    eq("senza il plugin: esce in errore", 1, status);
    eq("senza il plugin: nomina il file letto", true, uscita.includes("vite.config.mjs"));
  }
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
