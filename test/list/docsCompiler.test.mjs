// Il compilatore del manuale (site/pages/docs/scripts/compileDocs.mjs): il dialetto .mdx, ogni errore
// con file:riga, e il JSX che emette.
//
// Perché è un test e non "si vede nella pagina": un errore del dialetto che passa non rompe niente, finisce
// in una pagina sbagliata o in una stringa che la sync estrae male, e lo si scopre a traduzione fatta.
// Il caso che più conta è quello dei caratteri speciali nel testo (`{ } < > &`, `%s`, il delimitatore):
// devono diventare valori di K (`{K[n]}`) e mai testo traducibile, perché una traduzione che decodifica
// un'entità romperebbe il markup del paragrafo, mentre un `{n}` resta opaco.
//
//   node test/list/docsCompiler.test.mjs
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  collectCode, collectLinks, compileDocs, emitPage, escapeCode, imageSize, jsonSubtree, listMdx, pageIds, parseInline, parseMdx, slugOk, splitProse, splitSource,
} from "../../site/pages/docs/scripts/compileDocs.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(66), ok ? "" : `-> ${JSON.stringify(ottenuto)} (atteso ${JSON.stringify(atteso)})`);
};

/** Un PNG minimo: firma e IHDR, il resto non serve a imageSize. */
const png = (w, h) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};

const FRONT = "---\ntitle: Titolo\ndescription: Descrizione.\nsources:\n  - a.js\n---\n\n";
const pagina = (corpo, front = FRONT) => front + corpo;
/** parseMdx, riportando il messaggio d'errore (o null se passa). */
const errore = (testo, file = "p.mdx") => {
  try {
    parseMdx(testo, file);
    return null;
  } catch (e) {
    return e.message;
  }
};
const respinge = (nome, testo, frammento) => {
  const msg = errore(testo);
  eq(`${nome}: errore con file:riga`, true, !!msg && /^p\.mdx:\d+: /.test(msg) && msg.includes(frammento));
};
const accetta = (nome, testo) => eq(`${nome}: passa`, null, errore(testo));
const emetti = (corpo, front) => emitPage(parseMdx(pagina(corpo, front), "p.mdx"), "sez/pag");

// ------------------------------------------------------- frontmatter
console.log("\n== frontmatter ==");
{
  respinge("senza title", pagina("x", "---\ndescription: D\nsources:\n  - a.js\n---\n"), 'missing frontmatter key "title"');
  respinge("senza sources", pagina("x", "---\ntitle: T\ndescription: D\n---\n"), 'missing frontmatter key "sources"');
  respinge("sources vuoto", pagina("x", "---\ntitle: T\ndescription: D\nsources:\n---\n"), '"sources" needs at least one file');
  respinge("chiave sconosciuta", pagina("x", FRONT.replace("title: Titolo", "title: T\nauthor: io")), 'unknown frontmatter key "author"');
  respinge("chiave doppia", pagina("x", FRONT.replace("title: Titolo", "title: A\ntitle: B")), 'duplicate frontmatter key "title"');
  respinge("niente frontmatter", "Solo testo\n", "must start with the frontmatter");
  respinge("frontmatter non chiuso", "---\ntitle: T\n", "not closed");
  respinge("title con codice", pagina("x", FRONT.replace("Titolo", "Il `codice`")), "plain text only");
  respinge("description con graffe", pagina("x", FRONT.replace("Descrizione.", "Con {graffe}")), "plain text only");
  respinge("source con glob", pagina("x", FRONT.replace("a.js", "lib/*.js")), "no globs");
  respinge("source assoluta", pagina("x", FRONT.replace("a.js", "/lib/a.js")), "repo-relative");
  respinge("source con ..", pagina("x", FRONT.replace("a.js", "../a.js")), "repo-relative");
  respinge("voce di lista fuori da una lista", pagina("x", FRONT.replace("title: Titolo", "title: Titolo\n  - voce")), "list item outside a list key");
  respinge("alias con sintassi sbagliata", pagina("x", FRONT.replace("---\n\n", "aliases:\n  - non una rotta\n---\n\n")), "expected `section/page`");
  // related: `/section/page#id | label | detail`, at most 7, each target once.
  const conRelated = (...voci) => pagina("x", FRONT.replace("---\n\n", `related:\n${voci.map((v) => `  - ${v}\n`).join("")}---\n\n`));
  accetta("related con pagina e sezione", conRelated("/a/b | Voce | Dettaglio.", "/a/c#sez | Altra voce | Altro dettaglio."));
  respinge("related senza voce e dettaglio", conRelated("/a/b"), "expected /section/page#id | label | detail");
  respinge("related con la sola voce", conRelated("/a/b | Voce"), "expected /section/page#id | label | detail");
  respinge("related senza la barra iniziale", conRelated("a/b | V | D"), "expected /section/page#id");
  respinge("related con un link esterno", conRelated("https://x.dev | V | D"), "expected /section/page#id");
  respinge("related con codice nella voce", conRelated("/a/b | Il `codice` | D"), "related label: plain text only");
  respinge("related con graffe nel dettaglio", conRelated("/a/b | V | Con {graffe}"), "related detail: plain text only");
  respinge("related ripetuto", conRelated("/a/b | V | D", "/a/b | W | E"), 'related "/a/b" is listed twice');
  respinge("related oltre le 7 voci", conRelated(...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `/a/p${n} | V | D`)), "at most 7 entries");
  eq("related non entra nella pagina generata", false, emetti("x", FRONT.replace("---\n\n", "related:\n  - /a/b | V | D\n---\n\n")).includes("related"));
}

// ------------------------------------------------------- selettore JSON nelle sources (file.json#chiave)
console.log("\n== sources: selettore JSON ==");
{
  eq("splitSource: senza selettore", { file: "package.json", key: null }, splitSource("package.json"));
  eq("splitSource: con selettore", { file: "package.json", key: "peerDependencies" }, splitSource("package.json#peerDependencies"));
  eq("splitSource: selettore annidato", { file: "a/b.json", key: "x.y.z" }, splitSource("a/b.json#x.y.z"));
  accetta("a.json#chiave", pagina("x", FRONT.replace("a.js", "a.json#chiave")));
  accetta("a.json#b.c (annidata)", pagina("x", FRONT.replace("a.js", "a.json#b.c")));
  respinge("x.js#chiave: solo i JSON hanno un selettore", pagina("x", FRONT.replace("a.js", "x.js#chiave")), "only a JSON file takes a selector");
  respinge("selettore vuoto", pagina("x", FRONT.replace("a.js", "a.json#")), "only a JSON file takes a selector");
  respinge("selettore con ..", pagina("x", FRONT.replace("a.js", "a.json#b..c")), "only a JSON file takes a selector");
  const t = JSON.stringify({ a: { b: { c: 1 }, d: [1, 2] }, n: null, v: "x" });
  eq("jsonSubtree: un livello", { b: { c: 1 }, d: [1, 2] }, jsonSubtree(t, "a"));
  eq("jsonSubtree: annidato", { c: 1 }, jsonSubtree(t, "a.b"));
  eq("jsonSubtree: un null esiste", null, jsonSubtree(t, "n"));
  eq("jsonSubtree: chiave mancante", undefined, jsonSubtree(t, "a.zz"));
  eq("jsonSubtree: uno scalare in mezzo al percorso", undefined, jsonSubtree(t, "v.x"));
  eq("jsonSubtree: JSON illeggibile", undefined, jsonSubtree("{ non json", "a"));
}

// ------------------------------------------------------- titoli
console.log("\n== titoli ==");
{
  accetta("## con id", pagina("## Titolo {#titolo}\n"));
  respinge("titolo senza {#id}", pagina("## Titolo\n"), "heading without {#id}");
  respinge("id con maiuscole", pagina("## Titolo {#Titolo}\n"), 'heading id "Titolo"');
  respinge("id doppio", pagina("## A {#x}\n\n## B {#x}\n"), 'duplicate heading id "x"');
  respinge("h1 nel corpo", pagina("# Titolo {#t}\n"), "no h1 in the body");
  respinge("h4", pagina("#### Titolo {#t}\n"), "headings deeper than ###");
  respinge("titolo vuoto", pagina("## {#t}\n"), "empty heading");
  respinge("enfasi in un titolo", pagina("## Un *titolo* {#t}\n"), "headings take plain text and code only");
  respinge("link in un titolo", pagina("## Un [link](#t) {#t}\n"), "headings take plain text and code only");
  eq("pageIds: nell'ordine", ["a", "b"], pageIds(parseMdx(pagina("## A {#a}\n\n### B {#b}\n")).blocks));
  eq("slugOk", [true, false, false], [slugOk("a-b2"), slugOk("A"), slugOk("a_b")]);
}

// ------------------------------------------------------- blocchi
console.log("\n== blocchi ==");
{
  accetta("codice con lingua e titolo", pagina('```jsx title="App.jsx"\nconst a = 1;\n```\n'));
  accetta("codice senza lingua (text)", pagina("```\nx\n```\n"));
  respinge("lingua di codice sconosciuta", pagina("```rust\nx\n```\n"), 'unknown code language "rust"');
  respinge("codice non chiuso", pagina("```sh\nx\n"), "unclosed code fence");
  respinge("titolo del codice con il delimitatore", pagina('```sh title="_%_x_%_"\nx\n```\n'), "marker delimiter");
  respinge("elenco con * invece di -", pagina("* uno\n"), "list items start with `- `");
  accetta("elenco annidato a un livello", pagina("- uno\n  - sotto\n- due\n"));
  respinge("elenco annidato a due livelli", pagina("- uno\n  - due\n    - tre\n"), "only one nesting level");
  respinge("voce d'elenco su più righe", pagina("- uno\n  continua\n"), "a list item is one line");
  respinge("callout con alert sconosciuto", pagina("> [!FOO]\n> x\n"), 'unknown alert "[!FOO]"');
  respinge("callout con un elenco dentro", pagina("> [!NOTE]\n> - uno\n"), "a callout holds plain paragraphs only");
  respinge("callout con un blocco di codice", pagina("> [!NOTE]\n> ```sh\n"), "a callout holds plain paragraphs only");
  respinge("callout annidato", pagina("> [!NOTE]\n> > x\n"), "nested blockquotes");
  respinge("callout vuoto", pagina("> [!NOTE]\n"), "empty callout");
  accetta("callout con due paragrafi", pagina("> [!TIP]\n> uno\n>\n> due\n"));
  respinge("filetto orizzontale", pagina("---\n"), "horizontal rules");
  respinge("HTML grezzo", pagina("<div>x</div>\n"), "raw HTML and unknown components");
  respinge("componente sconosciuto", pagina('<Foo a="b" />\n'), "raw HTML and unknown components");
  respinge("<Demo> con attributo sconosciuto", pagina('<Demo page="x" foo="1" />\n'), 'unknown attribute "foo"');
  respinge("<Demo> senza page", pagina('<Demo anchor="x" />\n'), 'needs page="slug"');
  accetta("<Demo> con page e anchor", pagina('<Demo page="play" anchor="x" />\n'));
  respinge("tabella senza riga di separazione", pagina("| a | b |\n| 1 | 2 |\n"), "the second row must be the separator");
  respinge("tabella con una riga più larga", pagina("| a | b |\n| - | - |\n| 1 | 2 | 3 |\n"), "row has 3 cell(s)");
  eq("tabella: \\| è una barra letterale", "a|b", parseMdx(pagina("| x |\n| - |\n| a\\|b |\n")).blocks[0].rows[0][0][0].v);
  eq("tabella: la barra dentro il codice non divide", "a|b", parseMdx(pagina("| x |\n| - |\n| `a|b` |\n")).blocks[0].rows[0][0][0].v);
  respinge("immagine nel corpo di un paragrafo", pagina("testo ![a](img/x.png)\n"), "images are block-level");
  respinge("immagine con percorso fuori da img/", pagina("![a](x.png)\n"), "the path must be img/<file>");
  respinge("alt con markdown", pagina("![un *alt*](img/x.png)\n"), "plain text only");
  respinge("rientro", pagina("  indentato\n"), "unexpected indentation");
  respinge("commento non chiuso", pagina("<!-- aperto\n"), "unclosed comment");
  accetta("commento su più righe", pagina("<!-- uno\ndue -->\n\nTesto.\n"));
  eq("l'errore dice la riga giusta", true, /^p\.mdx:10: /.test(errore(pagina("Testo.\n\n## Sbagliato\n"), "p.mdx") ?? ""));
}

// ------------------------------------------------------- testo in linea
console.log("\n== testo in linea ==");
{
  const f = (line, why) => {
    throw new Error(`${line}: ${why}`);
  };
  const prova = (s) => {
    try {
      return parseInline(s, 1, f);
    } catch (e) {
      return e.message;
    }
  };
  respinge("enfasi non chiusa", pagina("un *testo senza fine\n"), "unclosed italic");
  respinge("enfasi annidata", pagina("*uno **due** tre*\n"), "nested emphasis");
  accetta("l'asterisco dentro un code span non conta come enfasi", pagina("*(only for `--llm-key-*`)*\n"));
  eq("code span con asterisco: un solo nodo corsivo con dentro testo e codice", ["i"], parseMdx(pagina("*(only for `--llm-key-*`)*\n")).blocks[0].inline.map((n) => n.t));
  respinge("code span vuoto (due backtick)", pagina("un ``codice`` doppio\n"), "empty code span");
  respinge("code span non chiuso", pagina("un `codice\n"), "unclosed code span");
  respinge("link dentro un link", pagina("[uno [due](#a)](#b)\n"), "a link cannot contain another link");
  respinge("[ senza ](target)", pagina("un [testo\n"), "`[` without `](target)`");
  respinge("link senza testo", pagina("[ ](#a)\n"), "link without text");
  respinge("bersaglio con &", pagina("[a](https://x.it/?a=1&b=2)\n"), "link target");
  respinge("bersaglio con il delimitatore", pagina("[a](https://x.it/_%_)\n"), "marker delimiter");
  respinge("bersaglio sconosciuto", pagina("[a](ftp://x.it)\n"), "link target");
  accetta("tutte le forme di bersaglio", pagina("[a](/sez/pag#x) [b](#x) [c](site:play#x) [d](repo:README.md#x) [e](https://x.it/y)\n"));
  eq("collectLinks: kind e dati", ["route", "hash", "site", "repo", "https"], collectLinks(parseMdx(pagina("[a](/sez/pag#x) [b](#x) [c](site:play#x) [d](repo:README.md#x) [e](https://x.it/y)\n")).blocks).map((l) => l.kind));
  eq("collectCode: anche nei titoli e nelle tabelle", ["a", "b", "c"], collectCode(parseMdx(pagina("## Titolo `a` {#t}\n\n| `b` |\n| - |\n| `c` |\n")).blocks));
  eq("parseInline: grassetto, testo e corsivo", ["b", "text", "i"],prova("**a** *b*").map((n) => n.t));
}

// ------------------------------------------------------- alias
console.log("\n== alias ==");
{
  const conAlias = (riga, corpo = "## Nuovo {#nuovo}\n") => pagina(corpo, FRONT.replace("---\n\n", `aliases:\n  - ${riga}\n---\n\n`));
  accetta("alias di pagina", conAlias("sez/vecchia"));
  accetta("alias di ancora", conAlias("sez/pag#vecchio -> nuovo"));
  respinge("alias a un id che non c'è", conAlias("sez/pag#vecchio -> altro"), 'no heading with id "altro"');
  accetta("l'id vecchio uguale a un titolo attuale passa il parse (lo giudica validate, che conosce le altre pagine)", conAlias("sez/pag#nuovo -> nuovo"));
  respinge("lo stesso id vecchio due volte", pagina("## Nuovo {#nuovo}\n", FRONT.replace("---\n\n", "aliases:\n  - sez/pag#v -> nuovo\n  - sez/pag#v -> nuovo\n---\n\n")), "already redirected");
  const e = emetti("## Nuovo {#nuovo}\n", FRONT.replace("---\n\n", "aliases:\n  - sez/pag#vecchio -> nuovo\n---\n\n"));
  eq("l'alias di ancora emette <span id aria-hidden> prima del titolo", true, e.includes('<span id="vecchio" aria-hidden="true" /><Heading depth={2} id="nuovo">'));
  const front = FRONT.replace("---\n\n", "aliases:\n  - altra/pag#vecchio -> nuovo\n---\n\n");
  const verso = emitPage(parseMdx(pagina("## Nuovo {#nuovo}\n", front), "p.mdx"), "sez/pag", { realRoutes: new Set(["sez/pag", "altra/pag"]) });
  eq("alias di ancora verso un'altra pagina vera: nessuno <span> (lo risolve il router)", false, verso.includes("<span"));
  const ex = emitPage(parseMdx(pagina("## Nuovo {#nuovo}\n", front), "p.mdx"), "sez/pag", { realRoutes: new Set(["sez/pag"]) });
  eq("alias di ancora di una pagina che non c'è più: lo <span> resta", true, ex.includes('<span id="vecchio" aria-hidden="true" />'));
  const stessa = emitPage(parseMdx(pagina("## Nuovo {#nuovo}\n", FRONT.replace("---\n\n", "aliases:\n  - sez/pag#vecchio -> nuovo\n---\n\n")), "p.mdx"), "sez/pag", { realRoutes: new Set(["sez/pag"]) });
  eq("alias di ancora sulla pagina stessa: lo <span> resta", true, stessa.includes('<span id="vecchio" aria-hidden="true" />'));
}

// ------------------------------------------------------- dimensioni delle immagini
console.log("\n== imageSize: PNG e WebP dall'intestazione ==");
{
  const riff = (kind, size = 40) => {
    const b = Buffer.alloc(size);
    b.write("RIFF", 0, "latin1");
    b.writeUInt32LE(size - 8, 4);
    b.write("WEBP", 8, "latin1");
    b.write(kind, 12, "latin1");
    return b;
  };
  eq("PNG", { width: 2058, height: 1380 }, imageSize(png(2058, 1380)));
  const x = riff("VP8X");
  x.writeUIntLE(799, 24, 3);
  x.writeUIntLE(599, 27, 3);
  eq("WebP esteso (VP8X)", { width: 800, height: 600 }, imageSize(x));
  const l = riff("VP8L");
  l[20] = 0x2f;
  l.writeUInt32LE((639 & 0x3fff) | ((479 & 0x3fff) << 14), 21);
  eq("WebP senza perdita (VP8L)", { width: 640, height: 480 }, imageSize(l));
  const v = riff("VP8 ");
  v[23] = 0x9d;
  v[24] = 0x01;
  v[25] = 0x2a;
  v.writeUInt16LE(320, 26);
  v.writeUInt16LE(200, 28);
  eq("WebP con perdita (VP8)", { width: 320, height: 200 }, imageSize(v));
  eq("un JPEG non si sa leggere", null, imageSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(0)])));
  eq("un GIF non si sa leggere", null, imageSize(Buffer.from("GIF89a" + "\0".repeat(40), "latin1")));
  eq("un file troncato non si sa leggere", null, imageSize(png(10, 10).subarray(0, 20)));
  eq("un PNG con larghezza 0 non è valido", null, imageSize(png(0, 10)));
  eq("un testo qualunque non si sa leggere", null, imageSize(Buffer.from("png")));
  eq("un file vuoto non si sa leggere", null, imageSize(Buffer.alloc(0)));
  const g = emitPage(parseMdx(pagina("![alt](img/x.png)\n"), "p.mdx"), "sez/pag", { imageSize: () => ({ width: 640, height: 480 }) });
  eq("emitPage: width e height nella figura", true, g.includes('<Figure src="img/x.png" alt={"_%_alt_%_"} width={640} height={480} />'));
  eq("emitPage: senza dimensioni, niente width/height", true, emetti("![alt](img/x.png)\n").includes('<Figure src="img/x.png" alt={"_%_alt_%_"} />'));
}

// ------------------------------------------------------- sequenze speciali nel testo
console.log("\n== sequenze speciali: valori di K, mai testo ==");
{
  const slot = (arr) => (s) => {
    if (!arr.includes(s)) arr.push(s);
    return `K[${arr.indexOf(s)}]`;
  };
  const K = [];
  eq("splitProse: testo senza speciali resta com'è", "ciao mondo", splitProse("ciao mondo", slot(K)));
  for (const [nome, c] of [["{", "{"], ["}", "}"], ["<", "<"], [">", ">"], ["&", "&"], ["%s", "%s"], ["il delimitatore", "_%_"]]) {
    const k = [];
    eq(`splitProse: ${nome} -> {K[0]}`, "a {K[0]} b", splitProse(`a ${c} b`, slot(k)));
    eq(`splitProse: ${nome} entra in K`, [c], k);
    const e = emetti(`Un ${c} nel paragrafo.\n`);
    eq(`emitPage: ${nome} nel paragrafo, mai come testo né come {"…"}`, true, e.includes("<p><Trans>Un {K[0]} nel paragrafo.</Trans></p>") && !/\{"/.test(e.split("export default")[1]));
  }
  {
    const k = [];
    eq("splitProse: più speciali in un paragrafo, e lo stesso valore riusa lo slot", "{K[0]}x{K[1]}y{K[0]}", splitProse("{x<y{", slot(k)));
    eq("splitProse: K nell'ordine di apparizione", ["{", "<"], k);
  }
  const e = emetti("- voce con { e <\n\n| a |\n| - |\n| cella con & |\n\n> [!NOTE]\n> callout con %s\n");
  const corpo = e.split("export default")[1];
  eq("emitPage: lista, cella e callout usano {K[n]}", true, corpo.includes("<li><Trans>voce con {K[") && corpo.includes("<td><Trans>cella con {K[") && corpo.includes("<p><Trans>callout con {K["));
  eq("emitPage: nessun carattere speciale nudo nel testo JSX", false, /<Trans>[^<]*[{}&][^<]*<\/Trans>/.test(corpo.replace(/\{K\[\d+\]\}/g, "")));
  eq("emitPage: K contiene i valori", true, /const K = \[\n  `\{`,\n  `<`,\n  `&`,\n  `%s`,\n\];/.test(e));
}

// ------------------------------------------------------- titoli emessi
console.log("\n== titoli emessi: %s e <code>%s</code> con i valori in `a` ==");
{
  const e = emetti("## Un titolo semplice {#a}\n\n## Con `codice` {#b}\n\n## Con `x` e `y` e < {#c}\n");
  eq("titolo semplice: stringa marcata, senza a", true, e.includes('{ id: "a", depth: 2, title: "_%_Un titolo semplice_%_" },'));
  eq("titolo con codice: <code>%s</code> e a: [K[n]]", true, e.includes('title: "_%_Con <code>%s</code>_%_", a: [K[0]]'));
  eq("titolo con più valori: nell'ordine, anche il carattere speciale", true, e.includes('title: "_%_Con <code>%s</code> e <code>%s</code> e %s_%_", a: [K[1], K[2], K[3]]'));
  eq("il titolo è emesso con <Heading depth id>", true, e.includes('<Heading depth={2} id="b"><Trans t={meta.headings[1].title} a={meta.headings[1].a} /></Heading>'));
  eq("un titolo senza valori non ha a=", true, e.includes('<Heading depth={2} id="a"><Trans t={meta.headings[0].title} /></Heading>'));
  eq("meta.headings porta id, depth e title", true, e.includes("export const meta = {") && e.includes('route: "sez/pag"'));
}

// ------------------------------------------------------- il delimitatore non compare nel resto
console.log("\n== il delimitatore _%_ compare solo nelle stringhe marcate di meta e nell'alt ==");
{
  const corpo = "Testo con _%_ in mezzo e `_%_` come codice.\n\n```js\nconst a = \"_%_x_%_\";\n```\n\n## Titolo con _%_ {#t}\n\n![alt della figura](img/x.png)\n\n- voce con _%_\n";
  const e = emetti(corpo);
  const senzaMarcate = e
    .replace(/title: "_%_[^"]*_%_"/g, "")
    .replace(/description: "_%_[^"]*_%_"/g, "")
    .replace(/alt=\{"_%_[^"]*_%_"\}/g, "")
    .replace(/\{ id: "[^"]*", depth: \d, title: "_%_[^"]*_%_"[^}]*\}/g, "");
  eq("nessun _%_ fuori dalle stringhe marcate", false, senzaMarcate.includes("_%_"));
  eq("il codice con il delimitatore usa M (composto a runtime)", true, e.includes("${M}x${M}") && e.includes('const M = ["_", "%", "_"].join("");'));
  eq("escapeCode: backslash, backtick, ${ e delimitatore", "\\\\ \\` \\${ ${M}", escapeCode("\\ ` ${ _%_"));
}

// ------------------------------------------------------- CRLF, riemissione identica
console.log("\n== CRLF e LF, riemissione ==");
{
  const lf = pagina("## Titolo {#t}\n\nTesto con `codice`.\n\n```sh\nnpm i\n```\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  eq("CRLF e LF danno lo stesso JSX", emitPage(parseMdx(lf), "a/b"), emitPage(parseMdx(crlf), "a/b"));
  eq("la stessa pagina due volte dà lo stesso JSX", emitPage(parseMdx(lf), "a/b"), emitPage(parseMdx(lf), "a/b"));
}

// ------------------------------------------------------- compileDocs su un albero finto
console.log("\n== compileDocs su un albero finto: i controlli tra pagine e sul disco ==");
{
  const tmp = mkdtempSync(join(tmpdir(), "vt-docs-"));
  const root = join(tmp, "site/pages/docs");
  const scrivi = (rel, testo) => {
    mkdirSync(dirname(join(tmp, rel)), { recursive: true });
    writeFileSync(join(tmp, rel), testo);
  };
  const front = (extra = "", sources = "README.md") => `---\ntitle: T\ndescription: D\nsources:\n  - ${sources}\n${extra}---\n\n`;
  const albero = (pagine, nav) => {
    rmSync(join(root, "content"), { recursive: true, force: true });
    for (const [rotta, testo] of Object.entries(pagine)) scrivi(`site/pages/docs/content/${rotta}.mdx`, testo);
    scrivi("site/pages/docs/src/nav.js", `export const NAV = [{ label: "x", items: [${(nav ?? Object.keys(pagine)).map((r) => `"${r}"`).join(", ")}] }];\n`);
  };
  const compila = () => {
    const righe = [];
    try {
      const r = compileDocs({ root, log: (l) => righe.push(l) });
      return { ok: true, r, righe };
    } catch (e) {
      return { ok: false, errors: e.errors, righe };
    }
  };
  const dice = (nome, res, frammento) => eq(`${nome}`, true, !res.ok && res.errors.some((e) => e.includes(frammento)));
  try {
    scrivi("README.md", "# x\n");
    scrivi("site/pages/play/package.json", JSON.stringify({ vitetranslateSite: { slug: "play" } }));
    mkdirSync(join(tmp, "site/pages/docs/public/img"), { recursive: true });
    writeFileSync(join(tmp, "site/pages/docs/public/img/x.png"), png(640, 480));
    scrivi("package.json", JSON.stringify({ peer: { a: 1 } }));

    albero({ "a/uno": `${front()}## Sezione {#sez}\n\nTesto [verso due](/a/due#altra).\n`, "a/due": `${front()}## Altra {#altra}\n` });
    let c = compila();
    eq("un albero valido compila", true, c.ok);
    eq("compila: routes.json, routes.js e una pagina per rotta", true, c.ok && c.r.routes.length === 2 && readFileSync(join(root, "src/generated/routes.js"), "utf8").includes('"a/due"'));
    eq("la rotta porta titolo, ids e alias", { route: "a/uno", title: "T", description: "D", ids: ["sez"], aliases: [] }, c.ok ? c.r.routes.find((r) => r.route === "a/uno") : null);
    const scritti = compila();
    eq("lo stesso input non scrive niente", 0, scritti.ok ? scritti.r.written : -1);

    albero({ "a/uno": `${front()}[x](/a/manca)\n` });
    dice("link a una pagina che non c'è", compila(), 'link to "/a/manca": no such page');
    albero({ "a/uno": `${front()}## S {#s}\n\n[x](/a/uno#nonc)\n` });
    dice("link a un id che non c'è", compila(), "no such section");
    albero({ "a/uno": `${front()}## S {#s}\n\n[x](#nonc)\n` });
    dice("link #id a una sezione che non c'è", compila(), 'link to "#nonc"');
    albero({ "a/uno": `${front("aliases:\n  - a/uno#vecchio -> s\n")}## S {#s}\n\n[x](#vecchio)\n` });
    eq("un id che solo un alias fornisce è un bersaglio valido", true, compila().ok);
    albero({ "a/uno": `${front()}[x](site:nonesiste)\n` });
    dice("site: con uno slug sconosciuto", compila(), 'link "site:nonesiste"');
    albero({ "a/uno": `${front()}[x](site:play#qualcosa)\n` });
    eq("site: con uno slug noto", true, compila().ok);
    albero({ "a/uno": `${front()}[x](repo:non/esiste.md)\n` });
    dice("repo: con un file che non c'è", compila(), 'no such file in the repo');
    albero({ "a/uno": `${front()}![x](img/non-c-e.png)\n` });
    dice("immagine mancante", compila(), 'image "img/non-c-e.png"');
    scrivi("site/pages/docs/public/img/foto.jpg", "non un png");
    albero({ "a/uno": `${front()}![x](img/foto.jpg)\n` });
    dice("un formato che non sa leggere è un errore di compilazione", compila(), 'image "img/foto.jpg": cannot read its size (PNG and WebP only)');
    albero({ "a/uno": `${front()}![x](img/x.png)\n` });
    c = compila();
    eq("un PNG valido compila e porta width/height nella pagina generata", true, c.ok && readFileSync(join(root, "src/generated/pages/a/uno.jsx"), "utf8").includes('width={640} height={480}'));
    albero({ "a/uno": `${front()}<Demo page="nonesiste" />\n` });
    dice("<Demo> con una pagina sconosciuta", compila(), "no such site page");
    albero({ "a/uno": front("", "non/esiste.js") + "x\n" });
    dice("source che non esiste", compila(), 'source "non/esiste.js" does not exist');
    albero({ "a/uno": front("", "package.json#peer.a") + "x\n" });
    eq("source con selettore: la chiave c'è", true, compila().ok);
    albero({ "a/uno": front("", "package.json#peer.zz") + "x\n" });
    dice("source con selettore: la chiave non c'è", compila(), 'no key "peer.zz" in package.json');
    albero({ "a/uno": `${front("aliases:\n  - a/due\n")}x\n`, "a/due": `${front()}x\n` });
    dice("alias che è una pagina vera", compila(), 'is a real page');
    albero({ "a/uno": `${front("aliases:\n  - a/uno\n")}x\n` });
    dice("alias che è la rotta della pagina stessa", compila(), "is the route of this page");

    // Una sezione passata da una pagina vera a un'altra: l'alias di ancora è ammesso, lo risolve il router.
    albero({ "a/uno": `${front()}## Resta {#resta}\n`, "a/due": `${front("aliases:\n  - a/uno#spostata -> nuova\n")}## Nuova {#nuova}\n` });
    c = compila();
    eq("alias di ancora tra due pagine esistenti: compila", true, c.ok);
    eq("aliases.json: route#old -> nuova/route#new", { "a/uno#spostata": "a/due#nuova" }, JSON.parse(readFileSync(join(root, "src/generated/aliases.json"), "utf8")));
    eq("la pagina che accoglie la sezione non emette lo <span>", false, readFileSync(join(root, "src/generated/pages/a/due.jsx"), "utf8").includes("<span"));
    eq("routes.json porta l'alias di ancora", ["a/uno#spostata -> nuova"], JSON.parse(readFileSync(join(root, "src/generated/routes.json"), "utf8")).find((r) => r.route === "a/due").aliases);
    albero({ "a/uno": `${front()}## Spostata {#spostata}\n`, "a/due": `${front("aliases:\n  - a/uno#spostata -> nuova\n")}## Nuova {#nuova}\n` });
    dice("l'id vecchio è ancora una sezione della pagina che si lascia", compila(), '"spostata" is still a section of "a/uno"');
    albero({ "a/uno": `${front()}x\n`, "a/due": `${front("aliases:\n  - a/uno#sezione -> sezione\n")}## Sezione {#sezione}\n` });
    eq("lo stesso id su due pagine diverse (la sezione passa da una all'altra senza rinomina) è ammesso", true, compila().ok);
    albero({ "a/uno": `${front()}x\n`, "a/due": `${front("aliases:\n  - b/vecchia#nuova -> nuova\n")}## Nuova {#nuova}\n` });
    dice("alias di una pagina che non c'è più, con old uguale a un titolo attuale di questa", compila(), 'is the id of a current heading');
    albero({ "a/uno": `${front("aliases:\n  - a/due#s -> nuova\n")}## Nuova {#nuova}\n`, "a/due": `${front("aliases:\n  - a/due#s -> altra\n")}## Altra {#altra}\n` });
    dice("la stessa route#old rivendicata da due pagine", compila(), "is also claimed by");
    albero({ "a/uno": `${front()}## Resta {#resta}\n`, "a/due": `${front("aliases:\n  - a/uno#spostata -> nuova\n")}## Nuova {#nuova}\n\n[x](/a/uno#spostata)\n` });
    dice("un link scritto nel manuale a una sezione spostata resta un errore", compila(), 'link to "/a/uno#spostata": no such section');
    albero({ "a/uno": `${front("aliases:\n  - a/uno#v -> resta\n  - a/uno#v -> resta\n")}## Resta {#resta}\n` });
    dice("due volte lo stesso route#old nella stessa pagina", compila(), "already redirected");
    albero({ "a/uno": `${front("aliases:\n  - a/uno#v -> resta\n")}## Resta {#resta}\n\n[x](#v)\n` });
    eq("un alias di ancora della pagina stessa resta un bersaglio valido dei link interni", true, compila().ok);
    albero({ "a/uno": `${front("aliases:\n  - b/x\n")}x\n`, "a/due": `${front("aliases:\n  - b/x\n")}x\n` });
    dice("lo stesso alias rivendicato da due pagine", compila(), "is also claimed by");
    albero({ "a/uno": `${front("related:\n  - /a/due#altra | Voce | Il dettaglio.\n  - /a/due | Due | La pagina.\n")}x\n`, "a/tre": `${front("related:\n  - /a/due#altra | Voce | Il dettaglio.\n")}x\n`, "a/due": `${front()}## Altra {#altra}\n` });
    c = compila();
    eq("related verso una pagina e una sua sezione: compila", true, c.ok);
    const related = c.ok ? readFileSync(join(root, "src/generated/related.js"), "utf8") : "";
    eq("related.js: una voce per riga, con voce e dettaglio marcati", true, related.includes('{ route: "a/due", id: "altra", label: "_%_Voce_%_", detail: "_%_Il dettaglio._%_" },') && related.includes('{ route: "a/due", id: null, label: "_%_Due_%_", detail: "_%_La pagina._%_" },'));
    eq("related.js: la stessa frase su due pagine è nello stesso file (una chiave)", 2, (related.match(/_%_Il dettaglio\._%_/g) ?? []).length);
    eq("related.js: le pagine senza related non compaiono", false, related.includes('"a/due": ['));
    albero({ "a/uno": `${front("related:\n  - /a/manca | V | D\n")}x\n` });
    dice("related verso una pagina che non c'è", compila(), 'related "/a/manca": no such page');
    albero({ "a/uno": `${front("related:\n  - /a/due#nonc | V | D\n")}x\n`, "a/due": `${front()}## Altra {#altra}\n` });
    dice("related verso una sezione che non c'è", compila(), 'related "/a/due#nonc": no such section');
    albero({ "a/uno": `${front("related:\n  - /a/uno | V | D\n")}## S {#s}\n` });
    dice("related verso la pagina stessa", compila(), "this page itself");
    albero({ "a/uno": `${front("related:\n  - /a/due#vecchio | V | D\n")}x\n`, "a/due": `${front("aliases:\n  - a/due#vecchio -> altra\n")}## Altra {#altra}\n` });
    dice("related verso un id che solo un alias tiene in vita", compila(), 'related "/a/due#vecchio": no such section');
    albero({ "a/uno": `${front()}x\n`, "a/due": `${front()}x\n` }, ["a/uno"]);
    dice("pagina che manca da nav.js", compila(), "missing from src/nav.js");
    albero({ "a/uno": `${front()}x\n` }, ["a/uno", "a/fantasma"]);
    dice("rotta di nav.js senza pagina", compila(), 'route "a/fantasma" has no page');
    albero({ "a/uno": `${front()}x\n` }, ["a/uno", "a/uno"]);
    dice("pagina elencata due volte in nav.js", compila(), "listed 2 times");
    albero({ "uno": `${front()}x\n` }, []);
    dice("un percorso che non è sezione/pagina", compila(), "the path must be section/page");

    // La pagina che non compila scrive i suoi errori e non tocca src/generated.
    albero({ "a/uno": `${front()}## Senza id\n` });
    const rotto = compila();
    eq("un errore di sintassi è riportato con file:riga e salta la scrittura", true, !rotto.ok && rotto.righe.some((r) => /content\/a\/uno\.mdx:\d+: heading without \{#id\}/.test(r)));
    eq("listMdx: i percorsi relativi, con /, in ordine", ["a/uno.mdx"], listMdx(join(root, "content")));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
