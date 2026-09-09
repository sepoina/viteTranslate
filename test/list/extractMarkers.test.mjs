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
  // Nota sull'entity: la decodifica di "&amp;" -> "&" avviene già al PRIMO parse, sul
  // `JSXText` originale (comportamento di JSX, non introdotto da questo piano — vale anche
  // senza autoWrap). Quello che si verifica qui è che, dopo quella singola decodifica
  // dovuta a JSX, il valore non subisca alcuna corruzione ULTERIORE nei parse successivi.
  const casi = [
    ["virgoletta nel fallback", `const x = <p>_%_dice "ciao"_%_</p>;`, 'dice "ciao"'],
    ["entity HTML nel fallback (decodificata una sola volta)", `const x = <p>_%_Tom &amp; Jerry_%_</p>;`, "Tom & Jerry"],
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

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
