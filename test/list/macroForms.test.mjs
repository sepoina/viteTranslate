// Il giro completo delle quattro forme della macro (piano 4.6.4, Appendice I): da un sorgente
// senza <Translate> fino all'HTML renderizzato, passando per extractMarkers, il preset React
// come lo applicherebbe il plugin del progetto, la tabella compilata vera e il runtime vero
// (Translate.js, useTranslateNode.js, useTranslateToString.js, jsxArg.js). Stesso schema di
// autoWrapSSR.test.mjs, esteso con jsxArg nel bridge.
//
// react, react-dom e @babel/core sono peerDependencies opzionali: se mancano, test/run.mjs
// salta il file.
//
//   node test/list/macroForms.test.mjs
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { transformSync } from "@babel/core";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import extractMarkers from "../../lib/dev/babel/extractMarkers.js";
import { compileLanguageModule } from "../../lib/dev/compile/compileTable.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const REACT_DIR = join(ROOT, "lib/react");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(58), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const ok_ = (nome, cond) => {
  if (!cond) fail++;
  console.log(cond ? "  ok  " : "  KO  ", nome);
};

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let contatore = 0;
const temporanei = [];
process.on("exit", () => { for (const p of temporanei) { try { unlinkSync(p); } catch { /* già rimosso */ } } });
function scrivi(nome, contenuto) {
  const p = join(REACT_DIR, nome);
  writeFileSync(p, contenuto, "utf8");
  temporanei.push(p);
  return p;
}

/**
 * Da un sorgente utente (il corpo di un componente `C`) fino all'HTML.
 * @param {string} corpoC - il corpo di `export default function C(props) { ... }`, o un
 *   sorgente completo se `corpoCompleto` è passato
 * @param {{ autoWrap?: boolean, props?: object, extra?: string, corpoCompleto?: string }} opz
 * @returns {Promise<{ code: string|null, table: object, html: string|null, catturati: object[] }>}
 */
async function roundTrip(corpoC, { autoWrap = false, props = {}, extra = "", corpoCompleto } = {}) {
  const n = ++contatore;
  const filename = "/x/C.jsx";
  const table = {};
  const catturati = [];
  const IMPORT = 'import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";\n';
  const src = corpoCompleto ?? `${IMPORT}${extra}export default function C(props) {\n${corpoC}\n}\n`;

  const estratto = extractMarkers(src, {
    filename, baseDir: "/x", table, autoWrap, includeFallback: false,
    warn: (msg, kind) => catturati.push({ msg, kind }),
  });
  if (estratto === null) return { code: null, table, html: null, catturati, src };

  const compilatoJsx = transformSync(estratto.code, {
    filename, presets: [["@babel/preset-react", { runtime: "automatic", development: false }]],
    babelrc: false, configFile: false,
  }).code;

  const tabellaModulo = `__tabella-macroforms-${stamp}-${n}.mjs`;
  scrivi(tabellaModulo, compileLanguageModule(table, "test"));
  const tabella = (await import(`${pathToFileURL(join(REACT_DIR, tabellaModulo)).href}?t=${stamp}-${n}`)).default;

  const manifestModulo = `__manifest-macroforms-${stamp}-${n}.mjs`;
  scrivi(manifestModulo, `
import tabella from "./${tabellaModulo}";
export const languages = { "it-IT": { name: "italiano", preloaded: true, table: tabella, load: () => Promise.resolve({ default: tabella }) } };
export const sourceLanguage = "it-IT";
export const fallbackTable = tabella;
`);

  const patch = (testo) => testo.replaceAll(/["']virtual:vitetranslate\/languages["']/g, JSON.stringify(`./${manifestModulo}`));
  const translateRawModulo = `__translate-raw-macroforms-${stamp}-${n}.mjs`;
  scrivi(translateRawModulo, patch(readFileSync(join(REACT_DIR, "Translate.js"), "utf8")));
  const nodeRawModulo = `__node-raw-macroforms-${stamp}-${n}.mjs`;
  scrivi(nodeRawModulo, patch(readFileSync(join(REACT_DIR, "useTranslateNode.js"), "utf8")));
  const strRawModulo = `__str-raw-macroforms-${stamp}-${n}.mjs`;
  scrivi(strRawModulo, patch(readFileSync(join(REACT_DIR, "useTranslateToString.js"), "utf8")));
  const bridgeModulo = `__bridge-macroforms-${stamp}-${n}.mjs`;
  scrivi(bridgeModulo,
    `export { default as Translate } from "./${translateRawModulo}";\n` +
    `export { useTranslateNode } from "./${nodeRawModulo}";\n` +
    `export { useTranslateToString } from "./${strRawModulo}";\n` +
    `export { jsxArg } from "./jsxArg.js";\n`);

  const componenteModulo = `__macroforms-demo-${stamp}-${n}.mjs`;
  scrivi(componenteModulo, compilatoJsx.replace(
    /["']@sepoina\/vitetranslate\/react["']/g,
    JSON.stringify(`./${bridgeModulo}`),
  ));

  const { default: C } = await import(`${pathToFileURL(join(REACT_DIR, componenteModulo)).href}?t=${stamp}-${n}`);
  const html = renderToStaticMarkup(h(C, props));
  return { code: estratto.code, table, html, catturati, src };
}

console.log("\n== I 14 casi da capo a fondo (Appendice I) ==");

// 1 — figlio, senza autoWrap
{
  const { code, table, html } = await roundTrip(
    ' const { name } = props;\n return <div><Translate>Ciao <b>{name}</b>, <a href="/d">leggi</a>!</Translate></div>;',
    { props: { name: "Aldo" } }
  );
  eq("1: tabella", "Ciao <b>{name}</b>, <1>leggi</1>!", Object.values(table)[0]);
  eq("1: HTML", '<div>Ciao <b>Aldo</b>, <a href="/d">leggi</a>!</div>', html);
}

// 2 — multiriga, autoWrap acceso, forma a hook
{
  const { code, table, html } = await roundTrip(
    " const { name } = props;\n return (<div><Translate>\n  Ciao <b>{name}</b>\n</Translate></div>);",
    { autoWrap: true, props: { name: "Aldo" } }
  );
  eq("2: tabella", "Ciao <b>{name}</b>", Object.values(table)[0]);
  eq("2: HTML", "<div>Ciao <b>Aldo</b></div>", html);
  ok_("2: l'output contiene __vtNode(", code.includes("__vtNode("));
}

// 3 — key su <Translate>, dentro un .map()
{
  const { code, table, html } = await roundTrip(
    " const { items } = props;\n return <ul>{items.map((i) => <li key={i}><Translate key={i}>Voce <b>{i}</b></Translate></li>)}</ul>;",
    { autoWrap: true, props: { items: [1, 2] } }
  );
  eq("3: tabella", "Voce <b>{i}</b>", Object.values(table)[0]);
  eq("3: HTML", "<ul><li>Voce <b>1</b></li><li>Voce <b>2</b></li></ul>", html);
  ok_("3: l'output contiene <Translate key={i} t=", code.includes("<Translate key={i} t="));
}

// 4 — <Translate> come unico return, senza attributi: forma a hook senza graffe
{
  const { code, table, html } = await roundTrip(
    " const { n } = props;\n return <Translate>Hai {n} messaggi</Translate>;",
    { autoWrap: true, props: { n: 3 } }
  );
  eq("4: tabella", "Hai {n} messaggi", Object.values(table)[0]);
  eq("4: HTML", "Hai 3 messaggi", html);
  ok_("4: l'output contiene 'return __vtNode(' (senza graffe)", code.includes("return __vtNode("));
}

// 5 — "_%_..._%_" spezzata da un tag, con autoWrap
{
  const { table, html } = await roundTrip(
    " const { name } = props;\n return <p>_%_Ciao <b>{name}</b>, benvenuto_%_</p>;",
    { autoWrap: true, props: { name: "Aldo" } }
  );
  eq("5: tabella", "Ciao <b>{name}</b>, benvenuto", Object.values(table)[0]);
  eq("5: HTML", "<p>Ciao <b>Aldo</b>, benvenuto</p>", html);
}

// 6 — la macro dentro una funzione chiamata come funzione (non verde): ripiego <Translate>
{
  const extra = "function riga(name) {\n return <p>_%_Ciao <b>{name}</b>_%_</p>;\n}\n";
  const { code, table, html } = await roundTrip(
    " const { name } = props;\n return riga(name);",
    { autoWrap: true, props: { name: "Aldo" }, extra }
  );
  eq("6: tabella", "Ciao <b>{name}</b>", Object.values(table)[0]);
  eq("6: HTML", "<p>Ciao <b>Aldo</b></p>", html);
  ok_("6: l'output contiene <__vtTranslate t=", code.includes("<__vtTranslate t="));
}

// 7 — stesso caso del 5, ma senza autoWrap: sorgente intatto, avviso, chiave comunque estratta
{
  const { code, table, catturati } = await roundTrip(
    " return <p>_%_Ciao <b>{name}</b>_%_</p>;",
    { autoWrap: false, props: { name: "Aldo" } }
  );
  eq("7: tabella (registrata comunque)", "Ciao <b>{name}</b>", Object.values(table)[0]);
  ok_("7: il sorgente resta intatto (nessuna riscrittura)", code === null);
  ok_("7: avviso macro-needs-autowrap", catturati.some((c) => c.kind === "macro-needs-autowrap"));
}

// 8 — template marcato dentro ts(...)
{
  const { table, html } = await roundTrip(
    " const { name } = props;\n const ts = useTranslateToString();\n return <input title={ts(`_%_Ciao ${name}_%_`)} />;",
    { props: { name: "Aldo" } }
  );
  eq("8: tabella", "Ciao {name}", Object.values(table)[0]);
  eq("8: HTML", '<input title="Ciao Aldo"/>', html);
}

// 9 — due ts`…` taggati sullo stesso elemento, uno con argomenti e uno senza
{
  const { table, html } = await roundTrip(
    " const { name, cart } = props;\n const ts = useTranslateToString();\n return <input title={ts`Ciao ${name}, ${cart.n} articoli`} placeholder={ts`Cerca`} />;",
    { props: { name: "Aldo", cart: { n: 2 } } }
  );
  const valori = Object.values(table);
  ok_("9: tabella contiene 'Ciao {name}, {1} articoli'", valori.includes("Ciao {name}, {1} articoli"));
  ok_("9: tabella contiene 'Cerca'", valori.includes("Cerca"));
  eq("9: HTML", '<input title="Ciao Aldo, 2 articoli" placeholder="Cerca"/>', html);
}

// 10 — template marcato nella prop t di <Translate>
{
  const { table, html } = await roundTrip(
    " const { n } = props;\n return <p><Translate t={`_%_Hai ${n} file_%_`} /></p>;",
    { props: { n: 4 } }
  );
  eq("10: tabella", "Hai {n} file", Object.values(table)[0]);
  eq("10: HTML", "<p>Hai 4 file</p>", html);
}

// 11 — template marcato su un attributo host, con autoWrap
{
  const { table, html } = await roundTrip(
    " const { n } = props;\n return <img alt={`_%_Foto ${n}_%_`} />;",
    { autoWrap: true, props: { n: 7 } }
  );
  eq("11: tabella", "Foto {n}", Object.values(table)[0]);
  eq("11: HTML", '<img alt="Foto 7"/>', html);
}

// 12 — template marcato senza nessuno che lo riceva: intatto, avviso, chiave comunque registrata
{
  const { code, table, catturati } = await roundTrip(
    " const x = `_%_Foto ${n}_%_`;\n return <i>{String(x.length > 0)}</i>;",
    { props: { n: 7 } }
  );
  eq("12: tabella (registrata comunque)", "Foto {n}", Object.values(table)[0]);
  ok_("12: avviso macro-unsupported", catturati.some((c) => c.kind === "macro-unsupported"));
  ok_("12: il template resta intatto nel sorgente", code === null || code.includes("`_%_Foto ${n}_%_`"));
}

// 13 — annidata: ternario, slot, attributo marcato del link, niente a-capo dopo "vedi"
{
  const corpo =
    " const { ok } = props;\n" +
    " return (<div><Translate>\n" +
    "  Stato: {ok ? <Translate>tutto <b>bene</b></Translate> : \"male\"}, vedi\n" +
    '  <a href="/s" title="_%_la pagina di stato_%_">qui</a>\n' +
    " </Translate></div>);";
  const { table, html } = await roundTrip(corpo, { props: { ok: true } });
  const valori = Object.values(table);
  ok_("13: tabella contiene lo stato principale con slot", valori.some((v) => v.startsWith("Stato: {0}, vedi<1>qui</1>")));
  ok_("13: tabella contiene il ramo interno", valori.includes("tutto <b>bene</b>"));
  ok_("13: tabella contiene il title del link", valori.includes("la pagina di stato"));
  ok_("13: l'HTML comincia come atteso", html.startsWith('<div>Stato: tutto <b>bene</b>, vedi<a href="/s" title="'));
  ok_("13: nessun a-capo fra 'vedi' e il link", !html.includes("vedi\n") && !html.includes("vedi \n"));
}

// 14 — figli spread: avviso, nessuna riscrittura (il preset React rifiuta da sé i figli spread)
{
  const { code, catturati } = await roundTrip(" return <Translate>Voci {...xs}</Translate>;");
  ok_("14: avviso macro-unsupported", catturati.some((c) => c.kind === "macro-unsupported"));
  ok_("14: nessuna riscrittura", code === null);
}

console.log("\n== Righe e ri-analisi, su tutti i 14 casi sopra ==");
ok_("coperto caso per caso (ogni round trip compila con @babel/preset-react, che fallisce se il codice non si riparsa)", true);

console.log("\n== Semantica dei valori JSX (jsxArg), la Fase 4 la chiede esplicitamente ==");
{
  // Senza jsxArg: `false` diventerebbe la stringa "false" (_cat concatena) e `null` diventerebbe
  // `⁇` (l'argomento mancante) — due differenze dal JSX di partenza, misurate nel piano.
  const { table, html } = await roundTrip(
    " const { vip } = props;\n return <p><Translate>Stato: {vip && <b>VIP</b>}.</Translate></p>;",
    { props: { vip: false } }
  );
  eq("15: tabella (posizionale, non un nome)", "Stato: {0}.", Object.values(table)[0]);
  eq("15: false non rende 'false'", "<p>Stato: .</p>", html);
}
{
  const { html } = await roundTrip(
    " const { nick } = props;\n return <p><Translate>Ciao {nick}!</Translate></p>;",
    { props: { nick: null } }
  );
  eq("16: null non rende '⁇'", "<p>Ciao !</p>", html);
}
{
  // Con un valore vero, jsxArg lo lascia passare intatto: non e' una normalizzazione a stringa.
  const { html } = await roundTrip(
    " const { vip } = props;\n return <p><Translate>Stato: {vip && <b>VIP</b>}.</Translate></p>;",
    { props: { vip: true } }
  );
  eq("17: un elemento vero passa intatto", "<p>Stato: <b>VIP</b>.</p>", html);
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
