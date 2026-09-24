// La vetrina llmRestaurant compila davvero, nelle cinque lingue, senza avvisi ICU — piano 4.6.3,
// § 1.16. Non un confronto testo-a-testo (fragile, e cambierebbe a ogni rifinitura di stile):
// verifica che il numero e la data formattati compaiano nell'output, e che gli argomenti per
// nome (conferma) e per posizione (ospiti, abbinamento) siano letti.
//
//   node test/list/icuShowcase.test.mjs
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import readLanguageFile from "../../lib/dev/vite/uty/readLanguageFile.js";
import { tagFromFileName } from "../../lib/dev/vite/uty/languageFileFormat.js";
import { compileLanguageModule } from "../../lib/dev/compile/compileTable.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const LOCALE_DIR = join(ROOT, "site/pages/llmRestaurant/locale");
const ICU_RUNTIME_URL = pathToFileURL(join(ROOT, "lib/icu/runtime.js")).href;

const STUB = `
const Fragment = "#frag";
const jsx = (type, props) => ({ type, children: props.children });
const jsxs = jsx;
`;
function show(v) {
  if (v === null || v === undefined) return String(v);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(show).join("");
  if (v.type === "#frag") return show(v.children);
  return `<${v.type}>${v.children === undefined ? "" : show(v.children)}</${v.type}>`;
}

let fail = 0;
const ok_ = (nome, cond, extra = "") => {
  if (!cond) fail++;
  console.log(cond ? "  ok  " : "  KO  ", nome, extra);
};

const { table: sourceTable } = readLanguageFile(join(LOCALE_DIR, "it-IT.yml"));
const keyByText = (needle) => Object.entries(sourceTable).find(([, v]) => typeof v === "string" && v.includes(needle))?.[0];
const guestsKey = keyByText("{0, plural,");
const confirmKey = keyByText("{name}");
const pairingKey = keyByText("currency/EUR");
ok_("le tre chiavi si trovano in it-IT.yml", !!guestsKey && !!confirmKey && !!pairingKey,
  JSON.stringify({ guestsKey, confirmKey, pairingKey }));

const files = readdirSync(LOCALE_DIR).filter((f) => f.endsWith(".yml"));

for (const file of files) {
  const tag = tagFromFileName(file);
  const { table } = readLanguageFile(join(LOCALE_DIR, file));
  const warns = [];
  const code = compileLanguageModule(table, tag, tag === "it-IT" ? null : sourceTable, {
    icuModule: ICU_RUNTIME_URL,
    sourceTag: "it-IT",
    warn: (msg, kind) => warns.push({ msg, kind }),
  }).replace(/import \{[^}]*\} from "react\/jsx-runtime";/, STUB);
  const mod = await import("data:text/javascript," + encodeURIComponent(code));
  const T = mod.default;

  console.log(`\n== ${tag} ==`);
  ok_("nessun avviso ICU", warns.length === 0, JSON.stringify(warns));

  const g1 = show(T[guestsKey]([1]));
  const g4 = show(T[guestsKey]([4]));
  ok_(`ospiti(1) -> "${g1}"`, g1.includes("1"));
  ok_(`ospiti(4) -> "${g4}"`, g4.includes("4"));
  ok_("ospiti(1) e ospiti(4) sono diverse (categorie diverse, o CLDR le rende diverse)", g1 !== g4 || tag === "ja-JP");

  const dateExpected = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date("2026-10-03T00:00:00Z"));
  const conferma = show(T[confirmKey]({ name: "Aldo", guests: 2, date: "2026-10-03", time: "20:30" }));
  ok_("la conferma contiene il nome", conferma.includes("Aldo"));
  ok_(`la conferma contiene la data formattata ("${dateExpected}")`, conferma.includes(dateExpected));
  ok_('la conferma contiene l\'ora "20:30"', conferma.includes("20:30"));
  ok_("la conferma contiene il numero di ospiti (2)", conferma.includes("2"));

  const priceExpected = new Intl.NumberFormat(tag, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(28);
  const abbinamento = show(T[pairingKey]([28]));
  ok_(`l'abbinamento contiene il prezzo formattato ("${priceExpected}")`, abbinamento.includes(priceExpected));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
