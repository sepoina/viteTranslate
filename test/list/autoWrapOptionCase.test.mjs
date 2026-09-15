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

// Il sorgente di prova (`export default function App() { return (<p>_%_ciao_%_</p>); }`) è un
// componente VERDE per il classificatore della 4.4.0 (esportato, JSX diretto, zero parametri),
// quindi da questo strato in poi la forma emessa è l'hook (`{__vtNode(...)}`), non più il wrap
// (`<__vtTranslate .../>`). Questo test parla della LETTURA dell'opzione, non dell'emissione:
// deve restare vero riconoscendo entrambe le forme, altrimenti smetterebbe di verificare cio'
// per cui esiste il giorno in cui l'euristica del componente cambiasse idea su questo sorgente.
const avvolto = (opz) => {
  const code = transformDi(opz).code;
  return code.includes("<__vtTranslate") || code.includes("__vtNode(");
};

console.log("\n== autoWrap: case-insensitive, come simpleLog e autoSync* ==");
eq("autoWrap: true", true, avvolto(opzioni({ autoWrap: true })));
eq("autowrap: true (tutto minuscolo)", true, avvolto(opzioni({ autowrap: true })));
eq("AutoWrap: true (maiuscole diverse)", true, avvolto(opzioni({ AutoWrap: true })));
// T9: una RegExp accende esattamente come `true`, con qualunque maiuscola nel nome opzione.
eq("autoWrap: /^p$/ (RegExp)", true, avvolto(opzioni({ autoWrap: /^p$/ })));
eq("AUTOWRAP: /^p$/ (RegExp, tutto maiuscolo)", true, avvolto(opzioni({ AUTOWRAP: /^p$/ })));

console.log("\n== autoWrap: duale di leggiFlag — solo true esplicito o una RegExp accendono ==");
eq("nessuna opzione -> spento di default", false, avvolto(opzioni()));
eq("autoWrap: false -> spento", false, avvolto(opzioni({ autoWrap: false })));
eq("autoWrap: 1 -> resta spento (solo true accende)", false, avvolto(opzioni({ autoWrap: 1 })));
eq('autoWrap: "yes" -> resta spento (solo true accende)', false, avvolto(opzioni({ autoWrap: "yes" })));
eq('autoWrap: "p|span" (stringa, non RegExp) -> resta spento', false, avvolto(opzioni({ autoWrap: "p|span" })));

console.log("\n== T7: la RegExp con flag globale non e' stateful fra due tag di seguito ==");
{
  // `.test()` su una RegExp con "g" avanza `lastIndex` a ogni chiamata: senza la pulizia di
  // vitetranslate.js (§ 1.3 del piano), il secondo <p> di due risponderebbe a caso. Un
  // sorgente con DUE marcatori sotto due <p> distinti, passato al transform vero.
  const dueParagrafi = (opz) => {
    const plugin = vitetranslate(opz).flat(Infinity).find((p) => p?.name === "vitetranslate");
    const id = join(opz.baseDir, "src", "App.jsx");
    const src = `export default function App() { return (<div><p>_%_uno_%_</p><p>_%_due_%_</p></div>); }\n`;
    return plugin.transform.handler.call({}, src, id).code;
  };
  const code = dueParagrafi(opzioni({ autoWrap: /^p$/g }));
  const avvolti = (code.match(/__vtNode\(/g) ?? []).length;
  eq("entrambi i <p> avvolti (non solo il primo)", 2, avvolti);
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
