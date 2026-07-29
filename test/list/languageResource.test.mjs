// Il cablaggio fra il manifest generato e il runtime che lo consuma.
//
// È la giuntura che né la build né ssr-check attraversano: la build verifica che il modulo
// virtuale si generi, ssr-check parte da `resolveEntry` in giù. In mezzo sta languageResource,
// che legge `preloaded`, `table` e `load` dal manifest — e un disallineamento lì non si vede
// finché l'app non gira nel browser.
//
// Il manifest è quello vero, prodotto dal plugin; l'import virtuale viene riscritto a
// relativo, così il modulo sotto test resta byte per byte quello spedito.
//
//   node test/list/languageResource.test.mjs
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { writeFileSync, unlinkSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import vitetranslate from "../../lib/dev/vite/vitetranslate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const VIRTUAL = "\0virtual:vitetranslate/languages";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(50), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

/**
 * Carica languageResource.js contro un manifest generato davvero, per la configurazione data.
 * I file temporanei stanno accanto al modulo originale: gli import relativi devono risolversi.
 */
async function loadRuntime({ preloadedLanguages, isProduction }) {
  const [, plugin] = vitetranslate({
    baseDir: join(ROOT, "playground"),
    localeDir: "src/locale",
    sourceLanguage: "it-IT",
    ...(preloadedLanguages ? { preloadedLanguages } : {}),
  });
  plugin.configResolved({ isProduction, build: {} });
  const manifest = (await plugin.load(VIRTUAL)).code;

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const manifestPath = join(ROOT, "lib/react", `__manifest-${stamp}.mjs`);
  const modulePath = join(ROOT, "lib/react", `__resource-${stamp}.mjs`);
  writeFileSync(manifestPath, manifest, "utf8");
  writeFileSync(
    modulePath,
    readFileSync(join(ROOT, "lib/react/languageResource.js"), "utf8")
      .replace(/"virtual:vitetranslate\/languages"/, JSON.stringify(`./__manifest-${stamp}.mjs`)),
    "utf8"
  );
  try {
    return await import(`${modulePath}?t=${stamp}`);
  } finally {
    unlinkSync(manifestPath);
    unlinkSync(modulePath);
  }
}

console.log("\n== build, preloadedLanguages: ['en-US'] (la sorgente resta lazy) ==");
{
  const rt = await loadRuntime({ preloadedLanguages: ["en-US"], isProduction: true });

  eq("le lingue note sono tutte e tre", true,
    rt.isKnownLanguage("it-IT") && rt.isKnownLanguage("en-US") && rt.isKnownLanguage("zh-CN"));
  eq("un tag inventato non è noto", false, rt.isKnownLanguage("xx-XX"));
  // Object.prototype non deve passare per lingua.
  eq("constructor non è una lingua", false, rt.isKnownLanguage("constructor"));
  eq("toString non è una lingua", false, rt.isKnownLanguage("toString"));

  eq("en-US risulta precaricata", true, rt.isPreloadedLanguage("en-US"));
  // Il punto della modifica: in produzione la sorgente NON è precaricata, e il runtime lo sa.
  eq("it-IT (sorgente) NON risulta precaricata", false, rt.isPreloadedLanguage("it-IT"));
  eq("zh-CN NON risulta precaricata", false, rt.isPreloadedLanguage("zh-CN"));
  eq("un tag inventato non è precaricato", false, rt.isPreloadedLanguage("xx-XX"));

  eq("elenco delle precaricate", "en-US", rt.preloadedLanguages.join(","));
  eq("prima precaricata (default di initialLanguage)", "en-US", rt.firstPreloadedLanguage);

  // Una precaricata si legge sincrona: nessuna sospensione, nessuna Promise lanciata.
  const table = rt.readLanguage("en-US");
  eq("readLanguage di una precaricata non sospende", "object", typeof table);
  eq("ed è la tabella vera", true, typeof table["App_7p1ky4"] === "string");

  // Una lazy sospende: readLanguage lancia la Promise (meccanismo di Suspense).
  let thrown;
  try { rt.readLanguage("zh-CN"); } catch (e) { thrown = e; }
  eq("readLanguage di una lazy lancia una Promise", true, thrown instanceof Promise);
  await thrown.catch(() => {});
}

console.log("\n== dev, stessa configurazione (la sorgente è precaricata comunque) ==");
{
  const rt = await loadRuntime({ preloadedLanguages: ["en-US"], isProduction: false });
  eq("en-US precaricata", true, rt.isPreloadedLanguage("en-US"));
  // Ed è esattamente perché qui è `true` che il controllo di TranslateContainer non poteva
  // essere limitato allo sviluppo: in dev direbbe che va tutto bene.
  eq("it-IT precaricata anche lei", true, rt.isPreloadedLanguage("it-IT"));
  eq("elenco delle precaricate", "en-US,it-IT", rt.preloadedLanguages.join(","));
  eq("prima precaricata identica alla build", "en-US", rt.firstPreloadedLanguage);
}

console.log("\n== senza preloadedLanguages ==");
{
  const rt = await loadRuntime({ isProduction: true });
  eq("la sorgente è precaricata", true, rt.isPreloadedLanguage("it-IT"));
  eq("prima precaricata", "it-IT", rt.firstPreloadedLanguage);
  eq("le altre restano lazy", false, rt.isPreloadedLanguage("en-US"));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
