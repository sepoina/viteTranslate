// `@babel/core` è una peer dependency OBBLIGATORIA, e la sua assenza non è più un avviso: ferma
// il dev server e la build (vedi doc/requirements.md § "Why @babel/core is required"). Questo
// test copre la decisione, che non è verificabile disinstallando Babel dalla macchina che la
// verifica — `motivoBabel` accetta la sonda come parametro proprio per questo, la stessa
// cucitura che `autoSync` espone come `probeBabel`.
//
// La seconda metà legge vitetranslate.js come testo, nello stile di autoSyncHookPosition:
// prova che i due hook chiamano davvero quella decisione e si fermano. Una decisione giusta
// presa in un posto che non ferma niente non serve a nulla.
//
//   node test/list/babelRequired.test.mjs
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { motivoBabel } from "../../lib/dev/vite/vitetranslate.js";
import { BABEL_MISSING, BABEL_NODE_TOO_OLD, babelUnaRiga, babelConsiglio, BABEL_INSTALL_COMMAND } from "../../lib/dev/babel/babelPeer.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(64), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// Il test gira DENTRO la suite, non dentro Vitest: la guardia qui sotto si accende a mano.
const senzaVitest = (fn) => {
  const prima = process.env.VITEST;
  delete process.env.VITEST;
  try { return fn(); } finally { if (prima !== undefined) process.env.VITEST = prima; }
};

const sonda = (guasto) => () => {
  if (!guasto) return;
  const e = new Error(guasto.message);
  e.code = "VT_NO_BABEL";
  e.guasto = guasto;
  throw e;
};

// -------------------------------------------------------------- la decisione
console.log("== motivoBabel: quando fermarsi ==");
{
  eq("Babel a posto: si prosegue", null, senzaVitest(() => motivoBabel(sonda(null))));

  const assente = senzaVitest(() => motivoBabel(sonda(BABEL_MISSING)));
  eq("Babel assente: si ferma", true, assente !== null);
  eq("il guasto arriva intatto da ensureBabel", BABEL_MISSING, assente?.guasto);

  const nodeVecchio = senzaVitest(() => motivoBabel(sonda(BABEL_NODE_TOO_OLD)));
  eq("Babel 8 su Node troppo vecchio: si ferma", true, nodeVecchio !== null);
  // La distinzione che giustifica due guasti invece di uno: la cura non è la stessa, e
  // mandare a installare ciò che è già installato è il modo di far perdere un pomeriggio.
  eq("e con l'altro rimedio, non con 'installalo'", true,
    nodeVecchio?.guasto.comando !== BABEL_INSTALL_COMMAND);

  // Un errore che non è VT_NO_BABEL non è affare di questa funzione: un permesso negato o un
  // Babel rotto a metà devono risalire come sono, non diventare "installa @babel/core".
  const altro = new Error("boom");
  altro.code = "EACCES";
  let risalito = null;
  try { senzaVitest(() => motivoBabel(() => { throw altro; })); } catch (e) { risalito = e; }
  eq("un errore estraneo risale intatto", altro, risalito);
}

// -------------------------------------------------------------- la guardia Vitest
console.log("\n== sotto Vitest non si uccide il processo del runner ==");
{
  const prima = process.env.VITEST;
  process.env.VITEST = "true";
  try {
    // Stessa sonda del caso "assente" qui sopra, che senza questa guardia farebbe fermare
    // tutto: dentro un runner sarebbe la suite di test di chi ci usa a morire, per una
    // dipendenza che i suoi test non toccano.
    eq("Babel assente ma sotto Vitest: si prosegue", null, motivoBabel(sonda(BABEL_MISSING)));
  } finally {
    if (prima === undefined) delete process.env.VITEST; else process.env.VITEST = prima;
  }
}

// -------------------------------------------------------------- i testi
console.log("\n== una sola origine per il testo che l'utente legge ==");
{
  // Il comando compare UNA volta nella riga: `cura` non lo contiene, lo aggiunge babelUnaRiga.
  const riga = babelUnaRiga(BABEL_MISSING);
  eq("la riga nomina il pacchetto", true, riga.includes("@babel/core"));
  eq("il comando compare una volta sola", 1, riga.split(BABEL_INSTALL_COMMAND).length - 1);
  eq("il consiglio del ramo generico spiega a cosa serve", true,
    babelConsiglio().includes("scan your source for markers"));
  eq("i due guasti hanno comandi diversi", true,
    BABEL_MISSING.comando !== BABEL_NODE_TOO_OLD.comando);
}

// -------------------------------------------------------------- dove sta la decisione
console.log("\n== i due hook chiamano la decisione e si fermano ==");
{
  const HERE = dirname(fileURLToPath(import.meta.url));
  const testo = readFileSync(join(resolve(HERE, "../.."), "lib/dev/vite/vitetranslate.js"), "utf8");

  // Ritaglia il corpo di un hook fino all'inizio del successivo: i controlli qui sotto devono
  // dire "dentro QUESTO hook", non "da qualche parte nel file". `fine` omesso significa fino
  // in fondo, per l'ultimo hook del file.
  const corpoDa = (inizio, fine) => {
    const a = testo.indexOf(inizio);
    eq(`l'hook "${inizio}" esiste`, true, a !== -1);
    if (a === -1) return "";
    const b = fine === undefined ? testo.length : testo.indexOf(fine, a);
    eq(`e finisce prima di "${fine ?? "<fine file>"}"`, true, b !== -1);
    return b === -1 ? "" : testo.slice(a, b);
  };

  const buildStart = corpoDa("buildStart()", "buildEnd()");
  eq("buildStart chiama motivoBabel", true, buildStart.includes("motivoBabel()"));
  eq("buildStart lancia se il guasto c'è", true, /if \(guastoBabel\) throw new Error/.test(buildStart));

  const configureServer = corpoDa("async configureServer(server)");
  eq("configureServer chiama motivoBabel", true, configureServer.includes("motivoBabel()"));
  eq("configureServer esce dal processo", true, configureServer.includes("process.exit(1)"));
  // Prima di checkSetup: senza estrazione nemmeno un setup perfetto produrrebbe una build
  // tradotta, quindi è quello il guasto da dire per primo.
  eq("e lo fa PRIMA del controllo del setup", true,
    configureServer.indexOf("motivoBabel()") < configureServer.indexOf("checkSetup("));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
