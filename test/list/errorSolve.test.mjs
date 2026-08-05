// L'opzione `errorSolve`: come si completa, come si controlla, come si risolve contro
// l'ambiente e cosa finisce nel modulo virtuale.
//
// Il tratto verificato qui è quello che nessun altro test tocca: la strada che va dalla riga
// scritta in vite.config.js ai valori che il runtime legge. Come i prefissi si vedano poi a
// schermo lo verifica translateComponent, che parte dalle prop del componente.
//
//   node test/list/errorSolve.test.mjs
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ERROR_SOLVE_DEFAULTS, normalizeErrorSolve, resolveErrorSolve, resolveDiagnostics, report, reportOnce, DEFAULT_DIAGNOSTICS } from "../../lib/errorSolve.js";
import vitetranslate from "../../lib/dev/vite/vitetranslate.js";

const VIRTUAL = "\0virtual:vitetranslate/languages";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// --------------------------------------------------------------------- normalizzazione
console.log("\n== normalizeErrorSolve: completare e controllare ==");
{
  const avvisi = [];
  const raccogli = (m) => avvisi.push(m);

  eq("non specificata -> tutti i default", JSON.stringify(ERROR_SOLVE_DEFAULTS), JSON.stringify(normalizeErrorSolve(undefined, raccogli)));
  eq("oggetto vuoto -> tutti i default", JSON.stringify(ERROR_SOLVE_DEFAULTS), JSON.stringify(normalizeErrorSolve({}, raccogli)));
  eq("nessun avviso finora", 0, avvisi.length);

  const parziale = normalizeErrorSolve({ mark: { malformed: "!!" }, warningBuild: true }, raccogli);
  eq("il campo dato vince", "!!", parziale.mark.malformed);
  eq("gli altri mark restano ai default", ERROR_SOLVE_DEFAULTS.mark.untranslated, parziale.mark.untranslated);
  eq("anche i booleani", true, parziale.warningBuild);
  eq("un campo parziale non avvisa", 0, avvisi.length);

  // I default sono congelati e il risultato no: senza una copia profonda scrivere in `mark`
  // lancerebbe in strict mode, o peggio muterebbe i default per tutte le chiamate successive.
  eq("i default non si sono mossi", "‼️", ERROR_SOLVE_DEFAULTS.mark.malformed);
  eq("e il mark restituito è una copia", false, parziale.mark === ERROR_SOLVE_DEFAULTS.mark);

  // Spegnere un singolo mark: `false`, `null` e `""` sono la stessa richiesta, e la forma
  // interna dello spento è sempre la stringa vuota.
  const spenti = normalizeErrorSolve({ mark: { malformed: false, untranslated: null, notFullyTranslated: "", badData: false } }, raccogli);
  eq("false spegne", "", spenti.mark.malformed);
  eq("null spegne", "", spenti.mark.untranslated);
  eq('"" spegne', "", spenti.mark.notFullyTranslated);
  eq("badData si spegne come gli altri", "", spenti.mark.badData);
  eq("spegnere non è un errore", 0, avvisi.length);

  // Un refuso in un nome non produrrebbe nessun sintomo: l'opzione resterebbe al default,
  // cioè il contrario di ciò che si stava cercando di ottenere.
  avvisi.length = 0;
  normalizeErrorSolve({ mark: { malformd: "x" } }, raccogli);
  eq("un nome sconosciuto dentro mark viene segnalato", 1, avvisi.length);
  eq("il messaggio nomina il refuso", true, avvisi[0].includes("malformd"));
  eq("e elenca i nomi buoni", true, avvisi[0].includes("notFullyTranslated"));
  eq("dicendo dov'era", true, avvisi[0].includes("errorSolve.mark"));

  avvisi.length = 0;
  normalizeErrorSolve({ markOnlyDv: true }, raccogli);
  eq("e lo stesso al primo livello", 1, avvisi.length);
  eq("con l'elenco di quel livello", true, avvisi[0].includes("mark, markOnlyDev"));

  // Un nome che esisteva e si è spostato non è un refuso: l'elenco dei nomi buoni non lo
  // aiuterebbe, perché quello che cerca non c'è più. Solo diagnostica — la forma vecchia
  // resta ignorata, non viene tradotta in silenzio.
  avvisi.length = 0;
  const vecchiaForma = normalizeErrorSolve({ beginCharMalformed: "!!", onlyInDev: false }, raccogli);
  eq("i nomi di prima si segnalano", 2, avvisi.length);
  eq("dicendo dove sono finiti", true, avvisi[0].includes('use "errorSolve.mark.malformed"'));
  eq("anche per gli interruttori", true, avvisi[1].includes('use "errorSolve.markOnlyDev"'));
  eq("e non vengono applicati", "‼️", vecchiaForma.mark.malformed);
  eq("nemmeno i booleani", true, vecchiaForma.markOnlyDev);

  avvisi.length = 0;
  const tipiSbagliati = normalizeErrorSolve({ mark: { malformed: 42 }, markOnlyDev: "sì" }, raccogli);
  eq("un tipo sbagliato viene segnalato", 2, avvisi.length);
  eq("e il default resta", ERROR_SOLVE_DEFAULTS.mark.malformed, tipiSbagliati.mark.malformed);
  eq("anche per i booleani", true, tipiSbagliati.markOnlyDev);

  avvisi.length = 0;
  eq("mark non un oggetto -> default, con avviso", ERROR_SOLVE_DEFAULTS.mark.malformed, normalizeErrorSolve({ mark: "acceso" }, raccogli).mark.malformed);
  eq("e lo dice", 1, avvisi.length);

  avvisi.length = 0;
  eq("errorSolve non un oggetto -> default, con avviso", ERROR_SOLVE_DEFAULTS.mark.absentDataInArray, normalizeErrorSolve("acceso", raccogli).mark.absentDataInArray);
  eq("e lo dice", 1, avvisi.length);
}

// --------------------------------------------------------------- risoluzione ambientale
console.log("\n== resolveErrorSolve: decidere a build time ==");
{
  const base = normalizeErrorSolve(undefined);

  const dev = resolveErrorSolve(base, false);
  eq("dev: i prefissi ci sono", "‼️🔸🔹🚫", dev.malformed + dev.untranslated + dev.notFullyTranslated + dev.badData);
  eq("dev: la console parla", true, dev.warn);

  // I nomi risolti sono gli stessi che si scrivono dentro `mark`: la risoluzione copia e
  // spegne, non traduce un vocabolario nell'altro. Più `warn`, e nient'altro.
  eq("le chiavi risolte sono mark + warn", "badData,malformed,untranslated,notFullyTranslated,absentDataInArray,warn", Object.keys(dev).join(","));

  const build = resolveErrorSolve(base, true);
  // markOnlyDev di default: in build resta il fallback e basta.
  eq("build: nessun mark diagnostico", "", build.malformed + build.untranslated + build.notFullyTranslated + build.badData);
  eq("build: la console tace", false, build.warn);
  // absentDataInArray non è una diagnostica ma una resa normale, e non passa da markOnlyDev.
  eq("build: absentDataInArray resta", "⁇", build.absentDataInArray);

  const sempre = resolveErrorSolve(normalizeErrorSolve({ markOnlyDev: false, warningBuild: true }), true);
  eq("markOnlyDev:false riaccende i mark in build", "‼️🔸🔹🚫", sempre.malformed + sempre.untranslated + sempre.notFullyTranslated + sempre.badData);
  eq("warningBuild:true riaccende la console", true, sempre.warn);

  const mutoInDev = resolveErrorSolve(normalizeErrorSolve({ warningDev: false }), false);
  eq("warningDev:false zittisce anche lo sviluppo", false, mutoInDev.warn);
  eq("ma i mark restano", "‼️", mutoInDev.malformed);

  // Il risultato non deve tenersi un rimando al `mark` normalizzato: chi lo riceve lo spedisce
  // nel manifest, e una condivisione qui sarebbe una mutazione a distanza.
  eq("il risultato è una copia di mark", false, resolveErrorSolve(base, false) === base.mark);
}

// ------------------------------------------------------------------- lettura a runtime
console.log("\n== resolveDiagnostics: cosa legge il runtime ==");
{
  eq("manifest senza errorSolve -> nessun mark", "", resolveDiagnostics({}).malformed);
  // L'asimmetria è voluta: senza la risoluzione del plugin non si sa se si è in sviluppo,
  // e far comparire glifi in un'app pubblicata è peggio che non mostrarne.
  // `absentDataInArray` invece è la resa di sempre.
  eq("manifest senza errorSolve -> absentDataInArray di sempre", "⁇", resolveDiagnostics({}).absentDataInArray);
  eq("manifest senza errorSolve -> console attiva", true, resolveDiagnostics({}).warn);
  eq("manifest indefinito non esplode", true, resolveDiagnostics(undefined) === DEFAULT_DIAGNOSTICS);

  // Un manifest generato da una versione del plugin che `badData` non lo conosceva: il campo
  // manca e ricade su "", cioè sul non rendere niente.
  eq("manifest senza badData -> spento", "", resolveDiagnostics({ errorSolve: { malformed: "M" } }).badData);

  const diag = resolveDiagnostics({
    errorSolve: { malformed: "M", untranslated: "U", notFullyTranslated: "N", badData: "B", absentDataInArray: "?", warn: false },
    partiallyTranslated: { App_x: 1 },
  });
  eq("i valori arrivano dal manifest", "MUNB?", diag.malformed + diag.untranslated + diag.notFullyTranslated + diag.badData + diag.absentDataInArray);
  eq("partiallyTranslated pure", 1, diag.partiallyTranslated.App_x);
  // La variante con i soli prefissi di traduzione spenti: serve al salvataggio, dove `‼️` ha
  // già vinto e un secondo prefisso non aggiungerebbe niente.
  eq("malformedOnly tiene ‼️", "M", diag.malformedOnly.malformed);
  eq("malformedOnly spegne gli altri due", "", diag.malformedOnly.untranslated + diag.malformedOnly.notFullyTranslated);
  eq("malformedOnly tiene absentDataInArray", "?", diag.malformedOnly.absentDataInArray);
}

// ------------------------------------------------------------------ interruttore console
console.log("\n== report(): l'interruttore ==");
{
  const originale = console.error;
  const righe = [];
  console.error = (...pezzi) => righe.push(pezzi.join(" "));

  report({ warn: true }, "error", "si vede");
  eq("warn: true stampa", 1, righe.length);
  report({ warn: false }, "error", "non si vede");
  eq("warn: false non stampa", 1, righe.length);

  console.error = originale;
}

console.log("\n== reportOnce(): dedup e messaggio pigro ==");
{
  const originale = console.error;
  const righe = [];
  console.error = (...pezzi) => righe.push(pezzi.join(" "));

  // Forma a due parametri: la chiave È il messaggio.
  const acceso = { warn: true };
  reportOnce(acceso, "primo messaggio");
  reportOnce(acceso, "primo messaggio");
  eq("stessa chiave: una volta sola", 1, righe.length);
  reportOnce(acceso, "secondo messaggio");
  eq("chiave diversa: si vede", 2, righe.length);
  eq("il messaggio è la chiave", "secondo messaggio", righe[1]);

  // Forma a tre: la chiave deduplica, `build` compone. Il messaggio può quindi variare a
  // parità di chiave — è il prezzo di non costruirlo, ed è voluto.
  reportOnce(acceso, "chiave-pigra", () => "testo costruito");
  eq("build() fornisce il messaggio", "testo costruito", righe[2]);

  // Il punto di tutta la modifica: a console spenta `build` non deve essere CHIAMATA. Prima
  // il messaggio arrivava già composto, quindi un describeValue() girava comunque.
  let chiamate = 0;
  const spento = { warn: false };
  reportOnce(spento, "mai-vista", () => { chiamate++; return "non si vede"; });
  eq("warn: false non stampa", 3, righe.length);
  eq("warn: false non costruisce nemmeno il messaggio", 0, chiamate);

  // A console accesa build() viene chiamata una volta sola, non una per tentativo.
  reportOnce(acceso, "chiave-contata", () => { chiamate++; return "una volta"; });
  reportOnce(acceso, "chiave-contata", () => { chiamate++; return "una volta"; });
  eq("build() chiamata solo quando si stampa", 1, chiamate);
  eq("e la seconda non stampa", 4, righe.length);

  console.error = originale;
}

// ------------------------------------------------------- fino al modulo virtuale, davvero
console.log("\n== il modulo virtuale generato dal plugin ==");
{
  // Un progetto vero e minuscolo: due lingue, una tradotta a metà. `en-US` è precaricata così
  // il manifest la importa staticamente e non serve altro sul disco.
  const dir = mkdtempSync(join(tmpdir(), "vitetranslate-errorsolve-"));
  const locale = join(dir, "locale");
  const scrivi = (tag, tabella) =>
    writeFileSync(join(locale, `${tag}.js`), `export default ${JSON.stringify(tabella, null, 2)};\n`, "utf8");
  try {
    mkdirSync(locale, { recursive: true });
    scrivi("it-IT", { __builder__: { v: 1, languageName: "italiano" }, App_a: "uno", App_b: "due", App_c: "tre" });
    scrivi("en-US", { __builder__: { v: 1, languageName: "English", incomplete: true }, App_a: "one", App_b: null });

    const genera = async (errorSolve, isProduction) => {
      const [, plugin] = vitetranslate({ baseDir: dir, localeDir: "locale", sourceLanguage: "it-IT", preloadedLanguages: ["en-US"], errorSolve });
      plugin.configResolved({ isProduction, build: {} });
      return (await plugin.load(VIRTUAL)).code;
    };

    const inDev = await genera(undefined, false);
    eq("dev: il manifest porta errorSolve", true, inDev.includes('"malformed":"‼️"'));
    // App_b è a null in en-US, App_c manca del tutto: entrambe non tradotte "da qualche parte".
    // App_a è tradotta ovunque e non deve comparire.
    eq("dev: partiallyTranslated elenca le due incomplete", true, inDev.includes('export const partiallyTranslated = {"App_b":1,"App_c":1};'));

    // I nomi nel manifest sono quelli scritti in vite.config.js dentro `mark`, in quell'ordine.
    eq("dev: il manifest usa i nomi di mark", true, inDev.includes('"badData":"🚫","malformed":"‼️","untranslated":"🔸","notFullyTranslated":"🔹","absentDataInArray":"⁇"'));

    const inBuild = await genera(undefined, true);
    eq("build: i mark diagnostici sono spenti", true, inBuild.includes('"badData":"","malformed":"","untranslated":"","notFullyTranslated":""'));
    eq("build: absentDataInArray resta", true, inBuild.includes('"absentDataInArray":"⁇"'));
    // Il costo dei prefissi non si paga dove non servono: niente insieme globale nel bundle.
    eq("build: partiallyTranslated è vuoto", true, inBuild.includes("export const partiallyTranslated = {};"));

    const buildEsplicita = await genera({ markOnlyDev: false }, true);
    eq("build con markOnlyDev:false: i mark tornano", true, buildEsplicita.includes('"malformed":"‼️"'));
    eq("build con markOnlyDev:false: e l'insieme pure", true, buildEsplicita.includes('"App_b":1'));

    const senzaQuelPrefisso = await genera({ mark: { notFullyTranslated: false } }, false);
    eq("spegnere 🔹 toglie l'insieme anche in dev", true, senzaQuelPrefisso.includes("export const partiallyTranslated = {};"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
