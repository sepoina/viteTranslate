// <Translate> e ts(): cosa arriva davvero a schermo.
//
// Gli altri test coprono la tabella compilata (compileTable) e la sua risoluzione
// (ssr-check, markerCache); qui si parte da dove parte chi usa la libreria — le prop del
// componente — e si guarda l'HTML che ne esce. È il tratto in cui vivono le guardie contro
// l'uso scorretto, che non hanno altro modo di essere verificate: sbagliarle non fa fallire
// niente, mostra la stringa sbagliata.
//
// Nota su DEV/PROD: `import.meta.env` non esiste fuori dal bundler, quindi qui si esercita il
// ramo di PRODUZIONE — quello che degrada invece di lanciare, cioè quello che l'utente finale
// vede. I rami `import.meta.env.DEV` (errore in console per il testo non marcato, fallback
// interpretato come markup) restano fuori portata di un test in Node puro.
//
// react e react-dom sono peerDependencies opzionali: se mancano, test/run.mjs salta il file.
//
//   node test/list/translateComponent.test.mjs
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { compileLanguageModule } from "../../lib/dev/compile/compileTable.js";
import { TranslateContext } from "../../lib/react/TranslateContext.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(54), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// --------------------------------------------------------------- il mondo attorno ai moduli
// I moduli sotto test importano "virtual:vitetranslate/languages", che esiste solo dentro il
// bundler: si riscrive quell'import verso un manifest vero, scritto accanto all'originale così
// gli altri import relativi (React, il context, gli helper) continuano a risolversi.
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const temporanei = [];
// I file di appoggio vivono dentro lib/react per risolvere gli import relativi dei moduli sotto
// test: vanno tolti anche se il test muore a metà, altrimenti restano nel sorgente del pacchetto.
process.on("exit", () => {
  for (const percorso of temporanei) {
    try { unlinkSync(percorso); } catch { /* già rimosso */ }
  }
});

function scriviTemporaneo(nome, contenuto) {
  const percorso = join(ROOT, "lib/react", nome);
  writeFileSync(percorso, contenuto, "utf8");
  temporanei.push(percorso);
  return percorso;
}

// Un id nuovo a ogni caricamento: lo stesso modulo va caricato più volte contro manifest
// diversi (uno senza diagnostica, uno con i prefissi accesi), e Node tiene in cache i moduli
// per URL — riusare il nome del manifest servirebbe il primo anche alla seconda lettura.
let caricamenti = 0;

/** Carica un modulo di lib/react con l'import virtuale rimpiazzato dal manifest dato. */
async function caricaConManifest(file, manifest) {
  const id = `${stamp}-${caricamenti++}`;
  const nomeManifest = `__manifest-${id}.mjs`;
  scriviTemporaneo(nomeManifest, manifest);
  const nomeModulo = `__${file.replace(/\.jsx?$/, "")}-${id}.mjs`;
  const percorso = scriviTemporaneo(
    nomeModulo,
    readFileSync(join(ROOT, "lib/react", file), "utf8")
      .replaceAll(/["']virtual:vitetranslate\/languages["']/g, JSON.stringify(`./${nomeManifest}`)),
  );
  // pathToFileURL e non il percorso grezzo: su Windows un path assoluto comincia con "d:", che
  // l'ESM loader di Node legge come schema di URL e rifiuta (ERR_UNSUPPORTED_ESM_URL_SCHEME).
  return import(`${pathToFileURL(percorso).href}?t=${id}`);
}

// La tabella è quella vera, compilata dal sorgente come farebbe la build: stringhe, elementi
// già costruiti e funzioni, ognuna con la sua forma.
const sorgenti = {
  App_saluto: "Ciao mondo",
  App_conArg: "Ciao %s, come stai?",
  App_markup: "testo in <b>grassetto</b>",
  App_markupArg: "Ciao <b>%s</b>, hai %s messaggi",
};
const tabellaPath = join(ROOT, "lib/react", `__tabella-${stamp}.mjs`);
writeFileSync(tabellaPath, compileLanguageModule(sorgenti, "test"), "utf8");
temporanei.push(tabellaPath);
const tabella = (await import(`${pathToFileURL(tabellaPath).href}?t=${stamp}`)).default;

// Nel manifest, `fallbackTable` è la tabella eager: è la sola che <Translate> vede quando non
// c'è un container sopra, ed è il fallback universale quando c'è.
const manifest = `
import tabella from "./__tabella-${stamp}.mjs";
export const languages = { "it-IT": { name: "italiano", preloaded: true, table: tabella, load: () => Promise.resolve({ default: tabella }) } };
export const sourceLanguage = "it-IT";
export const fallbackTable = tabella;
`;

const { default: Translate } = await caricaConManifest("Translate.js", manifest);
const { useTranslateToString } = await caricaConManifest("useTranslateToString.js", manifest);

// --------------------------------------------------------------------------- utilità
const errori = [];
const originale = console.error;
console.error = (...pezzi) => errori.push(pezzi.map(String).join(" "));

/** Rende <Translate> con le prop date, dentro (o fuori) un provider di lingua. */
const rendi = (props, lang) => {
  const albero = h(Translate, props);
  return renderToStaticMarkup(lang === undefined ? albero : h(TranslateContext.Provider, { value: lang }, albero));
};

/** Rende una chiamata a ts() dentro un componente, restituendo la stringa prodotta. */
function ts(t, a, lang, options) {
  let risultato;
  function Sonda() {
    risultato = useTranslateToString()(t, a, options);
    return null;
  }
  renderToStaticMarkup(lang === undefined ? h(Sonda) : h(TranslateContext.Provider, { value: lang }, h(Sonda)));
  return risultato;
}

const linguaAttiva = { id: "it-IT", table: tabella, debug: false, proposeNewLanguage: () => {} };
const marcatore = (chiave, fallback) => (fallback === undefined ? `_<_${chiave}_>_` : `_<_${chiave}_/_${fallback}_>_`);

// ------------------------------------------------------------------------ casi normali
console.log("\n== una voce di tabella, nelle sue quattro forme ==");
{
  eq("stringa", "Ciao mondo", rendi({ t: marcatore("App_saluto") }, linguaAttiva));
  eq("stringa + argomento", "Ciao Mario, come stai?", rendi({ t: marcatore("App_conArg"), a: "Mario" }, linguaAttiva));
  eq("markup", "testo in <b>grassetto</b>", rendi({ t: marcatore("App_markup") }, linguaAttiva));
  eq("markup + argomenti", "Ciao <b>Mario</b>, hai 3 messaggi", rendi({ t: marcatore("App_markupArg"), a: ["Mario", 3] }, linguaAttiva));

  eq("forma ad array t={[testo, ...argomenti]}", "Ciao Mario, come stai?", rendi({ t: [marcatore("App_conArg"), "Mario"] }, linguaAttiva));
  eq("children al posto di t", "Ciao mondo", rendi({ children: marcatore("App_saluto") }, linguaAttiva));

  // Senza container sopra non c'è context: resta la tabella eager, che è importata staticamente
  // proprio perché il testo si veda comunque.
  eq("senza provider si usa la tabella eager", "Ciao mondo", rendi({ t: marcatore("App_saluto") }));
}

console.log("\n== argomenti: quello che manca e quello che non è testo ==");
{
  eq("argomento mancante", "Ciao ⁇, come stai?", rendi({ t: marcatore("App_conArg") }, linguaAttiva));
  eq("argomento null", "Ciao ⁇, come stai?", rendi({ t: marcatore("App_conArg"), a: null }, linguaAttiva));
  eq("argomento 0 (valore legittimo)", "Ciao 0, come stai?", rendi({ t: marcatore("App_conArg"), a: 0 }, linguaAttiva));
  eq("stringa vuota (valore legittimo)", "Ciao , come stai?", rendi({ t: marcatore("App_conArg"), a: "" }, linguaAttiva));
  eq("argomenti in meno del previsto", "Ciao <b>Mario</b>, hai ⁇ messaggi", rendi({ t: marcatore("App_markupArg"), a: ["Mario"] }, linguaAttiva));
  // Un elemento React come argomento: nella tabella compilata i segnaposto sono figli JSX,
  // quindi l'elemento viene reso, non stampato come "[object Object]".
  eq("elemento React come argomento", "Ciao <b><i>Mario</i></b>, hai 3 messaggi",
    rendi({ t: marcatore("App_markupArg"), a: [h("i", null, "Mario"), 3] }, linguaAttiva));
  // Stessa cosa in una voce senza markup, dove il testo si ricompone con _cat: la scelta fra
  // stringa e frammento si fa a runtime, altrimenti l'elemento diventerebbe "[object Object]"
  // in una lingua e no in un'altra, a seconda di come è scritta la traduzione.
  eq("elemento React in una voce di solo testo", "Ciao <i>Mario</i>, come stai?",
    rendi({ t: marcatore("App_conArg"), a: h("i", null, "Mario") }, linguaAttiva));
}

console.log("\n== chiavi che nella tabella non ci sono ==");
{
  // Condizione normale in sviluppo: la stringa è appena stata scritta, il marcatore esiste già
  // ma la sync non è ancora passata. Il testo di riserva viaggia dentro il marcatore.
  eq("fallback incorporato nel marcatore", "testo nuovo", rendi({ t: marcatore("App_maiVisto", "testo nuovo") }, linguaAttiva));
  eq("fallback con argomento", "nuovo Mario", rendi({ t: marcatore("App_maiVisto2", "nuovo %s"), a: "Mario" }, linguaAttiva));
  // In build il fallback non c'è (la sync gira prima): ultima risorsa, la chiave grezza.
  eq("senza fallback resta la chiave", "App_maiVisto3", rendi({ t: marcatore("App_maiVisto3") }, linguaAttiva));
}

console.log("\n== testo mai passato dal compilatore ==");
{
  // File sfuggito al transform, marcatore dentro node_modules, stringa costruita a runtime:
  // in produzione si mostra il testo, senza i delimitatori interni.
  eq("marcatore sorgente: delimitatori tolti", "Benvenuto", rendi({ t: "_%_Benvenuto_%_" }, linguaAttiva));
  eq("marcatore sorgente con argomento", "Ciao Mario", rendi({ t: "_%_Ciao %s_%_", a: "Mario" }, linguaAttiva));
  eq("stringa qualunque passa così com'è", "testo libero", rendi({ t: "testo libero" }, linguaAttiva));
  // Il markup NON viene interpretato qui: non c'è una voce di tabella compilata da cui partire.
  eq("il markup resta letterale", "a &lt;b&gt;b&lt;/b&gt;", rendi({ t: "_%_a <b>b</b>_%_" }, linguaAttiva));
}

// ------------------------------------------------------- dato di dominio nella posizione del testo
console.log("\n== numeri: valore, non uso scorretto ==");
{
  // Un conteggio, un interno, un codice: dal sorgente non passano e marcati non possono
  // essere. Resa diretta, senza passare dal salvataggio (che li mostrerebbe con `‼️`).
  const conta = errori.length;
  eq("t numero", "42", rendi({ t: 42 }, linguaAttiva));
  eq("t numero dentro la tupla", "42", rendi({ t: [42] }, linguaAttiva));
  eq("t bigint", "9007199254740993", rendi({ t: 9007199254740993n }, linguaAttiva));
  eq("o numero", "42", rendi({ o: 42 }, linguaAttiva));
  eq("children numero", "42", rendi({ children: 42 }, linguaAttiva));
  // Regressione: `0` è falsy come la sentinella `false` delle prop, e con `if (!source)` un
  // conteggio a zero spariva dallo schermo senza che niente lo segnalasse.
  eq("t={0} non è vuoto", "0", rendi({ t: 0 }, linguaAttiva));
  eq("o={0} non è vuoto", "0", rendi({ o: 0 }, linguaAttiva));
  eq("t={0n} non è vuoto", "0", rendi({ t: 0n }, linguaAttiva));
  // Le sentinelle vere e la stringa vuota restano vuote.
  eq("t={false} resta vuoto", "", rendi({ t: false }, linguaAttiva));
  eq("t={null} resta vuoto", "", rendi({ t: null }, linguaAttiva));
  eq("t={undefined} resta vuoto", "", rendi({ t: undefined }, linguaAttiva));
  eq("nessun numero ha lasciato un errore in console", conta, errori.length);
  eq("ts() numero", "42", ts(42, undefined, linguaAttiva));
  eq("ts(0) non è vuoto", "0", ts(0, undefined, linguaAttiva));
  eq("ts() numero non ha lasciato errori", conta, errori.length);
}

console.log("\n== un elemento React nella posizione del testo ==");
{
  // Una prop che di norma porta testo marcato ma per lo stato "sto caricando" porta uno
  // spinner: il componente foglia è uno solo e non sa quale delle due gli arriverà. Prima
  // l'elemento cadeva nel controllo dell'oggetto senza `t` e il contenuto spariva.
  const conta = errori.length;
  eq("t elemento", "<i>attendere</i>", rendi({ t: h("i", null, "attendere") }, linguaAttiva));
  eq("o elemento", "<i>attendere</i>", rendi({ o: h("i", null, "attendere") }, linguaAttiva));
  eq("children elemento", "<i>attendere</i>", rendi({ children: h("i", null, "attendere") }, linguaAttiva));
  eq("un elemento non lascia errori in console", conta, errori.length);
  // Nella tupla il primo posto è il testo: un elemento lì è davvero un errore, e resta al ramo
  // di salvataggio — che di testo non ne trova. Con `mark.badData` spento (questo manifest
  // non lo chiede) non si rende niente; il nome del tipo si verifica nel blocco errorSolve.
  eq("nella tupla resta un errore", "", rendi({ t: [h("i", null, "attendere")] }, linguaAttiva));
  eq("la tupla con elemento si segnala", true, errori.length > conta);
  // ts() deve restituire una stringa: un elemento non si riduce, e l'errore resta.
  const prima = errori.length;
  eq("ts() elemento rende vuoto", "", ts(h("i", null, "attendere"), undefined, linguaAttiva));
  eq("ts() lo segnala con un messaggio suo", true, errori.some((m) => m.includes("React element cannot be reduced")));
  eq("ts() elemento ha segnalato", true, errori.length > prima);
}

console.log("\n== skipMark: qui il non marcato non è un errore ==");
{
  // Senza prefissi accesi la resa è la stessa; quello che cambia è la console. I prefissi
  // veri e propri si verificano più sotto, nel blocco errorSolve.
  const conta = errori.length;
  eq("stringa non marcata", "testo libero", rendi({ t: "testo libero", skipMark: true }, linguaAttiva));
  eq("marcatore sorgente mai compilato", "Benvenuto", rendi({ t: "_%_Benvenuto_%_", skipMark: true }, linguaAttiva));
  eq("i %s vengono comunque interpolati", "Ciao Mario", rendi({ t: "_%_Ciao %s_%_", a: "Mario", skipMark: true }, linguaAttiva));
  eq("skipMark non lascia errori in console", conta, errori.length);
  // Non vuol dire "non tradurre": su un testo marcato la prop non ha alcun effetto.
  eq("un testo marcato si traduce lo stesso", "Ciao mondo", rendi({ t: marcatore("App_saluto"), skipMark: true }, linguaAttiva));
  eq("con argomenti", "Ciao Mario, come stai?", rendi({ t: [marcatore("App_conArg"), "Mario"], skipMark: true }, linguaAttiva));
  eq("ts() con skipMark", "testo libero", ts("testo libero", undefined, linguaAttiva, { skipMark: true }));
  eq("ts() skipMark non spegne la traduzione", "Ciao mondo", ts(marcatore("App_saluto"), undefined, linguaAttiva, { skipMark: true }));
  eq("ts() skipMark non lascia errori", conta, errori.length);
}

// ---------------------------------------------------------------------- forma a oggetto
console.log("\n== forma a oggetto { t, a } ==");
{
  // È la forma in cui certi core applicativi trasportano testo e argomenti insieme. Prima
  // dava "t cannot be an object" e ogni chiamante doveva convertirla a mano.
  eq("o={{ t, a }} con lista", "Ciao Mario, come stai?", rendi({ o: { t: marcatore("App_conArg"), a: ["Mario"] } }, linguaAttiva));
  eq("o={{ t, a }} con scalare", "Ciao Mario, come stai?", rendi({ o: { t: marcatore("App_conArg"), a: "Mario" } }, linguaAttiva));
  eq("o={{ t }} senza argomenti", "Ciao mondo", rendi({ o: { t: marcatore("App_saluto") } }, linguaAttiva));
  eq("o={{ t, a: null }}", "Ciao mondo", rendi({ o: { t: marcatore("App_saluto"), a: null } }, linguaAttiva));
  // Lo stesso oggetto passato a `t`: riconosciuto uguale, così chi ce l'ha già in mano non
  // deve sapere quale delle due prop usare.
  eq("t={{ t, a }}", "Ciao Mario, come stai?", rendi({ t: { t: marcatore("App_conArg"), a: ["Mario"] } }, linguaAttiva));
  eq("o con markup e argomenti", "Ciao <b>Mario</b>, hai 3 messaggi", rendi({ o: { t: marcatore("App_markupArg"), a: ["Mario", 3] } }, linguaAttiva));
  eq("ts() accetta la forma a oggetto", "Ciao Mario, come stai?", ts({ t: marcatore("App_conArg"), a: ["Mario"] }, undefined, linguaAttiva));
  eq("ts() accetta la forma a tupla", "Ciao Mario, come stai?", ts([marcatore("App_conArg"), "Mario"], undefined, linguaAttiva));
}

// ------------------------------------------------------------------------- usi scorretti
console.log("\n== usi scorretti: si salva il testo, non si esplode ==");
{
  // Il testo dell'utente non sparisce più dietro "[...]": era lì e si poteva mostrare, e a
  // pagare la combinazione sbagliata di prop era chi legge lo schermo. Con i prefissi accesi
  // (vedi più sotto) si porta dietro un `‼️`; qui il manifest non li chiede, quindi esce nudo.
  const conta = errori.length;
  eq("t e children insieme: vince t", "Ciao mondo", rendi({ t: marcatore("App_saluto"), children: marcatore("App_markup") }, linguaAttiva));
  // Regressione: il controllo è sulla sentinella `false`, non sulla verità del valore. Con
  // `t=""` i children sparivano in silenzio — e non devono sparire nemmeno nel salvataggio,
  // dove la stringa vuota non conta come testo.
  eq('t="" e children insieme: vincono i children', "Ciao mondo", rendi({ t: "", children: marcatore("App_saluto") }, linguaAttiva));
  eq("forma ad array insieme ad a: vincono gli argomenti dell'array", "Ciao Mario, come stai?", rendi({ t: [marcatore("App_conArg"), "Mario"], a: "Luigi" }, linguaAttiva));
  eq("o insieme a t: vince o", "Ciao mondo", rendi({ o: marcatore("App_saluto"), t: marcatore("App_markup") }, linguaAttiva));
  // Un oggetto senza campo `t` non è la forma `{ t, a }` e non contiene testo: è una
  // variante di `null`, e rende vuoto come lui, senza prefisso. Vuoto a schermo, ma non in
  // silenzio: l'uso scorretto si segnala una volta in console.
  const prima2 = errori.length;
  eq("t oggetto senza testo dentro", "", rendi({ t: { chiave: "valore" } }, linguaAttiva));
  eq("l'oggetto senza t si segnala in console", true, errori.length > prima2);
  // Con `mark.badData` spento — questo manifest non porta errorSolve, come una build di
  // produzione con i default — un valore che testo non è rende vuoto: la diagnostica non deve
  // arrivare all'utente finale. Il nome del tipo si verifica nel blocco errorSolve.
  const prima3 = errori.length;
  eq("t funzione", "", rendi({ t: () => {} }, linguaAttiva));
  eq("la funzione si segnala comunque in console", true, errori.length > prima3);
  // Un valore ciclico non deve far esplodere il messaggio diagnostico: warning sì, crash no.
  // Prima il JSON.stringify del messaggio lanciava "Converting circular structure to JSON".
  const ciclico = {};
  ciclico.se = ciclico;
  eq("t oggetto ciclico", "", rendi({ t: ciclico }, linguaAttiva));
  eq("ogni caso ha lasciato un errore in console", true, errori.length > conta);

  eq("nessuna prop -> stringa vuota, senza errori", "", rendi({}, linguaAttiva));
  eq("t vuoto -> stringa vuota", "", rendi({ t: "" }, linguaAttiva));

  // Lo stesso errore ripetuto non deve seppellire la console: una volta per messaggio.
  const prima = errori.length;
  for (let i = 0; i < 5; i++) rendi({ t: marcatore("App_saluto"), children: marcatore("App_markup") }, linguaAttiva);
  eq("un errore già visto non si ripete", prima, errori.length);
}

// ------------------------------------------------------------------------------- ts()
console.log("\n== ts(): stringhe per le prop del DOM ==");
{
  eq("voce semplice", "Ciao mondo", ts(marcatore("App_saluto"), undefined, linguaAttiva));
  eq("voce con argomento", "Ciao Mario, come stai?", ts(marcatore("App_conArg"), "Mario", linguaAttiva));
  eq("argomento mancante", "Ciao ⁇, come stai?", ts(marcatore("App_conArg"), undefined, linguaAttiva));
  // Il markup in un aria-label non ha senso: la voce si risolve in un elemento e qui se ne
  // estrae il testo. È una degradazione dichiarata, non un uso previsto.
  eq("una voce con markup viene appiattita", "testo in grassetto", ts(marcatore("App_markup"), undefined, linguaAttiva));
  eq("markup + argomenti appiattito", "Ciao Mario, hai 3 messaggi", ts(marcatore("App_markupArg"), ["Mario", 3], linguaAttiva));
  eq("chiave assente col fallback", "testo nuovo", ts(marcatore("App_maiVisto", "testo nuovo"), undefined, linguaAttiva));
  eq("marcatore sorgente non compilato", "Benvenuto", ts("_%_Benvenuto_%_", undefined, linguaAttiva));
  eq("stringa qualunque", "testo libero", ts("testo libero", undefined, linguaAttiva));
  eq("niente da tradurre", "", ts(undefined, undefined, linguaAttiva));
  eq("ts() oggetto senza testo", "", ts({ chiave: "valore" }, undefined, linguaAttiva));
  const ciclico = {};
  ciclico.se = ciclico;
  eq("ts() oggetto ciclico", "", ts(ciclico, undefined, linguaAttiva));
  eq("senza provider si usa la tabella eager", "Ciao mondo", ts(marcatore("App_saluto")));
  eq("il risultato è sempre una stringa", "string", typeof ts(marcatore("App_markup"), undefined, linguaAttiva));
}

// ------------------------------------------------------------------ prefissi diagnostici
console.log("\n== errorSolve: i prefissi a schermo ==");
{
  // Una lingua tradotta a metà: due voci tradotte, due ancora a null. Compilata con la tabella
  // italiana come sorgente, quindi le due a null portano già dentro il testo italiano — ed è
  // esattamente per questo che serve `__untranslated__`: dopo la compilazione le quattro voci
  // si assomigliano tutte, e senza quell'elenco non ci sarebbe più niente da guardare.
  const tradotteEn = {
    App_saluto: "Hello world",
    App_conArg: null,
    App_markup: "text in <b>bold</b>",
    App_markupArg: null,
  };
  const percorsoEn = join(ROOT, "lib/react", `__tabella-en-${stamp}.mjs`);
  writeFileSync(percorsoEn, compileLanguageModule(tradotteEn, "en-US", sorgenti, { emitUntranslated: true, missingArg: "«?»" }), "utf8");
  temporanei.push(percorsoEn);
  const tabellaEn = (await import(`${pathToFileURL(percorsoEn).href}?t=${stamp}`)).default;

  eq("__untranslated__ elenca le voci a null", '{"App_conArg":1,"App_markupArg":1}', JSON.stringify(tabellaEn.__untranslated__));

  // `App_markup` è tradotto QUI ma manca in qualche altra lingua: è l'informazione globale che
  // il plugin calcola leggendo tutte le tabelle e spedisce nel modulo virtuale.
  // `warn: false` per verificare l'interruttore: nessuno di questi casi deve stampare niente.
  const manifestDiag = `
import tabella from "./__tabella-en-${stamp}.mjs";
export const languages = { "en-US": { name: "English", preloaded: true, table: tabella, load: () => Promise.resolve({ default: tabella }) } };
export const sourceLanguage = "it-IT";
export const fallbackTable = tabella;
export const errorSolve = { malformed: "‼️", untranslated: "🔸", notFullyTranslated: "🔹", badData: "🚫", absentDataInArray: "«?»", warn: false };
export const partiallyTranslated = { "App_markup": 1 };
`;
  const { default: TranslateDiag } = await caricaConManifest("Translate.js", manifestDiag);
  const { useTranslateToString: usaTsDiag } = await caricaConManifest("useTranslateToString.js", manifestDiag);

  const linguaEn = { id: "en-US", table: tabellaEn, debug: false, proposeNewLanguage: () => {} };
  const rendiDiag = (props) =>
    renderToStaticMarkup(h(TranslateContext.Provider, { value: linguaEn }, h(TranslateDiag, props)));
  const tsDiag = (t, a, options) => {
    let risultato;
    function Sonda() { risultato = usaTsDiag()(t, a, options); return null; }
    renderToStaticMarkup(h(TranslateContext.Provider, { value: linguaEn }, h(Sonda)));
    return risultato;
  };

  const conta = errori.length;

  eq("tradotta e completa: nessun prefisso", "Hello world", rendiDiag({ t: marcatore("App_saluto") }));
  eq("🔸 non tradotta in questa lingua", "🔸Ciao Mario, come stai?", rendiDiag({ t: marcatore("App_conArg"), a: "Mario" }));
  eq("🔹 tradotta qui, non altrove", "🔹text in <b>bold</b>", rendiDiag({ t: marcatore("App_markup") }));
  eq("🔸 vince su 🔹 quando valgono entrambi", "🔸Ciao <b>Mario</b>, hai 3 messaggi", rendiDiag({ t: marcatore("App_markupArg"), a: ["Mario", 3] }));
  eq("🔸 anche per una chiave che la tabella non ha", "🔸testo nuovo", rendiDiag({ t: marcatore("App_maiVisto", "testo nuovo") }));
  eq("‼️ testo non marcato", "‼️testo libero", rendiDiag({ t: "testo libero" }));
  eq("‼️ marcatore sorgente mai compilato", "‼️Benvenuto", rendiDiag({ t: "_%_Benvenuto_%_" }));

  // absentDataInArray: vale sia nella tabella compilata (inlineato nel chunk) sia nell'interpolazione
  // a runtime. Due strade diverse per la stessa regola, e devono dire la stessa cosa.
  eq("absentDataInArray nella tabella compilata", "🔸Ciao «?», come stai?", rendiDiag({ t: marcatore("App_conArg") }));
  eq("absentDataInArray nell'interpolazione a runtime", "‼️ciao «?»", rendiDiag({ t: "_%_ciao %s_%_" }));

  // Un solo prefisso per stringa: `‼️` ha già vinto, e il testo recuperato non deve prendersene
  // un secondo per strada.
  eq("‼️ non si somma a 🔸 nel salvataggio", "‼️Ciao «?», come stai?", rendiDiag({ t: marcatore("App_conArg"), children: marcatore("App_saluto") }));
  eq("oggetto senza testo: vuoto come null", "", rendiDiag({ t: { chiave: "valore" } }));

  // mark.badData: qui il salvataggio non trova testo da nessuna parte, e l'unica cosa
  // utile che resta da dire è COSA c'era al suo posto. Non è un prefisso davanti a un testo —
  // testo non ce n'è — ma tutto ciò che si rende.
  const El = h("i", null, "attendere");
  eq("🚫 funzione", "🚫[func]", rendiDiag({ t: () => {} }));
  eq("🚫 symbol", "🚫[symbol]", rendiDiag({ t: Symbol("s") }));
  eq("🚫 boolean true", "🚫[true]", rendiDiag({ t: true }));
  eq("🚫 tupla vuota", "🚫[array]", rendiDiag({ t: [] }));
  eq("🚫 tupla che porta solo null", "🚫[nullArray]", rendiDiag({ t: [null] }));
  // Si scende nel primo posto della tupla: lì doveva esserci il testo, ed è di quello che si
  // parla — non dell'involucro che lo trasportava.
  eq("🚫 elemento nella tupla", "🚫[badDom]", rendiDiag({ t: [El] }));
  // `{ t: <El/> }` non è un errore: la forma a oggetto si srotola e un elemento da solo in
  // posizione testo è legittimo. Serve un livello in più perché diventi un uso scorretto.
  eq("la forma a oggetto con un elemento resta valida", "<i>attendere</i>", rendiDiag({ t: { t: El } }));
  eq("🚫 elemento annidato due volte", "🚫[badDom]", rendiDiag({ t: { t: { t: El } } }));
  eq("🚫 funzione nella tupla", "🚫[func]", rendiDiag({ t: [() => {}] }));
  // Prop incompatibili in cui nessuna delle due porta testo: si nomina la prima che c'è.
  eq("🚫 t e children entrambi elementi", "🚫[badDom]", rendiDiag({ t: El, children: El }));
  eq("🚫 o e t entrambi elementi", "🚫[badDom]", rendiDiag({ o: El, t: El }));
  // La stringa vuota si salta come in pickSource: il valore di cui vale la pena parlare è il
  // secondo, altrimenti si nominerebbe la prop innocua.
  eq('🚫 t="" e children elemento', "🚫[badDom]", rendiDiag({ t: "", children: El }));
  // Una struttura che si contiene da sé non deve far esplodere il render: senza la guardia di
  // profondità questa riga sarebbe un RangeError dentro il componente.
  const ciclica = [];
  ciclica[0] = ciclica;
  eq("🚫 tupla ciclica: nessun crash", "🚫[badData]", rendiDiag({ t: ciclica }));

  // I due valori che marcati non saranno mai: non passano dalla strada dell'errore, quindi
  // `‼️` non ce lo mettono nemmeno con i prefissi accesi.
  eq("nessun ‼️ per un numero", "42", rendiDiag({ t: 42 }));
  eq("nessun ‼️ per un elemento React", "<i>attendere</i>", rendiDiag({ t: h("i", null, "attendere") }));

  // skipMark spegne `‼️` e basta: la catena di risoluzione resta quella di sempre, e gli altri
  // due prefissi — che parlano della traduzione, non del marcatore — restano accesi.
  eq("skipMark: niente ‼️ sul non marcato", "testo libero", rendiDiag({ t: "testo libero", skipMark: true }));
  eq("skipMark: niente ‼️ sul marcatore sorgente", "Benvenuto", rendiDiag({ t: "_%_Benvenuto_%_", skipMark: true }));
  eq("skipMark non spegne 🔸", "🔸Ciao Mario, come stai?", rendiDiag({ t: marcatore("App_conArg"), a: "Mario", skipMark: true }));
  eq("skipMark non spegne 🔹", "🔹text in <b>bold</b>", rendiDiag({ t: marcatore("App_markup"), skipMark: true }));
  // Le prop incompatibili restano un errore anche con skipMark: quella dichiara la natura del
  // valore, non mette a tacere il componente.
  eq("skipMark non copre le prop incompatibili", "‼️Hello world", rendiDiag({ t: marcatore("App_saluto"), children: marcatore("App_markup"), skipMark: true }));

  console.log("\n== errorSolve: gli stessi prefissi da ts() ==");
  eq("ts() tradotta e completa", "Hello world", tsDiag(marcatore("App_saluto")));
  eq("ts() 🔸 non tradotta", "🔸Ciao Mario, come stai?", tsDiag(marcatore("App_conArg"), "Mario"));
  eq("ts() 🔹 non tradotta altrove", "🔹text in bold", tsDiag(marcatore("App_markup")));
  eq("ts() ‼️ testo non marcato", "‼️testo libero", tsDiag("testo libero"));
  eq("ts() skipMark: niente ‼️", "testo libero", tsDiag("testo libero", undefined, { skipMark: true }));
  eq("ts() skipMark non spegne 🔸", "🔸Ciao Mario, come stai?", tsDiag(marcatore("App_conArg"), "Mario", { skipMark: true }));
  eq("ts() nessun ‼️ per un numero", "42", tsDiag(42));

  eq("warn: false tiene la console muta", conta, errori.length);
}

console.error = originale;

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
