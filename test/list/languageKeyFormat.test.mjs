// Il lettore (parseLanguageFile) e lo scrittore (serializeLanguageFile) di un file di lingua
// devono accettare esattamente la stessa forma di chiave: LANGUAGE_KEY_RE, condivisa da
// entrambi in languageFileFormat.js. Se divergessero, si scriverebbe un file che alla sync
// successiva non si rilegge.
//
//   node test/list/languageKeyFormat.test.mjs
import { LANGUAGE_KEY_RE } from "../../lib/dev/vite/uty/languageFileFormat.js";
import parseLanguageFile from "../../lib/dev/vite/uty/parseLanguageFile.js";
import serializeLanguageFile from "../../lib/dev/vite/uty/serializeLanguageFile.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = Object.is(atteso, ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const accettaInScrittura = (key) => {
  try {
    serializeLanguageFile({ tag: "it-IT", isSource: true, translated: [[key, "x"]], untranslated: [], now: new Date() });
    return true;
  } catch {
    return false;
  }
};

console.log("\n== LANGUAGE_KEY_RE e serializeLanguageFile sono d'accordo ==");
{
  const valide = ["App_abc", "_x", "n1_z", "a.b-c"];
  const nonValide = ["1abc", "a:b", "a b", "", "à"];
  for (const key of [...valide, ...nonValide]) {
    eq(`"${key}" · regex e scrittore coincidono`, LANGUAGE_KEY_RE.test(key), accettaInScrittura(key));
  }
}

console.log("\n== ogni chiave valida sopravvive a un giro scrittura -> lettura ==");
{
  const valide = ["App_abc", "_x", "n1_z", "a.b-c"];
  for (const key of valide) {
    const testo = serializeLanguageFile({ tag: "it-IT", isSource: true, translated: [[key, "valore"]], untranslated: [], now: new Date() });
    const { table } = parseLanguageFile(testo, "it-IT.yml");
    eq(`"${key}" · si rilegge con lo stesso valore`, "valore", table[key]);
  }
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
