// L'incolonnamento dell'output del comando di sync.
//
// Sembra estetica e non lo è: l'unica cosa che rende leggibile una sincronizzazione è che
// tutti i messaggi comincino nella stessa colonna. Basta un percorso assoluto — o il testo di
// un marcatore, che è scritto dall'utente e lungo a piacere — perché una riga esca dal
// riquadro e si porti dietro la percezione che sia successo qualcos'altro, di un altro
// programma. Qui si verifica che nessuna riga sfondi i 120 e che le continuazioni restino
// riconoscibili come tali.
//
//   node test/list/logFormat.test.mjs
import { join, sep } from "node:path";
import { wrapLog, displayWidth, logEchoColored, logWarning, logError, colorize, LOG_WIDTH } from "../../lib/utility.js";
import shortPath from "../../lib/dev/vite/uty/shortPath.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

/** Le righe stampate da `fn`, con i colori ancora attaccati. */
function grezzo(fn) {
  const righe = [];
  const vero = console.log;
  console.log = (r) => righe.push(String(r));
  try { fn(); } finally { console.log = vero; }
  return righe;
}
const senzaColori = (righe) => righe.map((r) => r.replace(/\x1b\[[0-9;]*m/g, ""));

/** Le righe che logEchoColored stamperebbe, senza i colori: quello che si vede davvero. */
const stampato = (msg, text) => senzaColori(grezzo(() => logEchoColored(msg, text)));

// ------------------------------------------------------- larghezza
console.log("\n== nessuna riga esce dai 120 ==");
{
  const percorso = "D:\\L\\workSpaceReact\\progetti\\_vite\\Translate_02\\playEdge\\src\\testCases.jsx";
  const righe = stampato("vtranslate-cli",
    `nested markers in "${percorso}": "uno_%_ e _%_due" was read as a single text. ` +
    "A marker must wrap the whole string — split it into separate <Translate> or ts() calls.");

  eq("è andato a capo", true, righe.length > 1);
  eq("nessuna riga oltre il limite", 0, righe.filter((r) => displayWidth(r) > LOG_WIDTH).length);
  // Il caso che ha fatto nascere questo test: senza a capo la riga era una sola, lunghissima.
  eq("e nemmeno il testo tutto attaccato", true, righe.every((r) => displayWidth(r) <= LOG_WIDTH));
}

console.log("\n== le continuazioni restano nella colonna ==");
{
  const righe = stampato("updateLanguage", "parola ".repeat(40).trim());
  const colonna = (r) => r.indexOf("║");

  eq("tutte le righe hanno il montante", true, righe.every((r) => colonna(r) > 0));
  eq("nella stessa colonna", 1, new Set(righe.map(colonna)).size);
  // L'etichetta la porta solo la prima: le altre sono la stessa cosa che continua.
  eq("etichetta solo sulla prima", true, righe[0].includes("updateLanguage"));
  eq("non ripetuta sotto", false, righe.slice(1).some((r) => r.includes("updateLanguage")));
  // Rientro di due: senza, una riga spezzata sarebbe indistinguibile da un messaggio nuovo.
  const dopoMontante = (r) => r.slice(colonna(r) + 1);
  eq("le continuazioni rientrano", true, dopoMontante(righe[1]).startsWith("    "));
  eq("la prima no", false, dopoMontante(righe[0]).startsWith("    "));
}

console.log("\n== un messaggio corto resta una riga sola ==");
{
  const righe = stampato("updateLanguage", "Source language loaded.");
  eq("una riga", 1, righe.length);
  eq("col testo intatto", true, righe[0].endsWith("Source language loaded."));
}

// ------------------------------------------------------- wrapLog
console.log("\n== wrapLog: dove taglia ==");
{
  eq("va a capo sugli spazi", "ab|cd", wrapLog("ab cd", 3, 3).join("|"));
  eq("non lascia spazi in coda", "abc|def", wrapLog("abc def", 3, 3).join("|"));
  // Una parola più larga della colonna non ha un punto in cui andare a capo: si taglia, perché
  // l'alternativa è sfondare la larghezza proprio sui percorsi lunghi, che sono il caso vero.
  eq("spezza la parola troppo lunga", "abc|def|gh", wrapLog("abcdefgh", 3, 3).join("|"));
  eq("gli a capo già scritti restano", 2, wrapLog("uno\ndue", 40, 40).length);
  eq("testo vuoto: una riga vuota", 1, wrapLog("", 40, 40).length);
  // Una riga che ci sta passa com'è, spazi interni compresi. Il ciclo a parole li ridurrebbe
  // a uno solo, e le righe del rapporto di --status sono incolonnate proprio con quelli:
  // mandarle qui dentro voleva dire vedere la tabella sfasciarsi senza un errore da nessuna parte.
  eq("gli spazi di allineamento sopravvivono", "it-IT      53    0  ok", wrapLog("it-IT      53    0  ok", 40, 40).join("|"));
  eq("e anche il rientro a sinistra", "      sotto", wrapLog("      sotto", 40, 40).join("|"));
}

console.log("\n== larghezza da terminale, non da String.length ==");
{
  // Il motivo per cui displayWidth esiste: i nomi delle lingue nella loro lingua. Contare i
  // code unit sfalsa le colonne proprio sulle lingue per cui questa libreria esiste.
  eq("il CJK conta doppio", 12, displayWidth("中文（中国）"));
  eq("l'ASCII conta uno", 6, displayWidth("italia"));
  eq("gli accenti contano uno", 8, displayWidth("français"));
  eq("e wrapLog lo rispetta", 2, wrapLog("中文中文", 4, 4).length);
  // I colori non occupano colonne: contarli farebbe risultare una cella colorata larga il
  // doppio, e a sfasarsi sarebbe la tabella intera intorno a lei.
  eq("le sequenze ANSI non contano", 5, displayWidth(colorize("ok", "it-IT")));
  eq("una cella colorata non manda a capo", 1, wrapLog(`${colorize("error", "it-IT")}  rotto`, 20, 20).length);
}

// ------------------------------------------------------- warning ed error
console.log("\n== WARNING ed ERROR si trovano senza leggere ==");
{
  // Sono le due righe che si cercano scorrendo l'output con l'occhio, in mezzo a venti righe
  // tutte uguali di una sincronizzazione andata bene: colore sull'etichetta e stacco sopra.
  const avviso = grezzo(() => logWarning("qualcosa non va, ma si va avanti"));
  const errore = grezzo(() => logError("qualcosa non va e basta"));
  const vuota = (righe) => senzaColori(righe)[0].split("║")[1].trim();

  eq("l'avviso apre con una riga vuota", "", vuota(avviso));
  eq("e la riga vuota tiene la colonna", true, senzaColori(avviso)[0].includes("║"));
  eq("l'etichetta dice WARNING", true, senzaColori(avviso)[1].includes("WARNING"));
  eq("in arancione", true, avviso[1].includes("\x1b[1;38;5;208m"));

  eq("l'errore apre con una riga vuota", "", vuota(errore));
  eq("l'etichetta dice ERROR", true, senzaColori(errore)[1].includes("ERROR"));
  eq("in rosso", true, errore[1].includes("\x1b[1;31m"));

  // Il contrario, che è la metà che conta: una riga normale non deve staccare niente,
  // altrimenti l'output di una sincronizzazione riuscita diventa tutto spaziatura.
  const normale = grezzo(() => logEchoColored("updateLanguage", "Source language loaded."));
  eq("una riga normale non stacca", 1, normale.length);
  eq("e resta tenue", true, normale[0].includes("\x1b[2m"));
  eq("senza colori d'allarme", false, normale[0].includes("38;5;208") || normale[0].includes("1;31"));
}

// ------------------------------------------------------- percorsi
console.log("\n== i percorsi si scrivono relativi alla radice ==");
{
  // Due cose insieme: la riga si accorcia (un percorso assoluto ne mangia metà, e la parte
  // che interessa — quale file — sta in fondo) e il terminale di VS Code ci mette sotto il
  // link, perché lo risolve contro la propria cwd. Da cui la scelta di `process.cwd()` come
  // radice: relativizzare contro un'altra cartella darebbe un percorso corto e un link rotto.
  const root = join(sep, "progetto");
  eq("dentro la radice: relativo", "src/locale/it-IT.yml", shortPath(join(root, "src", "locale", "it-IT.yml"), root));
  eq("sempre con /", true, !shortPath(join(root, "src", "App.jsx"), root).includes("\\"));
  eq("una cartella si accorcia uguale", "src/locale", shortPath(join(root, "src", "locale"), root));

  // Fuori dal progetto accorciare non accorcia: darebbe un "../../.." lungo uguale e ambiguo
  // su dove sia il file. L'assoluto è comunque un link.
  const fuori = join(sep, "altrove", "file.yml");
  eq("fuori dalla radice: assoluto", fuori, shortPath(fuori, root));
  eq("la radice stessa: assoluta", root, shortPath(root, root));
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
