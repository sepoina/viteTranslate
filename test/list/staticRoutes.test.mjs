// Le copie statiche del manuale (site/pages/docs/scripts/staticRoutes.mjs): una pagina per ogni route
// e un rimando per ogni vecchio indirizzo.
//
// Perché è un test: su GitHub Pages un indirizzo senza file è un 404, e il manuale è pubblicato con
// indirizzi che non devono morire. Se il rimando perde l'ancora (#id), chi segue un vecchio link atterra
// in cima alla pagina nuova invece che alla sezione. Se il titolo non viene sostituito, ogni pagina si
// chiama "Overview" nei risultati di ricerca.
//
//   node test/list/staticRoutes.test.mjs
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { redirectPage, withMeta, writeStaticRoutes } from "../../site/pages/docs/scripts/staticRoutes.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(64), ok ? "" : `-> ${JSON.stringify(ottenuto)} (atteso ${JSON.stringify(atteso)})`);
};

const HTML = '<!doctype html>\n<html>\n  <head>\n    <title>viteTranslate docs</title>\n    <meta name="description" content="vecchia" />\n  </head>\n  <body><div id="root"></div></body>\n</html>\n';

// ------------------------------------------------------- withMeta
console.log("\n== withMeta: titolo e descrizione ==");
{
  const out = withMeta(HTML, "Price", "Quanto costa.");
  eq("sostituisce il <title>", true, out.includes("<title>Price · viteTranslate docs</title>"));
  eq("sostituisce la description", true, out.includes('<meta name="description" content="Quanto costa." />') && !out.includes("vecchia"));
  eq("il resto della pagina non cambia", true, out.includes('<div id="root"></div>'));
  const senza = withMeta(HTML.replace(/\s*<meta name="description"[^>]*>/, ""), "T", "D");
  eq("inserisce la description se manca", true, senza.includes('</title>\n    <meta name="description" content="D" />'));
  const speciale = withMeta(HTML, 'A & B <c> "d"', "x & y < z \"w\"");
  eq("il titolo è escapato (& < > \")", true, speciale.includes("<title>A &amp; B &lt;c&gt; &quot;d&quot; · viteTranslate docs</title>"));
  eq("la descrizione è escapata", true, speciale.includes('content="x &amp; y &lt; z &quot;w&quot;"'));
  eq("un $& nel titolo non è un riferimento di replace", true, withMeta(HTML, "Costa $& poco", "d").includes("<title>Costa $&amp; poco ·"));
}

// ------------------------------------------------------- redirectPage
console.log("\n== redirectPage: il rimando ==");
{
  const out = redirectPage("/viteTranslate/docs/", "llm/price");
  eq("porta alla route nuova, con la base", true, out.includes('location.replace("/viteTranslate/docs/llm/price/" + location.hash);'));
  eq("tiene l'ancora (location.hash)", true, out.includes("+ location.hash"));
  eq("ha un <noscript> con il refresh", true, out.includes('<noscript><meta http-equiv="refresh" content="0; url=/viteTranslate/docs/llm/price/" /></noscript>'));
  eq("non va indicizzata", true, out.includes('<meta name="robots" content="noindex" />'));
  eq("dà il link a chi non ha né script né refresh", true, out.includes('<a href="/viteTranslate/docs/llm/price/">'));
}

// ------------------------------------------------------- writeStaticRoutes
console.log("\n== writeStaticRoutes: una pagina per route, un rimando per alias ==");
{
  const tmp = mkdtempSync(join(tmpdir(), "vt-static-"));
  try {
    let errore = null;
    try {
      writeStaticRoutes({ outDir: tmp, base: "/d/", routes: [] });
    } catch (e) {
      errore = e.message;
    }
    eq("senza index.html (build non fatta) rifiuta", true, !!errore && errore.includes("build the page first"));
    writeFileSync(join(tmp, "index.html"), HTML);
    const routes = [
      { route: "llm/price", title: "Price", description: "Costi.", aliases: ["llm/costs", "llm/costs-old#budget -> budget-caps", "llm/old#x -> budget-caps"] },
      { route: "api/cli", title: "CLI", description: "La riga di comando.", aliases: [] },
    ];
    const r = writeStaticRoutes({ outDir: tmp, base: "/viteTranslate/docs/", routes });
    eq("conta pagine e rimandi", { pages: 2, redirects: 3 }, r);
    eq("una index.html per route, col titolo giusto", [true, true], [readFileSync(join(tmp, "llm/price/index.html"), "utf8").includes("<title>Price ·"), readFileSync(join(tmp, "api/cli/index.html"), "utf8").includes("<title>CLI ·")]);
    eq("un rimando per l'alias di route", true, readFileSync(join(tmp, "llm/costs/index.html"), "utf8").includes('location.replace("/viteTranslate/docs/llm/price/" + location.hash)'));
    eq("un rimando per la vecchia route di un alias con ancora", true, existsSync(join(tmp, "llm/costs-old/index.html")) && existsSync(join(tmp, "llm/old/index.html")));
    eq("l'alias con ancora che sta sulla route stessa non scrive niente di più", 2, writeStaticRoutes({ outDir: tmp, base: "/d/", routes: [{ route: "a/b", title: "T", description: "D", aliases: ["a/b#x -> y"] }, { route: "c/d", title: "T", description: "D", aliases: [] }] }).pages);
    eq("la route con l'alias di sola ancora sulla propria route non ha rimandi", false, existsSync(join(tmp, "a/b/index.html")) && readFileSync(join(tmp, "a/b/index.html"), "utf8").includes("location.replace"));
    // Un alias su una route vera: mai un rimando sopra la pagina (la sezione la sposta il router, aliases.json).
    const vere = [
      { route: "a/uno", title: "Uno", description: "D1", aliases: [] },
      { route: "a/due", title: "Due", description: "D2", aliases: ["a/uno#spostata -> nuova", "a/uno"] },
    ];
    const rv = writeStaticRoutes({ outDir: tmp, base: "/d/", routes: vere });
    eq("alias di ancora verso una route vera: nessun rimando", 0, rv.redirects);
    eq("…e la pagina vera resta la pagina, non un rimando", true, readFileSync(join(tmp, "a/uno/index.html"), "utf8").includes("<title>Uno ·") && !readFileSync(join(tmp, "a/uno/index.html"), "utf8").includes("location.replace"));
    mkdirSync(join(tmp, "x"), { recursive: true });
    eq("l'index.html della radice resta quello della build", HTML, readFileSync(join(tmp, "index.html"), "utf8"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ------------------------------------------------------- una pagina rinominata che cede una sezione
console.log("\n== rinominata e divisa: ogni vecchia ancora al suo posto ==");
{
  // Lo script del rimando, eseguito con un `location` finto: dove porta `#hash`.
  const segui = (html, hash) => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
    let dove = null;
    new Function("location", script)({ hash, replace: (u) => (dove = u) });
    return dove;
  };
  const custom = { route: "llm/custom-endpoint", title: "Custom", description: "D", aliases: ["llm/providers", "llm/providers#optional-vercel-provider -> what-a-driver-receives"] };
  const tested = { route: "llm/tested-endpoints", title: "Tested", description: "D", aliases: ["llm/providers#openai-compatible-endpoints -> openai-compatible-endpoints", "llm/setup-old#tested-endpoints -> run-end-to-end"] };
  for (const [nome, routes] of [["custom prima", [custom, tested]], ["tested prima", [tested, custom]]]) {
    const tmp = mkdtempSync(join(tmpdir(), "vt-static-"));
    try {
      writeFileSync(join(tmp, "index.html"), HTML);
      writeStaticRoutes({ outDir: tmp, base: "/d/", routes });
      const vecchia = readFileSync(join(tmp, "llm/providers/index.html"), "utf8");
      eq(`${nome}: la sezione ceduta va all'altra pagina`, "/d/llm/tested-endpoints/#openai-compatible-endpoints", segui(vecchia, "#openai-compatible-endpoints"));
      eq(`${nome}: la sezione rinominata va al nuovo id`, "/d/llm/custom-endpoint/#what-a-driver-receives", segui(vecchia, "#optional-vercel-provider"));
      eq(`${nome}: il resto alla pagina che ha preso la route`, ["/d/llm/custom-endpoint/#altro", "/d/llm/custom-endpoint/"], [segui(vecchia, "#altro"), segui(vecchia, "")]);
      eq(`${nome}: la vecchia route di sola ancora porta al nuovo id`, "/d/llm/tested-endpoints/#run-end-to-end", segui(readFileSync(join(tmp, "llm/setup-old/index.html"), "utf8"), "#tested-endpoints"));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  eq("senza sezioni spostate lo script resta quello di sempre", true, redirectPage("/d/", "a/b", {}).includes('<script>location.replace("/d/a/b/" + location.hash);</script>'));
  eq("un'ancora codificata nell'indirizzo si riconosce", "/d/x/y/#nuova", segui(redirectPage("/d/", "x/z", { "città": "x/y#nuova" }), "#citt%C3%A0"));
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
