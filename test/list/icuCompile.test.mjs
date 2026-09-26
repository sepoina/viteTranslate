// Dall'AST all'espressione JS, integrato nella compilazione di una tabella — piano 4.6.3, § 1.7
// e § 1.8. Ogni forma passa dal compilatore vero e viene eseguita davvero: non si ispeziona il
// codice sorgente (fragile), si guarda cosa produce a runtime.
//
//   node test/list/icuCompile.test.mjs
import { pathToFileURL } from "node:url";
import { compileLanguageModule } from "../../lib/dev/compile/compileTable.js";

const STUB = `
const Fragment = "#frag";
const jsx = (type, props) => ({ type, children: props.children });
const jsxs = jsx;
`;

const ICU_RUNTIME_URL = pathToFileURL(new URL("../../lib/icu/runtime.js", import.meta.url).pathname).href;

async function load(table, sourceTable = null, options = {}) {
  const warns = [];
  const code = compileLanguageModule(table, options.tag ?? "it-IT", sourceTable, {
    icuModule: ICU_RUNTIME_URL,
    sourceTag: "it-IT",
    warn: (msg, kind) => warns.push({ msg, kind }),
    ...options,
  }).replace(/import \{[^}]*\} from "react\/jsx-runtime";/, STUB);
  const mod = await import("data:text/javascript," + encodeURIComponent(code));
  return { table: mod.default, code, warns };
}

function show(v) {
  if (v === null || v === undefined) return String(v);
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(show).join("");
  if (v.type === "#frag") return show(v.children);
  return `<${v.type}>${v.children === undefined ? "" : show(v.children)}</${v.type}>`;
}

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const ok_ = (nome, cond, extra = "") => {
  if (!cond) fail++;
  console.log(cond ? "  ok  " : "  KO  ", nome, extra);
};

console.log("\n== le forme di base ==");
{
  const { table: T } = await load({
    plurale: "{0, plural, one {# file} other {# file}}",
    zero: "{0, plural, =0 {niente} one {# file} other {# file}}",
    poundElemento: "{0, plural, one {<b>#</b> file} other {<b>#</b> file}}",
    poundConTag: "<b>{0, plural, one {# file} other {# file}}</b>",
    selectInPlurale: "{0, plural, one {{1, select, m {suo} other {loro}} file} other {{1, select, m {suo} other {loro}} files}}",
    nidificato: "{0, plural, one {# folder ({1, plural, one {# file} other {# files}})} other {# folders ({1, plural, one {# file} other {# files}})}}",
    percent: "{0, number, percent}",
    dataSkeleton: "{0, date, ::EEEEdMMMM}",
    oraCorta: "{0, time, short}",
    elementoComeArg: "hello {0}",
    argAssente: "hello {0}",
  });

  eq("plurale one", "1 file", show(T.plurale([1])));
  eq("plurale other", "3 file", show(T.plurale([3])));
  eq("=0 vince", "niente", show(T.zero([0])));
  eq("# dentro un elemento", "<b>1</b> file", show(T.poundElemento([1])));
  eq("plurale dentro un tag", "<b>1 file</b>", show(T.poundConTag([1])));
  eq("select dentro plurale", "suo file", show(T.selectInPlurale([1, "m"])));
  eq("select dentro plurale (other)", "loro files", show(T.selectInPlurale([3, "f"])));
  eq("plurale dentro plurale (h0/h1)", "2 folders (3 files)", show(T.nidificato([2, 3])));
  eq("number percent", new Intl.NumberFormat("it-IT", { style: "percent" }).format(0.4), show(T.percent([0.4])));
  eq("date skeleton", new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date("2026-10-03T00:00:00Z")), show(T.dataSkeleton(["2026-10-03"])));
  ok_("time short produce testo", typeof show(T.oraCorta(["2026-10-03T20:30:00Z"])) === "string" && show(T.oraCorta(["2026-10-03T20:30:00Z"])).length > 0);

  const elFinto = { $$typeof: Symbol.for("react.transitional.element"), type: "b", props: {} };
  eq("elemento React come argomento {0}", "hello <b></b>", show(T.elementoComeArg([elFinto])));
  eq("argomento mancante -> ⁇", "hello ⁇", show(T.argAssente([])));
}
{
  // Le categorie ordinali dipendono dalla locale: qui serve en-US, non il default it-IT del
  // blocco sopra (l'italiano non distingue "one/two/few" negli ordinali, ricade su "other").
  const { table: T } = await load({ ordinaleEn: "{0, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}" }, null, { tag: "en-US" });
  eq("selectordinal en: 1st", "1st", show(T.ordinaleEn([1])));
  eq("selectordinal en: 2nd", "2nd", show(T.ordinaleEn([2])));
  eq("selectordinal en: 3rd", "3rd", show(T.ordinaleEn([3])));
  eq("selectordinal en: 4th", "4th", show(T.ordinaleEn([4])));
}

console.log("\n== argomenti per nome ==");
{
  const { table: T } = await load({
    saluto: "ciao {name} come stai",
    misto: "{count, plural, one {# elemento} other {# elementi}} il {d, date, ::EEEEdMMMM}",
  });
  eq("nome presente", "ciao aldo come stai", show(T.saluto({ name: "aldo" })));
  eq("nome assente -> ⁇", "ciao ⁇ come stai", show(T.saluto({})));
  eq(
    "{count} e {d} per nome",
    `3 elementi il ${new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date("2026-10-03T00:00:00Z"))}`,
    show(T.misto({ count: 3, d: "2026-10-03" }))
  );
}
{
  // absentDataInArray personalizzato: l'avviso si sopprime come oggi.
  const { table: T } = await load({ saluto: "ciao {name} come stai" }, null, { missingArg: "" });
  eq("absentDataInArray vuoto", "ciao  come stai", show(T.saluto({})));
}
{
  const { table: T } = await load({ combo: "{name} e {1}" });
  eq("{name} e {1} da [{name}, 3]", "x e 3", show(T.combo([{ name: "x" }, 3])));
}

console.log("\n== solo se un nome è usato, _key entra nel modulo ==");
{
  const { code: codeConNome } = await load({ a: "ciao {name}" });
  ok_("_key presente quando un nome è usato", codeConNome.includes("function _key("));
  const { code: codeSenzaNome } = await load({ a: "ciao {0}" });
  ok_("_key assente quando nessun nome è usato", !codeSenzaNome.includes("function _key("));
}

console.log("\n== graffa letterale con entità: nessun import, stringa statica ==");
{
  const { table: T, code } = await load({ letterale: "&#123;0} letterale" });
  eq("valore statico", "string", typeof T.letterale);
  eq("testo", "{0} letterale", T.letterale);
  ok_("nessun import da virtual:vitetranslate/icu", !code.includes("vitetranslate/icu"));
}

console.log("\n== apostrofi e entità ICU (4.6.3) ==");
{
  const { table: T } = await load({
    elisione: "dell'{0}",
    citato: "Premi '{0}'",
    plurale: "{0, plural, one {l'# &num; &lbrace;x&rbrace;} other {gli #}}",
  });
  eq("dell'{0}", "dell'albero", show(T.elisione(["albero"])));
  eq("'{0}' mostra il valore fra apostrofi", "Premi 'Invio'", show(T.citato(["Invio"])));
  eq("&num; e &lbrace; letterali in un plurale", "l'1 # {x}", show(T.plurale([1])));
}

console.log("\n== un modulo senza ICU non importa il runtime ICU ==");
{
  const { code } = await load({ a: "ciao %s", b: "<b>grassetto</b>" });
  ok_("nessun import ICU", !code.includes("vitetranslate/icu"));
}

console.log("\n== opzioni hoistate: una sola dichiarazione per opzioni uguali ==");
{
  const { code } = await load({
    a: "{0, number, percent}",
    b: "{0, number, percent}",
  });
  const matches = code.match(/const _o0 = /g) ?? [];
  eq("un solo _o0", 1, matches.length);
  ok_("nessun _o1 (opzioni riusate)", !code.includes("const _o1 ="));
}

console.log("\n== ricaduta: argomenti diversi dal sorgente ==");
{
  const source = { bad: "{0} file" };
  const translated = { bad: "{1} file" };
  const { table: T, warns } = await load(translated, source, { tag: "en-US", emitUntranslated: true });
  eq("mostra il testo sorgente formattato", "42 file", show(T.bad([42])));
  ok_("in __untranslated__", T.__untranslated__?.bad === 1);
  ok_("warn riceve icu-args", warns.some((w) => w.kind === "icu-args"));
}

console.log("\n== categorie plurali mancanti: avviso, la voce resta la traduzione ==");
{
  const source = { p: "{0, plural, one {# file} other {# file}}" };
  const translated = { p: "{0, plural, one {# plik} other {# pliki}}" }; // manca "few"/"many" per pl-PL
  const { table: T, warns } = await load(translated, source, { tag: "pl-PL" });
  ok_("avviso icu-plural-categories", warns.some((w) => w.kind === "icu-plural-categories"));
  // La voce resta la TRADUZIONE (non ricade sulla sorgente): a runtime, per n=2, pl-PL sceglie
  // "few" — categoria che la traduzione non ha — e icuPlural ripiega sul suo "other".
  eq("la voce resta la traduzione (non ricade sulla sorgente)", "2 pliki", show(T.p([2])));
}

console.log("\n== sorgente rotta: testo semplice + icu-syntax, niente eco per ogni lingua ==");
{
  const source = { rotto: "{0, plural, one {x}}" }; // manca "other": MISSING_OTHER_CLAUSE
  const translatedA = { rotto: null };
  const translatedB = { rotto: null };
  const { table: TA, warns: warnsA } = await load(translatedA, source, { tag: "en-US", emitUntranslated: true });
  const { table: TB, warns: warnsB } = await load(translatedB, source, { tag: "fr-FR", emitUntranslated: true });
  eq("mostrato come testo semplice", "{0, plural, one {x}}", show(TA.rotto));
  eq("stesso per l'altra lingua", "{0, plural, one {x}}", show(TB.rotto));
  ok_("nessun avviso icu-syntax ripetuto per la traduzione (quiet)", !warnsA.some((w) => w.kind === "icu-syntax") && !warnsB.some((w) => w.kind === "icu-syntax"));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
