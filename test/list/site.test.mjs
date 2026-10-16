// Il sito (landing + site/pages/*): la lista delle pagine è scritta in due posti, il campo
// "vitetranslateSite.slug" nel package.json di ogni pagina e le card di site/landing/src/pages.js,
// e i due devono coincidere. In più, siteLinks.js è una copia in ogni progetto (una pagina deve
// restare scaricabile da sola) e le copie devono restare identiche. Il tema di site/theme/ è
// copiato identico nei progetti, i colori stanno solo in tokens.css, le coppie di testo passano
// AA e nessuna pagina importa da fuori della sua cartella.
//
//   node test/list/site.test.mjs
import { inflateRawSync } from "node:zlib";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sitePages } from "../../site/cli/build.mjs";
import { DEMOS, PAGES } from "../../site/landing/src/pages.js";
import { sourceUrl, stackblitzUrl } from "../../site/landing/src/links.js";
import { collectFiles, crc32, makeZip, zipDemos, zipPages } from "../../site/cli/zip.mjs";
import { checkTheme, syncTheme, themeTargets } from "../../site/cli/syncTheme.mjs";
import { checkFavicon, themeColors } from "../../site/cli/favicon.mjs";
import { demoDirs } from "../syncDemoDeps.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// 1. Le pagine trovate.
const pagine = sitePages(ROOT);
eq("sitePages trova le quattro pagine", ["docs", "edge", "llmrestaurant", "playground"], pagine.map((p) => p.slug));
eq("sitePages: solo il manuale è senza card", ["docs"], pagine.filter((p) => !p.card).map((p) => p.slug));

// 2. Le card e le pagine con card sono lo stesso insieme (il manuale non ha card: la landing lo linka dalla barra).
eq("gli slug delle card sono quelli delle pagine con card", pagine.filter((p) => p.card).map((p) => p.slug), PAGES.map((p) => p.slug).sort());

// 3. Il "source" di ogni card è la cartella della pagina con quello slug.
for (const { slug, source } of PAGES) {
  eq(`card ${slug}: source esiste`, true, existsSync(join(ROOT, source)));
  eq(`card ${slug}: source è la cartella della pagina`, pagine.find((p) => p.slug === slug)?.dir, source);
}

// 3b. Le card delle demo: una per ogni cartella di demo/<Vite_N>/ con un package.json, slug validi e unici.
const cartelleDemo = readdirSync(join(ROOT, "demo"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(join(ROOT, "demo", d.name), { withFileTypes: true }).filter((s) => s.isDirectory()).map((s) => `demo/${d.name}/${s.name}`))
  .filter((dir) => existsSync(join(ROOT, dir, "package.json")))
  .sort();
eq("ogni demo di demo/ ha la sua card", cartelleDemo, DEMOS.map((d) => d.source).sort());
eq("gli slug delle demo sono unici", DEMOS.length, new Set(DEMOS.map((d) => d.slug)).size);
for (const { slug } of DEMOS) eq(`demo ${slug}: slug valido`, true, /^[a-z0-9-]+$/.test(slug));

// 3c. StackBlitz legge la cartella da GitHub e apre src/App.jsx: deve esistere in ogni progetto con una card.
eq("stackblitzUrl", "https://stackblitz.com/github/sepoina/viteTranslate/tree/main/demo/Vite_8/minimal?file=src/App.jsx", stackblitzUrl("demo/Vite_8/minimal"));
eq("sourceUrl", "https://github.com/sepoina/viteTranslate/tree/main/demo/Vite_8/minimal", sourceUrl("demo/Vite_8/minimal"));
for (const { source } of [...PAGES, ...DEMOS]) eq(`${source}: c'è src/App.jsx`, true, existsSync(join(ROOT, source, "src/App.jsx")));

// 4. Slug non ammessi, su cartelle finte.
const finta = (slugs) => {
  const tmp = mkdtempSync(join(tmpdir(), "vt-site-"));
  for (const [dir, slug] of Object.entries(slugs)) {
    mkdirSync(join(tmp, "site/pages", dir), { recursive: true });
    writeFileSync(join(tmp, "site/pages", dir, "package.json"), JSON.stringify({ vitetranslateSite: { slug } }));
  }
  return tmp;
};
const lancia = (slugs) => {
  const tmp = finta(slugs);
  try {
    sitePages(tmp);
    return "nessun errore";
  } catch (e) {
    return "errore";
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};
eq("uno slug doppio lancia", "errore", lancia({ a: "x", b: "x" }));
eq("uno slug con maiuscole lancia", "errore", lancia({ a: "Edge" }));
eq("uno slug riservato lancia", "errore", lancia({ a: "assets" }));
eq("slug diversi passano", "nessun errore", lancia({ a: "x", b: "y" }));

// 4b. "card": false (il manuale): la pagina c'è, ma sitePages lo dice e zipPages non la zippa.
{
  const tmp = finta({ a: "x" });
  try {
    mkdirSync(join(tmp, "site/pages/b"), { recursive: true });
    writeFileSync(join(tmp, "site/pages/b/package.json"), JSON.stringify({ vitetranslateSite: { slug: "y", card: false } }));
    eq("sitePages: card vale true se non dichiarata, false se `card: false`", [["x", true], ["y", false]], sitePages(tmp).map((p) => [p.slug, p.card]));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// 5. siteLinks.js: copie identiche, a meno delle virgolette.
const normalizza = (t) => t.replace(/"/g, "'");
const copie = ["site/landing", ...pagine.map((p) => p.dir)].map((d) => join(d, "src/siteLinks.js"));
const primo = normalizza(readFileSync(join(ROOT, copie[0]), "utf8"));
for (const c of copie) eq(`${c} uguale alle altre`, primo, normalizza(readFileSync(join(ROOT, c), "utf8")));

// 5b. siteLanguage.js: la stessa cosa, è la lingua condivisa da tutto il sito.
const lingua = ["site/landing", ...pagine.map((p) => p.dir)].map((d) => join(d, "src/siteLanguage.js"));
const primaLingua = normalizza(readFileSync(join(ROOT, lingua[0]), "utf8"));
for (const c of lingua) eq(`${c} uguale alle altre`, primaLingua, normalizza(readFileSync(join(ROOT, c), "utf8")));

// 6. syncDemoDeps le vede.
const dirs = demoDirs(ROOT);
for (const d of ["site/landing", ...pagine.map((p) => p.dir)]) eq(`demoDirs include ${d}`, true, dirs.includes(d));

// 7. Gli zip per StackBlitz: si rileggono dal loro stesso formato (intestazioni locali, deflate, CRC).
const leggiZip = (zip) => {
  const files = {};
  let p = 0;
  while (zip.readUInt32LE(p) === 0x04034b50) {
    const csize = zip.readUInt32LE(p + 18);
    const nlen = zip.readUInt16LE(p + 26);
    const nome = zip.toString("utf8", p + 30, p + 30 + nlen);
    const dati = inflateRawSync(zip.subarray(p + 30 + nlen, p + 30 + nlen + csize));
    eq(`zip: CRC di ${nome}`, crc32(dati), zip.readUInt32LE(p + 14));
    files[nome] = dati.toString("utf8");
    p += 30 + nlen + csize;
  }
  eq("zip: dopo i file c'è la directory centrale", 0x02014b50, zip.readUInt32LE(p));
  return files;
};
eq("crc32 di 123456789", 0xcbf43926, crc32(Buffer.from("123456789")));
const cartellaZip = mkdtempSync(join(tmpdir(), "vt-zip-"));
try {
  const cosa = {
    "package.json": "{}",
    "src/main.jsx": "ciao — è",
    "locale/it-IT.yml": "a: 1",
    ".env": "SECRET=1",
    ".env.local": "SECRET=2",
    ".env.example": "KEY=",
    "package-lock.json": "{}",
    "node_modules/x/index.js": "x",
    "dist/index.html": "x",
    "debug.log": "x",
  };
  for (const [nome, testo] of Object.entries(cosa)) {
    mkdirSync(dirname(join(cartellaZip, "p", nome)), { recursive: true });
    writeFileSync(join(cartellaZip, "p", nome), testo);
  }
  eq("zip: entrano solo i file del progetto, mai i segreti", [".env.example", "locale/it-IT.yml", "package.json", "src/main.jsx"], collectFiles(join(cartellaZip, "p")).map((f) => f.name));
  const scritti = zipPages([{ dir: "p", slug: "prova" }], join(cartellaZip, "dist"), cartellaZip);
  const letto = leggiZip(readFileSync(scritti[0].file));
  eq("zip: i contenuti tornano uguali (UTF-8 compreso)", { "src/main.jsx": "ciao — è", "package.json": "{}" }, { "src/main.jsx": letto["src/main.jsx"], "package.json": letto["package.json"] });
  eq("zip: due build danno gli stessi byte", true, makeZip(collectFiles(join(cartellaZip, "p"))).equals(readFileSync(scritti[0].file)));
  const conCard = zipPages([{ dir: "p", slug: "x", card: false }, { dir: "p", slug: "y", card: true }], join(cartellaZip, "dist2"), cartellaZip);
  eq("zip: una pagina con card: false non ha il suo zip", ["y"], conCard.map((z) => z.slug));
  const demo = zipDemos([{ source: "p", slug: "prova" }], join(cartellaZip, "dist"), cartellaZip);
  eq("zip: le demo vanno in zip/demo/<slug>.zip", join(cartellaZip, "dist/zip/demo/prova.zip"), demo[0].file);
  eq("zip: lo zip di una demo è lo stesso progetto", true, readFileSync(demo[0].file).equals(readFileSync(scritti[0].file)));
} finally {
  rmSync(cartellaZip, { recursive: true, force: true });
}
// Ogni card della landing ha il suo zip: lo slug è quello della pagina, lo scrive zipPages.
for (const { slug } of PAGES) eq(`card ${slug}: c'è una pagina da zippare con questo slug`, true, pagine.some((p) => p.slug === slug));

// 8. Il tema: site/theme/ (più runtimeSize.json) copiato identico in src/theme/ di ogni progetto che lo usa.
eq("themeTargets: la landing e le pagine con theme: true", ["site/landing", "site/pages/docs", "site/pages/playEdge", "site/pages/playground"], themeTargets(ROOT));
eq("le copie del tema sono allineate (npm run site:theme)", [], checkTheme(ROOT));
for (const t of themeTargets(ROOT)) {
  eq(`${t}: main.jsx importa theme/theme.css`, true, readFileSync(join(ROOT, t, "src/main.jsx"), "utf8").includes("./theme/theme.css"));
}
eq("site/theme/logo.svg è doc/logo.svg", true, readFileSync(join(ROOT, "site/theme/logo.svg")).equals(readFileSync(join(ROOT, "doc/logo.svg"))));

// 8b. The favicon: redrawn from tokens.css it gives the same bytes (npm run site:favicon), and every themed page links it.
eq("site/theme: favicon up to date (npm run site:favicon)", [], await checkFavicon(ROOT));
const tokensFinti = `:root {\n  --bg-deep: #000000;\n  --badge-bg: var(--text);\n  --bg: #0B0F0D;\n  --accent: #4ade80;\n}\n:root[data-theme="light"] {\n  --bg: #f6f5f0;\n  --accent: #147a3a;\n}\n`;
eq("themeColors: --bg and --accent of both blocks", { dark: { bg: "#0b0f0d", fg: "#4ade80" }, light: { bg: "#f6f5f0", fg: "#147a3a" } }, themeColors(tokensFinti));
const erroreColori = (testo) => {
  try {
    themeColors(testo);
    return "";
  } catch (e) {
    return e.message;
  }
};
eq("themeColors: a token that isn't #rrggbb is an error", true, erroreColori(tokensFinti.replace("#147a3a", "var(--x)")).includes("--accent"));
eq("themeColors: a missing block is an error", true, erroreColori(tokensFinti.slice(0, tokensFinti.indexOf(":root["))).includes("no "));
for (const t of themeTargets(ROOT)) {
  const html = readFileSync(join(ROOT, t, "index.html"), "utf8");
  const icone = ["favicon-32.png", "favicon.svg", "apple-touch-icon.png"].map((f) => html.indexOf(`href="/src/theme/${f}"`));
  eq(`${t}: index.html links the favicons, PNG before SVG`, true, icone.every((i) => i > 0) && icone[0] < icone[1]);
}

// 9. syncTheme su un albero finto: scrive, toglie i file che non ci sono più, lascia stare chi non lo chiede.
const alberoTema = mkdtempSync(join(tmpdir(), "vt-theme-"));
try {
  const scrivi = (rel, testo) => {
    mkdirSync(dirname(join(alberoTema, rel)), { recursive: true });
    writeFileSync(join(alberoTema, rel), testo);
  };
  scrivi("site/theme/a.css", "a{}");
  scrivi("site/theme/B.jsx", "export default 1;");
  scrivi("site/cli/runtimeSize.json", "{}");
  scrivi("site/landing/package.json", "{}");
  scrivi("site/pages/p1/package.json", JSON.stringify({ vitetranslateSite: { slug: "p1", theme: true } }));
  scrivi("site/pages/p2/package.json", JSON.stringify({ vitetranslateSite: { slug: "p2" } }));
  eq("tema finto: chi lo riceve", ["site/landing", "site/pages/p1"], themeTargets(alberoTema));
  eq("tema finto: prima della copia mancano 3 file x 2 progetti", 6, checkTheme(alberoTema).length);
  syncTheme(alberoTema);
  eq("tema finto: dopo la copia è allineato", [], checkTheme(alberoTema));
  eq("tema finto: la copia porta anche runtimeSize.json", true, existsSync(join(alberoTema, "site/pages/p1/src/theme/runtimeSize.json")));
  scrivi("site/pages/p1/src/theme/vecchio.css", "x");
  eq("tema finto: un file in più si vede", ["site/pages/p1/src/theme/vecchio.css: in più"], checkTheme(alberoTema));
  syncTheme(alberoTema);
  eq("tema finto: e la copia lo toglie", false, existsSync(join(alberoTema, "site/pages/p1/src/theme/vecchio.css")));
  eq("tema finto: p2 non riceve niente", false, existsSync(join(alberoTema, "site/pages/p2/src/theme")));
} finally {
  rmSync(alberoTema, { recursive: true, force: true });
}

// 10. I colori stanno solo in tokens.css: nel resto del CSS del sito, solo var(--…).
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");
for (const f of ["site/theme/theme.css", "site/theme/code.css", "site/theme/codeTheme.js", "site/landing/src/landing.css", "site/pages/playground/src/playground.css", "site/pages/playEdge/src/edge.css", "site/pages/docs/src/docs.css"]) {
  const trovati = senzaCommenti(readFileSync(join(ROOT, f), "utf8")).match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g) ?? [];
  eq(`${f}: nessun colore scritto a mano`, [], trovati);
}

// 11. tokens.css: i due blocchi del tema chiaro sono uguali, e ogni coppia di testo passa 4.5:1 in entrambi i temi.
const tokens = readFileSync(join(ROOT, "site/theme/tokens.css"), "utf8");
const blocco = (selettore) => {
  const a = tokens.indexOf("{", tokens.indexOf(selettore));
  return tokens.slice(a + 1, tokens.indexOf("}", a));
};
const variabili = (testo) => Object.fromEntries([...testo.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const chiaroSistema = blocco(':root:not([data-theme="dark"])');
eq("tokens.css: i due blocchi chiari sono uguali", chiaroSistema.replace(/\s+/g, " ").trim(), blocco(':root[data-theme="light"]').replace(/\s+/g, " ").trim());
const scuro = variabili(blocco(":root {"));
const chiaro = { ...scuro, ...variabili(chiaroSistema) };
const risolvi = (mappa, nome, n = 0) => {
  const v = mappa[nome] ?? "";
  const r = /^var\(--([\w-]+)\)$/.exec(v);
  return r && n < 5 ? risolvi(mappa, r[1], n + 1) : v;
};
const luminanza = (hex) => {
  const c = hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrasto = (a, b) => {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const COPPIE = [
  ...["text", "muted", "faint", "quiet", "accent"].flatMap((f) => ["bg", "surface-2", "bg-deep"].map((b) => [f, b])),
  ["lead", "bg"],
  ["code-text", "bg"],
  ["accent-ink", "accent-fill"],
  ["accent-ink-2", "accent-fill"],
  ["ink-text", "ink"],
  ["badge-ink", "badge-bg"],
  ...["warn", "error"].flatMap((f) => ["bg", "surface-2"].map((b) => [f, b])),
  ...["tk-c", "tk-s", "tk-t", "tk-k", "tk-n", "code-text"].map((f) => [f, "code-bg"]),
  // The hint under the bar: name (accent) and description (muted) on both ends of its gradient.
  ...["muted", "accent"].flatMap((f) => ["hint-bg", "hint-bg-2"].map((b) => [f, b])),
  // The manual's tables: the header on its fill, text and links on the body.
  ["table-head-ink", "table-head-bg"],
  ...["text", "muted", "accent"].map((f) => [f, "table-bg"]),
];
// 3:1 basta per il testo grande e per i simboli (WCAG 1.4.3 e 1.4.11): --dim colora solo titoli e
// testo decorativo, --mark-n è il ✕ del confronto, che ha accanto il suo significato per esteso.
const COPPIE_3 = [
  ...["bg", "bg-deep"].map((b) => ["dim", b]),
  ["mark-n", "bg"],
];
const esa = /^#[0-9a-f]{6}$/i;
for (const [nome, mappa] of [["scuro", scuro], ["chiaro", chiaro]]) {
  for (const [coppie, soglia] of [[COPPIE, 4.5], [COPPIE_3, 3]]) {
    const sotto = coppie.filter(([f, b]) => {
      const [a, c] = [risolvi(mappa, f), risolvi(mappa, b)];
      return !esa.test(a) || !esa.test(c) || contrasto(a, c) < soglia;
    }).map(([f, b]) => `${f} su ${b}`);
    eq(`tema ${nome}: ogni coppia passa ${soglia}:1`, [], sotto);
  }
}
// The code blocks' base16 scheme (codeScheme.css, slots chosen by codeTheme.js, painted by code.css): every slot that colours text,
// on the scheme's own background. base01, base02 (backgrounds), base06 and base07 colour no text.
{
  const schema = variabili(readFileSync(join(ROOT, "site/theme/codeScheme.css"), "utf8"));
  const testo = ["base03", "base04", "base05", "base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F"];
  const sotto = testo.filter((b) => !esa.test(schema[b] ?? "") || !esa.test(schema.base00 ?? "") || contrasto(schema[b], schema.base00) < 4.5);
  eq("codeScheme.css: ogni colore del testo passa 4.5:1 su base00", [], sotto);
}
// The manual's highlighter is see-through: its text is measured on the stroke laid over the page, the
// cards and the table body.
const sopra = (rgba, sotto) => {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(rgba);
  if (!m || !esa.test(sotto)) return "";
  const a = Number(m[4]);
  return "#" + [1, 2, 3].map((k) => Math.round(Number(m[k]) * a + parseInt(sotto.slice(2 * k - 1, 2 * k + 1), 16) * (1 - a)).toString(16).padStart(2, "0")).join("");
};
for (const [nome, mappa] of [["scuro", scuro], ["chiaro", chiaro]]) {
  const sotto = ["bg", "surface-2", "table-bg"].filter((b) => {
    const fondo = sopra(risolvi(mappa, "highlight-bg"), risolvi(mappa, b));
    return !esa.test(fondo) || contrasto(risolvi(mappa, "highlight-ink"), fondo) < 4.5;
  });
  eq(`tema ${nome}: il testo evidenziato passa 4.5:1 (pagina, card, tabella)`, [], sotto);
}

// 12. Una pagina, o una demo, resta autonoma: nessun import relativo esce dalla sua cartella (né lo zip
// né StackBlitz, che importa solo quella cartella da GitHub, lo avrebbero).
const sorgenti = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (["node_modules", "dist"].includes(e.name) ? [] : sorgenti(join(dir, e.name))) : /\.(jsx?|mjs|css)$/.test(e.name) ? [join(dir, e.name)] : []
  );
for (const dir of [...pagine.map((p) => p.dir), ...DEMOS.map((d) => d.source)]) {
  const radicePagina = join(ROOT, dir);
  const fuori = [];
  for (const f of sorgenti(radicePagina)) {
    for (const m of readFileSync(f, "utf8").matchAll(/(?:from\s*|import\s*\(\s*|@import\s+(?:url\()?)["'](\.{1,2}\/[^"']+)["']/g)) {
      if (!resolve(dirname(f), m[1]).startsWith(radicePagina + sep)) fuori.push(`${f.slice(radicePagina.length + 1)} -> ${m[1]}`);
    }
  }
  eq(`${dir}: nessun import fuori dalla cartella`, [], fuori);
}

process.exit(fail > 0 ? 1 : 0);
