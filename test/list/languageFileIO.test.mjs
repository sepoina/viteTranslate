// Come un file di lingua viene letto dal disco e riscritto: parseLanguageFile,
// readLanguageFile, splitAndSortEntries, serializeLanguageFile, stableStringify, updateKeys.
//
// Sono i pezzi che il comando di sincronizzazione mette in fila (vedi syncPipeline.test.mjs
// per il loro effetto d'insieme). Qui si guarda ciascuno da vicino, perché è il punto in cui
// una lettura sbagliata non produce un errore ma un contenuto plausibile e diverso: e a quel
// punto la riscrittura del file lo rende definitivo.
//
// Il blocco più importante è l'ultimo: il formato è un sottoinsieme STRETTO di YAML, e
// "stretto" vuol dire che tutto ciò che accettiamo un parser YAML vero lo legge allo stesso
// modo. È una promessa verificabile, non un commento, e lì viene verificata.
//
//   node test/list/languageFileIO.test.mjs
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import parseLanguageFile, { normalizeBuilder, ENTRY_RE } from "../../lib/dev/vite/uty/parseLanguageFile.js";
import readLanguageFile from "../../lib/dev/vite/uty/readLanguageFile.js";
import splitAndSortEntries from "../../lib/dev/vite/uty/splitAndSortEntries.js";
import serializeLanguageFile from "../../lib/dev/vite/uty/serializeLanguageFile.js";
import stableStringify from "../../lib/dev/vite/uty/stableStringify.js";
import updateKeys from "../../lib/dev/vite/uty/updateKeys.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function cartella() {
  const dir = mkdtempSync(join(tmpdir(), "vt-io-"));
  temporanee.push(dir);
  return dir;
}
const scrivi = (dir, nome, testo) => {
  const p = join(dir, nome);
  writeFileSync(p, testo, "utf8");
  return p;
};

/** Il messaggio dell'errore di parse, o "(nessun errore)" se non ne è stato lanciato. */
const errore = (testo) => {
  try {
    parseLanguageFile(testo, "x.yml");
    return "(nessun errore)";
  } catch (e) {
    return e.message;
  }
};
/** Il prefisso "line N:" del messaggio: è quello che il traduttore usa per trovare la riga. */
const rigaDi = (testo) => errore(testo).split(":")[0];

// Un file minimo valido a cui aggiungere la riga in prova, così il numero di riga conta davvero.
const CON = (...righe) => ['__builder__: {"v":1}', ...righe].join("\n");

// -------------------------------------------------------------------- forme accettate
console.log("\n== parseLanguageFile: le forme che il formato ammette ==");
{
  const t = parseLanguageFile(CON(
    "# un commento intero",
    "",
    'App_a: "Ciao"',
    "App_b: null",
    "App_c:",
    '   # un commento può essere indentato, una voce no',
    'App_d: "  spazi  interni  conservati  "',
  ), "x.yml");
  eq("chiavi lette", "App_a,App_b,App_c,App_d,__builder__", Object.keys(t).sort().join(","));
  eq("testo quotato", "Ciao", t.App_a);
  eq("null esplicito", "null", JSON.stringify(t.App_b));
  eq("chiave senza valore = null", "null", JSON.stringify(t.App_c));
  eq("spazi interni conservati", "  spazi  interni  conservati  ", t.App_d);
  eq("__builder__ come oggetto JSON", 1, t.__builder__.v);
}
{
  // Il file si edita su Windows quanto altrove: un "\r" rimasto in coda finirebbe dentro
  // l'ultimo valore, o farebbe fallire JSON.parse su una riga che a schermo è perfetta.
  const t = parseLanguageFile('__builder__: {"v":1}\r\nApp_a: "Ciao"\r\nApp_b: null\r\n', "x.yml");
  eq("CRLF: valore senza \\r in coda", "Ciao", t?.App_a);
  eq("CRLF: null resta null", "null", JSON.stringify(t?.App_b));
  const conBom = parseLanguageFile('\uFEFF__builder__: {"v":1}\nApp_a: "Ciao"\n', "x.yml");
  eq("BOM ignorato", "Ciao", conBom?.App_a);
}

// -------------------------------------------------------------------- forme rifiutate
console.log("\n== parseLanguageFile: cosa si rifiuta, e a quale riga ==");
{
  // Ogni riga qui sotto YAML la accetterebbe, dandole un significato diverso da quello che
  // il traduttore intendeva. Sono i casi per cui il parser è stretto invece che permissivo.
  const casi = [
    ["valore non quotato", CON("App_a: ciao come stai"), "unquoted value"],
    ["valore che comincia per %s", CON("App_a: %s e pronto"), "unquoted value"],
    ["valore con # in mezzo", CON("App_a: prezzo 5 # sconto"), "unquoted value"],
    ["numero non quotato", CON("App_a: 1.20"), "unquoted value"],
    ["lista", CON("App_a: [uno, due]"), "unquoted value"],
    ["manca lo spazio dopo i due punti", CON('App_a:"Ciao"'), "missing space"],
    ["riga indentata", CON('  App_a: "Ciao"'), "indented line"],
    ["oggetto su una chiave qualsiasi", CON('App_a: {"x":1}'), "only \"__builder__\""],
    ["testo quotato rotto", CON('App_a: "Ciao'), "invalid quoted text"],
    ["roba dopo la virgoletta di chiusura", CON('App_a: "Ciao" # nota'), "invalid quoted text"],
    ["riga che non è una voce", CON("questa non e' una voce"), "not an entry"],
  ];
  for (const [nome, testo, atteso] of casi) {
    eq(nome + " -> riga 2", "line 2", rigaDi(testo));
    eq(nome + " -> motivo", true, errore(testo).includes(atteso));
  }
}
{
  // Il traduttore che copia il blocco sotto il separatore e lo incolla tradotto sopra si
  // ritrova ogni chiave due volte. Un parser a righe farebbe vincere l'ultima in silenzio;
  // js-yaml stesso rifiuta i duplicati, e qui si fa lo stesso.
  const doppia = CON('App_a: "primo"', 'App_b: null', 'App_a: "secondo"');
  eq("chiave duplicata -> riga 4", "line 4", rigaDi(doppia));
  eq("...e dice dov'era la prima", true, errore(doppia).includes("already set at line 2"));
}
{
  // Il ciclo di parse non usa la regex (troppo lenta su una tabella grande) ma il confronto
  // sui codici dei caratteri. I due devono accettare esattamente le stesse righe: qui si
  // verifica che non abbiano cominciato a divergere.
  //
  // Solo la FORMA della riga (chiave, due punti, spazio): il valore è sempre valido, perché
  // le regole sul valore sono un'altra cosa e la regex non le descrive.
  const righe = [
    '__builder__: {"v":1}', 'App_a: "x"', 'App_a:', 'App_a:   "x"', 'App_a: null',
    'n404_ab12: "x"', 'my-component_xyz: "x"', 'a.b_c: "x"',
    'App_a:"x"', '  App_a: "x"', '9App_a: "x"', 'App a: "x"', 'App_a "x"', 'App$a: "x"', '', '# nota',
  ];
  const accettateDallaRegex = righe.filter((r) => r === "" || r.trimStart().startsWith("#") || ENTRY_RE.test(r));
  const accettateDalCiclo = righe.filter((r) => {
    try { parseLanguageFile(`${r}\nZ_z: "y"`, "x.yml"); return true; } catch { return false; }
  });
  eq("regex e ciclo accettano le stesse righe", accettateDallaRegex.join(" | "), accettateDalCiclo.join(" | "));
}
{
  // La scorciatoia che evita JSON.parse quando non ci sono escape deve valere ESATTAMENTE
  // quanto JSON.parse, o il formato cambia significato a seconda del contenuto del valore.
  const casi = [
    'testo semplice', 'con: due punti', 'con # cancelletto', 'con \\\\ backslash escapato',
    'con \\" virgolette escapate', 'a capo \\n dentro', 'tab \\t dentro', '', 'null', '   bordi   ',
  ];
  let divergenze = 0;
  for (const v of casi) {
    const riga = `App_a: "${v}"`;
    let nostro, json;
    try { nostro = JSON.stringify(parseLanguageFile(`${riga}\nZ_z: "y"`, "x.yml").App_a); } catch (e) { nostro = "ERR"; }
    try { json = JSON.stringify(JSON.parse(`"${v}"`)); } catch { json = "ERR"; }
    if (nostro !== json) { divergenze++; console.log("       divergenza su", JSON.stringify(v), nostro, "vs", json); }
  }
  eq("scorciatoia e JSON.parse danno lo stesso risultato", 0, divergenze);

  // Un TAB letterale dentro le virgolette: YAML lo accetta, JSON.parse no. La scorciatoia
  // non deve farlo passare per la porta di servizio.
  eq("tab letterale rifiutato come da JSON.parse", true, errore(CON('App_a: "a\tb"')).includes("invalid quoted text"));
  // Virgolette non escapate in mezzo: senza il controllo, `slice` restituirebbe un testo
  // plausibile e sbagliato invece di un errore.
  eq("virgolette interne non escapate rifiutate", true, errore(CON('App_a: "a" b "c"')).includes("invalid quoted text"));
  // `__proto__` non esce mai da sanitizeName, ma un file scritto a mano sì: assegnarlo non
  // creerebbe una proprietà e la voce sparirebbe senza un errore.
  eq("__proto__ rifiutato come chiave", true, errore(CON('__proto__: "x"')).includes("__proto__"));
}

// ------------------------------------------------------- malformazioni che non si vedono
console.log("\n== le rotture che passavano il parser e cadevano altrove ==");
{
  // Ogni nome che un oggetto ha GIÀ. `__proto__` era già rifiutato perché assegnarlo non crea
  // una proprietà; gli altri la creano, ma erano "presenti" ancora prima — e la sincronizzazione
  // decide con `chiave in tabella`, che guarda anche il prototipo. Una chiave `toString` in una
  // sub-lingua non risultava mai in eccesso, quindi non veniva mai tolta: restava nel file per
  // sempre. Nessuna di queste può uscire da sanitizeName: qui si chiude la porta.
  for (const chiave of ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"]) {
    eq(`"${chiave}" rifiutata come chiave`, true, errore(CON(`${chiave}: "x"`)).includes(chiave));
  }
  // Il nome ci somiglia ma è una chiave normale: non deve finire nella stessa rete.
  eq("una chiave che somiglia e basta passa", "x", parseLanguageFile(CON('toStringify_a1: "x"'), "x.yml").toStringify_a1);
}
{
  // `__builder__` è l'unica voce che il resto della libreria dereferenzia senza chiedere
  // permesso (`sourceTable.__builder__.v` quando genera una lingua nuova). Cancellarne il
  // valore a mano la lasciava passare come null: il file si leggeva benissimo, e la build
  // cadeva molto più tardi su un TypeError senza numero di riga.
  const casi = [
    ["__builder__ svuotato", "__builder__:"],
    ["__builder__ a null", "__builder__: null"],
    ["__builder__ come testo", '__builder__: "v1"'],
  ];
  for (const [nome, riga] of casi) {
    const testo = `${riga}\nApp_a: "x"`;
    eq(nome + " -> riga 1", "line 1", rigaDi(testo));
    eq(nome + " -> motivo", true, errore(testo).includes("must hold a JSON object"));
  }
  // E quello vero continua a passare.
  eq("__builder__ oggetto: nessun errore", 1, parseLanguageFile('__builder__: {"v":1}\nApp_a: "x"', "x.yml").__builder__.v);
}
{
  // Un file salvato in UTF-16 (il Blocco note di Windows alla voce "Unicode") letto come UTF-8
  // è il testo giusto con un NUL fra un carattere e l'altro: senza un controllo apposta
  // l'errore parlava di sintassi, e la causa — la codifica — non era indovinabile.
  const utf16 = Buffer.from('__builder__: {"v":1}\nApp_a: "Ciao"\n', "utf16le").toString("utf8");
  eq("UTF-16 riconosciuto per quello che è", true, errore(utf16).includes("not UTF-8 text"));
  eq("...e dice cosa fare", true, errore(utf16).includes("save it again as UTF-8"));
  eq("il numero di riga c'è comunque", "line 1", rigaDi(utf16));
  // Il NUL lo si trova ovunque sia, e la riga indicata e' la sua: su un file UTF-16 e'
  // sempre la prima, ma il conteggio non deve dipendere da quel caso.
  eq("riga del NUL, ovunque si trovi", "line 3", rigaDi(CON('App_a: "x"', 'App_b: "y\u0000"')));
}
{
  // Il messaggio d'errore esce a terminale e cita la riga che l'ha causato: una riga che
  // contiene una sequenza ANSI non deve poter ricolorare il messaggio o cancellarlo.
  const conAnsi = CON("\u001b[2K\u001b[31m non e' una voce");
  eq("nessun carattere di controllo nel messaggio", false, /[\u0000-\u001f]/.test(errore(conAnsi)));
  eq("ma la riga si riconosce lo stesso", true, errore(conAnsi).includes("non e' una voce"));
}

// ------------------------------------------------------------ vuoto contro svuotato
console.log("\n== un file vuoto è una lingua nuova; uno svuotato no ==");
{
  // Il modo documentato per aggiungere una lingua è creare il file vuoto e lanciare la sync.
  eq("file vuoto", undefined, parseLanguageFile("", "x.yml"));
  eq("file di soli spazi", undefined, parseLanguageFile("\n  \n\t", "x.yml"));

  // Ma un file che ha ancora l'intestazione e nessuna voce NON è una lingua nuova: è una
  // lingua svuotata a mano. Trattarlo come nuovo vorrebbe dire ripopolarlo di null senza
  // mettere al sicuro quello che c'era, e il backup non scatterebbe mai.
  eq("solo commenti -> errore, non lingua nuova", true, errore("# intestazione\n# rimasta sola\n").includes("no entry found"));

  const dir = cartella();
  eq("readLanguageFile su file vuoto", undefined, readLanguageFile(scrivi(dir, "en-US.yml", "")));
  eq("readLanguageFile normalizza __builder__", false, readLanguageFile(scrivi(dir, "fr-FR.yml", '__builder__: {"v":1}\nApp_a: "x"\n')).__builder__.incomplete);
}

// ------------------------------------------------------------------- scrittura
console.log("\n== serializeLanguageFile: quello che finisce sul disco ==");
{
  const testo = serializeLanguageFile({
    tag: "it-IT",
    isSource: true,
    translated: [["__builder__", { v: 1, languageName: "italiano", incomplete: true }], ["App_a", 'con "virgolette" e \\ backslash']],
    untranslated: [["App_b", null]],
    now: new Date(2026, 0, 2, 3, 4),
  });
  eq("intestazione a commento #", true, testo.startsWith("#  ---"));
  eq("nessuna riga di codice JS", false, testo.includes("export default"));
  eq("intestazione con il conteggio", true, /missing key: 1/.test(testo));
  eq("intestazione con la data al minuto", true, /processed: 2026-01-02 03:04/.test(testo));
  eq("marcata come lingua sorgente", true, testo.includes("(sourceLanguage)"));
  eq("incomplete: true resta scritto", true, testo.includes('"incomplete":true'));
  eq("separatore prima delle non tradotte", true, testo.indexOf("to be translated") < testo.indexOf("App_b"));
  eq("ogni voce a colonna 0", true, /^App_a: /m.test(testo) && !/^ +App_a:/m.test(testo));
  eq("__builder__ in JSON stretto", true, testo.includes('__builder__: {"v":1,"languageName":"italiano","incomplete":true}'));

  const riletto = parseLanguageFile(testo, "it-IT.yml");
  eq("round-trip del valore ostile", 'con "virgolette" e \\ backslash', riletto?.App_a);
  eq("round-trip del null", "null", JSON.stringify(riletto?.App_b));
}
{
  const testo = serializeLanguageFile({
    tag: "en-US",
    isSource: false,
    translated: [["__builder__", { v: 1, languageName: "English", incomplete: false }], ["App_a", "Hello"]],
    untranslated: [],
    now: new Date(2026, 0, 2, 3, 4),
  });
  eq("incomplete: false omesso su disco", false, testo.includes("incomplete"));
  eq("...e ripristinato in lettura", false, normalizeBuilder(parseLanguageFile(testo, "x.yml")).__builder__.incomplete);
  eq("nessun separatore se non manca nulla", false, testo.includes("to be translated"));
  eq("__builder__ separato dalle voci", true, /__builder__: .*\n#  -+\nApp_a:/.test(testo));
}

// --------------------------------------------------------- parità con un parser YAML vero
console.log("\n== quello che scriviamo è YAML, e YAML lo legge uguale ==");
{
  // La promessa del formato: accettiamo un sottoinsieme stretto, e su quel sottoinsieme il
  // nostro parser e un parser YAML vero non possono divergere. Vale finché ogni valore lo
  // scrive JSON.stringify — è il motivo per cui il serializzatore non "abbellisce" mai una
  // riga a mano.
  let yaml = null;
  try {
    ({ default: yaml } = await import("js-yaml"));
  } catch {
    console.log("  --  js-yaml non installato: parità con YAML non verificata (npm i -D js-yaml)");
  }

  if (yaml) {
    // Ognuno di questi, scritto NON quotato, YAML lo leggerebbe diverso da com'è: `%s ...` è
    // un errore di sintassi, `prezzo 5 # sconto` si tronca, `1.20` diventa un numero, `null`
    // diventa il null "da tradurre". Quotati sono tutti se stessi, in entrambi i parser.
    const ostili = {
      App_percento: "%s è pronto",
      App_duepunti: "Nota: importante",
      App_cancelletto: "prezzo 5 # sconto",
      App_cancelletto2: "#1 in classifica",
      App_null: "null",
      App_tilde: "~",
      App_decimale: "1.20",
      App_zeri: "007",
      App_no: "no",
      App_trattino: "- primo",
      App_chiocciola: "@utente",
      App_lista: "[uno, due]",
      App_spazi: "   ai bordi   ",
      App_vuoto: "",
      App_virgolette: 'dice "sì" e usa \\ così',
      App_acapo: "riga1\nriga2",
      App_tab: "a\tb",
      App_emoji: "🐅 fine",
      App_html: "<b>ciao</b> &amp; via",
      App_cinese: "你好 %s，你好吗？",
      App_daTradurre: null,
    };
    const tabella = { __builder__: { v: 260824, languageName: "中文（中国）", incomplete: true }, ...ostili };
    const { translated, untranslated } = splitAndSortEntries(tabella);
    const testo = serializeLanguageFile({ tag: "zh-CN", isSource: false, translated, untranslated, now: new Date(2026, 0, 2, 3, 4) });

    const nostro = parseLanguageFile(testo, "zh-CN.yml");
    eq("il nostro parser rilegge la tabella identica", stableStringify(tabella), stableStringify(nostro));

    let daYaml;
    try {
      daYaml = yaml.load(testo);
    } catch (e) {
      daYaml = { errore: e.message.split("\n")[0] };
    }
    eq("js-yaml legge esattamente la stessa cosa", stableStringify(nostro), stableStringify(daYaml));

    // E con CRLF, che è come il file finisce sul disco su Windows.
    eq("...anche con CRLF", stableStringify(nostro), stableStringify(yaml.load(testo.replace(/\n/g, "\r\n"))));
  }
}

// ------------------------------------------------------------- ordinamento e confronti
console.log("\n== splitAndSortEntries: chi va sopra e chi va sotto ==");
{
  const tabella = { App_z: "z", App_a: "a", __builder__: { v: 1 }, App_m: null, App_b: null };
  const { translated, untranslated } = splitAndSortEntries(tabella);
  eq("tradotte: builder in testa, poi alfabetico", "__builder__,App_a,App_z", translated.map(([k]) => k).join(","));
  eq("non tradotte: i null, alfabetico", "App_b,App_m", untranslated.map(([k]) => k).join(","));

  // Il criterio è parametrico: per la lingua sorgente "non tradotta" vuol dire "manca altrove".
  const altrove = { App_z: true };
  const { untranslated: perLaSorgente } = splitAndSortEntries(tabella, (k) => k in altrove);
  eq("criterio esterno rispettato", "App_z", perLaSorgente.map(([k]) => k).join(","));

  // Ordinamento con locale esplicito ("en"): senza, l'ordine dipenderebbe dal locale del
  // processo, e siccome il file si riscrive solo quando queste liste cambiano, la stessa
  // tabella risulterebbe "cambiata" passando da una macchina all'altra. L'ordine atteso è
  // quello di una persona che legge (le maiuscole non vengono prima di tutto il resto, come
  // farebbe invece un confronto sui code point), e la minuscola precede la maiuscola a parità
  // di lettera.
  const misto = splitAndSortEntries({ b_1: "x", A_1: "x", a_2: "x", B_2: "x", a_1: "x" });
  eq("maiuscole e minuscole in ordine stabile", "a_1,A_1,a_2,b_1,B_2", misto.translated.map(([k]) => k).join(","));
}

console.log("\n== stableStringify: due tabelle uguali devono risultare uguali ==");
{
  eq("ordine delle chiavi ininfluente", stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
  eq("anche annidato", stableStringify({ x: { a: 1, b: 2 } }), stableStringify({ x: { b: 2, a: 1 } }));
  // È il caso vero: `incomplete` viene omesso in scrittura e riappeso in coda in lettura,
  // quindi lo stesso __builder__ torna con le chiavi in un altro ordine.
  const scritto = { v: 1, languageName: "italiano", incomplete: false };
  const riletto = normalizeBuilder({ __builder__: { v: 1, languageName: "italiano" } }).__builder__;
  eq("round-trip di __builder__ non conta come modifica", stableStringify(scritto), stableStringify(riletto));
  eq("l'ordine negli array conta ancora", false, stableStringify([1, 2]) === stableStringify([2, 1]));
  eq("undefined non fa esplodere il confronto", "null", stableStringify(undefined));
  eq("valori diversi restano diversi", false, stableStringify({ a: 1 }) === stableStringify({ a: "1" }));
}

console.log("\n== updateKeys: cosa è entrato e cosa è uscito ==");
{
  const vecchio = { App_a: "a", App_b: "b" };
  const [stato, aggiornato] = updateKeys(vecchio, { App_a: "a", App_c: "c" });
  eq("chiavi risultanti", "App_a,App_c", Object.keys(aggiornato).sort().join(","));
  eq("aggiunte", "App_c", stato.added.join(","));
  eq("rimosse", "App_b", stato.deleted.join(","));
  eq("valore della rimossa conservato (serve ai rename)", "b", stato.deletedValues.App_b);
  eq("segnalato come cambiato", true, stato.changed);

  const [fermo] = updateKeys({ App_a: "a" }, { App_a: "diverso" });
  // updateKeys guarda le CHIAVI, non i valori: un testo sorgente riscritto senza cambiare id
  // non esiste (l'id è l'hash del testo), quindi qui non c'è nulla da rilevare.
  eq("stesso insieme di chiavi: nessuna variazione", false, fermo.changed);
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
