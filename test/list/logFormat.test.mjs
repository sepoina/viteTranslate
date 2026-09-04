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
import { wrapLog, displayWidth, logEchoColored, logWarning, logError, logRule, logHeader, logBullet, colorize, LOG_WIDTH, setLogStyle, isSimpleLog } from "../../lib/utility.js";
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

// ------------------------------------------------------- traverse e intestazione
console.log("\n== la traversa non spezza il montante ==");
{
  // Il punto della traversa: separare i blocchi SENZA usare la riga vuota, che è già presa —
  // è il modo in cui un avviso si annuncia. Se il "╟" non cadesse nella colonna del "║", la
  // verticale che tiene insieme tutto l'output si spezzerebbe proprio sui separatori.
  const normale = senzaColori(grezzo(() => logEchoColored("x", "y")))[0];
  const traversa = senzaColori(grezzo(() => logRule()))[0];

  eq("il ╟ è nella colonna del ║", normale.indexOf("║"), traversa.indexOf("╟"));
  // La larghezza esatta, non solo il limite: la traversa è l'unica riga che arriva fino in
  // fondo, quindi è quella che denuncia subito se il filetto e LOG_WIDTH divergono. Scritti
  // come due numeri indipendenti lo erano già: 76 su una riga da 100 sfondava di due colonne.
  eq("arriva esattamente a LOG_WIDTH", LOG_WIDTH, displayWidth(traversa));
  eq("la traversa può nominare il blocco", true, senzaColori(grezzo(() => logRule("viteTranslate")))[0].includes("viteTranslate"));

  const testa = senzaColori(grezzo(() => logHeader("viteTranslate", "v4.0.2", "source: \"src\"")));
  eq("l'intestazione è tre righe", 3, testa.length);
  eq("apre con la traversa che porta il nome", true, testa[0].includes("╟") && testa[0].includes("viteTranslate"));
  eq("la versione sta nella colonna dell'etichetta", true, testa[1].split("║")[0].includes("v4.0.2"));
  eq("e il testo dopo il montante", true, testa[1].split("║")[1].includes('source: "src"'));
  eq("chiude con una traversa", true, testa[2].includes("╟"));
  eq("le tre righe restano incolonnate", 1, new Set(testa.map((r) => Math.max(r.indexOf("║"), r.indexOf("╟")))).size);
  // Senza versione l'intestazione non lascia un glifo appeso, che si leggerebbe come un dato
  // mancante. Il confronto è con la colonna di una riga a etichetta vuota invece che con una
  // stringa scritta qui: così non dà per scontato di cosa sia fatto il prefisso a sinistra.
  const etichettaDi = (r) => r.split("║")[0];
  const vuota = etichettaDi(senzaColori(grezzo(() => logEchoColored("", "y")))[0]);
  eq("versione assente: etichetta vuota", vuota, etichettaDi(senzaColori(grezzo(() => logHeader("x", "", "y")))[1]));
}

console.log("\n== dove separa già una traversa, l'avviso non stacca ==");
{
  // Due separatori di fila spendono una riga per fare un segnale più debole, non più forte.
  const conStacco = grezzo(() => logWarning("attenzione"));
  const senzaStacco = grezzo(() => logWarning("attenzione", { stacco: false }));

  eq("il default stacca ancora", 2, conStacco.length);
  eq("con stacco: false è una riga sola", 1, senzaStacco.length);
  eq("ma resta un WARNING acceso", true, senzaColori(senzaStacco)[0].includes("WARNING"));
  eq("e vale anche per ERROR", 1, grezzo(() => logError("rotto", { stacco: false })).length);
}

// ------------------------------------------------------- percorsi
console.log("\n== i percorsi si scrivono relativi alla radice ==");
{
  // Due cose insieme: la riga si accorcia (un percorso assoluto ne mangia metà, e la parte
  // che interessa — quale file — sta in fondo) e il terminale di VS Code ci mette sotto il
  // link, perché lo risolve contro la propria cwd. Da cui la scelta di `process.cwd()` come
  // radice: relativizzare contro un'altra cartella darebbe un percorso corto e un link rotto.
  const root = join(sep, "progetto");
  eq("dentro la radice: relativo", "locale/it-IT.yml", shortPath(join(root, "locale", "it-IT.yml"), root));
  eq("sempre con /", true, !shortPath(join(root, "src", "App.jsx"), root).includes("\\"));
  eq("una cartella si accorcia uguale", "locale", shortPath(join(root, "locale"), root));
  eq("più livelli, un solo separatore per livello", "src/components/ui/Bottone.jsx",
    shortPath(join(root, "src", "components", "ui", "Bottone.jsx"), root));

  // Fuori dal progetto accorciare non accorcia: darebbe un "../../.." lungo uguale e ambiguo
  // su dove sia il file. L'assoluto è comunque un link.
  const fuori = join(sep, "altrove", "file.yml");
  eq("fuori dalla radice: assoluto", fuori, shortPath(fuori, root));
  eq("la radice stessa: assoluta", root, shortPath(root, root));
}

// ------------------------------------------------------- logBullet
console.log("\n== logBullet: in rich mode è logEchoColored(\"\", \"- \" + msg) ==");
{
  const a = senzaColori(grezzo(() => logBullet("qualcosa da vedere")));
  const b = senzaColori(grezzo(() => logEchoColored("", "- qualcosa da vedere")));
  eq("stesso output di prima", b.join("\n"), a.join("\n"));
}

// ------------------------------------------------------- simple mode
console.log("\n== simple mode: niente montanti, tutto comincia con ::: ==");
try {
  setLogStyle({ simple: true });
  eq("isSimpleLog() lo dice", true, isSimpleLog());

  {
    const righe = senzaColori(grezzo(() => logEchoColored("updateLanguage", "parola ".repeat(40).trim())));
    eq("niente montante ║", 0, righe.filter((r) => r.includes("║")).length);
    eq("niente traversa ╟", 0, righe.filter((r) => r.includes("╟")).length);
    eq("ogni riga comincia con :::", true, righe.every((r) => r.startsWith(":::")));
    eq("nessuna riga oltre LOG_WIDTH", 0, righe.filter((r) => displayWidth(r) > LOG_WIDTH).length);
  }

  eq("etichetta: riga propria, indent 0", "::: WARNING",
    senzaColori(grezzo(() => logWarning("qualcosa", { stacco: false })))[0]);
  eq("riga normale: indent 2", ":::   testo",
    senzaColori(grezzo(() => logEchoColored("", "testo")))[0]);
  eq("puntato: indent 4, col trattino", ":::     - testo",
    senzaColori(grezzo(() => logBullet("testo")))[0]);
  eq("traversa senza etichetta: nuda", ":::",
    senzaColori(grezzo(() => logRule()))[0]);
  eq("traversa con etichetta: come un'etichetta", "::: X",
    senzaColori(grezzo(() => logRule("X")))[0]);

  {
    const testa = senzaColori(grezzo(() => logHeader("viteTranslate", "v9.9.9", "sources: \"src\"")));
    eq("l'intestazione è due righe, non tre", 2, testa.length);
    eq("nome e versione su una riga sola", "::: viteTranslate v9.9.9", testa[0]);
    eq("la riga delle cartelle a indent 0", "::: sources: \"src\"", testa[1]);
  }
} finally {
  // Rischio noto: `setLogStyle` è stato di modulo, non un parametro. Se questo blocco
  // lasciasse simpleLog acceso e un'asserzione sopra fallisse a metà, ogni test scritto DOPO
  // in questo stesso file (e chiunque lo importi da un altro script) erediterebbe la forma
  // sbagliata senza che nulla lo dica.
  setLogStyle({ simple: false });
}
eq("torna in rich mode dopo il finally", false, isSimpleLog());

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
