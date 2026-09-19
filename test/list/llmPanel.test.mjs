// Il pannello delle richieste LLM (requestPanel.js) e la regione che si riscrive sul posto
// (liveRegion.js). Nessun terminale vero: uno `stream` finto che raccoglie quello che gli si
// scrive, e un emulatore minimo che lo ripassa — le sole sequenze che la regione usa — per
// guardare lo schermo che ne esce invece dei byte. Un orologio finto al posto di Date.now.
//
//   node test/list/llmPanel.test.mjs
import { displayWidth, logTextWidth, setLogStyle } from "../../lib/utility.js";
import createLiveRegion, { isLiveTerminal } from "../../lib/dev/llm/liveRegion.js";
import createRequestPanel, { shortReason } from "../../lib/dev/llm/requestPanel.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const senzaColori = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

/** Uno stdout finto, da terminale: raccoglie ogni `write`. */
function terminale({ columns = 100, rows = 30 } = {}) {
  const scritti = [];
  return { isTTY: true, columns, rows, scritti, write: (s) => { scritti.push(s); return true; } };
}

/**
 * Lo schermo che quei byte lasciano: "\r", "\n", "su di N" (CSI N A), "cancella la riga"
 * (CSI 2K), "cancella fino in fondo" (CSI 0J). I colori si tolgono. Una cella per carattere:
 * basta a confrontare testi, non a misurare colonne — per quelle c'è displayWidth.
 */
function schermo(scritti) {
  const dati = senzaColori(scritti.join(""));
  const righe = [""];
  let r = 0, c = 0;
  for (let i = 0; i < dati.length; i++) {
    const m = /^\x1b\[(\d*)([AJK])/.exec(dati.slice(i, i + 8));
    if (m) {
      if (m[2] === "A") r = Math.max(0, r - Number(m[1] || 1));
      if (m[2] === "K") righe[r] = "";
      if (m[2] === "J") { righe[r] = righe[r].slice(0, c); righe.length = r + 1; }
      i += m[0].length - 1;
      continue;
    }
    const ch = dati[i];
    if (ch === "\r") c = 0;
    else if (ch === "\n") { r++; c = 0; if (r === righe.length) righe.push(""); }
    else { righe[r] = righe[r].padEnd(c).slice(0, c) + ch + righe[r].slice(c + 1); c++; }
  }
  return righe.filter((riga, i) => riga !== "" || i < righe.length - 1);
}

/** Quello che `fn` stampa con console.log, riga per riga, senza colori. */
function stampato(fn) {
  const righe = [];
  const vero = console.log;
  console.log = (s) => righe.push(senzaColori(String(s)));
  try { fn(); } finally { console.log = vero; }
  return righe;
}

const MAI = 1e9; // un timer che nel tempo di un test non scatta

// ------------------------------------------------------- liveRegion: la meccanica
console.log("\n== liveRegion: disegna, riscrive sul posto, si cancella ==");
{
  const t = terminale();
  let testo = ["uno", "due", "tre"];
  const regione = createLiveRegion({ render: () => testo, label: "llm", stream: t, intervalMs: MAI });
  eq("il primo disegno non risale", false, /^\x1b\[\d+A/.test(t.scritti[0]));
  eq("tre righe a schermo", 3, schermo(t.scritti).length);
  eq("l'etichetta solo sulla prima", [true, false, false], schermo(t.scritti).map((r) => r.includes("llm")));

  testo = ["uno"];
  regione.update();
  eq("il ridisegno risale di quante ne aveva scritte", true, t.scritti.at(-1).startsWith("\x1b[3A"));
  eq("una riga in meno: sotto non resta niente", ["uno"], schermo(t.scritti).map((r) => r.split("║")[1].trim()));

  testo = ["a", "b", "c", "d"];
  regione.update();
  eq("una in più: ci sono tutte", ["a", "b", "c", "d"], schermo(t.scritti).map((r) => r.split("║")[1].trim()));

  regione.stop();
  eq("stop: lo schermo torna vuoto", [], schermo(t.scritti));
  const dopo = t.scritti.length;
  regione.update();
  regione.stop();
  eq("dopo stop non scrive più niente", dopo, t.scritti.length);
  // Per un terminale "su di 0" vale "su di 1": risalirebbe su una riga non nostra.
  eq("mai \"su di 0\"", false, t.scritti.join("").includes("\x1b[0A"));
}

console.log("\n== liveRegion: mai più larga né più alta del terminale ==");
{
  const t = terminale({ columns: 40, rows: 6 });
  let ricevuto;
  const regione = createLiveRegion({
    render: (p) => { ricevuto = p; return ["parola ".repeat(30), "日本語".repeat(20)]; },
    label: "llm", stream: t, intervalMs: MAI,
  });
  regione.stop();
  const righe = t.scritti[0].split("\n").slice(0, -1).map(senzaColori).map((r) => r.replace(/^\r?\x1b\[2K/, ""));
  eq("ogni riga entro columns - 1", true, righe.every((r) => displayWidth(r) <= 39));
  eq("maxLines = rows - 1", 5, ricevuto.maxLines);
  eq("width = il testo che ci sta in quel terminale", logTextWidth(39), ricevuto.width);
  try {
    setLogStyle({ simple: true });
    const t2 = terminale({ rows: 6 });
    createLiveRegion({ render: (p) => { ricevuto = p; return ["x"]; }, label: "llm", stream: t2, intervalMs: MAI }).stop();
    eq("simple: l'etichetta ha la sua riga, una in meno", 4, ricevuto.maxLines);
  } finally {
    setLogStyle({ simple: false });
  }
}

console.log("\n== liveRegion: il timer fa avanzare tick, update no ==");
{
  const t = terminale();
  const ticks = [];
  const regione = createLiveRegion({ render: ({ tick }) => { ticks.push(tick); return ["x"]; }, stream: t, intervalMs: 5 });
  regione.update();
  eq("update non muove tick", [0, 0], ticks.slice(0, 2));
  await new Promise((r) => setTimeout(r, 60));
  regione.stop();
  eq("il timer sì", true, ticks.at(-1) >= 1);
  const dopo = t.scritti.length;
  await new Promise((r) => setTimeout(r, 30));
  eq("stop ferma anche il timer", dopo, t.scritti.length);
}

console.log("\n== liveRegion: chi stampa nel frattempo finisce sopra ==");
{
  // Le asserzioni dopo, fuori: dentro, anche le righe "ok" di `eq` finirebbero nel raccoglitore.
  const t = terminale();
  const raccolti = [];
  const vero = console.log;
  const raccogli = (s) => raccolti.push(s);
  let prima, schermoDopo, restituito;
  console.log = raccogli;
  try {
    const regione = createLiveRegion({ render: () => ["a", "b"], stream: t, intervalMs: MAI, patchConsole: true });
    prima = t.scritti.length;
    console.log("avviso");
    schermoDopo = schermo(t.scritti).length;
    regione.stop();
    restituito = console.log === raccogli;
  } finally {
    console.log = vero;
  }
  eq("la riga è arrivata", ["avviso"], raccolti);
  eq("prima si toglie la regione", "\x1b[2A\r\x1b[0J", t.scritti[prima]);
  eq("poi si ridisegna", 2, schermoDopo);
  eq("stop rimette a posto console.log", true, restituito);
}

console.log("\n== isLiveTerminal ==");
{
  eq("un TTY sì", true, isLiveTerminal({ isTTY: true }, {}));
  eq("TERM=dumb no", false, isLiveTerminal({ isTTY: true }, { TERM: "dumb" }));
  eq("una pipe no", false, isLiveTerminal({ isTTY: false }, {}));
  eq("niente stream, no", false, isLiveTerminal(undefined, {}));
}

// ------------------------------------------------------- requestPanel: i testi
console.log("\n== shortReason: perché, in due parole ==");
{
  eq("un troncamento, prima di tutto il resto", "truncated", shortReason(Object.assign(new Error("openai-chat reply truncated: max_tokens reached"), { truncated: true, status: 200 })));
  eq("uno status HTTP", "HTTP 429", shortReason({ status: 429, message: "x" }));
  eq("un timeout", "timeout", shortReason(new Error("openai-chat request to http://x failed: The operation was aborted due to timeout")));
  eq("una risposta non JSON", "reply not JSON", shortReason(new Error("openai-chat reply was not a JSON object: ...")));
  eq("la rete", "network error", shortReason(new Error("openai-chat request to http://x failed: fetch failed")));
  eq("un errore qualunque: niente", null, shortReason(new Error("boom")));
  eq("nessun errore: niente", null, shortReason(undefined));
}

const PREZZI = { costMillionInput: 0.6, costMillionOutput: 1.2, costUnity: "$" };
const USAGE = { tokensIn: 1000, tokensOut: 2000 }; // 0.0006 + 0.0024 = $0.0030

/** Un pannello senza terminale e un orologio che avanza solo quando lo si dice. */
function pannello(opzioni = {}) {
  const orologio = { t: 0 };
  const p = createRequestPanel({
    sourceTag: "it-IT", tags: ["de-DE", "fr-FR", "ja-JP"], connection: PREZZI, live: false,
    now: () => orologio.t, ...opzioni,
  });
  return { p, orologio };
}

console.log("\n== requestPanel: il log finale, una riga per connessione, con la coda ==");
{
  const { p, orologio } = pannello();
  const de = p.open({ tag: "de-DE", count: 6 });
  const fr = p.open({ tag: "fr-FR", count: 6 });
  const ja = p.open({ tag: "ja-JP", count: 6 });
  orologio.t = 3000;
  de.done({ filled: 6, rejected: 0, missing: 0, unknown: 0 }, USAGE);
  fr.done({ filled: 4, rejected: 1, missing: 1, unknown: 0 }, USAGE);
  orologio.t = 12000;
  ja.fail(Object.assign(new Error("unauthorized"), { status: 401 }));
  const righe = stampato(() => p.finish());

  eq("una riga per connessione", 3, righe.length);
  eq("etichetta LLM sulla prima", true, righe[0].includes(" LLM ") && !righe[1].includes(" LLM "));
  eq("completa: la coda", true, righe[0].includes("✔ < 6 new keys Deutsch. completed / 3s."));
  eq("parziale: cosa manca, e la coda", true, righe[1].includes("✔ < 4 new keys français. 1 rejected / 1 not returned / 3s."));
  eq("errore: il testo e la coda", true, righe[2].includes("✖ - error 日本語 (HTTP 401) / see trace in debug mode / 12s."));
  // Niente più colonna a destra: né costo per richiesta, né secondi incolonnati, né
  // "Full translate!" (lo dice la coda).
  eq("nessun costo per riga", false, righe.some((r) => r.includes("$")));
  eq("niente 'Full translate!' nel log finale", false, righe.some((r) => r.includes("Full translate!")));
  eq("ogni riga chiude con un punto", true, righe.every((r) => r.trimEnd().endsWith(".")));

  eq("finish una volta sola", [], stampato(() => p.finish()));
}

console.log("\n== requestPanel: le altre forme di riga ==");
{
  const riga = (fn, opzioni) => {
    const { p } = pannello(opzioni);
    fn(p);
    return stampato(() => p.finish());
  };
  const colore = (fn) => {
    const { p } = pannello();
    fn(p);
    const grezze = [];
    const vero = console.log;
    console.log = (s) => grezze.push(String(s));
    try { p.finish(); } finally { console.log = vero; }
    return grezze[0];
  };

  eq("contesto", true, riga((p) => p.open({ kind: "context", count: 8 }).done({ lines: 24 }, USAGE))[0]
    .includes("✔ < context abstract, 24 lines. completed / 0s."));
  eq("riparazione completa", true, riga((p) => p.open({ kind: "repair", tag: "de-DE", count: 2 })
    .done({ filled: 2, rejected: 0, missing: 0, unknown: 0 }, USAGE))[0].includes("✔ < 2 keys repaired Deutsch. completed / 0s."));
  eq("riparazione fallita", true, riga((p) => p.open({ kind: "repair", tag: "de-DE", count: 1 })
    .done({ filled: 0, rejected: 1, missing: 0, unknown: 0 }, USAGE))[0].includes("✔ < 0 keys repaired Deutsch. 1 still rejected / 0s."));
  eq("singolare", true, riga((p) => p.open({ tag: "de-DE", count: 1 })
    .done({ filled: 1, rejected: 0, missing: 0, unknown: 0 }, USAGE))[0].includes("< 1 new key Deutsch. completed / 0s."));
  eq("chiavi sconosciute", true, riga((p) => p.open({ tag: "de-DE", count: 2 })
    .done({ filled: 2, rejected: 0, missing: 0, unknown: 1 }, USAGE))[0].includes("1 unknown key ignored / 0s."));
  eq("completa: segno verde", true, colore((p) => p.open({ tag: "de-DE", count: 1 })
    .done({ filled: 1, rejected: 0, missing: 0, unknown: 0 }, USAGE)).includes("\x1b[32m✔"));
  eq("incompleta: segno arancione", true, colore((p) => p.open({ tag: "de-DE", count: 2 })
    .done({ filled: 1, rejected: 1, missing: 0, unknown: 0 }, USAGE)).includes("\x1b[1;38;5;208m✔"));
  eq("con --llm-debug: rimanda alla trace che c'è", true, riga((p) => p.open({ tag: "de-DE", count: 1 })
    .fail(new Error("boom")), { traced: true })[0].includes("✖ - error Deutsch / see the debug trace / 0s."));
  eq("senza usage: la riga chiude comunque", true, riga((p) => p.open({ tag: "de-DE", count: 1 })
    .done({ filled: 1, rejected: 0, missing: 0, unknown: 0 }, null))[0].includes("completed / 0s."));
  eq("lingua ancora da finire: quante ne mancano", true, riga((p) => p.open({ tag: "de-DE", count: 50 })
    .done({ filled: 50, rejected: 0, missing: 0, unknown: 0, remaining: 178 }, USAGE))[0].includes("✔ < 50 new keys Deutsch. 178 to do / 0s."));
  eq("lingua completa: Full translate!", true, riga((p) => p.open({ tag: "de-DE", count: 28 })
    .done({ filled: 28, rejected: 0, missing: 0, unknown: 0, remaining: 0 }, USAGE))[0].includes("✔ < 28 new keys Deutsch. Full translate! / 0s."));
  eq("da finire e con rifiuti", true, riga((p) => p.open({ tag: "de-DE", count: 3 })
    .done({ filled: 2, rejected: 1, missing: 0, unknown: 0, remaining: 5 }, USAGE))[0].includes("✔ < 2 new keys Deutsch. 5 to do / 1 rejected / 0s."));
  eq("mai risposta: niente spinner fermo", true, riga((p) => p.open({ tag: "de-DE", count: 3 }))[0]
    .includes("· > ask 3 keys italiano - Deutsch"));
  eq("lotto rimandato dopo una troncatura: il suo verbo", true, riga((p) => p.open({ kind: "split", tag: "fr-FR", count: 19 }))[0]
    .includes("· > split 19 keys italiano - français"));
  eq("lotto rimandato riuscito: chiavi nuove come un lotto qualunque", true, riga((p) => p.open({ kind: "split", tag: "fr-FR", count: 5 })
    .done({ filled: 5, rejected: 0, missing: 0, unknown: 0, remaining: 0 }, USAGE))[0].includes("✔ < 5 new keys français. Full translate! / 0s."));
  eq("troncata con coppie salvate: lo dice, e dice cosa manca", true, riga((p) => p.open({ tag: "fr-FR", count: 38 })
    .done({ filled: 33, rejected: 0, missing: 5, unknown: 0, remaining: 5, truncated: true }, USAGE))[0]
    .includes("✔ < 33 new keys français. 5 to do / truncated / 5 not returned / 0s."));
  const conNota = riga((p) => { p.open({ tag: "de-DE", count: 1 }).fail(new Error("x")); p.note("stopped sending"); });
  eq("una nota va in fondo", true, conNota.length === 2 && conNota[1].includes("stopped sending"));
  eq("nessuna connessione, niente log", [], riga(() => {}));
}

// ------------------------------------------------------- requestPanel dal vivo
console.log("\n== requestPanel dal vivo: spinner, secondi, retry, esito, poi il log ==");
{
  const t = terminale();
  const { p, orologio } = pannello({ live: true, stream: t });
  const de = p.open({ tag: "de-DE", count: 6 });
  const vivo = () => schermo(t.scritti).map((r) => r.split("║")[1]?.trim());
  eq("la domanda, con lo spinner", true, vivo()[0].startsWith("⠋ > ask 6 keys italiano - Deutsch"));
  eq("e i secondi", true, vivo()[0].endsWith("0s"));

  orologio.t = 3000;
  const fr = p.open({ tag: "fr-FR", count: 2 });
  eq("una riga per connessione", 2, vivo().length);
  eq("i secondi di chi aspetta da prima", true, vivo()[0].endsWith("3s"));

  fr.retry({ retry: 1, maxRetries: 3, error: { status: 429 } });
  eq("il retry, e perché", true, vivo()[1].includes("retry 1/3 after HTTP 429"));

  orologio.t = 5000;
  de.done({ filled: 6, rejected: 0, missing: 0, unknown: 0 }, USAGE);
  eq("l'esito al posto della domanda", true, vivo()[0].startsWith("✔ < 6 new keys Deutsch. Full translate!"));
  eq("dal vivo niente costi", false, vivo()[0].includes("$"));
  const it = p.open({ tag: "fr-FR", count: 50 });
  it.done({ filled: 50, rejected: 0, missing: 0, unknown: 0, remaining: 400 }, USAGE);
  eq("lotto pieno, lingua no: niente Full translate!", true, vivo().some((r) => r.startsWith("✔ < 50 new keys français. 400 to do")));
  eq("…e nessun Full translate! su quella riga", false, vivo().some((r) => r.startsWith("✔ < 50 new keys français.") && r.includes("Full translate!")));
  const rj = p.open({ tag: "fr-FR", count: 3 });
  rj.done({ filled: 2, rejected: 1, missing: 0, unknown: 0, remaining: 7 }, USAGE);
  eq("da finire e con rifiuti, dal vivo", true, vivo().some((r) => r.startsWith("✔ < 2 new keys français. 7 to do. 1 rejected")));
  fr.done({ filled: 2, rejected: 0, missing: 0, unknown: 0 }, USAGE);

  const log = stampato(() => p.finish());
  eq("finish: la regione sparisce", [], schermo(t.scritti));
  eq("e al suo posto il log, con la coda", true, log.length === 4 && log.every((r) => /\/ \d+s\.$/.test(r)));
}

console.log("\n== requestPanel dal vivo: più connessioni che righe ==");
{
  const t = terminale({ rows: 5 }); // 4 righe di regione
  const { p } = pannello({ live: true, stream: t });
  const aperte = ["de-DE", "fr-FR", "ja-JP", "de-DE", "fr-FR", "ja-JP"].map((tag) => p.open({ tag, count: 1 }));
  aperte[0].fail(new Error("x"));
  for (const r of aperte.slice(2, 5)) r.done({ filled: 1, rejected: 0, missing: 0, unknown: 0 }, USAGE);
  // In corso restano la 2 (fr-FR) e la 6 (ja-JP): devono vedersi entrambe, qualunque posto abbiano.
  const righe = schermo(t.scritti).map((r) => r.split("║")[1]?.trim());
  eq("mai più righe dello schermo", 4, righe.length);
  eq("la prima riassume le nascoste", true, righe[0].startsWith("… 3 more:") && righe[0].includes("1 failed"));
  eq("quelle in corso si vedono tutte", 2, righe.filter((r) => r.startsWith("⠋")).length);
  eq("il log finale invece le ha tutte", 6, stampato(() => p.finish()).length);
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
