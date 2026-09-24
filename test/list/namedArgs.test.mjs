// Parità fra lib/namedArgs.js (usato dal runtime fuori dal chunk: interpolate.js, l'interprete
// ICU di dev) e gli helper inline `_arg`/`_key` del chunk compilato (piano 4.6.3, "`_arg`
// cambia"). Due copie della stessa regola, verificate qui caso per caso — non solo "combaciano
// fra loro" ma anche i comportamenti documentati nel piano.
//
//   node test/list/namedArgs.test.mjs
import { pathToFileURL } from "node:url";
import { compileLanguageModule } from "../../lib/dev/compile/compileTable.js";
import { argAt, argNamed, isNamedArgs } from "../../lib/namedArgs.js";

const STUB = `
const Fragment = "#frag";
const jsx = (type, props) => ({ type, children: props.children });
const jsxs = jsx;
`;

const ICU_RUNTIME_URL = pathToFileURL(new URL("../../lib/icu/runtime.js", import.meta.url).pathname).href;

async function load(table) {
  const code = compileLanguageModule(table, "it-IT", null, { icuModule: ICU_RUNTIME_URL, sourceTag: "it-IT" })
    .replace(/import \{[^}]*\} from "react\/jsx-runtime";/, STUB);
  const mod = await import("data:text/javascript," + encodeURIComponent(code));
  return mod.default;
}

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = Object.is(atteso, ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", show(ottenuto), ok ? "" : `(atteso ${show(atteso)})`);
};
function show(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (v === undefined) return "undefined";
  try { return JSON.stringify(v); } catch { return String(v); }
}

class Persona {
  constructor(name) { this.name = name; }
}

const REACT_ELEMENT = { $$typeof: Symbol.for("react.transitional.element"), type: "b", props: {} };
const NULL_PROTO_NAMED = Object.assign(Object.create(null), { name: "n" });

const MATRICE = [
  ["array", ["a", "b"]],
  ["scalare", "x"],
  ["false", false],
  ["null", null],
  ["array con 0", [0]],
  ["array con stringa vuota", [""]],
  ["array con null", [null]],
  ["elemento React finto", REACT_ELEMENT],
  ["oggetto nominato", { name: "aldo" }],
  ["oggetto con chiave numerica", { 0: "z" }],
  ["array [oggetto, 3]", [{ name: "aldo" }, 3]],
  ["oggetto vuoto", {}],
  ["oggetto a prototipo nullo", NULL_PROTO_NAMED],
  ["istanza di classe", new Persona("x")],
  ["Date", new Date(0)],
  ["oggetto {constructor: 1}", { constructor: 1 }],
];

// "{0}"/"{1}" e non "%s": un messaggio ICU che è SOLO un argomento compila a `_arg(a, n)` diretto
// (l'ottimizzazione "onlySlot" di compileIcu.js), senza il `_cat`/Fragment che un "%s" isolato
// porterebbe con sé per restare renderizzabile. Qui serve il valore letto, non la sua resa.
const T = await load({ p0: "{0}", p1: "{1}", n: "{name}", c: "{constructor}" });

console.log("\n== parità _arg/_key (chunk) vs argAt/argNamed (lib/namedArgs.js) ==");
for (const [nome, args] of MATRICE) {
  eq(`${nome}: p0`, argAt(args, 0) ?? "⁇", T.p0(args));
  eq(`${nome}: p1`, argAt(args, 1) ?? "⁇", T.p1(args));
  eq(`${nome}: n (name)`, argNamed(args, "name") ?? "⁇", T.n(args));
  eq(`${nome}: c (constructor)`, argNamed(args, "constructor") ?? "⁇", T.c(args));
}

console.log("\n== comportamenti documentati dal piano ==");
eq("oggetto semplice come VALORE -> assente", "⁇", T.p0([{ x: 1 }]));
eq("istanza di classe come NOME -> assente", "⁇", T.n(new Persona("x")));
eq("prototipo nullo -> valore letto", "n", T.n(NULL_PROTO_NAMED));
eq("{constructor} su {} -> assente (non pesca dal prototipo)", "⁇", T.c({}));
eq("isNamedArgs(elemento React) è false", false, isNamedArgs(REACT_ELEMENT));
eq("isNamedArgs(istanza di classe) è false", false, isNamedArgs(new Persona("x")));
eq("isNamedArgs({}) è true", true, isNamedArgs({}));
eq("isNamedArgs(prototipo nullo) è true", true, isNamedArgs(NULL_PROTO_NAMED));

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
