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

  const parziale = normalizeErrorSolve({ beginCharMalformed: "!!", warningBuild: true }, raccogli);
  eq("il campo dato vince", "!!", parziale.beginCharMalformed);
  eq("gli altri restano ai default", ERROR_SOLVE_DEFAULTS.beginCharUntranslated, parziale.beginCharUntranslated);
  eq("anche i booleani", true, parziale.warningBuild);
  eq("un campo parziale non avvisa", 0, avvisi.length);

  // Spegnere un singolo prefisso: `false`, `null` e `""` sono la stessa richiesta, e la forma
  // interna dello spento è sempre la stringa vuota.
  const spenti = normalizeErrorSolve({ beginCharMalformed: false, beginCharUntranslated: null, beginCharNotFullyTranslated: "" }, raccogli);
  eq("false spegne", "", spenti.beginCharMalformed);
  eq("null spegne", "", spenti.beginCharUntranslated);
  eq('"" spegne', "", spenti.beginCharNotFullyTranslated);
  eq("spegnere non è un errore", 0, avvisi.length);

  // Un refuso in un nome non produrrebbe nessun sintomo: l'opzione resterebbe al default,
  // cioè il contrario di ciò che si stava cercando di ottenere.
  avvisi.length = 0;
  normalizeErrorSolve({ beginCharMalformd: "x" }, raccogli);
  eq("un nome sconosciuto viene segnalato", 1, avvisi.length);
  eq("il messaggio nomina il refuso", true, avvisi[0].includes("beginCharMalformd"));
  eq("e elenca i nomi buoni", true, avvisi[0].includes("beginCharMalformed"));

  avvisi.length = 0;
  const tipiSbagliati = normalizeErrorSolve({ beginCharMalformed: 42, onlyInDev: "sì" }, raccogli);
  eq("un tipo sbagliato viene segnalato", 2, avvisi.length);
  eq("e il default resta", ERROR_SOLVE_DEFAULTS.beginCharMalformed, tipiSbagliati.beginCharMalformed);
  eq("anche per i booleani", true, tipiSbagliati.onlyInDev);

  avvisi.length = 0;
  eq("non un oggetto -> default, con avviso", ERROR_SOLVE_DEFAULTS.noArrayChar, normalizeErrorSolve("acceso", raccogli).noArrayChar);
  eq("e lo dice", 1, avvisi.length);
}

// --------------------------------------------------------------- risoluzione ambientale
console.log("\n== resolveErrorSolve: decidere a build time ==");
{
  const base = normalizeErrorSolve(undefined);

  const dev = resolveErrorSolve(base, false);
  eq("dev: i prefissi ci sono", "⁂⁑∴", dev.malformed + dev.untranslated + dev.notFullyTranslated);
  eq("dev: la console parla", true, dev.warn);

  const build = resolveErrorSolve(base, true);
  // onlyInDev di default: in build resta il fallback e basta.
  eq("build: nessun prefisso", "", build.malformed + build.untranslated + build.notFullyTranslated);
  eq("build: la console tace", false, build.warn);
  // noArrayChar non è una diagnostica ma una resa normale, e non passa da onlyInDev.
  eq("build: noArg resta", "[?]", build.noArg);

  const sempre = resolveErrorSolve(normalizeErrorSolve({ onlyInDev: false, warningBuild: true }), true);
  eq("onlyInDev:false riaccende i prefissi in build", "⁂⁑∴", sempre.malformed + sempre.untranslated + sempre.notFullyTranslated);
  eq("warningBuild:true riaccende la console", true, sempre.warn);

  const mutoInDev = resolveErrorSolve(normalizeErrorSolve({ warningDev: false }), false);
  eq("warningDev:false zittisce anche lo sviluppo", false, mutoInDev.warn);
  eq("ma i prefissi restano", "⁂", mutoInDev.malformed);
}

// ------------------------------------------------------------------- lettura a runtime
console.log("\n== resolveDiagnostics: cosa legge il runtime ==");
{
  eq("manifest senza errorSolve -> nessun prefisso", "", resolveDiagnostics({}).malformed);
  // L'asimmetria è voluta: senza la risoluzione del plugin non si sa se si è in sviluppo,
  // e far comparire glifi in un'app pubblicata è peggio che non mostrarne. `noArg` invece è
  // la resa di sempre.
  eq("manifest senza errorSolve -> noArg di sempre", "[?]", resolveDiagnostics({}).noArg);
  eq("manifest senza errorSolve -> console attiva", true, resolveDiagnostics({}).warn);
  eq("manifest indefinito non esplode", true, resolveDiagnostics(undefined) === DEFAULT_DIAGNOSTICS);

  const diag = resolveDiagnostics({
    errorSolve: { malformed: "M", untranslated: "U", notFullyTranslated: "N", noArg: "?", warn: false },
    partiallyTranslated: { App_x: 1 },
  });
  eq("i valori arrivano dal manifest", "MUN?", diag.malformed + diag.untranslated + diag.notFullyTranslated + diag.noArg);
  eq("partiallyTranslated pure", 1, diag.partiallyTranslated.App_x);
  // La variante con i soli prefissi di traduzione spenti: serve al salvataggio, dove `⁂` ha
  // già vinto e un secondo prefisso non aggiungerebbe niente.
  eq("malformedOnly tiene ⁂", "M", diag.malformedOnly.malformed);
  eq("malformedOnly spegne gli altri due", "", diag.malformedOnly.untranslated + diag.malformedOnly.notFullyTranslated);
  eq("malformedOnly tiene noArg", "?", diag.malformedOnly.noArg);
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
    eq("dev: il manifest porta errorSolve", true, inDev.includes('"malformed":"⁂"'));
    // App_b è a null in en-US, App_c manca del tutto: entrambe non tradotte "da qualche parte".
    // App_a è tradotta ovunque e non deve comparire.
    eq("dev: partiallyTranslated elenca le due incomplete", true, inDev.includes('export const partiallyTranslated = {"App_b":1,"App_c":1};'));

    const inBuild = await genera(undefined, true);
    eq("build: i prefissi sono spenti", true, inBuild.includes('"malformed":"","untranslated":"","notFullyTranslated":""'));
    // Il costo dei prefissi non si paga dove non servono: niente insieme globale nel bundle.
    eq("build: partiallyTranslated è vuoto", true, inBuild.includes("export const partiallyTranslated = {};"));

    const buildEsplicita = await genera({ onlyInDev: false }, true);
    eq("build con onlyInDev:false: i prefissi tornano", true, buildEsplicita.includes('"malformed":"⁂"'));
    eq("build con onlyInDev:false: e l'insieme pure", true, buildEsplicita.includes('"App_b":1'));

    const senzaQuelPrefisso = await genera({ beginCharNotFullyTranslated: false }, false);
    eq("spegnere ∴ toglie l'insieme anche in dev", true, senzaQuelPrefisso.includes("export const partiallyTranslated = {};"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
