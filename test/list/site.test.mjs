// Il sito (landing + site/pages/*): la lista delle pagine è scritta in due posti, il campo
// "vitetranslateSite.slug" nel package.json di ogni pagina e le card di site/landing/src/pages.js,
// e i due devono coincidere. In più, siteLinks.js è una copia in ogni progetto (una pagina deve
// restare scaricabile da sola) e le copie devono restare identiche.
//
//   node test/list/site.test.mjs
import { inflateRawSync } from "node:zlib";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sitePages } from "../../site/build.mjs";
import { PAGES } from "../../site/landing/src/pages.js";
import { collectFiles, crc32, makeZip, zipPages } from "../../site/zip.mjs";
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
eq("sitePages trova le tre pagine", ["edge", "llmrestaurant", "playground"], pagine.map((p) => p.slug));

// 2. Le card e le pagine sono lo stesso insieme.
eq("gli slug delle card sono quelli delle pagine", pagine.map((p) => p.slug), PAGES.map((p) => p.slug).sort());

// 3. Il "source" di ogni card è la cartella della pagina con quello slug.
for (const { slug, source } of PAGES) {
  eq(`card ${slug}: source esiste`, true, existsSync(join(ROOT, source)));
  eq(`card ${slug}: source è la cartella della pagina`, pagine.find((p) => p.slug === slug)?.dir, source);
}

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
} finally {
  rmSync(cartellaZip, { recursive: true, force: true });
}
// Ogni card della landing ha il suo zip: lo slug è quello della pagina, lo scrive zipPages.
for (const { slug } of PAGES) eq(`card ${slug}: c'è una pagina da zippare con questo slug`, true, pagine.some((p) => p.slug === slug));

process.exit(fail > 0 ? 1 : 0);
