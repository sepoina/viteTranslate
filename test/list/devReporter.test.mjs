// Il raccoglitore di avvisi per sessione di dev: un errore di battitura in un file di lingua
// non deve produrre una riga per ogni rigenerazione del manifest.
//
//   node test/list/devReporter.test.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import creaReporter from "../../lib/dev/vite/uty/devReporter.js";
import { readSession } from "../../lib/dev/vite/uty/sessionStore.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

/**
 * Solo il testo di una riga (rich mode: dopo il montante "║"; simple mode: senza il prefisso
 * ":::" e il suo rientro). Ogni riga porta il proprio montante/prefisso, quindi unire le righe
 * grezze con uno spazio spezzerebbe una frase andata a capo proprio nel mezzo. Qui si cerca il
 * TESTO che il reporter scrive, non l'incolonnamento: quello ha già un test suo (logFormat).
 */
const soloTesto = (riga) => (riga.includes("║") ? riga.split("║").pop() : riga.replace(/^:::\s*/, "")).trim();
/** Il messaggio complessivo di un blocco di righe, per le ricerche di sottostringa. */
const messaggioDi = (righe) => righe.map(soloTesto).join(" ");

/** Le righe stampate da `fn` (console.log intercettato), senza colori. */
function grezzo(fn) {
  const righe = [];
  const vero = console.log;
  console.log = (r) => righe.push(String(r).replace(/\x1b\[[0-9;]*m/g, ""));
  try { fn(); } finally { console.log = vero; }
  return righe;
}

/**
 * Come `grezzo`, ma per il flush che arriva da solo a timer scaduto: `console.log` resta
 * intercettato per tutta l'attesa, non solo per la chiamata sincrona.
 */
async function grezzoAsincrono(fn) {
  const righe = [];
  const vero = console.log;
  console.log = (r) => righe.push(String(r).replace(/\x1b\[[0-9;]*m/g, ""));
  try { await fn(); } finally { console.log = vero; }
  return righe;
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

const temporanee = [];
function baseDirUsaEGetta() {
  const dir = mkdtempSync(join(tmpdir(), "vt-devreporter-"));
  temporanee.push(dir);
  return dir;
}

// ------------------------------------------------------- una riga per categoria
console.log("\n== una sola riga per categoria, il resto a conteggio ==");
{
  const baseDir = baseDirUsaEGetta();
  const reporter = creaReporter({ baseDir, cliName: "vtranslate-cli" });
  reporter.report("invalid-language-file", "fr-FR.yml è rotto");
  reporter.report("invalid-language-file", "de-DE.yml è rotto"); // stessa categoria, 2° avviso
  reporter.report("empty-language-file", "es-ES.yml è vuoto");

  const righe = grezzo(() => reporter.flush());
  const testo = messaggioDi(righe);

  eq("il primo messaggio della categoria esce per esteso", true, testo.includes("fr-FR.yml è rotto"));
  eq("il secondo della stessa categoria no", false, testo.includes("de-DE.yml è rotto"));
  eq("l'altra categoria esce comunque", true, testo.includes("es-ES.yml è vuoto"));
  eq("la riga di rimando conta il nascosto", true, testo.includes("+1 more"));
  eq("e nomina --status", true, testo.includes("--status"));
}

// ------------------------------------------------------- silenzio a firma invariata
console.log("\n== stessi problemi del giro prima, nello stesso processo: silenzio ==");
{
  const baseDir = baseDirUsaEGetta();
  const reporter = creaReporter({ baseDir, cliName: "vtranslate-cli" });

  reporter.report("empty-language-file", "es-ES.yml è vuoto");
  const primoGiro = grezzo(() => reporter.flush());
  eq("il primo giro stampa", true, primoGiro.length > 0);

  reporter.report("empty-language-file", "es-ES.yml è vuoto"); // stesso identico problema
  const secondoGiro = grezzo(() => reporter.flush());
  eq("il secondo giro, identico, tace", 0, secondoGiro.length);
}

// ------------------------------------------------------- ripresa a firma cambiata
console.log("\n== un problema in più (o uno risolto): riprende a parlare ==");
{
  const baseDir = baseDirUsaEGetta();
  const reporter = creaReporter({ baseDir, cliName: "vtranslate-cli" });

  reporter.report("empty-language-file", "es-ES.yml è vuoto");
  grezzo(() => reporter.flush());

  reporter.report("empty-language-file", "es-ES.yml è vuoto");
  reporter.report("preload-missing", "preloadedLanguages: \"de-DE\" not found");
  const terzoGiro = grezzo(() => reporter.flush());
  eq("l'insieme è diverso: riprende a stampare", true, terzoGiro.length > 0);
  eq("e si vede il problema nuovo", true, messaggioDi(terzoGiro).includes("de-DE"));
}

// ------------------------------------------------------- niente da dire
console.log("\n== nessun report: flush non stampa niente ==");
{
  const baseDir = baseDirUsaEGetta();
  const reporter = creaReporter({ baseDir, cliName: "vtranslate-cli" });
  const righe = grezzo(() => reporter.flush());
  eq("zero righe", 0, righe.length);
}

// ------------------------------------------------------- persistenza in session.json
console.log("\n== la firma stampata finisce in session.json ==");
{
  const { mkdirSync } = await import("node:fs");
  const baseDir = baseDirUsaEGetta();
  mkdirSync(join(baseDir, "node_modules"), { recursive: true }); // altrimenti writeSession si arrende
  const reporter = creaReporter({ baseDir, cliName: "vtranslate-cli" });

  reporter.report("parse-failed", "x.jsx could not be parsed");
  grezzo(() => reporter.flush());

  const s = readSession(baseDir);
  eq("lastDevWarnings.signature scritta", true, typeof s?.lastDevWarnings?.signature === "string" && s.lastDevWarnings.signature.length > 0);
  eq("lastDevWarnings.count", 1, s?.lastDevWarnings?.count);
}

console.log("\n== \"same as the previous session\": firma persistita = firma di oggi ==");
{
  const { mkdirSync } = await import("node:fs");
  const baseDir = baseDirUsaEGetta();
  mkdirSync(join(baseDir, "node_modules"), { recursive: true });

  // Prima "sessione" (primo reporter, come un primo `vite dev`): due avvisi nella stessa
  // categoria, uno nascosto -> lascia una riga di rimando e la sua firma in session.json.
  const primaSessione = creaReporter({ baseDir, cliName: "vtranslate-cli" });
  primaSessione.report("empty-language-file", "es-ES.yml è vuoto");
  primaSessione.report("empty-language-file", "es-ES.yml è vuoto 2");
  grezzo(() => primaSessione.flush());

  // Seconda "sessione" (nuovo reporter = nuovo processo `vite dev`, stessi problemi): la prima
  // stampa di un processo nuovo non si sopprime mai, ma la riga di rimando si qualifica.
  const secondaSessione = creaReporter({ baseDir, cliName: "vtranslate-cli" });
  secondaSessione.report("empty-language-file", "es-ES.yml è vuoto");
  secondaSessione.report("empty-language-file", "es-ES.yml è vuoto 2");
  const righe = grezzo(() => secondaSessione.flush());

  eq("un processo nuovo stampa comunque", true, righe.length > 0);
  eq("ma la riga di rimando dice che sono gli stessi di ieri", true, messaggioDi(righe).includes("same as the previous session"));
}

// ------------------------------------------------------- il giro si chiude da solo
// La sola cosa che fa uscire gli avvisi in `vite dev`: lì nessuno chiama flush() — `buildEnd`
// non scatta e il modulo virtuale si rigenera solo quando cambia l'insieme delle lingue — e
// senza questo timer tutto ciò che i transform raccolgono resta dentro il raccoglitore.
console.log("\n== nessuno chiama flush: il raccoglitore lo fa da sé ==");
{
  const baseDir = baseDirUsaEGetta();
  const reporter = creaReporter({ baseDir, cliName: "vtranslate-cli", ritardoMs: 30 });

  const righe = await grezzoAsincrono(async () => {
    reporter.report("malformed", "App.jsx: marcatore malformato");
    reporter.report("malformed", "Altro.jsx: marcatore malformato");
    await attendi(120);
  });

  const testo = messaggioDi(righe);
  eq("stampa senza che nessuno chiami flush", true, testo.includes("App.jsx"));
  eq("la raffica resta un blocco solo", true, testo.includes("+1 more"));
}

console.log("\n== la raffica riarma il timer: un blocco, non tre ==");
{
  const baseDir = baseDirUsaEGetta();
  const reporter = creaReporter({ baseDir, cliName: "vtranslate-cli", ritardoMs: 60 });

  const righe = await grezzoAsincrono(async () => {
    // Tre avvisi a 40 ms l'uno dall'altro: nessun intervallo raggiunge i 60 del timer, quindi
    // il giro si chiude una volta sola, alla fine, con tutti e tre dentro.
    reporter.report("a", "primo");
    await attendi(40);
    reporter.report("b", "secondo");
    await attendi(40);
    reporter.report("c", "terzo");
    await attendi(150);
  });

  eq("un solo giro, con tutte le categorie", true,
    ["primo", "secondo", "terzo"].every((t) => messaggioDi(righe).includes(t)));
}

console.log("\n== flush esplicito: il timer non stampa una seconda volta ==");
{
  const baseDir = baseDirUsaEGetta();
  const reporter = creaReporter({ baseDir, cliName: "vtranslate-cli", ritardoMs: 30 });

  const righe = await grezzoAsincrono(async () => {
    reporter.report("parse-failed", "x.jsx could not be parsed");
    reporter.flush();      // com'è in build, da buildEnd
    await attendi(120);    // il timer, se fosse rimasto armato, scatterebbe qui
  });

  eq("una volta sola", 1, righe.filter((r) => soloTesto(r).includes("x.jsx")).length);
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
