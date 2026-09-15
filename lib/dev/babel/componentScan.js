// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione", "2a. Estrazione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

// Quali funzioni di un file sono componenti React, con certezza sufficiente a iniettarci
// dentro la chiamata a un hook.
//
// "Certezza sufficiente" non è un modo di dire: un hook in una funzione che NON è un
// componente produce "Invalid hook call" se viene chiamata fuori da un render, e
// "Rendered fewer hooks than expected" — a intermittenza, cioè il peggiore dei guasti — se
// viene chiamata a mano dentro un render in modo condizionale. Nel dubbio si risponde no, e
// chi chiede ricade su una via che funziona comunque (vedi extractMarkers.js, nearestComponent).
//
// Misurato sui sorgenti di playground/ e playEdge/: 21 funzioni contengono JSX, 15 sono
// componenti, 6 sono arrow anonime dentro `.map()`. I 6 rifiuti sono tutti corretti.

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression",
  "ClassMethod", "ObjectMethod",
]);

const SKIP_KEYS = new Set([
  "loc", "extra", "comments", "tokens",
  "leadingComments", "trailingComments", "innerComments",
]);

// Il nome di una funzione, dove Babel lo mette: `node.id.name` per una dichiarazione o
// un'espressione con nome proprio, altrimenti il nome del binding a cui è assegnata
// (`const Card = () => ...`). Ogni altra forma — argomento anonimo di una chiamata, elemento
// di un array, callback inline — resta senza nome: non può essere né esportata né chiamata
// per nome altrove, quindi non può mai diventare verde (punto 2 del semaforo, § 4.2).
function nameOf(node, parent) {
  if (node.id?.type === "Identifier") return node.id.name;
  if (parent?.type === "VariableDeclarator" && parent.id?.type === "Identifier") return parent.id.name;
  return null;
}

// Nessun parametro, o un solo parametro che sia un ObjectPattern (props destrutturate) o un
// Identifier chiamato "props". Serve solo al punto 6 del semaforo (§ 4.2): una funzione
// maiuscola esportata ma chiamata con argomenti scalari posizionali è quasi certamente una
// utility, non un componente.
function hasComponentShape(params) {
  if (params.length === 0) return true;
  if (params.length !== 1) return false;
  const p = params[0];
  return p.type === "ObjectPattern" || (p.type === "Identifier" && p.name === "props");
}

// L'ultimo offset "sicuro" a cui inserire uno statement in testa al corpo: dopo l'ultima
// direttiva, se ce ne sono, altrimenti subito dopo la graffa aperta. Solo per un corpo a
// blocco: un'arrow a corpo conciso (`() => <p/>`) non ha un blocco in cui inserire nulla, e
// resta null — verde ma non iniettabile (vedi il piano, § "Cosa NON fare in fase 1").
function bodyStartOf(node) {
  const body = node.body;
  if (body?.type !== "BlockStatement") return null;
  const directives = body.directives;
  if (directives && directives.length) return directives[directives.length - 1].end;
  return body.start + 1;
}

/**
 * Una sola visita dell'AST: raccoglie ogni funzione, insieme a due indici a livello di file —
 * i nomi usati come callee di una chiamata normale, e i nomi esportati — che servono al
 * semaforo del § 4.2, e produce `hasJsx`/`hasHook` per ciascuna.
 *
 * `hasJsx` e `hasHook` si fermano alla prima funzione NOMINATA (o metodo) incontrata scendendo:
 * quella è indipendentemente classificabile per conto proprio, quindi il suo JSX e i suoi hook
 * restano suoi soli — altrimenti una funzione qualunque erediterebbe `hasHook` da un componente
 * annidato che magari non renderizza nemmeno (vedi il CAUTION del piano su questo file).
 *
 * Una arrow ANONIMA usata come callback inline (`items.map(i => <li/>)`) non apre un nuovo
 * ambito: resta trasparente, e quel che contiene si attribuisce alla funzione nominata più
 * vicina. Non potendo mai avere un nome, un'arrow così non può mai diventare verde di per sé
 * (punto 2 del semaforo la esclude comunque); tenerla trasparente è ciò che permette a un
 * componente il cui intero render è `return items.map(i => <li/>)` di essere riconosciuto —
 * un pattern comune quanto un `return <div>...</div>` diretto, e non di meno.
 *
 * @param {object} ast - l'AST completo di Babel (si usa `ast.program`)
 * @returns {{ green: Map<object, number|null> }} - le sole funzioni classificate componente.
 *   Il valore è l'offset a cui iniettare una `const`, o `null` se la funzione è un'arrow a
 *   corpo conciso: verde, ma non iniettabile senza riscriverne il corpo.
 */
export function scanComponents(ast) {
  const calledAsCallee = new Set();
  const exported = new Set();
  const funzioni = [];

  // Pila di ATTRIBUZIONE per hasJsx/hasHook: un frame per ogni funzione NOMINATA (o metodo)
  // incontrata scendendo. Vedi il commento sopra la funzione per il perché un'arrow anonima
  // non ne apre uno.
  const stack = [];

  (function walk(node, parent) {
    if (Array.isArray(node)) { for (const child of node) walk(child, parent); return; }
    if (node === null || typeof node !== "object" || typeof node.type !== "string") return;

    if (node.type === "CallExpression" && node.callee?.type === "Identifier") {
      calledAsCallee.add(node.callee.name);
    }
    if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
      const d = node.declaration;
      if (d?.type === "FunctionDeclaration" && d.id) exported.add(d.id.name);
      if (d?.type === "VariableDeclaration") {
        for (const v of d.declarations) if (v.id?.type === "Identifier") exported.add(v.id.name);
      }
      if (d?.type === "Identifier") exported.add(d.name);
      for (const s of node.specifiers ?? []) if (s.local?.name) exported.add(s.local.name);
    }

    const isFn = FUNCTION_TYPES.has(node.type);
    let record = null;
    let scoped = false;
    if (isFn) {
      const name = nameOf(node, parent);
      record = {
        node,
        name,
        isMethod: node.type === "ClassMethod" || node.type === "ObjectMethod",
        hasHook: false,
        hasJsx: false,
        bodyStart: bodyStartOf(node),
        formaProps: hasComponentShape(node.params ?? []),
      };
      funzioni.push(record);
      scoped = name !== null || record.isMethod;
      if (scoped) stack.push(record);
    }

    if ((node.type === "JSXElement" || node.type === "JSXFragment") && stack.length) {
      stack[stack.length - 1].hasJsx = true;
    }
    if (node.type === "CallExpression" && node.callee?.type === "Identifier" &&
        /^use[A-Z]/.test(node.callee.name) && stack.length) {
      stack[stack.length - 1].hasHook = true;
    }

    for (const key in node) {
      if (SKIP_KEYS.has(key)) continue;
      const child = node[key];
      if (child !== null && typeof child === "object") walk(child, node);
    }

    if (scoped) stack.pop();
  })(ast.program, null);

  // Verde se e solo se TUTTE queste cose insieme:
  //
  //   1. non e' un metodo (di classe o di oggetto): in una classe un hook e' illegale, punto.
  //   2. ha un nome che comincia per maiuscola.
  //   3. contiene JSX.
  //   4. il suo nome NON compare mai nel file come callee di una chiamata normale `Nome(...)`.
  //   5. e' esportato, OPPURE chiama gia' un hook.
  //   6. se e' verde per il solo ramo "esportato", ha anche la FORMA di un componente: nessun
  //      parametro, oppure uno solo che sia un ObjectPattern (`{ title, onSave }`) o un
  //      Identifier chiamato `props`.
  //
  // Il punto 4 e' quello che fa il lavoro: e' l'unico che esclude la funzione maiuscola che
  // ritorna JSX e viene invocata a mano, cioe' l'unico caso che rompe DAVVERO.
  //
  // Il punto 5 e' una disgiunzione e non una congiunzione perche' i due rami hanno forza
  // diversa e coprono cose diverse. "Chiama gia' un hook" e' una dimostrazione, non un indizio:
  // la funzione e' gia' soggetta alle regole degli hook, quindi aggiungerne uno in cima non
  // puo' peggiorare niente. "Esportato" e' inferenza, ed e' il ramo che copre il caso piu'
  // comune di tutti — il componente senza stato, esportato dal proprio file e reso altrove.
  //
  // Il punto 6 esiste perche' il punto 4 vede un FILE SOLO. `export function RenderIcon(name)`
  // chiamata come funzione da un altro file e' maiuscola, ritorna JSX, non e' mai callee qui
  // dentro — ed e' verde. Iniettarci un hook e' "Invalid hook call", cioe' l'unico modo in cui
  // questo piano rompe codice che oggi funziona. Una utility chiamata a mano prende quasi sempre
  // scalari posizionali; un componente prende props destrutturate, o niente.
  //
  // Misurato: "esportato" copre 15/15, "chiama gia' un hook" 9/15, e sei componenti su quindici
  // stanno in piedi sul solo primo ramo. Il punto 6 sopra al primo ramo lascia 15/15: zero
  // componenti persi, misurato sugli stessi sorgenti prima di adottarlo. Costa niente e chiude il
  // falso verde piu' probabile — non tutti: vedi l'invariante 7 del piano.
  //
  // Cio' che NON serve e' l'identificatore usato come <Nome/> nello stesso file: 0/15, e non e'
  // il corpus — un componente si definisce nel proprio file e si rende altrove, quindi nel suo
  // file `<Foo/>` non compare mai.
  const green = new Map();
  for (const f of funzioni) {
    if (f.isMethod) continue;
    if (!f.name || !/^[A-Z]/.test(f.name)) continue;
    if (!f.hasJsx) continue;
    if (calledAsCallee.has(f.name)) continue;
    const isExported = exported.has(f.name);
    if (!isExported && !f.hasHook) continue;
    if (isExported && !f.hasHook && !f.formaProps) continue;
    green.set(f.node, f.bodyStart);
  }
  return { green };
}
