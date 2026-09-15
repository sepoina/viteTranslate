// Il classificatore di componenti (doc/ImplementationPlans/4_4_0.md § 4). È lo strato più
// importante da provare da solo, perché è l'unico che, sbagliato, produce un guasto a
// intermittenza: un hook iniettato in una funzione che componente non è.
//
//   node test/list/componentScan.test.mjs
import { createRequire } from "node:module";
import { scanComponents } from "../../lib/dev/babel/componentScan.js";

const { parseSync } = createRequire(import.meta.url)("@babel/core");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = Object.is(atteso, ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(58), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const parse = (code) => parseSync(code, { babelrc: false, configFile: false, parserOpts: { plugins: ["jsx"], sourceType: "module" } });

console.log("\n== T-C1: export default function, verde ==");
{
  const ast = parse(`export default function App() { return (<p/>); }`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0].declaration;
  eq("verde", true, green.has(fn));
  eq("bodyStart dopo la graffa aperta", fn.body.start + 1, green.get(fn));
}

console.log("\n== T-C2: export const arrow a blocco, verde ==");
{
  const ast = parse(`export const Card = () => { return (<p/>); };`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0].declaration.declarations[0].init;
  eq("verde", true, green.has(fn));
}

console.log("\n== T-C3: non esportata, mai usata, rossa ==");
{
  const ast = parse(`const Card = () => (<p/>);`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0].declarations[0].init;
  eq("rossa", false, green.has(fn));
}

console.log("\n== T-C4: export const arrow a corpo conciso, verde ma non iniettabile ==");
{
  const ast = parse(`export const Card = () => (<p/>);`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0].declaration.declarations[0].init;
  eq("verde", true, green.has(fn));
  eq("bodyStart null (corpo conciso)", null, green.get(fn));
}

console.log("\n== T-C5: dichiarata e poi chiamata come funzione, rossa ==");
{
  const ast = parse(`function Row() { return (<tr/>); } Row();`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0];
  eq("rossa (chiamata come funzione)", false, green.has(fn));
}

console.log("\n== T-C6: direttiva in testa, bodyStart dopo la direttiva ==");
{
  const ast = parse(`export function App() { "use client"; return (<p/>); }`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0].declaration;
  eq("verde", true, green.has(fn));
  eq("bodyStart dopo la direttiva", fn.body.directives[0].end, green.get(fn));
}

console.log("\n== T-C7: metodo di classe, rosso ==");
{
  const ast = parse(`class C { render() { return (<p/>); } }`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0].body.body[0];
  eq("rosso (metodo)", false, green.has(fn));
}

console.log("\n== T-C8: render intero via .map(), verde per la funzione, rossa l'arrow ==");
{
  const ast = parse(`function App() { useState(); return items.map(i => (<li/>)); }`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0];
  const arrow = fn.body.body[1].argument.arguments[0];
  eq("App verde (chiama gia' un hook, hasJsx via la .map)", true, green.has(fn));
  eq("l'arrow resta rossa (anonima)", false, green.has(arrow));
}

console.log("\n== T-C9: minuscola, esportata, rossa ==");
{
  const ast = parse(`export const helper = () => (<p/>);`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0].declaration.declarations[0].init;
  eq("rossa (minuscola)", false, green.has(fn));
}

console.log("\n== T-C10: componente annidato dentro un componente, entrambi per conto proprio ==");
{
  // Inner ha bisogno di un segnale SUO (qui: chiama gia' un hook) per essere verde: essere
  // "annidato dentro un componente" non basta da solo, e non deve bastare — altrimenti
  // sarebbe esattamente l'eredita' che il CAUTION del § 4.1 vieta. Il punto del test e' che
  // Inner e Outer arrivano al verde/rosso per DUE ragioni indipendenti (Inner: hasHook
  // proprio; Outer: esportata), non perche' uno "trascina" l'altro.
  const ast = parse(`export function Outer() { function Inner() { useState(); return (<span/>); } return (<div><Inner/></div>); }`);
  const { green } = scanComponents(ast);
  const outer = ast.program.body[0].declaration;
  const inner = outer.body.body[0];
  eq("Outer verde (esportata)", true, green.has(outer));
  eq("Inner verde (hook proprio, non ereditato)", true, green.has(inner));
}

console.log("\n== T-C11/T-C12: fondamenta di nearestComponent ==");
{
  // nearestComponent vive in extractMarkers.js e attraversa i frame senza fermarsi finche' non
  // trova un frame in `green`, o un metodo di classe (-> null). Qui si verifica solo che
  // `green` sia la mappa giusta da cui partire: senza export ne' hook, App resta rossa — il
  // comportamento end-to-end della risalita (T-C11: dentro una .map dentro un componente
  // verde, T-C12: dentro un metodo di classe) e' provato in extractMarkers.test.mjs, dove
  // l'emissione vera lo rende osservabile.
  const ast = parse(`function App() { return items.map(i => (<li/>)); }`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0];
  const arrow = fn.body.body[0].argument.arguments[0];
  eq("App rossa (ne' esportata ne' con un hook proprio)", false, green.has(fn));
  eq("l'arrow non e' mai candidata (anonima)", false, green.has(arrow));
}

console.log("\n== T-C13: la esterna non eredita hasHook dalla annidata ==");
{
  const ast = parse(`function Outer() { function Inner() { useState(); return (<p/>); } return (<Inner/>); }`);
  const { green } = scanComponents(ast);
  const outer = ast.program.body[0];
  // Outer non e' esportata e non chiama essa stessa un hook: se avesse ereditato hasHook da
  // Inner sarebbe verde lo stesso. Non lo e': la prova che l'ereditarieta' non c'e'.
  eq("Outer rossa: non ha ereditato hasHook da Inner", false, green.has(outer));
}

console.log("\n== casi limite aggiuntivi ==");
{
  // Un default export anonimo non ha nome: non puo' mai diventare verde, ma non deve
  // nemmeno far esplodere lo scan.
  const ast = parse(`export default () => (<p/>);`);
  const { green } = scanComponents(ast);
  eq("nessuna funzione verde (anonima)", 0, green.size);
}
{
  // Un componente esportato ma con una forma di parametri che non e' quella di un
  // componente (uno scalare posizionale, non un ObjectPattern/`props`) resta rosso: e' il
  // punto 6 del semaforo.
  const ast = parse(`export function RenderIcon(name) { return (<i className={name}/>); }`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0].declaration;
  eq("rossa: esportata ma con la forma di una utility, non di un componente", false, green.has(fn));
}
{
  // La stessa funzione, ma con la forma giusta (props destrutturate), torna verde.
  const ast = parse(`export function RenderIcon({ name }) { return (<i className={name}/>); }`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0].declaration;
  eq("verde: esportata con props destrutturate", true, green.has(fn));
}
{
  // Un componente esportato con un solo parametro chiamato "props" (non destrutturato) e'
  // anch'esso una forma valida.
  const ast = parse(`export function Card(props) { return (<div>{props.title}</div>); }`);
  const { green } = scanComponents(ast);
  const fn = ast.program.body[0].declaration;
  eq("verde: esportata con un solo parametro 'props'", true, green.has(fn));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
