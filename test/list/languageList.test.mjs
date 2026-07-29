// L'elenco delle lingue esposto da useTranslateLanguage(): ordine, contenuto e immutabilità.
//
// L'immutabilità non è un vezzo, è la ragione per cui questo file esiste. `languages` è un
// singleton di modulo consegnato a codice che non controlliamo: una singola scrittura di
// troppo lo corrompe per tutti i lettori e per tutta la vita della pagina. Il caso reale è
// stato un `filter(l => l.tag = id)` (`=` invece di `===`) in un language switcher, che
// azzerava il tag di ogni lingua al primo render — sintomo lontanissimo dalla causa.
// Congelato, quella riga lancia sul posto; senza freeze il test qui sotto tornerebbe verde
// solo per finta, quindi si verifica sia che lanci sia che il contenuto sia rimasto intatto.
//
// react e react-dom sono peerDependencies opzionali: se mancano, test/run.mjs salta il file.
//
//   node test/list/languageList.test.mjs
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { TranslateContext } from "../../lib/react/TranslateContext.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(54), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// --------------------------------------------------------------- il mondo attorno al modulo
// Come negli altri test del runtime: l'import virtuale viene riscritto verso un manifest vero,
// scritto accanto all'originale così gli import relativi (React, il context) si risolvono —
// e TranslateContext resta la STESSA istanza che importa il test, altrimenti il Provider non
// parlerebbe con l'hook.
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const temporanei = [];
process.on("exit", () => {
  for (const percorso of temporanei) {
    try { unlinkSync(percorso); } catch { /* già rimosso */ }
  }
});

function scriviTemporaneo(nome, contenuto) {
  const percorso = join(ROOT, "lib/react", nome);
  writeFileSync(percorso, contenuto, "utf8");
  temporanei.push(percorso);
  return percorso;
}

// Due lingue, sorgente it-IT: nel manifest en-US viene per prima (è l'unica precaricata in
// build), così l'ordine atteso in uscita — sorgente in testa — non può venire dal caso.
const manifest = `
const tabella = {};
export const languages = {
  "en-US": { name: "American English", preloaded: true, table: tabella, load: () => Promise.resolve({ default: tabella }) },
  "it-IT": { name: "italiano (Italia)", preloaded: false, load: () => Promise.resolve({ default: tabella }) }
};
export const sourceLanguage = "it-IT";
export const fallbackTable = tabella;
`;
const nomeManifest = `__manifest-${stamp}.mjs`;
scriviTemporaneo(nomeManifest, manifest);
const percorsoModulo = scriviTemporaneo(
  `__useTranslateLanguage-${stamp}.mjs`,
  readFileSync(join(ROOT, "lib/react/useTranslateLanguage.js"), "utf8")
    .replaceAll(/["']virtual:vitetranslate\/languages["']/g, JSON.stringify(`./${nomeManifest}`)),
);
const { useTranslateLanguage } = await import(`${percorsoModulo}?t=${stamp}`);

/** Rende una sonda che chiama l'hook, dentro (o fuori) un provider di lingua. */
function leggiHook(lang) {
  let risultato;
  function Sonda() {
    risultato = useTranslateLanguage();
    return null;
  }
  renderToStaticMarkup(lang === undefined ? h(Sonda) : h(TranslateContext.Provider, { value: lang }, h(Sonda)));
  return risultato;
}

const linguaAttiva = { id: "it-IT", table: {}, debug: false, proposeNewLanguage: () => {} };

/** Esegue `azione` e restituisce il nome dell'errore, o "(nessun errore)" se non lancia. */
const lancia = (azione) => {
  try {
    azione();
    return "(nessun errore)";
  } catch (errore) {
    return errore.constructor.name;
  }
};

// ------------------------------------------------------------------------ ordine e contenuto
console.log("\n== l'elenco ==");
const { languages, sourceLanguage, id } = leggiHook(linguaAttiva);

eq("lingua sorgente in testa", "it-IT,en-US", languages.map((l) => l.tag).join(","));
eq("nome dal manifest, non dal tag", "italiano (Italia)", languages[0].languageName);
eq("nome della seconda lingua", "American English", languages[1].languageName);
eq("sourceLanguage esposta", "it-IT", sourceLanguage);
eq("id preso dal context", "it-IT", id);

// -------------------------------------------------------------------------- immutabilità
console.log("\n== l'elenco non si può corrompere ==");
eq("l'array è congelato", true, Object.isFrozen(languages));
eq("ogni voce è congelata", true, languages.every((l) => Object.isFrozen(l)));

// Il caso reale, riprodotto: `=` al posto di `===` dentro un filter.
eq("scrivere su una voce lancia", "TypeError", lancia(() => languages.filter((l) => (l.tag = undefined))));
eq("dopo il tentativo il tag è intatto", "it-IT", languages[0].tag);
eq("aggiungere una voce lancia", "TypeError", lancia(() => languages.push({ tag: "fr-FR" })));
eq("riordinare in place lancia", "TypeError", lancia(() => languages.reverse()));
eq("dopo i tentativi la lunghezza è intatta", 2, languages.length);
eq("una copia resta ordinabile", "en-US,it-IT", [...languages].reverse().map((l) => l.tag).join(","));

console.log("\n== l'oggetto restituito dall'hook ==");
const valore = leggiHook(linguaAttiva);
eq("è congelato", true, Object.isFrozen(valore));
eq("scriverci dentro lancia", "TypeError", lancia(() => { valore.id = "en-US"; }));
eq("identità dell'elenco stabile fra render", true, valore.languages === languages);

// ------------------------------------------------------------------ fuori dal container
console.log("\n== fuori da <TranslateContainer> ==");
const fuori = leggiHook(undefined);
eq("l'elenco resta lo stesso", true, fuori.languages === languages);
eq("id è undefined", undefined, fuori.id);
eq("è congelato anche lì", true, Object.isFrozen(fuori));

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
