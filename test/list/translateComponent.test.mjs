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
import { fileURLToPath } from "node:url";
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

/** Carica un modulo di lib/react con l'import virtuale rimpiazzato dal manifest dato. */
async function caricaConManifest(file, manifest) {
  const nomeManifest = `__manifest-${stamp}.mjs`;
  scriviTemporaneo(nomeManifest, manifest);
  const nomeModulo = `__${file.replace(/\.jsx?$/, "")}-${stamp}.mjs`;
  const percorso = scriviTemporaneo(
    nomeModulo,
    readFileSync(join(ROOT, "lib/react", file), "utf8")
      .replaceAll(/["']virtual:vitetranslate\/languages["']/g, JSON.stringify(`./${nomeManifest}`)),
  );
  return import(`${percorso}?t=${stamp}`);
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
const tabella = (await import(`${tabellaPath}?t=${stamp}`)).default;

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

// ------------------------------------------------------------------------- usi scorretti
console.log("\n== usi scorretti: si degrada, non si esplode ==");
{
  const conta = errori.length;
  eq("t e children insieme", "[...]", rendi({ t: marcatore("App_saluto"), children: marcatore("App_markup") }, linguaAttiva));
  // Regressione: il controllo è sulla sentinella `false`, non sulla verità del valore. Con
  // `t=""` i children sparivano in silenzio.
  eq('t="" e children insieme', "[...]", rendi({ t: "", children: marcatore("App_saluto") }, linguaAttiva));
  eq("forma ad array insieme ad a", "[...]", rendi({ t: [marcatore("App_conArg"), "Mario"], a: "Luigi" }, linguaAttiva));
  eq("t oggetto", "[...]", rendi({ t: { chiave: "valore" } }, linguaAttiva));
  eq("t numero", "[...]", rendi({ t: [42] }, linguaAttiva));
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
  eq("senza provider si usa la tabella eager", "Ciao mondo", ts(marcatore("App_saluto")));
  eq("il risultato è sempre una stringa", "string", typeof ts(marcatore("App_markup"), undefined, linguaAttiva));
}

console.error = originale;

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
