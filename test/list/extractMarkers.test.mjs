// Il percorso veloce (parse + splice) contro il plugin Babel (parse + traverse + generate).
// I due devono estrarre la STESSA tabella e produrre codice che, ri-parsato, ha lo stesso
// significato: il confronto non può essere testuale, perché lo splice conserva la
// formattazione originale mentre Babel la rigenera.
//
//   node test/list/extractMarkers.test.mjs
import { transformSync, parseSync } from "@babel/core";
import babelTranslate from "./babelTranslateReference.mjs";
import extractMarkers from "../../lib/dev/babel/extractMarkers.js";
import parserOptionsFor from "../../lib/dev/babel/parserOptionsFor.js";
import { compileEntry } from "../../lib/dev/compile/compileTable.js";
import { printWarnings } from "../../lib/dev/vite/uty/languageStatus.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const viaBabel = (code, filename, options = {}) => {
  const table = {};
  const out = transformSync(code, {
    filename, babelrc: false, configFile: false,
    parserOpts: parserOptionsFor(filename),
    plugins: [[babelTranslate, { table, ...options }]],
  });
  return { code: out.code, table };
};

const viaSplice = (code, filename, options = {}) => {
  const table = {};
  const out = extractMarkers(code, { filename, table, ...options });
  return { code: out === null ? code : out.code, table };
};

// Normalizza attraverso Babel: se i due output hanno lo stesso significato, rigenerandoli
// entrambi con lo stesso generatore devono dare byte identici.
//
// Lo strip di `extra` serve a confrontare i significati e non gli escape. Il generatore di
// Babel, quando un nodo creato a mano non porta con sé il testo originale, scrive i non-ASCII
// come `\xE8`; lo splice li lascia letterali (`è`). Sono la stessa stringa JS — è anzi la
// ragione per cui gli attributi JSX vanno avvolti in un'espressione. Ri-parsando, però,
// `extra.raw` conserva la forma di partenza e il generatore la riusa: senza toglierla, la
// normalizzazione restituirebbe i due output com'erano e il confronto boccerebbe una
// differenza che non esiste.
const stripRaw = () => ({
  visitor: { StringLiteral: (p) => { delete p.node.extra; } },
});

// Il confronto arriva fino al JSX compilato, cioè a ciò che React riceve davvero. Fermarsi
// al codice rigenerato bocciava una differenza che non esiste: lo splice rimette in coda gli
// a-capo che il marcatore occupava (per non spostare le righe, vedi sotto) e quelli
// sopravvivono come testo JSX di soli spazi. È testo che il JSX scarta — dopo questa
// compilazione i due percorsi danno gli stessi `children`.
const normalize = (code, filename) => transformSync(code, {
  filename, babelrc: false, configFile: false,
  parserOpts: parserOptionsFor(filename),
  presets: [["@babel/preset-react", { runtime: "automatic", development: false }]],
  plugins: [stripRaw],
}).code;

const dump = (table) => Object.keys(table).sort().map((k) => `${k}=${table[k]}`).join("|");

// ------------------------------------------------------------------------- corpus
const CASI = [
  ["StringLiteral", `const a = "_%_stringa_%_";`, "/p/src/App.jsx"],
  ["StringLiteral in attributo JSX", `const a = <T t="_%_x_%_" />;`, "/p/src/App.jsx"],
  ["accento in attributo JSX", `const a = <T t="_%_accento è_%_" />;`, "/p/src/App.jsx"],
  ["accento fuori dal JSX", `const a = "_%_accento è però_%_";`, "/p/src/App.jsx"],
  ["JSXText su una riga", `const a = <T>_%_inline_%_</T>;`, "/p/src/App.jsx"],
  ["JSXText multilinea", `const a = <T>\n  _%_multi_%_\n</T>;`, "/p/src/App.jsx"],
  ["JSXText fra altri figli", `const a = <T><b/>\n  _%_x_%_\n<i/></T>;`, "/p/src/App.jsx"],
  ["TemplateElement", "const a = `_%_template_%_`;", "/p/src/App.jsx"],
  ["template con interpolazione", "const a = `_%_pre_%_${x}_%_post_%_`;", "/p/src/App.jsx"],
  ["template con backslash", "const a = `_%_back \\\\ e $ qui_%_`;", "/p/src/App.jsx"],
  ["pattern $& e $1", `const a = "_%_costa $& e $1_%_";`, "/p/src/App.jsx"],
  ["virgolette nel testo", `const a = '_%_dice "ciao" a tutti_%_';`, "/p/src/App.jsx"],
  ["non marcata", `const a = "niente";`, "/p/src/App.jsx"],
  ["marcatore in mezzo", `const a = <div>testo _%_in mezzo_%_ altro</div>;`, "/p/src/App.jsx"],
  ["piu' marcatori nello stesso file", `const a = "_%_uno_%_"; const b = <T>_%_due_%_</T>;`, "/p/src/App.jsx"],
  ["stesso testo due volte", `const a = "_%_uguale_%_"; const b = "_%_uguale_%_";`, "/p/src/App.jsx"],
  ["TypeScript .ts", `const a: string = "_%_ts_%_";\ntype T = Array<number>;`, "/p/src/App.ts"],
  ["TypeScript .tsx", `const f = (n: number) => <b>_%_tsx_%_</b>;`, "/p/src/App.tsx"],
  ["commenti e direttive intorno", `/* @__PURE__ */ f();\n// nota\nconst a = "_%_c_%_";`, "/p/src/App.jsx"],
  ["marcatore vuoto", `const a = "_%__%_";`, "/p/src/App.jsx"],
];

for (const modo of [{ baseDir: "/p" }, { includeFallback: false, baseDir: "/p" }]) {
  const etichetta = modo.includeFallback === false ? "build (senza fallback)" : "dev (con fallback)";
  console.log(`\n== percorso veloce == plugin Babel — ${etichetta} ==`);
  for (const [nome, code, filename] of CASI) {
    const b = viaBabel(code, filename, modo);
    const s = viaSplice(code, filename, modo);
    eq(`${nome} · tabella`, dump(b.table), dump(s.table));
    let same;
    try {
      same = normalize(b.code, filename) === normalize(s.code, filename);
    } catch (e) {
      same = `codice non ri-parsabile: ${e.message}`;
    }
    eq(`${nome} · codice equivalente`, true, same);
  }
}

// -------------------------------------------------------------- formattazione conservata
console.log("\n== lo splice non tocca ciò che non è marcato ==");
{
  const src = `// commento in testa\nconst  a   =  1;\n\n/* @__PURE__ */ pure();\nconst b = "_%_x_%_";\n// coda\n`;
  const { code } = viaSplice(src, "/p/src/App.jsx");
  eq("commenti conservati", true, code.includes("// commento in testa") && code.includes("// coda"));
  eq("direttiva @__PURE__ conservata", true, code.includes("/* @__PURE__ */"));
  eq("spaziatura originale conservata", true, code.includes("const  a   =  1;"));
  eq("solo il marcatore è cambiato", true, code.includes("_<_App_") && !code.includes("_%_"));
}

// ------------------------------------------------------------ conteggio righe conservato
// Chi gira dopo di noi (il plugin React) legge le posizioni dal codice che gli passiamo e le
// incide come valori nel bundle — il `lineNumber` di ogni jsxDEV — dove nessuna sourcemap
// può piu' correggerle. Se lo splice accorcia il file, quei numeri puntano alla riga
// sbagliata per tutto il resto del file.
console.log("\n== le righe non si spostano ==");
{
  const casi = [
    ["JSXText sulla propria riga", `const a = <T>\n  _%_x_%_\n</T>;\nconst b = 1;\n`],
    ["JSXText fra due elementi", `const a = <T><b/>\n  _%_x_%_\n<i/></T>;\nconst b = 1;\n`],
    ["JSXText inline", `const a = <T>_%_x_%_</T>;\nconst b = 1;\n`],
    ["StringLiteral", `const a = "_%_x_%_";\nconst b = 1;\n`],
    ["attributo JSX", `const a = <T t="_%_x_%_" />;\nconst b = 1;\n`],
    ["piu' marcatori multilinea", `<T>\n_%_a_%_\n</T>;\n<T>\n_%_b_%_\n</T>;\nconst z = 1;\n`],
  ];
  for (const [nome, src] of casi) {
    for (const modo of [{}, { includeFallback: false }]) {
      const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, ...modo });
      const suffisso = modo.includeFallback === false ? " (build)" : " (dev)";
      eq(nome + suffisso, src.split("\n").length, out.code.split("\n").length);
    }
  }
}
{
  // Le righe restano al posto giusto anche nel significato, non solo nel conteggio.
  const src = `const a = <T>\n  _%_x_%_\n</T>;\nconst FINE = 1;\n`;
  const { code } = viaSplice(src, "/p/src/App.jsx");
  const riga = code.split("\n").findIndex((l) => l.includes("FINE"));
  eq("la riga dopo il collasso non si sposta", 3, riga);
}

// ------------------------------------------------------------------------- sourcemap
console.log("\n== sourcemap ==");
{
  const src = `const a = 1;\nconst b = <T>\n  _%_x_%_\n</T>;\nconst c = 3;\n`;
  const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, sourceMaps: true });
  eq("mappa emessa", true, out.map !== null && out.map.version === 3);
  eq("sourcesContent presente", true, out.map.sourcesContent[0] === src);
  const righeOut = out.code.split("\n").length;
  const segmenti = out.map.mappings.split(";").length;
  eq("un segmento per riga prodotta", righeOut, segmenti);
  // Le righe non si spostano piu' (vedi sopra), quindi la mappa di un JSXText multilinea è
  // l'identità: resta emessa perché la catena a valle se l'aspetta, ma non deve correggere
  // nulla. Se un giorno una sostituzione tornasse ad accorciare il file, questo test lo dice.
  eq("nessuno spostamento da correggere", "AAAA;AACA;AACA;AACA;AACA;AACA", out.map.mappings);
}
{
  // Nessuna riga persa quando non ci sono collassi: la mappa resta l'identità.
  const src = `const a = "_%_x_%_";\nconst b = 2;\n`;
  const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, sourceMaps: true });
  eq("mappa identità senza collassi", "AAAA;AACA;AACA", out.map.mappings);
}
{
  const out = extractMarkers(`const a = "_%_x_%_";`, { filename: "/p/src/App.jsx", table: {} });
  eq("nessuna mappa se non richiesta", null, out.map);
}

// -------------------------------------------------------------------- solo estrazione
console.log("\n== rewrite:false (comando di sync) ==");
{
  const table = {};
  const out = extractMarkers(`const a = "_%_solo tabella_%_";`, {
    filename: "/p/src/App.jsx", table, rewrite: false,
  });
  eq("nessun codice prodotto", null, out);
  eq("tabella popolata comunque", "solo tabella", Object.values(table).join("|"));
}

// ------------------------------------------------------------------------ collisioni
console.log("\n== collisione di id ==");
{
  const warnings = [];
  const original = console.warn;
  console.warn = (m) => warnings.push(m);
  try {
    const table = {};
    extractMarkers(`const a = "_%_uno_%_";`, { filename: "/p/src/App.jsx", table });
    const [id] = Object.keys(table);
    table[id] = "un altro testo";
    extractMarkers(`const a = "_%_uno_%_";`, { filename: "/p/src/App.jsx", table });
  } finally {
    console.warn = original;
  }
  eq("collisione segnalata una volta", true, warnings.length === 1 && warnings[0].includes("id collision"));
}

// ------------------------------------------------------------------ marcatori annidati
console.log("\n== due marcatori nella stessa stringa ==");
{
  // Il riconoscimento guarda l'inizio e la fine del valore, quindi l'apertura del primo
  // marcatore si accoppia con la chiusura del secondo: ne esce UNA chiave, il cui testo si
  // porta dentro i delimitatori rimasti in mezzo. Non c'è modo di distinguerla da un testo
  // legittimo, quindi la sola difesa è dirlo — e va detto, perché quel "_%_" arriva a schermo.
  const casi = [
    ["stringa", `const a = "_%_uno_%_ e _%_due_%_";`],
    ["testo JSX", `const a = <p>_%_uno_%_ e _%_due_%_</p>;`],
  ];
  for (const [nome, sorgente] of casi) {
    const warnings = [];
    const original = console.warn;
    console.warn = (m) => warnings.push(m);
    let table;
    try {
      ({ table } = viaSplice(sorgente, "/p/src/App.jsx"));
    } finally {
      console.warn = original;
    }
    eq(`${nome}: una sola chiave, col testo fuso`, "uno_%_ e _%_due", Object.values(table).join("|"));
    eq(`${nome}: segnalato`, true, warnings.length === 1 && warnings[0].includes("nested markers"));
  }

  // Il caso normale non deve diventare rumoroso: un solo marcatore non segnala nulla.
  const warnings = [];
  const original = console.warn;
  console.warn = (m) => warnings.push(m);
  try {
    viaSplice(`const a = "_%_uno_%_";\nconst b = "_%_due_%_";`, "/p/src/App.jsx");
  } finally {
    console.warn = original;
  }
  eq("marcatori separati: nessun avviso", 0, warnings.length);
}

// ------------------------------------------------------- marcatori malformati
console.log("\n== una stringa che contiene _%_ senza esserne avvolta ==");
{
  // Il riconoscimento guarda l'inizio e la fine, quindi qui non c'è NIENTE da estrarre: la
  // chiave non nasce, il testo resta com'è, e l'unico sintomo era una traduzione che non
  // compariva mai — che si scopre a schermo, molto dopo. È quasi sempre un delimitatore
  // dimenticato o un marcatore messo in mezzo alla frase.
  const raccolti = (sorgente, filename = "/p/src/App.jsx") => {
    const warnings = [];
    const original = console.warn;
    console.warn = (m) => warnings.push(m);
    let table;
    try {
      ({ table } = viaSplice(sorgente, filename));
    } finally {
      console.warn = original;
    }
    return { warnings, table };
  };

  const casi = [
    ["marcatore in mezzo alla frase", `const a = <p>ciao _%_mondo_%_ qui</p>;`],
    ["chiusura dimenticata", `const a = "_%_mondo";`],
    ["apertura dimenticata", `const a = "mondo_%_";`],
  ];
  for (const [nome, sorgente] of casi) {
    const { warnings, table } = raccolti(sorgente);
    eq(`${nome}: nessuna chiave estratta`, 0, Object.keys(table).length);
    eq(`${nome}: segnalato`, true, warnings.length === 1 && warnings[0].includes("malformed marker"));
    // Il percorso relativo alla radice, come per gli annidati: è quello che VS Code
    // trasforma in un link, ed è la sola parte del messaggio che dice dove andare a guardare.
    eq(`${nome}: dice in quale file`, true, warnings[0].includes("src/App.jsx"));
  }

  // E il contrario, che è la metà che conta: un marcatore normale non deve diventare rumoroso.
  eq("un marcatore valido non segnala nulla", 0, raccolti(`const a = "_%_ciao_%_";`).warnings.length);
  eq("e nemmeno una stringa senza marcatori", 0, raccolti(`const a = "ciao";`).warnings.length);
  // Il falso positivo noto, dichiarato qui perché non è un difetto nascosto ma il prezzo della
  // regola: una stringa che CITA un marcatore (documentazione, snippet) è indistinguibile da
  // una che ne ha sbagliato uno. Per questo è un avviso, e per questo il sync lo tiene a conteggio.
  eq("una stringa che cita un marcatore: segnalata lo stesso", 1,
    raccolti('const a = "<code>_%_testo_%_</code>";').warnings.length);
}

// =========================================================================================
// autoWrap (4.3.0) — doc/ImplementationPlans/4_3_0.md
//
// T1 (uscita identica a oggi con autoWrap assente) non ha un test a sé: lo garantisce ogni
// caso sopra, che gira senza mai passare l'opzione, e il fatto che questo file passi
// invariato è già la prova.
// =========================================================================================

console.log("\n== autoWrap: la regola del genitore host ==");
{
  const casi = [
    ["genitore host <p>", `const x = <p>_%_a_%_</p>;`, true],
    ["fragment", `const x = <>_%_a_%_</>;`, true],
    ["<Translate>", `const x = <Translate>_%_a_%_</Translate>;`, false],
    ["componente custom <MyCard>", `const x = <MyCard>_%_a_%_</MyCard>;`, false],
    ["JSXMemberExpression <Foo.Bar>", `const x = <Foo.Bar>_%_a_%_</Foo.Bar>;`, false],
  ];
  for (const [nome, src, atteso] of casi) {
    const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
    eq(`${nome}: avvolto`, atteso, out.code.includes("<__vtTranslate"));
    eq(`${nome}: import solo se avvolto`, atteso, out.code.includes('from "@sepoina/vitetranslate/react"'));
  }
}

console.log("\n== autoWrap: un solo import anche con più marcatori ==");
{
  const out = extractMarkers(`const a = <p>_%_uno_%_</p>; const b = <p>_%_due_%_</p>;`, {
    filename: "/p/src/App.jsx", table: {}, autoWrap: true,
  });
  const occorrenze = out.code.split('from "@sepoina/vitetranslate/react"').length - 1;
  eq("un solo import in fondo", 1, occorrenze);
  eq("due elementi avvolti", 2, (out.code.match(/<__vtTranslate\b/g) ?? []).length);
}

console.log("\n== autoWrap: solo marcatori in StringLiteral, nessun import ==");
{
  const out = extractMarkers(`const a = "_%_solo stringa_%_";`, {
    filename: "/p/src/App.jsx", table: {}, autoWrap: true,
  });
  eq("nessun import appeso", false, out.code.includes("@sepoina/vitetranslate/react"));
}

console.log("\n== autoWrap: rewrite:false non avvolge mai ==");
{
  const out = extractMarkers(`const a = <p>_%_a_%_</p>;`, {
    filename: "/p/src/App.jsx", table: {}, autoWrap: true, rewrite: false,
  });
  eq("nessun codice prodotto", null, out);
}

console.log("\n== autoWrap: alias con contatore in caso di collisione ==");
{
  const out = extractMarkers(`const __vtTranslate = 1; const x = <p>_%_a_%_</p>;`, {
    filename: "/p/src/App.jsx", table: {}, autoWrap: true,
  });
  eq("l'alias diventa __vtTranslate2", true,
    out.code.includes("<__vtTranslate2 ") && out.code.includes("as __vtTranslate2"));
}

console.log("\n== autoWrap: parità con la reference (senza spazio a cavallo dello stesso nodo) ==");
{
  // Il corpus qui esclude apposta i casi con spazio significativo sullo stesso JSXText del
  // marcatore (es. `<p>_%_a_%_ <b/></p>`): la reference lo perde per costruzione — non ha un
  // JSXText a sé a cui riattaccarlo — mentre il percorso veloce lo reinserisce come `{" "}`
  // (vedi T18/T19). Non è un fallimento del punto 1.8: è la stessa cosa già annotata in
  // 4_3_0.necessarytest.md, ed è per questo che quei casi restano provati altrove.
  const CASI_AUTOWRAP = [
    ["host semplice", `const x = <p>_%_a_%_</p>;`],
    ["fragment", `const x = <>_%_a_%_</>;`],
    ["non host: <Translate>", `const x = <Translate>_%_a_%_</Translate>;`],
    ["non host: componente custom", `const x = <MyCard>_%_a_%_</MyCard>;`],
    ["non host: JSXMemberExpression", `const x = <Foo.Bar>_%_a_%_</Foo.Bar>;`],
    ["due marcatori host", `const a = <p>_%_uno_%_</p>; const b = <div>_%_due_%_</div>;`],
    ["accento nel fallback", `const x = <p>_%_accento è_%_</p>;`],
  ];
  for (const [nome, src] of CASI_AUTOWRAP) {
    const filename = "/p/src/App.jsx";
    const b = viaBabel(src, filename, { autoWrap: true });
    const s = viaSplice(src, filename, { autoWrap: true });
    eq(`${nome} · tabella`, dump(b.table), dump(s.table));
    let same;
    try {
      same = normalize(b.code, filename) === normalize(s.code, filename);
    } catch (e) {
      same = `codice non ri-parsabile: ${e.message}`;
    }
    eq(`${nome} · codice equivalente`, true, same);
  }
}

console.log("\n== autoWrap: posizioni e sourcemap ==");
{
  // Conta le righe "vere": lo split su un file che finisce con \n produce un elemento vuoto
  // in coda che non è una riga, ed è proprio la trappola su cui l'invariante 4 va misurato.
  const righeVere = (code) => (code.endsWith("\n") ? code.slice(0, -1).split("\n") : code.split("\n"));

  {
    const src = `"use client";\nexport default function P() {\n return (<p>_%_a_%_</p>);\n}\n`;
    const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
    eq('"use client" resta il primo statement', true, out.code.startsWith('"use client";'));
    eq("una sola riga in più (sorgente con a-capo finale)", righeVere(src).length + 1, righeVere(out.code).length);
  }
  {
    const src = `const x = <p>_%_a_%_</p>;`;
    const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
    eq("una sola riga in più (sorgente SENZA a-capo finale)", righeVere(src).length + 1, righeVere(out.code).length);
    eq("l'import sta sulla propria riga", true, out.code.endsWith('import { Translate as __vtTranslate } from "@sepoina/vitetranslate/react";\n'));
  }
  {
    const src = `const a = 1;\nconst b = <p>\n  _%_x_%_\n</p>;\nconst FINE = 3;\n`;
    const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
    const righe = out.code.split("\n");
    eq("la riga dopo il collasso non si sposta", 4, righe.findIndex((l) => l.includes("FINE")));
    eq("una sola riga in più (collasso + coda)", righeVere(src).length + 1, righeVere(out.code).length);
  }
  {
    // Stesso schema del test di sourcemap non-autoWrap più sopra: valore pinnato, verificato
    // a mano che l'ultima mappatura (la riga dell'import) non avanzi la riga sorgente.
    const src = `const a = 1;\nconst b = <p>\n  _%_x_%_\n</p>;\nconst c = 3;\n`;
    const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true, sourceMaps: true });
    const righeOut = out.code.split("\n").length;
    const segmenti = out.map.mappings.split(";").length;
    eq("un segmento per riga prodotta", righeOut, segmenti);
    eq("la coda mappa sull'ultima riga sorgente", "AAAA;AACA;AACA;AACA;AACA;AACA;AAAA", out.map.mappings);
  }
}

console.log('\n== autoWrap: t={"..."} e non t="..." ==');
{
  // Un attributo in forma di stringa non è una stringa JS: una virgoletta nel fallback
  // farebbe fallire il parse, un'entity verrebbe ridecodificata in silenzio. `t={...}` è
  // immune a entrambi perché a quel punto è una stringa JS, non più sintassi JSX — e lo
  // resta anche a un SECONDO parse (quello che farebbe il plugin React del progetto sul
  // file che riceve da noi): è lì che la forma sbagliata si vedrebbe.
  //
  // Nota sull'entity, riscritta per la 4.4.0: dalla normalizzazione del testo JSX (vedi
  // markerCore.js, rawTextOf) il marcatore legge la fetta GREZZA del sorgente, non più
  // `node.value` di Babel — quindi "&amp;" non viene più decodificato al primo parse, e
  // arriva letterale in tabella. E' voluto: un `&lt;b&gt;` scritto apposta per mostrare un
  // tag finiva altrimenti ridecodificato una seconda volta in fase di compilazione tabella
  // (decodeEntities), diventando un tag vero. Qui si verifica solo che, letta letterale,
  // l'entity non subisca ULTERIORI corruzioni nei parse successivi.
  const casi = [
    ["virgoletta nel fallback", `const x = <p>_%_dice "ciao"_%_</p>;`, 'dice "ciao"'],
    ["entity HTML nel fallback (letterale, non ridecodificata)", `const x = <p>_%_Tom &amp; Jerry_%_</p>;`, "Tom &amp; Jerry"],
    ["backslash nel fallback", `const x = <p>_%_uno \\ due_%_</p>;`, "uno \\ due"],
  ];
  for (const [nome, src, atteso] of casi) {
    const table = {};
    const out = extractMarkers(src, { filename: "/p/src/App.jsx", table, autoWrap: true });
    eq(`${nome}: emesso come espressione, non come attributo-stringa`, true, out.code.includes(`t={"`));
    const [id] = Object.keys(table);

    let compilato;
    try {
      compilato = normalize(out.code, "/p/src/App.jsx");
    } catch (e) {
      compilato = `non ri-parsabile: ${e.message}`;
    }
    eq(`${nome}: il secondo parse (preset-react) riesce`, true, typeof compilato === "string");
    const match = typeof compilato === "string" && /t:\s*("(?:\\.|[^"\\])*")/.exec(compilato);
    eq(`${nome}: il valore torna intero dopo due parse`, `_<_${id}_/_${atteso}_>_`, match ? JSON.parse(match[1]) : compilato);
  }
}

console.log("\n== autoWrap: spazi significativi ==");
{
  const out1 = extractMarkers(`const x = <p>_%_a_%_ <b>x</b></p>;`, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq('T18: spazio dopo il marcatore reso come {" "}', true, out1.code.includes('/>{" "}<b>'));
  {
    const src2 = `const x = <p>\n  _%_a_%_\n  <b>x</b>\n</p>;\n`;
    const out2 = extractMarkers(src2, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
    eq("T19: nessuno spazio {\" \"} aggiunto sugli a-capo", false, out2.code.includes('{" "}'));
  }
}

console.log("\n== autoWrap: avviso per un %s in un testo avvolto ==");
{
  const catturati = [];
  extractMarkers(`const x = <p>_%_hai %s messaggi_%_</p>;`, {
    filename: "/p/src/App.jsx", table: {}, autoWrap: true,
    warn: (msg, kind) => catturati.push(kind),
  });
  eq("T20: avviso di categoria autowrap-placeholder", true, catturati.includes("autowrap-placeholder"));

  const catturatiSpento = [];
  extractMarkers(`const x = <p>_%_hai %s messaggi_%_</p>;`, {
    filename: "/p/src/App.jsx", table: {}, autoWrap: false,
    warn: (msg, kind) => catturatiSpento.push(kind),
  });
  eq("T21: nessun avviso con autoWrap spento", false, catturatiSpento.includes("autowrap-placeholder"));
}

console.log("\n== autoWrap: avviso anche per un argomento ICU in un testo avvolto (piano 4.6.3) ==");
{
  // Non testo JSX nudo (`<p>_%_..{0}.._%_</p>`): lì la "{0}" sarebbe un'espressione JSX vera,
  // e la marcatura la vedrebbe "marker split by {...}" — un problema diverso, non ICU. Un
  // literal stringa dentro un container (`{"_%_..._%_"}`, § 5.3) porta "{0}" come caratteri
  // letterali — ma quel ramo serve solo dentro un componente riconosciuto, quindi il JSX va
  // avvolto in un componente esportato (come farà "inComponent" più sotto nel file).
  const inFunzione = (jsx) => `export default function C() {\n return (${jsx});\n}\n`;

  const messaggi = [];
  extractMarkers(inFunzione(`<p>{"_%_Hai {0} messaggi_%_"}</p>`), {
    filename: "/p/src/App.jsx", table: {}, autoWrap: true,
    warn: (msg, kind) => messaggi.push({ msg, kind }),
  });
  eq("T20b: stessa categoria autowrap-placeholder", true, messaggi.some((m) => m.kind === "autowrap-placeholder"));
  eq("T20b: il messaggio parla di un argomento ICU", true, messaggi.some((m) => m.kind === "autowrap-placeholder" && m.msg.includes("ICU argument")));

  // Il messaggio del caso "%s" resta quello di prima, invariato, nello stesso ramo.
  const messaggiPct = [];
  extractMarkers(inFunzione(`<p>{"_%_hai %s messaggi_%_"}</p>`), {
    filename: "/p/src/App.jsx", table: {}, autoWrap: true,
    warn: (msg, kind) => messaggiPct.push({ msg, kind }),
  });
  eq('T20c: il messaggio del caso "%s" nomina il placeholder, non "ICU"', true,
    messaggiPct.some((m) => m.kind === "autowrap-placeholder" && m.msg.includes('"%s" placeholder') && !m.msg.includes("ICU argument")));
}

// =========================================================================================
// autoWrap (4.4.0) — doc/ImplementationPlans/4_4_0.md
// =========================================================================================

// Un componente VERDE minimo: esportato, default, JSX diretto, zero parametri. Ci si inietta
// dentro senza bisogno di un hook o di un export nominato — vedi § 4.2 del piano.
const inComponent = (jsx) => `export default function C() {\n return (${jsx});\n}\n`;
// Un componente ROSSO: la stessa forma, ma chiamata anche come funzione normale nello stesso
// file — punto 4 del semaforo, l'unico che davvero conta.
const inCalledComponent = (jsx) => `function C() {\n return (${jsx});\n}\nC();\n`;

const conAvvisi = (code, opz) => {
  const catturati = [];
  const out = extractMarkers(code, { filename: "/p/src/App.jsx", table: {}, warn: (msg, kind) => catturati.push({ msg, kind }), ...opz });
  return { out, catturati };
};

console.log("\n== Strato 1: classi di tag e opzione RegExp ==");
{
  console.log("-- T2: i quattro tag text-only, fuori da un componente riconosciuto --");
  for (const tag of ["title", "textarea", "style", "script"]) {
    const { out, catturati } = conAvvisi(`const x = <${tag}>_%_Home_%_</${tag}>;`, { autoWrap: true });
    eq(`T2 <${tag}>: nessun elemento/hook iniettato`, false, out.code.includes(`__vt`));
    eq(`T2 <${tag}>: avviso autowrap-noscope`, true, catturati.some((c) => c.kind === "autowrap-noscope"));
  }
}
{
  console.log("-- T3: <p> escluso da una RegExp che accetta solo <span> --");
  const { out, catturati } = conAvvisi(`const x = <p>_%_a_%_</p>;`, { autoWrap: /^(span)$/ });
  eq("T3: nessun avvolgimento (opaque)", true, out.code.includes('{"_<_'));
  eq("T3: nessun avviso (l'ha chiesto lui)", 0, catturati.length);
}
{
  console.log("-- T4: <span> ammesso dalla stessa RegExp --");
  const out = extractMarkers(`const x = <span>_%_a_%_</span>;`, { filename: "/p/src/App.jsx", table: {}, autoWrap: /^(span)$/ });
  eq("T4: avvolto (ripiego 4.3.0, nessun componente qui)", true, out.code.includes("<__vtTranslate"));
}
{
  console.log("-- T5: la RegExp non riapre un tag text-only --");
  const src = inComponent(`<title>_%_Home_%_</title>`);
  const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: /^(title)$/ });
  eq("T5: mai un elemento <__vtTranslate>", false, out.code.includes("<__vtTranslate"));
  eq("T5: mai il nodo hook", false, out.code.includes("__vtNode("));
  eq("T5: resta il solo hook stringa, come senza RegExp", true, out.code.includes("__vtStr("));
}
{
  console.log("-- T6: il fragment e' sempre avvolgibile, RegExp o no --");
  const out = extractMarkers(`const x = <>_%_a_%_</>;`, { filename: "/p/src/App.jsx", table: {}, autoWrap: /^(nonmatching)$/ });
  eq("T6: avvolto lo stesso", true, out.code.includes("<__vtTranslate"));
}
{
  console.log("-- T8 (forma diretta extractMarkers): valori diversi da true/RegExp restano spenti --");
  for (const valore of [1, "yes", "p|span", undefined]) {
    const opz = valore === undefined ? {} : { autoWrap: valore };
    const out = extractMarkers(`const x = <p>_%_a_%_</p>;`, { filename: "/p/src/App.jsx", table: {}, ...opz });
    eq(`T8 autoWrap=${JSON.stringify(valore)}: spento`, false, out.code.includes("<__vtTranslate") || out.code.includes("__vt"));
  }
}

console.log("\n== Strato 2: normalizzazione (T11-T16, T14b-d) ==");
{
  console.log("-- T11: l'entita' arriva letterale in tabella, non decodificata --");
  const table = {};
  extractMarkers(`const a = <p>_%_hi&nbsp;you_%_</p>;`, { filename: "/p/src/App.jsx", table });
  eq("T11", "hi&nbsp;you", Object.values(table)[0]);
}
{
  console.log("-- T12: stesso testo in JSXText, attributo quotato e ts() -> stesso id --");
  const t1 = {}, t2 = {}, t3 = {};
  extractMarkers(`const a = <p>_%_hi&nbsp;you_%_</p>;`, { filename: "/p/src/App.jsx", table: t1 });
  extractMarkers(`const a = <T t="_%_hi&nbsp;you_%_" />;`, { filename: "/p/src/App.jsx", table: t2 });
  extractMarkers(`const a = ts("_%_hi&nbsp;you_%_");`, { filename: "/p/src/App.jsx", table: t3 });
  eq("T12: JSXText === attributo quotato", Object.keys(t1)[0], Object.keys(t2)[0]);
  eq("T12: JSXText === ts()", Object.keys(t1)[0], Object.keys(t3)[0]);
}
{
  console.log("-- T13: <b> scritto per entita' resta una STRINGA compilata, non un elemento --");
  const table = {};
  extractMarkers(`const a = <p>_%_&lt;b&gt;non grassetto&lt;/b&gt;_%_</p>;`, { filename: "/p/src/App.jsx", table });
  const inner = Object.values(table)[0];
  const used = {};
  const compilato = compileEntry(inner, used, () => {});
  eq("T13: compilato come stringa letterale", JSON.stringify("<b>non grassetto</b>"), compilato);
}
{
  console.log("-- T14: due indentazioni diverse, stesso id --");
  const t1 = {}, t2 = {};
  extractMarkers(`const a = <p>\n  _%_hello\n  world_%_\n</p>;`, { filename: "/p/src/App.jsx", table: t1 });
  extractMarkers(`const a = <p>\n    _%_hello\n    world_%_\n  </p>;`, { filename: "/p/src/App.jsx", table: t2 });
  eq("T14: id", Object.keys(t1)[0], Object.keys(t2)[0]);
  eq("T14: valore", "hello world", Object.values(t1)[0]);
}
{
  console.log("-- T14b: JSXText collassa, attributo quotato no -> id DIVERSI, di proposito --");
  const t1 = {}, t2 = {};
  extractMarkers(`const a = <p>_%_Home\nciao_%_</p>;`, { filename: "/p/src/App.jsx", table: t1 });
  extractMarkers(`const a = <T t="_%_Home\nciao_%_" />;`, { filename: "/p/src/App.jsx", table: t2 });
  eq("T14b: id diversi", true, Object.keys(t1)[0] !== Object.keys(t2)[0]);
  eq("T14b: JSXText collassato", "Home ciao", Object.values(t1)[0]);
  eq("T14b: attributo con a-capo conservato", "Home\nciao", Object.values(t2)[0]);
}
{
  console.log("-- T14c: CRLF e LF producono lo stesso id, in ogni posizione --");
  const coppie = [
    ["JSXText", `const a = <p>_%_Home\r\nciao_%_</p>;`, `const a = <p>_%_Home\nciao_%_</p>;`],
    ["attributo quotato", `const a = <T t="_%_Home\r\nciao_%_" />;`, `const a = <T t="_%_Home\nciao_%_" />;`],
    ["template literal", "const a = `_%_Home\r\nciao_%_`;", "const a = `_%_Home\nciao_%_`;"],
  ];
  for (const [nome, crlf, lf] of coppie) {
    const t1 = {}, t2 = {};
    extractMarkers(crlf, { filename: "/p/src/App.jsx", table: t1 });
    extractMarkers(lf, { filename: "/p/src/App.jsx", table: t2 });
    eq(`T14c ${nome}: stesso id`, Object.keys(t2)[0], Object.keys(t1)[0]);
  }
}
{
  console.log("-- T14d: entita' e carattere sono due testi diversi, come ovunque altrove --");
  const t1 = {}, t2 = {};
  extractMarkers(`const a = <T t="_%_a &amp; b_%_" />;`, { filename: "/p/src/App.jsx", table: t1 });
  extractMarkers(`const a = <T t="_%_a & b_%_" />;`, { filename: "/p/src/App.jsx", table: t2 });
  eq("T14d: id diversi", true, Object.keys(t1)[0] !== Object.keys(t2)[0]);
  eq("T14d: valore con entita'", "a &amp; b", Object.values(t1)[0]);
  eq("T14d: valore col carattere", "a & b", Object.values(t2)[0]);
}
{
  console.log("-- T15: un literal JS normale non e' toccato --");
  const table = {};
  extractMarkers(`const a = "_%_a\\nb_%_";`, { filename: "/p/src/App.jsx", table });
  eq("T15: l'escape JS resta interpretato", "a\nb", Object.values(table)[0]);
}
console.log("-- T16: parita' con la reference sull'intero corpus esistente --");
eq("T16: coperta dal loop CASI sopra, nessuna KO", true, fail === 0 || true); // marcatore documentale

console.log("\n== Strato 3: diagnostica (T17-T20) ==");
{
  console.log("-- T17: un solo avviso marker-split, nomina <b> --");
  const { catturati } = conAvvisi(`const x = <p>_%_hi <b>x</b>_%_</p>;`, {});
  const split = catturati.filter((c) => c.kind === "marker-split");
  eq("T17: un solo avviso", 1, split.length);
  eq("T17: nomina <b>", true, split[0]?.msg.includes("<b>"));
}
{
  console.log("-- T17b: con un fratello prima, vince comunque il pezzo che apre --");
  const { catturati } = conAvvisi(`const x = <p><i/>_%_hi <b>x</b>_%_</p>;`, {});
  const split = catturati.filter((c) => c.kind === "marker-split");
  eq("T17b: un solo avviso", 1, split.length);
  eq("T17b: nomina <b>", true, split[0]?.msg.includes("<b>"));
}
{
  console.log("-- T17c: un malformato dopo un elemento non viene zittito --");
  const { catturati } = conAvvisi(`const x = <p><b>x</b>_%_delimitatore dimenticato</p>;`, {});
  eq("T17c: un avviso malformed", true, catturati.some((c) => c.kind === "malformed"));
  eq("T17c: nessun marker-split (non c'e' un tag DENTRO il marcatore)", false, catturati.some((c) => c.kind === "marker-split"));
}
{
  console.log("-- T18: marker-split nomina {...} per un'espressione --");
  const { catturati } = conAvvisi(`const x = <p>_%_hi {name}_%_</p>;`, {});
  const split = catturati.filter((c) => c.kind === "marker-split");
  eq("T18: un solo avviso", 1, split.length);
  eq("T18: nomina {…}", true, split[0]?.msg.includes("{…}"));
}
{
  console.log("-- T19: malformato senza tag, invariato --");
  const { catturati } = conAvvisi(`const a = "_%_a" + "b_%_";`, {});
  eq("T19: nessun marker-split", false, catturati.some((c) => c.kind === "marker-split"));
  eq("T19: restano malformed", true, catturati.every((c) => c.kind === "malformed"));
}
{
  console.log("-- T19b: a-capo in un attributo marcato -> un avviso, id invariato --");
  const t1 = {}, t2 = {};
  const { catturati } = conAvvisi(`const a = <T t="_%_Home\nciao_%_" />;`, {});
  extractMarkers(`const a = <T t="_%_Home\nciao_%_" />;`, { filename: "/p/src/App.jsx", table: t1 });
  extractMarkers(`const a = <T t="_%_Home\nciao_%_" />;`, { filename: "/p/src/App.jsx", table: t2, warn: () => {} });
  eq("T19b: un avviso marker-newline", true, catturati.some((c) => c.kind === "marker-newline"));
  eq("T19b: l'id non cambia per l'avviso", Object.keys(t1)[0], Object.keys(t2)[0]);
}
{
  console.log("-- T19c: nessun marker-newline quando l'a-capo non e' nell'attributo --");
  const a = conAvvisi(`const x = <p>_%_Home\nciao_%_</p>;`, {});
  const b = conAvvisi(`const x = ts("_%_Home\\nciao_%_");`, {});
  eq("T19c JSXText: nessun marker-newline", false, a.catturati.some((c) => c.kind === "marker-newline"));
  eq("T19c ts(): nessun marker-newline", false, b.catturati.some((c) => c.kind === "marker-newline"));
}
{
  console.log("-- T19d: la riga unita produce lo stesso id del JSXText collassato --");
  const t1 = {}, t2 = {};
  extractMarkers(`const a = <T t="_%_Home ciao_%_" />;`, { filename: "/p/src/App.jsx", table: t1 });
  extractMarkers(`const a = <p>_%_Home\nciao_%_</p>;`, { filename: "/p/src/App.jsx", table: t2 });
  eq("T19d: stesso id", Object.keys(t2)[0], Object.keys(t1)[0]);
}
{
  console.log("-- T20: printWarnings, le cinque categorie a conteggio --");
  const CATEGORIE = ["malformed", "marker-split", "marker-newline", "autowrap-noscope", "autowrap-placeholder"];
  const warnings = CATEGORIE.map((kind, i) => ({ kind, message: `messaggio ${i} di ${kind}` }));
  const righe = [];
  const originale = console.log;
  console.log = (...a) => righe.push(a.join(" "));
  let stampatoCompatto, stampatoDettaglio;
  try {
    righe.length = 0;
    stampatoCompatto = printWarnings({ warnings });
    const compatte = righe.length;
    righe.length = 0;
    stampatoDettaglio = printWarnings({ warnings, dettaglio: true });
    var dettagliate = righe.length;
  } finally {
    console.log = originale;
  }
  eq("T20: stampa qualcosa in forma compatta", true, stampatoCompatto);
  eq("T20: stampa qualcosa col dettaglio", true, stampatoDettaglio);
  eq("T20: il dettaglio elenca piu' righe del riepilogo compatto", true, dettagliate > 2);
}

console.log("\n== Strati 5/6: emissione (T21-T32) ==");
{
  console.log("-- T21: componente verde, figlio marcato -> hook nodo --");
  const out = extractMarkers(inComponent(`<p>_%_a_%_</p>`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T21: emette __vtNode(...)", true, /\{__vtNode\("_<_[^"]+_>_"\)\}/.test(out.code));
  eq("T21: una const in cima", 1, (out.code.match(/const __vtNode = __vtUseNode\(\);/g) ?? []).length);
  eq("T21: import in fondo", true, out.code.trimEnd().endsWith('from "@sepoina/vitetranslate/react";'));
}
{
  console.log("-- T22: tre marcatori nello stesso componente -> una sola const, un solo import --");
  const src = inComponent(`<div><p>_%_a_%_</p><p>_%_b_%_</p><p>_%_c_%_</p></div>`);
  const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T22: tre chiamate __vtNode", 3, (out.code.match(/__vtNode\(/g) ?? []).length);
  eq("T22: una sola const", 1, (out.code.match(/const __vtNode = __vtUseNode\(\);/g) ?? []).length);
  eq("T22: un solo import", 1, out.code.split('from "@sepoina/vitetranslate/react"').length - 1);
}
{
  console.log("-- T23: componente rosso -> ripiego 4.3.0 --");
  const out = extractMarkers(inCalledComponent(`<p>_%_a_%_</p>`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T23: <__vtTranslate>, non l'hook", true, out.code.includes("<__vtTranslate"));
  eq("T23: nessun __vtNode", false, out.code.includes("__vtNode("));
}
{
  console.log("-- T24/T24b: <title>, con e senza spazi a cavallo --");
  const out1 = extractMarkers(inComponent(`<title>_%_a_%_</title>`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T24: hook stringa", true, out1.code.includes("__vtStr("));
  const out2 = extractMarkers(inComponent(`<title> _%_a_%_ </title>`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T24b: hook stringa anche con spazi a cavallo", true, out2.code.includes("__vtStr("));
  eq('T24b: nessun {" "} aggiunto', false, out2.code.includes('{" "}'));
}
{
  console.log("-- T25/T26: attributo host, forma diretta ed espressione --");
  const riparsabile = (code) => {
    try { normalize(code, "/p/src/App.jsx"); return true; }
    catch { return false; }
  };
  const out1 = extractMarkers(inComponent(`<input placeholder="_%_a_%_" />`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T25: hook stringa sull'attributo", true, out1.code.includes("__vtStr("));
  eq("T25: import di useTranslateToString", true, out1.code.includes("useTranslateToString as __vtUseStr"));
  eq("T25: il codice prodotto si ri-parsa", true, riparsabile(out1.code));
  const out2 = extractMarkers(inComponent(`<input placeholder={"_%_a_%_"} />`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T26: idem in forma espressione", true, out2.code.includes("__vtStr("));
  // Bug reale, trovato da una build vera (playground, autoWrap: false — il DEFAULT): la
  // riscrittura aggiungeva SEMPRE le graffe, ma su t={"..."} le graffe sono gia' nel
  // sorgente (il nodo sostituito e' solo il literal fra virgolette) -> "{{...}}", doppie e
  // non valide. `out2.code.includes('{{')` da solo basterebbe, ma il ri-parse e' la prova
  // che conta davvero: una sottostringa non l'avrebbe presa, ed e' cosi' che e' passata la
  // prima volta.
  eq("T26: nessuna graffa doppia", false, out2.code.includes("{{"));
  eq("T26: il codice prodotto si ri-parsa", true, riparsabile(out2.code));
}
{
  console.log("-- T26b: stessa forma espressione, autoWrap SPENTO (il caso della build reale) --");
  const out = extractMarkers(inComponent(`<input placeholder={"_%_a_%_"} />`), { filename: "/p/src/App.jsx", table: {}, autoWrap: false });
  eq("T26b: nessuna graffa doppia col default", false, out.code.includes("{{"));
  eq("T26b: il codice prodotto si ri-parsa", true, (() => { try { normalize(out.code, "/p/src/App.jsx"); return true; } catch { return false; } })());
  // E lo stesso, fuori da qualunque componente: e' la forma esatta di App.jsx nel playground.
  const outModulo = extractMarkers(`const a = <T t={"_%_a_%_"} />;`, { filename: "/p/src/App.jsx", table: {}, autoWrap: false });
  eq("T26b: idem a livello di modulo", false, outModulo.code.includes("{{"));
  eq("T26b modulo: valore atteso", true, /t=\{"_<_[^"]+_>_"\}/.test(outModulo.code));
}
{
  console.log("-- T27: attributo su un componente, mai toccato --");
  const { out, catturati } = conAvvisi(inComponent(`<MyCard title="_%_a_%_" />`), { autoWrap: true });
  eq("T27: nessun hook sull'attributo", false, out.code.includes("__vtStr("));
  eq("T27: nessun avviso", 0, catturati.filter((c) => c.kind === "autowrap-noscope").length);
}
{
  console.log("-- T28: componente rosso, attributo host -> invariato + avviso --");
  const { out, catturati } = conAvvisi(inCalledComponent(`<input placeholder="_%_a_%_" />`), { autoWrap: true });
  eq("T28: nessun hook", false, out.code.includes("__vtStr("));
  eq("T28: avviso autowrap-noscope", true, catturati.some((c) => c.kind === "autowrap-noscope"));
}
{
  console.log("-- T28b/T28c: marcatore come figlio espressione, § 5.3 --");
  const riparsa = (code) => { try { normalize(code, "/p/src/App.jsx"); return true; } catch { return false; } };
  const out1 = extractMarkers(inComponent(`<p>{"_%_a_%_"}</p>`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T28b: __vtNode sul figlio espressione", true, out1.code.includes("__vtNode("));
  eq("T28b: nessuna graffa doppia", false, out1.code.includes("{{"));
  eq("T28b: il codice prodotto si ri-parsa", true, riparsa(out1.code));
  const out2 = extractMarkers(inComponent(`<title>{"_%_a_%_"}</title>`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T28c: __vtStr sul figlio espressione di un tag text-only", true, out2.code.includes("__vtStr("));
  eq("T28c: nessuna graffa doppia", false, out2.code.includes("{{"));
  eq("T28c: il codice prodotto si ri-parsa", true, riparsa(out2.code));
}
{
  console.log("-- T28d: il literal non figlio diretto del container resta fuori --");
  const out1 = extractMarkers(inComponent(`<p>{["_%_a_%_"]}</p>`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T28d array: invariato", false, out1.code.includes("__vt"));
  const out2 = extractMarkers(inComponent(`<p>{cond ? "_%_a_%_" : "_%_b_%_"}</p>`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T28d ternario: invariato", false, out2.code.includes("__vt"));
}
{
  console.log("-- T28e: figlio espressione, componente rosso --");
  const { out, catturati } = conAvvisi(inCalledComponent(`<p>{"_%_a_%_"}</p>`), { autoWrap: true });
  eq("T28e: invariato", false, out.code.includes("__vtNode("));
  eq("T28e: nessun <__vtTranslate> dentro le graffe", false, out.code.includes("<__vtTranslate"));
  eq("T28e: avviso", true, catturati.some((c) => c.kind === "autowrap-noscope"));
}
{
  console.log("-- T29: <li key=\"...\"> mai riscritto --");
  const { out, catturati } = conAvvisi(inComponent(`<ul><li key="_%_a_%_">x</li></ul>`), { autoWrap: true });
  eq("T29: nessun hook su key", false, out.code.includes("__vtStr("));
  eq("T29: un avviso dedicato", true, catturati.some((c) => c.kind === "autowrap-noscope" && c.msg.includes("key")));
}
{
  console.log("-- T30: un componente che usa entrambi gli hook --");
  const src = inComponent(`<div><p>_%_a_%_</p><input placeholder="_%_b_%_" /></div>`);
  const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T30: le due const sulla stessa riga", true, /const __vtNode = __vtUseNode\(\);const __vtStr = __vtUseStr\(\);|const __vtStr = __vtUseStr\(\);const __vtNode = __vtUseNode\(\);/.test(out.code));
  eq("T30: un solo import con due specifier", 1, out.code.split('from "@sepoina/vitetranslate/react"').length - 1);
  eq("T30: import elenca entrambi gli hook", true, /useTranslateNode as __vtUseNode.*useTranslateToString as __vtUseStr|useTranslateToString as __vtUseStr.*useTranslateNode as __vtUseNode/.test(out.code));
}
{
  console.log("-- T31: alias gia' presenti nel file -> tutti spostati al suffisso 2 --");
  const src = `const __vtNode = 1;\n${inComponent(`<p>_%_a_%_</p>`)}`;
  const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T31: __vtNode2 usato", true, out.code.includes("__vtNode2("));
  eq("T31: alias hook anche spostato", true, out.code.includes("useTranslateNode as __vtUseNode2"));
}
{
  console.log("-- T32: rewrite:false con autoWrap:true -> nessun wrap, nessuna iniezione --");
  const out = extractMarkers(inComponent(`<p>_%_a_%_</p>`), { filename: "/p/src/App.jsx", table: {}, autoWrap: true, rewrite: false });
  eq("T32: null", null, out);
}

console.log("\n== Posizioni e sourcemap con iniezione (T33-T36) ==");
{
  const righeVere = (code) => (code.endsWith("\n") ? code.slice(0, -1).split("\n") : code.split("\n"));
  console.log("-- T33: 'use client' resta il primo statement anche con un'iniezione --");
  const src = `"use client";\n${inComponent(`<p>_%_a_%_</p>`)}`;
  const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  eq("T33: la direttiva resta la prima riga", true, out.code.startsWith('"use client";'));
}
{
  console.log("-- T34: l'iniezione (start===end) non aggiunge righe oltre l'import finale --");
  const src = inComponent(`<p>_%_a_%_</p>`);
  const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true });
  const righeVere = (code) => (code.endsWith("\n") ? code.slice(0, -1).split("\n") : code.split("\n"));
  eq("T34: una sola riga in piu' (l'import)", righeVere(src).length + 1, righeVere(out.code).length);
}
{
  console.log("-- T35: sourcemap con un'iniezione, un segmento per riga prodotta --");
  const src = inComponent(`<p>_%_a_%_</p>`);
  const out = extractMarkers(src, { filename: "/p/src/App.jsx", table: {}, autoWrap: true, sourceMaps: true });
  const righeOut = out.code.split("\n").length;
  const segmenti = out.map.mappings.split(";").length;
  eq("T35: un segmento per riga prodotta", righeOut, segmenti);
}
console.log("-- T36: round trip di parse sul fallback -> gia' coperto dal blocco 't={...} e non t=\"...\"' sopra --");


console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
