// <TranslateContainer>: lo stato della lingua, la sospensione e cosa si vede quando un chunk
// non arriva.
//
// Era l'unico file di lib/react che nessun test renderizzava mai — compariva solo dentro tre
// commenti. Non è un dettaglio: è il punto in cui vivono la sospensione, il cambio lingua in
// transition e il ramo di errore di readLanguage, cioè le tre cose che sbagliate non fanno
// fallire niente, mostrano la pagina sbagliata.
//
// Il componente è JSX, quindi passa da Babel come nel bundle vero (rolldown.config.js fa lo
// stesso con @babel/preset-react). Il manifest è scritto a mano perché serve un `load()`
// pilotabile: è l'unico modo per far fallire un chunk a comando.
//
// Nota sui limiti: react-dom/server non ha stato fra un render e l'altro, quindi
// `proposeNewLanguage` non si può guidare fino allo schermo senza un DOM (jsdom non è una
// dipendenza, e non vale un test). Il meccanismo del ritentativo si verifica dove è stato
// messo apposta per essere verificabile: `hasFailedLanguage` + `nextLanguageState`, in fondo
// al file. Quello che resta scoperto è la sola riga di cablaggio dentro il useCallback.
//
// react e react-dom sono peerDependencies opzionali: se mancano, test/run.mjs salta il file.
//
//   node test/list/translateContainer.test.mjs
import { renderToStaticMarkup, renderToPipeableStream } from "react-dom/server";
import { createElement as h } from "react";
import { Writable } from "node:stream";
import { transformSync } from "@babel/core";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const REACT_DIR = join(ROOT, "lib/react");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(54), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// --------------------------------------------------------------- il mondo attorno ai moduli
// I file di appoggio vivono dentro lib/react perché gli import relativi dei moduli sotto test
// (React, il context, gli helper) devono continuare a risolversi. Vanno tolti anche se il test
// muore a metà, altrimenti restano nel sorgente del pacchetto.
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const temporanei = [];
process.on("exit", () => {
  for (const percorso of temporanei) {
    try { unlinkSync(percorso); } catch { /* già rimosso */ }
  }
});

function scrivi(nome, contenuto) {
  const percorso = join(REACT_DIR, nome);
  writeFileSync(percorso, contenuto, "utf8");
  temporanei.push(percorso);
  return percorso;
}

const sorgente = (file) => readFileSync(join(REACT_DIR, file), "utf8");

// Import virtuale -> il manifest di questo scenario. Le virgolette possono essere singole o
// doppie: nel sorgente sono doppie, ma il generatore di Babel normalizza a modo suo.
const VIRTUALE = /["']virtual:vitetranslate\/languages["']/g;

/** Il componente è JSX: stessa trasformazione che rolldown.config.js applica al bundle. */
const compilaJsx = (code, filename) => transformSync(code, {
  filename,
  presets: [["@babel/preset-react", { runtime: "automatic" }]],
  babelrc: false,
  configFile: false,
}).code;

let scenari = 0;

/**
 * Uno scenario completo: manifest, tabelle e una copia privata di ogni modulo che dal manifest
 * dipende. Privata è la parola importante — la cache delle lingue vive a livello di modulo, e
 * due scenari che se la condividessero si racconterebbero l'un l'altro caricamenti già andati.
 *
 * `fallisce` decide se il chunk di fr-FR arriva o no; `control` resta esportato e mutabile, così
 * un caricamento può fallire la prima volta e riuscire alla seconda (il caso del ritentativo).
 */
async function scenario({ fallisce = false } = {}) {
  const id = `${stamp}-${scenari++}`;
  const nomeManifest = `__manifest-${id}.mjs`;
  const nomeRisorsa = `__resource-${id}.mjs`;

  // Una voce di tabella può essere una stringa: è la forma che compileLanguageModule produce
  // per un testo senza segnaposto né markup, e qui è tutto ciò che serve per vedere QUALE
  // tabella è finita a schermo.
  scrivi(`__tab-it-${id}.mjs`, `export default { App_saluto: "Ciao mondo" };\n`);
  scrivi(`__tab-fr-${id}.mjs`, `export default { App_saluto: "Bonjour le monde" };\n`);

  scrivi(nomeManifest, `
import tabellaIt from "./__tab-it-${id}.mjs";
import tabellaFr from "./__tab-fr-${id}.mjs";
export const control = { fallisce: ${fallisce}, caricamenti: 0 };
export const languages = {
  "it-IT": { name: "italiano", preloaded: true, table: tabellaIt, load: () => Promise.resolve({ default: tabellaIt }) },
  "fr-FR": { name: "français", preloaded: false, load: () => {
    control.caricamenti++;
    return control.fallisce
      ? Promise.reject(new Error("chunk di lingua non caricato"))
      : Promise.resolve({ default: tabellaFr });
  } },
};
export const sourceLanguage = "it-IT";
export const fallbackTable = tabellaIt;
`);

  const versoManifest = (code) => code.replace(VIRTUALE, JSON.stringify(`./${nomeManifest}`));

  scrivi(nomeRisorsa, versoManifest(sorgente("languageResource.js")));
  // Il container deve vedere LA COPIA di languageResource, non l'originale: è lì che sta la
  // cache, e puntare all'originale significherebbe leggere un manifest che non esiste.
  scrivi(`__container-${id}.mjs`,
    versoManifest(compilaJsx(sorgente("TranslateContainer.jsx"), "TranslateContainer.jsx"))
      .replace(/["']\.\/languageResource\.js["']/g, JSON.stringify(`./${nomeRisorsa}`)));
  scrivi(`__translate-${id}.mjs`, versoManifest(sorgente("Translate.js")));
  scrivi(`__uselang-${id}.mjs`, versoManifest(sorgente("useTranslateLanguage.js")));

  // pathToFileURL e non il percorso grezzo: su Windows un path assoluto comincia con "d:", che
  // l'ESM loader di Node legge come schema di URL e rifiuta.
  //
  // E soprattutto NIENTE query di cache-busting, al contrario degli altri test: il nome del
  // file porta già l'id dello scenario, quindi la cache di Node non ha nulla da confondere — ma
  // una query renderebbe questa istanza diversa da quella che il container importa per
  // percorso relativo. Due copie di languageResource significano due cache delle lingue, e il
  // caricamento che il test fa fallire non sarebbe quello che il container legge.
  const carica = (nome) => import(pathToFileURL(join(REACT_DIR, nome)).href);

  return {
    TranslateContainer: (await carica(`__container-${id}.mjs`)).default,
    Translate: (await carica(`__translate-${id}.mjs`)).default,
    useTranslateLanguage: (await carica(`__uselang-${id}.mjs`)).useTranslateLanguage,
    risorsa: await carica(nomeRisorsa),
    control: (await carica(nomeManifest)).control,
  };
}

// --------------------------------------------------------------------------- utilità
const errori = [];
const avvisi = [];
const consoleErrore = console.error;
const consoleAvviso = console.warn;
console.error = (...pezzi) => errori.push(pezzi.map(String).join(" "));
console.warn = (...pezzi) => avvisi.push(pezzi.map(String).join(" "));

/**
 * Render in streaming, atteso fino in fondo: è l'unica API di react-dom/server che sa aspettare
 * un boundary sospeso invece di renderne subito il fallback. `onAllReady` -> l'HTML è quello a
 * sospensione risolta, cioè quello che l'utente finisce per vedere.
 */
function rendiStream(elemento) {
  return new Promise((risolvi, rifiuta) => {
    let html = "";
    const scarico = new Writable({ write(pezzo, _enc, fatto) { html += pezzo; fatto(); } });
    scarico.on("finish", () => risolvi(html));
    const timer = setTimeout(() => rifiuta(new Error("render non concluso entro 5s")), 5000);
    const controllo = renderToPipeableStream(elemento, {
      onAllReady() { clearTimeout(timer); controllo.pipe(scarico); },
      onShellError(e) { clearTimeout(timer); rifiuta(e); },
      onError() { /* lo assorbe il boundary, non deve far fallire il test */ },
    });
  });
}

// Il markup dello stream porta i commenti di confine di React (<!--$-->, <!--/$-->) e gli
// eventuali template di ricollegamento: qui interessa il testo, non la meccanica dell'idratazione.
const soloTesto = (html) => html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "");

const CHIAVE = "App_saluto";

// ------------------------------------------------------------ la lingua iniziale
console.log("\n== lingua iniziale ==");
{
  const { TranslateContainer, Translate } = await scenario();
  const conta = errori.length + avvisi.length;

  // Precaricata: la tabella è già in memoria, readLanguage non sospende e il primo render
  // produce il testo. È la ragione per cui `preloadedLanguages` esiste.
  eq("precaricata: nessuna sospensione, testo subito", "Ciao mondo",
    renderToStaticMarkup(h(TranslateContainer, null, h(Translate, { t: `_<_${CHIAVE}_>_` }))));
  eq("default = prima precaricata", "Ciao mondo",
    renderToStaticMarkup(h(TranslateContainer, { initialLanguage: "it-IT" }, h(Translate, { t: `_<_${CHIAVE}_>_` }))));
  eq("nessun rumore in console", conta, errori.length + avvisi.length);
}

{
  const { TranslateContainer, Translate } = await scenario();
  // Tag che non è una lingua: l'app non deve esplodere, ricade sulla prima precaricata — che
  // per costruzione è sempre disponibile — e lo dice.
  eq("initialLanguage sconosciuta: ricade sulla precaricata", "Ciao mondo",
    renderToStaticMarkup(h(TranslateContainer, { initialLanguage: "xx-XX" }, h(Translate, { t: `_<_${CHIAVE}_>_` }))));
  eq("e lo segnala in console", true, errori.some((m) => m.includes('unknown initial language "xx-XX"')));
}

{
  const { TranslateContainer, Translate } = await scenario();
  // Lingua vera ma non in bundle: funziona, ma il primo render aspetta un giro di rete. È
  // l'avviso che esiste perché `preloaded` viaggia nel manifest invece di essere dedotto.
  const html = await rendiStream(h(TranslateContainer, { initialLanguage: "fr-FR" }, h(Translate, { t: `_<_${CHIAVE}_>_` })));
  eq("non precaricata: sospende e poi mostra la sua lingua", "Bonjour le monde", soloTesto(html));
  eq("l'avviso sul non precaricato c'è", true, avvisi.some((m) => m.includes('"fr-FR" is not preloaded')));
}

{
  const { TranslateContainer } = await scenario();
  // Il fallback di Suspense è quello passato dal chiamante, non un lampo deciso da noi.
  //
  // Qui serve l'API sincrona e non lo stream: `renderToStaticMarkup` non aspetta un boundary
  // sospeso, quindi rende il fallback ed è l'unico modo per guardarlo. Con lo stream non si
  // vedrebbe mai — React risolve la sospensione prima di considerare pronto il guscio, e nello
  // scarico finisce già il contenuto (verificato: vale anche con un `load()` che ritarda).
  eq("il fallback è quello del chiamante", "<i>attendere</i>",
    renderToStaticMarkup(h(TranslateContainer, { initialLanguage: "fr-FR", fallback: h("i", null, "attendere") }, "contenuto")));
  eq("senza fallback il boundary rende vuoto", "",
    renderToStaticMarkup(h(TranslateContainer, { initialLanguage: "fr-FR" }, "contenuto")));
}

// ------------------------------------------------------ quando il chunk non arriva
console.log("\n== chunk di lingua che non arriva ==");
{
  const { TranslateContainer, Translate, useTranslateLanguage, risorsa } = await scenario({ fallisce: true });

  // Fallimento armato PRIMA del render: a quel punto readLanguage risponde senza sospendere, e
  // il test non dipende da come il renderer di server tratta una Promise sospesa che rifiuta.
  // È comunque lo stato in cui il client si trova dopo un caricamento andato male.
  await risorsa.ensureLanguage("fr-FR").catch(() => {});
  eq("la lingua risulta fallita", true, risorsa.hasFailedLanguage("fr-FR"));

  // "Mostra sempre qualcosa": si ricade sulla tabella eager invece di far crashare l'albero.
  eq("si vede la tabella eager, non un crash", "Ciao mondo",
    renderToStaticMarkup(h(TranslateContainer, { initialLanguage: "fr-FR" }, h(Translate, { t: `_<_${CHIAVE}_>_` }))));

  // Regressione: `id` diceva "fr-FR" mentre a schermo c'era l'italiano. Un selettore di lingua
  // evidenziava una voce che non corrispondeva a niente, senza avere modo di accorgersene.
  let letto;
  function Sonda() { letto = useTranslateLanguage(); return null; }
  renderToStaticMarkup(h(TranslateContainer, { initialLanguage: "fr-FR" }, h(Sonda)));
  eq("id è la lingua che si vede davvero", "it-IT", letto.id);
  eq("l'elenco delle lingue resta completo", 2, letto.languages.length);
}

// -------------------------------------------------------------- proposeNewLanguage
console.log("\n== proposeNewLanguage ==");
{
  const { TranslateContainer, useTranslateLanguage, control } = await scenario();
  let api;
  function Sonda() { api = useTranslateLanguage(); return null; }
  renderToStaticMarkup(h(TranslateContainer, null, h(Sonda)));

  eq("id iniziale", "it-IT", api.id);
  eq("proposeNewLanguage è esposta", "function", typeof api.proposeNewLanguage);

  // Tag inesistente: si esce prima di avviare qualunque caricamento, e i callback dicono com'è
  // andata invece di lasciare il chiamante a indovinare.
  const visti = [];
  api.proposeNewLanguage({
    lang: "xx-XX",
    onStart: () => visti.push("start"),
    onDone: (ok) => visti.push(`done:${ok}`),
    onError: ({ inexistID }) => visti.push(`error:${inexistID}`),
  });
  eq("tag inesistente: niente onStart, onError e onDone(false)", "error:xx-XX,done:false", visti.join(","));
  eq("e nessun caricamento avviato", 0, control.caricamenti);
}

// ------------------------------------------------ il meccanismo del ritentativo
console.log("\n== ritentativo di una lingua fallita ==");
{
  const { risorsa, control } = await scenario({ fallisce: true });
  const { ensureLanguage, hasFailedLanguage, nextLanguageState, readLanguage } = risorsa;

  await ensureLanguage("fr-FR").catch(() => {});
  eq("primo tentativo: fallito", true, hasFailedLanguage("fr-FR"));
  eq("un solo caricamento", 1, control.caricamenti);

  // Il cuore della regressione. Dopo il fallimento il tag È GIÀ quello richiesto: riproporlo
  // faceva `setLang(stessoTag)`, che incontra il bailout di React e non pianifica nessun
  // render. Il chunk arrivava, onDone(true) diceva che era andata bene, e a schermo restava la
  // tabella di fallback. `nextLanguageState` distingue i due casi dando un'identità nuova solo
  // quando c'è davvero qualcosa da ri-renderizzare.
  const prima = { tag: "fr-FR", epoch: 0 };
  eq("stesso tag, niente da riprovare: stessa identità (bailout)", true,
    nextLanguageState(prima, "fr-FR", false) === prima);
  eq("stesso tag ma è un ritentativo: identità nuova", false,
    nextLanguageState(prima, "fr-FR", hasFailedLanguage("fr-FR")) === prima);
  eq("un tag diverso: identità nuova", false, nextLanguageState(prima, "it-IT", false) === prima);
  eq("epoch avanza, e non lo legge nessuno", 1, nextLanguageState(prima, "fr-FR", true).epoch);

  // E il ritentativo vero riarma davvero il caricamento: una entry in errore non resta in cache
  // come tale, altrimenti quella lingua non sarebbe più selezionabile per tutta la vita della
  // pagina — un chunk può fallire per un buco di rete.
  control.fallisce = false;
  await ensureLanguage("fr-FR");
  eq("il secondo tentativo parte davvero", 2, control.caricamenti);
  eq("e riesce", "Bonjour le monde", readLanguage("fr-FR")[CHIAVE]);
  eq("dopo il successo non risulta più fallita", false, hasFailedLanguage("fr-FR"));
  eq("ora riproporla non ri-renderizza più", true, nextLanguageState(prima, "fr-FR", hasFailedLanguage("fr-FR")) === prima);

  // Una lingua caricata bene non riparte a ogni proposta: la cache serve a questo.
  await ensureLanguage("fr-FR");
  eq("una lingua già pronta non si ricarica", 2, control.caricamenti);
}

console.error = consoleErrore;
console.warn = consoleAvviso;

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
