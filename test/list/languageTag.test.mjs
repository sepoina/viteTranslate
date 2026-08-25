// La validazione dei tag di lingua usata da `--add`.
//
// Perché è un test e non "si vede subito se funziona": un tag sbagliato che passa non dà
// errore da nessuna parte. Diventa un file in localeDir, quindi una lingua a tutti gli
// effetti — sincronizzata, compilata, spedita nel bundle — e l'unico sintomo è una voce in
// più nel selettore delle lingue, mesi dopo. I due controlli servono a cose diverse:
//
//   - la FORMA è la nostra convenzione (`<lingua>-<REGIONE>`, come i nomi dei file);
//   - l'ESISTENZA è l'unica cosa che distingue "xy-AB" da "fr-FR", visto che la forma la
//     rispettano entrambi.
//
//   node test/list/languageTag.test.mjs
import validateLanguageTag, { LANGUAGE_TAG_RE } from "../../lib/dev/vite/uty/validateLanguageTag.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const accetta = (tag) => eq(`accetta ${tag}`, true, validateLanguageTag(tag).ok);
const rifiuta = (tag, atteso) => {
  const esito = validateLanguageTag(tag);
  eq(`rifiuta ${JSON.stringify(tag)}`, false, esito.ok);
  if (atteso) eq(`  ...dicendo perché (${atteso})`, true, (esito.reason ?? "").includes(atteso));
};

// ------------------------------------------------------- l'elenco documentato, per intero
console.log("\n== ogni tag di doc/bcp47.md è accettato ==");
{
  // L'oracolo è la nostra stessa documentazione: se un tag è nella tabella che pubblichiamo
  // come "lingue supportate", `--add` deve poterlo aggiungere. È anche il test che ha imposto
  // `{2,3}` nella regex — "fil-PH" è lì dentro, e un `[a-z]{2}` l'avrebbe scartato.
  const doc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../doc/bcp47.md"), "utf8");
  const tags = [...doc.matchAll(/^\| \*\*([^*]+)\*\*/gm)].map((m) => m[1]);
  eq("la tabella è stata letta davvero", true, tags.length > 50);
  const scartati = tags.filter((t) => !validateLanguageTag(t).ok);
  eq(`tutti i ${tags.length} tag documentati passano`, "", scartati.join(" "));
}

// ------------------------------------------------------- forma
console.log("\n== forma <lingua>-<REGIONE> ==");
{
  accetta("it-IT");
  accetta("pt-BR");
  accetta("fil-PH"); // tre lettere di lingua: sta nell'elenco documentato
  rifiuta("it", "<language>-<REGION>"); // senza regione il nome del file non è confrontabile
  rifiuta("it_IT", "<language>-<REGION>");
  rifiuta("IT-it", "<language>-<REGION>");
  rifiuta("it-it", "<language>-<REGION>");
  rifiuta("zh-Hans-CN", "<language>-<REGION>"); // BCP 47 valido, fuori dal nostro sottoinsieme
  rifiuta("", "<language>-<REGION>");
  rifiuta("fr-FR.yml", "<language>-<REGION>"); // il tag, non il nome del file
  rifiuta(undefined);
}

// ------------------------------------------------------- il tag storto suggerisce quello giusto
console.log("\n== il messaggio dice qual era il tag giusto ==");
{
  // Le due forme in cui il tag corretto viene digitato sbagliato. Rifiutare senza dire cosa
  // scrivere lascia a chi legge il compito di indovinare quale metà era sbagliata.
  eq('"it_IT" suggerisce it-IT', true, validateLanguageTag("it_IT").reason.includes('did you mean "it-IT"'));
  eq('"IT-it" suggerisce it-IT', true, validateLanguageTag("IT-it").reason.includes('did you mean "it-IT"'));
  // Niente suggerimento inventato quando non ce n'è uno: "it" da solo resta senza regione.
  eq('"it" non suggerisce nulla', false, validateLanguageTag("it").reason.includes("did you mean"));
}

// ------------------------------------------------------- esistenza
console.log("\n== lingua e regione devono esistere ==");
{
  // Il controllo che la sola forma non può fare: questi passerebbero la regex identici a "fr-FR".
  rifiuta("xy-AB", "not a known language code");
  rifiuta("zz-ZZ", "not a known language code");
  rifiuta("it-ZZ", "not a known region code"); // "ZZ" = regione sconosciuta CLDR: ha un nome, non è una regione
  rifiuta("it-QQ", "not a known region code");
  // Lingua vera, regione vera, accoppiata insolita: si accetta. Non spetta a noi decidere
  // che l'italiano in Svizzera non si parli.
  accetta("it-CH");
  accetta("en-IN");
}

// ------------------------------------------------------- la regex resta esportata e sola
console.log("\n== la regex è una sola, esportata ==");
{
  eq("fil-PH passa la regex", true, LANGUAGE_TAG_RE.test("fil-PH"));
  eq("it-IT passa la regex", true, LANGUAGE_TAG_RE.test("it-IT"));
  eq("it-it non passa la regex", false, LANGUAGE_TAG_RE.test("it-it"));
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
