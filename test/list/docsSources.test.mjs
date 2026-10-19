// Il legame fra il codice e il manuale (site/cli/docsSources.mjs): quali pagine descrivono quali file, se il
// codice è cambiato dall'ultima rilettura, e le verifiche che `npm run commit` fa sul manuale.
//
// Perché è un test e non "si vede nell'uscita": questa è la rete che impedisce al manuale di restare
// indietro in silenzio. Se `status` smette di accorgersi di un cambio, o `seal` toglie un'ancora già
// pubblicata, nessuno se ne accorge finché un lettore non trova un link morto. Tutto gira su un albero
// finto in una cartella temporanea, come site.test.mjs.
//
//   node test/list/docsSources.test.mjs
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checks, hashFile, hashSource, loadPages, readLock, scanScope, seal, status } from "../../site/cli/docsSources.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(70), ok ? "" : `-> ${JSON.stringify(ottenuto)} (atteso ${JSON.stringify(atteso)})`);
};

const tmp = mkdtempSync(join(tmpdir(), "vt-docssrc-"));
const scrivi = (rel, testo) => {
  mkdirSync(dirname(join(tmp, rel)), { recursive: true });
  writeFileSync(join(tmp, rel), testo);
};
const leggi = (rel) => readFileSync(join(tmp, rel), "utf8");
const pagina = (sources, corpo = "## Sezione {#sezione}\n\nTesto.\n", extra = "") =>
  `---\ntitle: Titolo\ndescription: Descrizione.\nsources:\n${sources.map((s) => `  - ${s}`).join("\n")}\n${extra}---\n\n${corpo}`;
const PUNTATORE = (routes) => `// DOCS-PAGE: ${routes} — il manuale descrive questo file.\n`;
const livello = (voci, nome) => voci.find((v) => v.name === nome)?.level;
const righe = (voci, nome) => voci.find((v) => v.name === nome)?.lines ?? [];
const pulisci = () => {
  rmSync(join(tmp, "site"), { recursive: true, force: true });
};

try {
  // ------------------------------------------------------- hash: fine riga e selettore
  console.log("\n== hash ==");
  scrivi("lib/a.js", `${PUNTATORE("x/uno")}export const a = 1;\n`);
  scrivi("crlf.txt", "una\ndue\n");
  scrivi("lf.txt", "una\r\ndue\r\n");
  eq("hashFile: CRLF e LF danno lo stesso hash", hashFile(join(tmp, "crlf.txt")), hashFile(join(tmp, "lf.txt")));
  eq("hashFile: un file che non c'è", null, hashFile(join(tmp, "non-c-e.txt")));
  scrivi("p.json", JSON.stringify({ version: "1", peer: { a: { b: 1 } } }));
  const h1 = hashSource(tmp, "p.json#peer.a");
  scrivi("p.json", JSON.stringify({ version: "2", peer: { a: { b: 1 } } }));
  eq("hashSource: una chiave estranea cambia e l'hash no", h1, hashSource(tmp, "p.json#peer.a"));
  eq("hashSource: senza selettore l'hash è quello del file intero", hashFile(join(tmp, "p.json")), hashSource(tmp, "p.json"));
  scrivi("p.json", JSON.stringify({ version: "2", peer: { a: { b: 2 } } }));
  eq("hashSource: cambia il sottoalbero e l'hash cambia", true, h1 !== hashSource(tmp, "p.json#peer.a"));
  eq("hashSource: chiave mancante", null, hashSource(tmp, "p.json#peer.zz"));
  eq("hashSource: file mancante", null, hashSource(tmp, "non-c-e.json#a"));
  scrivi("p.json", `{\n  "peer": {"a": {"b": 2}},\n\n  "version": "9"\n}\n`);
  eq("hashSource: la formattazione del file non conta, solo il sottoalbero", hashSource(tmp, "p.json#peer.a"), (() => {
    scrivi("p.json", JSON.stringify({ peer: { a: { b: 2 } } }));
    return hashSource(tmp, "p.json#peer.a");
  })());

  // ------------------------------------------------------- status e seal
  console.log("\n== status e seal ==");
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"]));
  eq("loadPages: legge le pagine di content/", ["x/uno"], loadPages(tmp).map((p) => p.route));
  eq("status: una pagina mai sigillata è stale", [["x/uno", ["not sealed yet"]]], status(tmp).stale.map((s) => [s.route, s.reasons]));
  let errore = null;
  try {
    seal([], { radice: tmp, head: "abc" });
  } catch (e) {
    errore = e.message;
  }
  eq("seal: senza rotte rifiuta", true, !!errore && errore.includes("name the pages"));
  try {
    seal(["x/non-c-e"], { radice: tmp, head: "abc" });
    errore = null;
  } catch (e) {
    errore = e.message;
  }
  eq("seal: una rotta che non è una pagina rifiuta", true, !!errore && errore.includes('no page "x/non-c-e"'));
  seal(["x/uno"], { radice: tmp, head: "abc" });
  eq("seal: la pagina diventa fresca", [[], ["x/uno"]], [status(tmp).stale, status(tmp).fresh]);
  eq("seal: registra hash e commit", { sealedAt: "abc", keys: ["lib/a.js"] }, { sealedAt: readLock(tmp).pages["x/uno"].sealedAt, keys: Object.keys(readLock(tmp).pages["x/uno"].sources) });
  eq("seal: registra la rotta e le ancore", ["x/uno", "x/uno#sezione"], readLock(tmp).anchors);
  scrivi("lib/a.js", leggi("lib/a.js").replace(/\n/g, "\r\n"));
  eq("status: un cambio di soli fine riga non rende la pagina stale", [], status(tmp).stale);
  scrivi("lib/a.js", `${PUNTATORE("x/uno")}export const a = 2;\n`);
  const s = status(tmp).stale[0];
  eq("status: un cambio vero rende la pagina stale, con file e commit", ["x/uno", ["changed: lib/a.js"], ["lib/a.js"], "abc"], [s.route, s.reasons, s.files, s.sealedAt]);
  seal(["x/uno"], { radice: tmp, head: "def" });
  eq("seal di nuovo: torna fresca", [], status(tmp).stale);
  scrivi("lib/b.js", `${PUNTATORE("x/uno")}export const b = 1;\n`);
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js", "lib/b.js"]));
  eq("status: una source aggiunta nel frontmatter", ["source added: lib/b.js"], status(tmp).stale[0].reasons);
  seal(["x/uno"], { radice: tmp, head: "def" });
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"]));
  eq("status: una source tolta dal frontmatter", ["source removed: lib/b.js"], status(tmp).stale[0].reasons);
  seal(["x/uno"], { radice: tmp, head: "def" });
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js", "lib/manca.js"]));
  try {
    seal(["x/uno"], { radice: tmp, head: "def" });
    errore = null;
  } catch (e) {
    errore = e.message;
  }
  eq("seal: una source che non esiste rifiuta", true, !!errore && errore.includes("lib/manca.js"));
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"]));

  // ------------------------------------------------------- selettore JSON in una pagina
  console.log("\n== sources con selettore (file.json#chiave) ==");
  scrivi("package.json", JSON.stringify({ version: "1.0.0", peerDependencies: { react: "^19" } }));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["package.json#peerDependencies"]));
  seal(["x/due"], { radice: tmp, head: "abc" });
  eq("selettore: il lock registra l'hash del sottoalbero", true, readLock(tmp).pages["x/due"].sources["package.json#peerDependencies"] === hashSource(tmp, "package.json#peerDependencies"));
  scrivi("package.json", JSON.stringify({ version: "1.0.1", peerDependencies: { react: "^19" } }));
  eq("selettore: un'altra chiave del JSON cambia e la pagina resta fresca", [], status(tmp).stale.filter((x) => x.route === "x/due"));
  scrivi("package.json", JSON.stringify({ version: "1.0.1", peerDependencies: { react: "^20" } }));
  eq("selettore: cambia il sottoalbero e la pagina è stale", ["changed: package.json#peerDependencies"], status(tmp).stale.find((x) => x.route === "x/due")?.reasons);
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["package.json#nonc"]));
  try {
    seal(["x/due"], { radice: tmp, head: "abc" });
    errore = null;
  } catch (e) {
    errore = e.message;
  }
  eq("selettore: seal rifiuta una chiave che non c'è", true, !!errore && errore.includes("package.json#nonc"));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["package.json#peerDependencies"]));
  seal(["x/due"], { radice: tmp, head: "abc" });

  // ------------------------------------------------------- le ancore non si perdono
  console.log("\n== ancore pubblicate ==");
  eq("ancore: ci sono rotta e sezione", true, readLock(tmp).anchors.includes("x/uno#sezione"));
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"], "## Altro {#altro}\n\nTesto.\n"));
  eq("ancore: una sezione sparita senza alias è un KO", "ko", livello(checks(tmp), "published anchors"));
  eq("ancore: il KO dice quale", true, righe(checks(tmp), "published anchors").some((r) => r.includes("x/uno#sezione")));
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"], "## Altro {#altro}\n\nTesto.\n", "aliases:\n  - x/uno#sezione -> altro\n"));
  eq("ancore: con un alias torna ok", "ok", livello(checks(tmp), "published anchors"));
  seal(["x/uno"], { radice: tmp, head: "def" });
  eq("seal: aggiunge le ancore nuove e non toglie le vecchie", ["x/uno", "x/uno#altro", "x/uno#sezione", "x/due", "x/due#sezione"].sort(), readLock(tmp).anchors);
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"]));
  seal(["x/uno"], { radice: tmp, head: "def" });
  eq("seal: neanche sigillando una pagina che le ha perse", true, readLock(tmp).anchors.includes("x/uno#altro") && readLock(tmp).anchors.includes("x/uno#sezione"));
  eq("ancore: sigillata e poi tolta senza alias (altro) è un KO", "ko", livello(checks(tmp), "published anchors"));
  rmSync(join(tmp, "site/pages/docs/content/x/due.mdx"));
  eq("ancore: la rotta sparita senza alias è un KO", "ko", livello(checks(tmp), "published anchors"));
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"], "## Sezione {#sezione}\n\nTesto.\n", "aliases:\n  - x/due\n"));
  eq("ancore: un alias di pagina copre la rotta, non le sue sezioni", [true, true], [righe(checks(tmp), "published anchors").some((r) => r.includes("x/due#sezione")), !righe(checks(tmp), "published anchors").some((r) => /x\/due:/.test(r))]);

  // ------------------------------------------------------- alias di ancora tra due pagine esistenti
  console.log("\n== alias di ancora tra pagine esistenti ==");
  pulisci();
  scrivi("lib/a.js", `${PUNTATORE("x/uno, x/due")}export const a = 1;\n`);
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"], "## Resta {#resta}\n\n## Spostata {#spostata}\n"));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["lib/a.js"], "## Nuova {#nuova}\n"));
  seal(["x/uno", "x/due"], { radice: tmp, head: "abc" });
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"], "## Resta {#resta}\n"));
  eq("ancore: la sezione spostata senza alias è un KO", true, righe(checks(tmp), "published anchors").some((r) => r.includes("x/uno#spostata")));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["lib/a.js"], "## Nuova {#nuova}\n", "aliases:\n  - x/uno#spostata -> nuova\n"));
  eq("ancore: con l'alias dell'altra pagina (route#old -> new) torna ok", "ok", livello(checks(tmp), "published anchors"));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["lib/a.js"], "## Nuova {#nuova}\n", "aliases:\n  - y/altra#spostata -> nuova\n"));
  eq("ancore: un alias con lo stesso old ma di un'altra route non copre", true, righe(checks(tmp), "published anchors").some((r) => r.includes("x/uno#spostata")));
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"], "## Resta {#resta}\n", "aliases:\n  - x/due#vecchia -> resta\n"));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["lib/a.js"], "## Nuova {#nuova}\n"));
  eq("ancore: un alias dichiarato sulla pagina stessa ma per un'altra route non copre", true, righe(checks(tmp), "published anchors").some((r) => r.includes("x/uno#spostata")));
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js"], "## Resta {#resta}\n"));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["lib/a.js"], "## Nuova {#nuova}\n", "aliases:\n  - x/uno#spostata -> nuova\n"));
  scrivi("README.md", "Vedi https://sepoina.github.io/viteTranslate/docs/x/uno/#spostata e https://sepoina.github.io/viteTranslate/docs/x/uno/#resta.\n");
  eq("link in entrata: un vecchio indirizzo coperto da un alias di un'altra pagina è valido", "ok", livello(checks(tmp), "links into the manual"));
  scrivi("README.md", "Vedi https://sepoina.github.io/viteTranslate/docs/x/uno/#mai-esistita.\n");
  eq("link in entrata: un id che nessun alias nomina resta un KO", "ko", livello(checks(tmp), "links into the manual"));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["lib/a.js"], "## Nuova {#nuova}\n", "aliases:\n  - y/altra#mai-esistita -> nuova\n"));
  eq("link in entrata: l'alias di un'altra route non copre", "ko", livello(checks(tmp), "links into the manual"));
  scrivi("README.md", "Niente.\n");


  console.log("\n== puntatori DOCS-PAGE ==");
  pulisci();
  scrivi("lib/a.js", "export const a = 1;\n");
  scrivi("lib/b.js", `${PUNTATORE("x/uno, x/due")}export const b = 1;\n`);
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js", "lib/b.js"]));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["lib/b.js", "package.json#peerDependencies"]));
  let v = checks(tmp);
  eq("puntatori: manca in lib/a.js", ["  lib/a.js has no \"DOCS-PAGE: x/uno\" line"], righe(v, "back-pointers"));
  eq("puntatori: una riga con più rotte le soddisfa tutte (lib/b.js)", false, righe(v, "back-pointers").some((r) => r.includes("lib/b.js")));
  eq("puntatori: un .json (con selettore) è esente", false, righe(v, "back-pointers").some((r) => r.includes("package.json")));
  scrivi("lib/a.js", `${PUNTATORE("x/uno")}export const a = 1;\n`);
  eq("puntatori: con il puntatore va ok", "ok", livello(checks(tmp), "back-pointers"));
  scrivi("lib/c.js", `${PUNTATORE("x/fantasma")}export const c = 1;\n`);
  eq("puntatori: l'altro verso, una rotta che non è una pagina", true, righe(checks(tmp), "back-pointers").some((r) => r.includes("lib/c.js") && r.includes("x/fantasma")));
  rmSync(join(tmp, "lib/c.js"));

  // ------------------------------------------------------- copertura dell'API pubblica
  console.log("\n== copertura dell'API pubblica ==");
  scrivi("lib/react.d.ts", `${PUNTATORE("x/uno")}export declare const Alfa: number;\nexport declare function beta(): void;\n`);
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js", "lib/b.js", "lib/react.d.ts"], "## S {#s}\n\nUsa `Alfa` e basta.\n"));
  v = checks(tmp);
  eq("copertura: un nome non citato nel codice di una pagina che elenca il file è un KO", "ko", livello(v, "API coverage"));
  eq("copertura: il KO nomina quello che manca", true, righe(v, "API coverage").some((r) => r.includes("lib/react.d.ts") && r.includes("beta") && !r.includes("Alfa,")));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["lib/b.js", "lib/react.d.ts"], "## S {#s}\n\nE poi `beta()`.\n"));
  scrivi("lib/react.d.ts", `${PUNTATORE("x/uno, x/due")}export declare const Alfa: number;\nexport declare function beta(): void;\n`);
  eq("copertura: i nomi si sommano fra le pagine che elencano il file", "ok", livello(checks(tmp), "API coverage"));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["lib/b.js", "lib/react.d.ts"], "## S {#s}\n\nE poi `betaX`.\n"));
  eq("copertura: un nome più lungo non vale (beta ≠ betaX)", "ko", livello(checks(tmp), "API coverage"));
  scrivi("site/pages/docs/content/x/due.mdx", pagina(["lib/b.js", "lib/react.d.ts"], "## S {#s}\n\nE poi `beta`.\n"));
  // l'estensione: idePlugin/package.json elencato con un selettore conta lo stesso
  scrivi("idePlugin/package.json", JSON.stringify({ name: "ide", contributes: { commands: [{ command: "vt.sync" }, { command: "vt.llm" }], configuration: { properties: { "vt.size": {} } } } }));
  scrivi("site/pages/docs/content/x/tre.mdx", pagina(["idePlugin/package.json#contributes"], "## S {#s}\n\nComandi `vt.sync` e `vt.llm`.\n"));
  v = checks(tmp);
  eq("copertura: con un selettore la copertura di idePlugin/package.json continua a funzionare", true, righe(v, "API coverage").some((r) => r.includes("idePlugin/package.json") && r.includes("vt.size")));
  scrivi("site/pages/docs/content/x/tre.mdx", pagina(["idePlugin/package.json#contributes"], "## S {#s}\n\nComandi `vt.sync` e `vt.llm`, setting `vt.size`.\n"));
  eq("copertura: nominati tutti, ok", "ok", livello(checks(tmp), "API coverage"));
  rmSync(join(tmp, "site/pages/docs/content/x/tre.mdx"));

  // ------------------------------------------------------- link dal resto del repo
  console.log("\n== link verso il manuale e verso i file migrati ==");
  scrivi("README.md", "Vedi https://sepoina.github.io/viteTranslate/docs/x/uno/#s e https://sepoina.github.io/viteTranslate/docs/.\n");
  eq("link in entrata: rotta e sezione che esistono, e la radice, vanno bene", "ok", livello(checks(tmp), "links into the manual"));
  scrivi("README.md", "Vedi https://sepoina.github.io/viteTranslate/docs/x/manca/ e https://sepoina.github.io/viteTranslate/docs/x/uno/#nonc.\n");
  v = checks(tmp);
  eq("link in entrata: pagina e sezione che non ci sono sono KO", ["no such page", "no such section"], righe(v, "links into the manual").map((r) => r.split("→ ")[1]));
  scrivi("README.md", "Niente.\n");
  scrivi("site/landing/src/l.jsx", `const A = [{ manual: "x/uno#s" }, { manual: 'x/uno' }];\nexport default () => <a manual="x/uno" href={docsUrl("x/uno#s")} />;\n`);
  eq("link in entrata dal sito: docsUrl(), manual: e manual= che esistono vanno bene", "ok", livello(checks(tmp), "links into the manual"));
  scrivi("site/landing/src/l.jsx", `const A = [{ manual: "x/manca" }];\nexport default () => <a manual='x/uno#nonc' href={docsUrl("x/uno#altra")} />;\n`);
  eq("link in entrata dal sito: le tre forme, pagina o sezione che mancano sono KO", ['  site/landing/src/l.jsx: manual: "x/manca" → no such page', "  site/landing/src/l.jsx: manual='x/uno#nonc' → no such section", '  site/landing/src/l.jsx: docsUrl("x/uno#altra" → no such section'], righe(checks(tmp), "links into the manual"));
  rmSync(join(tmp, "site/landing/src/l.jsx"));
  scrivi("README.md", "Vedi [la guida](doc/llm.md) e [un'altra](./cli.md) e doc/icu.md.\n");
  scrivi("doc/llm.md", "# stub\n");
  scrivi("doc/altro.md", "Vedi [la cli](cli.md) e [l'icu](./icu.md).\n");
  v = checks(tmp);
  eq("file migrati: doc/x.md nel README, il relativo solo dentro doc/", ["  README.md: doc/llm.md", "  README.md: doc/icu.md", "  doc/altro.md: cli.md", "  doc/altro.md: ./icu.md"], righe(v, "links to migrated files").slice(1));
  eq("file migrati: il segnaposto stesso (doc/llm.md) non conta", false, righe(v, "links to migrated files").some((r) => r.startsWith("  doc/llm.md")));
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js", "lib/b.js", "lib/react.d.ts"], "<!-- Migrated from doc/llm.md -->\n\n## S {#s}\n\nUsa `Alfa`.\n"));
  eq("file migrati: la nota 'Migrated from doc/x.md' in una pagina è provenienza, non un link", false, righe(checks(tmp), "links to migrated files").some((r) => r.includes("content/x/uno.mdx")));
  scrivi("README.md", "Niente.\n");
  rmSync(join(tmp, "doc"), { recursive: true });
  eq("file migrati: pulito", "ok", livello(checks(tmp), "links to migrated files"));

  // ------------------------------------------------------- TODO(links)
  console.log("\n== TODO(links) ==");
  eq("TODO(links): nessuno, ok", "ok", livello(checks(tmp), "TODO(links)"));
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js", "lib/b.js", "lib/react.d.ts"], "## S {#s}\n\nUsa `Alfa`.\n\n<!-- TODO(links): punta alla panoramica -->\n"));
  v = checks(tmp);
  eq("TODO(links): è un WARN", "warn", livello(v, "TODO(links)"));
  eq("TODO(links): con file e riga", true, righe(v, "TODO(links)").some((r) => /content\/x\/uno\.mdx:\d+: TODO\(links\): punta alla panoramica/.test(r)));
  scrivi("site/pages/docs/content/x/uno.mdx", pagina(["lib/a.js", "lib/b.js", "lib/react.d.ts"], "## S {#s}\n\nUsa `Alfa`.\n"));

  // ------------------------------------------------------- stato della traduzione
  console.log("\n== stato della traduzione ==");
  eq("traduzione: senza locale/ è un WARN", "warn", livello(checks(tmp), "translation status"));
  scrivi("site/pages/docs/locale/en-US.yml", '# intestazione\nA_1: "uno"\nA_2: "due"\n');
  scrivi("site/pages/docs/locale/it-IT.yml", '# intestazione\nA_1: "uno"\nA_2: null\n');
  v = checks(tmp);
  eq("traduzione: chiavi null → WARN con la percentuale", true, livello(v, "translation status") === "warn" && righe(v, "translation status").some((r) => r.includes("it-IT: 1/2 keys translated (50%)")));
  scrivi("site/pages/docs/locale/it-IT.yml", '# intestazione\nA_1: "uno"\nA_2: "due"\n');
  eq("traduzione: tutto tradotto, ok", "ok", livello(checks(tmp), "translation status"));

  // ------------------------------------------------------- le verifiche sono otto
  console.log("\n== l'insieme ==");
  eq("checks: le otto verifiche, nell'ordine", ["stale pages", "back-pointers", "API coverage", "published anchors", "links into the manual", "links to migrated files", "TODO(links)", "translation status"], checks(tmp).map((c) => c.name));
  scrivi("site/pages/docs/content/x/rotta.mdx", "non è un frontmatter\n");
  eq("checks: una pagina che non si legge è un KO unico", ["manual compiles"], checks(tmp).map((c) => c.name));
  rmSync(join(tmp, "site/pages/docs/content/x/rotta.mdx"));

  // ------------------------------------------------------- dove si cerca
  console.log("\n== scanScope ==");
  const url = "Vedi https://sepoina.github.io/viteTranslate/docs/x/nonc/ qui.\n";
  scrivi("site/pages/docs/src/generated/g.js", url);
  scrivi("site/pages/docs/src/ui/u.js", url);
  scrivi("site/pages/docs/locale/en-US.yml", `A_1: "${url.trim()}"\n`);
  scrivi("site/pages/docs/dist/d.js", url);
  scrivi("lib/node_modules/n.js", url);
  scrivi("lib/dist/e.js", url);
  const ambito = scanScope(tmp);
  eq("scanScope: salta generated/, locale/, dist/ e node_modules", [false, false, false, false, false], ["site/pages/docs/src/generated/g.js", "site/pages/docs/locale/en-US.yml", "site/pages/docs/dist/d.js", "lib/node_modules/n.js", "lib/dist/e.js"].map((f) => ambito.includes(f)));
  eq("scanScope: guarda i sorgenti delle pagine, README e lib", [true, true, true], ["site/pages/docs/src/ui/u.js", "README.md", "lib/a.js"].map((f) => ambito.includes(f)));
  eq("scanScope: e quello che sta in un file saltato non produce KO", ["site/pages/docs/src/ui/u.js"], righe(checks(tmp), "links into the manual").map((r) => r.trim().split(":")[0]));
  scrivi("lib/react.d.ts", "Vedi doc/icu.md.\n");
  eq("scanScope: i .d.ts di lib/ sono nel perimetro", true, scanScope(tmp).includes("lib/react.d.ts"));
  eq("scanScope: un doc/x.md dentro un .d.ts è un KO", ["lib/react.d.ts"], righe(checks(tmp), "links to migrated files").slice(1).map((r) => r.trim().split(":")[0]));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
