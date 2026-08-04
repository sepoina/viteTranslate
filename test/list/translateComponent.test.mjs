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
function ts(t, a, lang) {
  let risultato;
  function Sonda() {
    risultato = useTranslateToString()(t, a);
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
  eq("argomento mancante", "Ciao [?], come stai?", rendi({ t: marcatore("App_conArg") }, linguaAttiva));
  eq("argomento null", "Ciao [?], come stai?", rendi({ t: marcatore("App_conArg"), a: null }, linguaAttiva));
  eq("argomento 0 (valore legittimo)", "Ciao 0, come stai?", rendi({ t: marcatore("App_conArg"), a: 0 }, linguaAttiva));
  eq("stringa vuota (valore legittimo)", "Ciao , come stai?", rendi({ t: marcatore("App_conArg"), a: "" }, linguaAttiva));
  eq("argomenti in meno del previsto", "Ciao <b>Mario</b>, hai [?] messaggi", rendi({ t: marcatore("App_markupArg"), a: ["Mario"] }, linguaAttiva));
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
  // (vedi più sotto) si porta dietro un `⁂`; qui il manifest non li chiede, quindi esce nudo.
  const conta = errori.length;
  eq("t e children insieme: vince t", "Ciao mondo", rendi({ t: marcatore("App_saluto"), children: marcatore("App_markup") }, linguaAttiva));
  // Regressione: il controllo è sulla sentinella `false`, non sulla verità del valore. Con
  // `t=""` i children sparivano in silenzio — e non devono sparire nemmeno nel salvataggio,
  // dove la stringa vuota non conta come testo.
  eq('t="" e children insieme: vincono i children', "Ciao mondo", rendi({ t: "", children: marcatore("App_saluto") }, linguaAttiva));
  eq("forma ad array insieme ad a: vincono gli argomenti dell'array", "Ciao Mario, come stai?", rendi({ t: [marcatore("App_conArg"), "Mario"], a: "Luigi" }, linguaAttiva));
  eq("o insieme a t: vince o", "Ciao mondo", rendi({ o: marcatore("App_saluto"), t: marcatore("App_markup") }, linguaAttiva));
  eq("t numero", "42", rendi({ t: [42] }, linguaAttiva));
  // Un oggetto senza campo `t` non è la forma `{ t, a }` e non contiene testo: è una
  // variante di `null`, e rende vuoto come lui, senza prefisso. `[...]` resta per i valori
  // che non si possono proprio leggere — la funzione qui sotto. Vuoto a schermo, ma non in
  // silenzio: l'uso scorretto si segnala una volta in console.
  const prima2 = errori.length;
  eq("t oggetto senza testo dentro", "", rendi({ t: { chiave: "valore" } }, linguaAttiva));
  eq("l'oggetto senza t si segnala in console", true, errori.length > prima2);
  eq("t funzione", "[...]", rendi({ t: () => {} }, linguaAttiva));
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
  eq("argomento mancante", "Ciao [?], come stai?", ts(marcatore("App_conArg"), undefined, linguaAttiva));
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
export const errorSolve = { malformed: "⁂", untranslated: "⁑", notFullyTranslated: "∴", noArg: "«?»", warn: false };
export const partiallyTranslated = { "App_markup": 1 };
`;
  const { default: TranslateDiag } = await caricaConManifest("Translate.js", manifestDiag);
  const { useTranslateToString: usaTsDiag } = await caricaConManifest("useTranslateToString.js", manifestDiag);

  const linguaEn = { id: "en-US", table: tabellaEn, debug: false, proposeNewLanguage: () => {} };
  const rendiDiag = (props) =>
    renderToStaticMarkup(h(TranslateContext.Provider, { value: linguaEn }, h(TranslateDiag, props)));
  const tsDiag = (t, a) => {
    let risultato;
    function Sonda() { risultato = usaTsDiag()(t, a); return null; }
    renderToStaticMarkup(h(TranslateContext.Provider, { value: linguaEn }, h(Sonda)));
    return risultato;
  };

  const conta = errori.length;

  eq("tradotta e completa: nessun prefisso", "Hello world", rendiDiag({ t: marcatore("App_saluto") }));
  eq("⁑ non tradotta in questa lingua", "⁑Ciao Mario, come stai?", rendiDiag({ t: marcatore("App_conArg"), a: "Mario" }));
  eq("∴ tradotta qui, non altrove", "∴text in <b>bold</b>", rendiDiag({ t: marcatore("App_markup") }));
  eq("⁑ vince su ∴ quando valgono entrambi", "⁑Ciao <b>Mario</b>, hai 3 messaggi", rendiDiag({ t: marcatore("App_markupArg"), a: ["Mario", 3] }));
  eq("⁑ anche per una chiave che la tabella non ha", "⁑testo nuovo", rendiDiag({ t: marcatore("App_maiVisto", "testo nuovo") }));
  eq("⁂ testo non marcato", "⁂testo libero", rendiDiag({ t: "testo libero" }));
  eq("⁂ marcatore sorgente mai compilato", "⁂Benvenuto", rendiDiag({ t: "_%_Benvenuto_%_" }));

  // noArrayChar: vale sia nella tabella compilata (inlineato nel chunk) sia nell'interpolazione
  // a runtime. Due strade diverse per la stessa regola, e devono dire la stessa cosa.
  eq("noArrayChar nella tabella compilata", "⁑Ciao «?», come stai?", rendiDiag({ t: marcatore("App_conArg") }));
  eq("noArrayChar nell'interpolazione a runtime", "⁂ciao «?»", rendiDiag({ t: "_%_ciao %s_%_" }));

  // Un solo prefisso per stringa: `⁂` ha già vinto, e il testo recuperato non deve prendersene
  // un secondo per strada.
  eq("⁂ non si somma a ⁑ nel salvataggio", "⁂Ciao «?», come stai?", rendiDiag({ t: marcatore("App_conArg"), children: marcatore("App_saluto") }));
  eq("oggetto senza testo: vuoto come null", "", rendiDiag({ t: { chiave: "valore" } }));
  eq("⁂ funzione: niente da salvare", "⁂[...]", rendiDiag({ t: () => {} }));

  console.log("\n== errorSolve: gli stessi prefissi da ts() ==");
  eq("ts() tradotta e completa", "Hello world", tsDiag(marcatore("App_saluto")));
  eq("ts() ⁑ non tradotta", "⁑Ciao Mario, come stai?", tsDiag(marcatore("App_conArg"), "Mario"));
  eq("ts() ∴ non tradotta altrove", "∴text in bold", tsDiag(marcatore("App_markup")));
  eq("ts() ⁂ testo non marcato", "⁂testo libero", tsDiag("testo libero"));

  eq("warn: false tiene la console muta", conta, errori.length);
}

console.error = originale;

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
