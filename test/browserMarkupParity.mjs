// Registra il comportamento del parser HTML del BROWSER sul corpus, per rigenerare
// list/markupExpected.mjs. Non è un test (non finisce in `npm test`): richiede Chrome, e la
// suite deve girare ovunque.
//
// Serve per la STRUTTURA dei tag, che è l'unica cosa per cui un browser vero non ha sostituti:
// annidamenti, tag non chiusi, recuperi da markup malformato. Per le sole entità un oracolo
// senza browser c'è — `entities` (fb55), dipendenza di sviluppo — e markupParity lo usa per
// controllare la tabella registrata a ogni giro, invece di fidarsi di una registrazione fatta
// una volta e mai più riguardata.
//
//   node test/browserMarkupParity.mjs            # stampa le divergenze rispetto a parseMarkup
//   node test/browserMarkupParity.mjs --json     # stampa la tabella, da incollare in list/markupExpected.mjs
//
// Pilota Chrome headless via DevTools Protocol usando il WebSocket nativo di Node: nessuna
// dipendenza da installare. Il codice runtime NON viene reimplementato — viene servito quello
// vero, con il solo import di React sostituito da uno stub che costruisce oggetti semplici.
// Si confronta la struttura prodotta, non React.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import parseMarkup from "../lib/dev/compile/parseMarkup.js";
import { VOID_TAGS } from "../lib/htmlDialect.js";
import { CORPUS } from "./list/markupCorpus.mjs";

const LIB = resolve(dirname(fileURLToPath(import.meta.url)), "../lib");
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome-stable";
const SOLO_JSON = process.argv.includes("--json");

const serializza = (nodi) => nodi.map(function uno(n) {
  if (n.type === "text") return n.value;
  return VOID_TAGS.has(n.tag) ? `<${n.tag}/>` : `<${n.tag}>${n.children.map(uno).join("")}</${n.tag}>`;
}).join("");

const FILES = {
  "/react.js": `const React = { createElement: (type, props, children) => ({ type, children }), Fragment: "#frag" };
export default React;`,
  "/ser.js": `export function ser(n) {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(ser).join("");
  if (n.type === "#frag") return ser(n.children);
  const VOID = new Set(["br","wbr","hr"]);
  return VOID.has(n.type) ? "<"+n.type+"/>" : "<"+n.type+">"+(n.children===undefined?"":ser(n.children))+"</"+n.type+">";
}`,
  "/htmlDialect.js": readFileSync(join(LIB, "htmlDialect.js"), "utf8"),
  "/interpolate.js": readFileSync(join(LIB, "react/interpolate.js"), "utf8"),
  "/basicHtmlToNodes.js": readFileSync(join(LIB, "react/basicHtmlToNodes.js"), "utf8")
    .replace('import React from "react";', 'import React from "./react.js";')
    .replace('from "../htmlDialect.js"', 'from "./htmlDialect.js"'),
  "/index.html": `<!doctype html><meta charset="utf-8"><body><script type="module">
import { basicHtmlToNodes } from "./basicHtmlToNodes.js";
import { ser } from "./ser.js";
window.__run = (c) => c.map((s) => { try { return ser(basicHtmlToNodes(s)); } catch (e) { return "ERRORE: " + e.message; } });
window.__pronto = true;
</script></body>`,
};

const server = createServer((req, res) => {
  const p = req.url.split("?")[0];
  const body = FILES[p === "/" ? "/index.html" : p];
  if (body === undefined) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": p === "/" ? "text/html" : "text/javascript", "cache-control": "no-store" });
  res.end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const PORT = 9911;
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--remote-debugging-address=127.0.0.1",
  "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run",
  "--user-data-dir=/tmp/vitetranslate-markup-parity", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
chrome.on("error", (e) => { console.error(`Chrome non avviabile (${CHROME}): ${e.message}\nImposta CHROME=/percorso/al/browser`); process.exit(1); });
chrome.stderr.on("data", () => {});

let version;
for (let i = 0; i < 80; i++) {
  try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
  catch { await new Promise((r) => setTimeout(r, 250)); }
}
if (!version) { console.error("Chrome non risponde sulla porta di debug"); chrome.kill(); server.close(); process.exit(1); }

const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) =>
  new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });

const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Runtime.enable", {}, sessionId);
await send("Page.enable", {}, sessionId);
await send("Page.navigate", { url: origin }, sessionId);
for (let i = 0; i < 120; i++) {
  const { result } = await send("Runtime.evaluate", { expression: "!!window.__pronto", returnByValue: true }, sessionId);
  if (result?.result?.value) break;
  await new Promise((r) => setTimeout(r, 50));
}
const { result } = await send("Runtime.evaluate", {
  expression: `JSON.stringify(window.__run(${JSON.stringify(CORPUS.map((c) => c[1]))}))`,
  returnByValue: true,
}, sessionId);
const browser = JSON.parse(result.result.value);
ws.close(); chrome.kill(); server.close();

if (SOLO_JSON) {
  const out = {};
  CORPUS.forEach(([nome], i) => { out[nome] = browser[i]; });
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

let diff = 0;
console.log(`\nChrome ${version.Browser.replace("Chrome/", "")} — ${CORPUS.length} casi\n`);
CORPUS.forEach(([nome, src], i) => {
  const b = serializza(parseMarkup(src));
  if (b === browser[i]) return;
  diff++;
  console.log(`  DIVERGE  ${nome}`);
  console.log(`    input    ${JSON.stringify(src)}`);
  console.log(`    build    ${JSON.stringify(b)}`);
  console.log(`    browser  ${JSON.stringify(browser[i])}`);
});
console.log(diff === 0 ? "\n  nessuna divergenza" : `\n  ${diff} divergenze (attese: quelle in DIVERGENZE_NOTE di markupParity.test.mjs)`);
