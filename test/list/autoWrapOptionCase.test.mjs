// L'opzione autoWrap si legge case-insensitive come simpleLog e le due autoSync (vedi
// autoSyncOptionCase.test.mjs), ma è il DUALE di leggiFlag: il default è spento, quindi si
// accende solo su `true` esplicito, non su qualunque valore non-`false` — vedi
// doc/ImplementationPlans/4_3_0.md § 1.6. Un refuso come "autoWrap: 1" deve restare spento:
// un default che sbaglia verso l'inazione è quello giusto per una funzionalità additiva.
//
// A differenza di autoSyncDev/autoSyncBuild, autoWrap non finisce in vitetranslateConfig: lo
// legge solo transform.handler al momento di chiamare extractMarkers, quindi il modo di
// osservarlo è invocare il transform vero su un file con un marcatore sotto un genitore host.
//
//   node test/list/autoWrapOptionCase.test.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vitetranslate from "../../lib/dev/vite/vitetranslate.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function baseDir() {
  const radice = mkdtempSync(join(tmpdir(), "vt-autowrap-optioncase-"));
  temporanee.push(radice);
  return radice;
}

const opzioni = (extra = {}) => ({ localeDir: "locale", sourceLanguage: "it-IT", baseDir: baseDir(), ...extra });

/** Il transform vero, chiamato come farebbe Vite: stesso schema di languageResource.test.mjs
 * per il plugin "compile-locale", qui sul plugin principale "vitetranslate". */
const transformDi = (opz) => {
  const plugin = vitetranslate(opz).flat(Infinity).find((p) => p?.name === "vitetranslate");
  const id = join(opz.baseDir, "src", "App.jsx");
  return plugin.transform.handler.call({}, `export default function App() { return (<p>_%_ciao_%_</p>); }\n`, id);
};

const avvolto = (opz) => transformDi(opz).code.includes("<__vtTranslate");

console.log("\n== autoWrap: case-insensitive, come simpleLog e autoSync* ==");
eq("autoWrap: true", true, avvolto(opzioni({ autoWrap: true })));
eq("autowrap: true (tutto minuscolo)", true, avvolto(opzioni({ autowrap: true })));
eq("AutoWrap: true (maiuscole diverse)", true, avvolto(opzioni({ AutoWrap: true })));

console.log("\n== autoWrap: duale di leggiFlag — solo true esplicito accende ==");
eq("nessuna opzione -> spento di default", false, avvolto(opzioni()));
eq("autoWrap: false -> spento", false, avvolto(opzioni({ autoWrap: false })));
eq("autoWrap: 1 -> resta spento (solo true accende)", false, avvolto(opzioni({ autoWrap: 1 })));
eq('autoWrap: "yes" -> resta spento (solo true accende)', false, avvolto(opzioni({ autoWrap: "yes" })));

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
