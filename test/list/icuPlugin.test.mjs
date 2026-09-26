// L'opzione "icu" del plugin, il modulo virtuale "virtual:vitetranslate/icu" e i due export del
// manifest (icu, icuDev) — piano 4.6.3, § 1.10.
//
//   node test/list/icuPlugin.test.mjs
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import vitetranslate from "../../lib/dev/vite/vitetranslate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const ok_ = (nome, cond) => {
  if (!cond) fail++;
  console.log(cond ? "  ok  " : "  KO  ", nome);
};

const VIRTUAL_LANG = "\0virtual:vitetranslate/languages";
const VIRTUAL_ICU = "virtual:vitetranslate/icu";
const RESOLVED_VIRTUAL_ICU = "\0virtual:vitetranslate/icu";

function makePlugin(extra = {}) {
  const [, plugin] = vitetranslate({
    baseDir: join(ROOT, "site/pages/playground"),
    localeDir: "locale",
    sourceLanguage: "it-IT",
    ...extra,
  });
  return plugin;
}

console.log("\n== resolveId / load del modulo virtuale ICU ==");
{
  const plugin = makePlugin();
  eq("resolveId(virtual:vitetranslate/icu)", RESOLVED_VIRTUAL_ICU, plugin.resolveId(VIRTUAL_ICU));
  const loaded = await plugin.load(RESOLVED_VIRTUAL_ICU);
  ok_("load() contiene /lib/icu/runtime.js", loaded.code.includes("/lib/icu/runtime.js"));
  ok_("load() riesporta i quattro helper", ["icuDate", "icuNumber", "icuPlural", "icuSelect"].every((n) => loaded.code.includes(n)));
}

console.log("\n== validazione dell'opzione icu ==");
{
  const throws = (extra, atteso, nome) => {
    try {
      makePlugin(extra);
      eq(nome, atteso, "(nessun errore)");
    } catch (e) {
      eq(nome, atteso, e.message);
    }
  };
  throws({ icu: { timeZone: "Nope/Nowhere" } },
    '[vitetranslate] option "icu.timeZone" must be an IANA time zone such as "Europe/Rome" or "UTC", got "Nope/Nowhere".',
    "fuso inesistente");
  throws({ icu: { foo: 1 } },
    '[vitetranslate] option "icu.foo" is not a recognised option: the only one is "timeZone".',
    "chiave sconosciuta");
  throws({ icu: "UTC" },
    '[vitetranslate] option "icu" must be an object, e.g. { timeZone: "Europe/Rome" }.',
    "icu non oggetto");
}

console.log("\n== manifest: export icu / icuDev ==");
{
  const plugin = makePlugin({ icu: { timeZone: "Europe/Rome" } });
  plugin.configResolved({ isProduction: false, build: {} });
  const dev = await plugin.load(VIRTUAL_LANG);
  ok_('dev: contiene export const icu = {"timeZone":"Europe/Rome"}', dev.code.includes('export const icu = {"timeZone":"Europe/Rome"};'));
  ok_("dev: icuDev riesporta interpretIcu da lib/icu/devInterpret.js", /export \{ interpretIcu as icuDev \} from ".*\/lib\/icu\/devInterpret\.js";/.test(dev.code));

  const pluginBuild = makePlugin({ icu: { timeZone: "Europe/Rome" } });
  pluginBuild.configResolved({ isProduction: true, build: {} });
  const build = await pluginBuild.load(VIRTUAL_LANG);
  ok_("build: icuDev = null", build.code.includes("export const icuDev = null;"));
  ok_('build: icu = {"timeZone":"Europe/Rome"} comunque presente', build.code.includes('export const icu = {"timeZone":"Europe/Rome"};'));
}
{
  const plugin = makePlugin();
  plugin.configResolved({ isProduction: false, build: {} });
  const dev = await plugin.load(VIRTUAL_LANG);
  ok_("senza opzione icu: export const icu = null", dev.code.includes("export const icu = null;"));
}

console.log("\n== config(): i moduli virtuali raggiungibili anche in SSR ==");
{
  // Sync spento: config() non deve scrivere nelle tabelle del playground.
  const plugin = makePlugin({ autoSyncDev: false, autoSyncBuild: false });
  const out = await plugin.config({}, { command: "serve", mode: "development" });
  eq("optimizeDeps.exclude", JSON.stringify(["@sepoina/vitetranslate"]), JSON.stringify(out.optimizeDeps?.exclude));
  // Senza, Vite esternalizza il pacchetto in SSR e Node muore su "virtual:" (ERR_UNSUPPORTED_ESM_URL_SCHEME).
  eq("ssr.noExternal", JSON.stringify(["@sepoina/vitetranslate"]), JSON.stringify(out.ssr?.noExternal));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
