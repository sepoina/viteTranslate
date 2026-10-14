// Il legame fra il codice e il manuale (site/pages/docs): quali pagine descrivono quali file
// (`sources:` nel frontmatter), se il codice è cambiato da quando la pagina è stata riletta
// (docs.lock.json) e le verifiche che `npm run testRelease` esegue sul manuale.
//
//   npm run docs:status                    # le pagine "stale": il codice è cambiato, la pagina no
//   npm run docs:seal -- <route> [<route>…]  # dopo aver riletto il diff e aggiornato la pagina
//   node site/docsSources.mjs checks       # le verifiche (le stesse di test/release/06-docs.check.mjs)
//
// Il lock si scrive solo con `seal`, una pagina alla volta: sigillare senza aver letto il diff
// vanificherebbe tutto. Gli hash sono sul testo con i fine riga normalizzati a LF (CRLF/LF non conta).
// LINKED-DATA: le regole stanno in AGENTS.md ("REGOLE DI MANUALISTICA") e nel piano doc/ImplementationPlans/docs/manual_v1.md.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectCode, collectLinks, jsonSubtree, listMdx, pageIds, parseMdx, splitSource } from "./pages/docs/scripts/compileDocs.mjs";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGINA = "site/pages/docs";
const SITO = "https://sepoina.github.io/viteTranslate/docs/";

/** I file di documentazione che il manuale ha sostituito: oggi sono segnaposto che rimandano al manuale. */
export const MIGRATED = [
  "react-api", "llm", "cli", "icu", "diagnostics", "plugin-options", "translations", "bcp47", "limitations", "requirements", "live-examples", "ide-panel",
].map((n) => `doc/${n}.md`);

// ───────────────────────────── pagine e lock ─────────────────────────────

/** Tutte le pagine di content/, già lette. @returns {{ route: string, file: string, front: object, blocks: object[] }[]} */
export function loadPages(radice = RADICE) {
  const dir = join(radice, PAGINA, "content");
  return listMdx(dir).map((rel) => {
    const file = `content/${rel}`;
    const { front, blocks } = parseMdx(readFileSync(join(dir, rel), "utf8"), file);
    return { route: rel.replace(/\.mdx$/, ""), file, front, blocks };
  });
}

const lf = (t) => t.replace(/\r\n?/g, "\n");
const sha = (testo) => createHash("sha256").update(testo).digest("hex");
/** L'hash (sha256) di un file con i fine riga a LF; null se il file non c'è. */
export function hashFile(path) {
  return existsSync(path) ? sha(lf(readFileSync(path, "utf8"))) : null;
}

/**
 * L'hash di una source: il file intero, oppure (`file.json#chiave`) il solo sottoalbero, su JSON.stringify.
 * null se il file o la chiave non ci sono.
 */
export function hashSource(radice, source) {
  const { file, key } = splitSource(source);
  if (key === null) return hashFile(join(radice, file));
  if (!existsSync(join(radice, file))) return null;
  const sotto = jsonSubtree(readFileSync(join(radice, file), "utf8"), key);
  return sotto === undefined ? null : sha(JSON.stringify(sotto));
}

const lockFile = (radice) => join(radice, PAGINA, "docs.lock.json");
/** Il lock, o un lock vuoto se non c'è ancora. */
export function readLock(radice = RADICE) {
  const f = lockFile(radice);
  const lock = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
  return { pages: lock.pages ?? {}, anchors: lock.anchors ?? [] };
}

function writeLock(radice, lock) {
  const pages = Object.fromEntries(Object.keys(lock.pages).sort().map((r) => [r, lock.pages[r]]));
  const anchors = [...new Set(lock.anchors)].sort();
  writeFileSync(lockFile(radice), `${JSON.stringify({ pages, anchors }, null, 2)}\n`);
}

const gitHead = (radice) => {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: radice, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};

/**
 * Le pagine il cui codice è cambiato (o mai sigillate).
 * @returns {{ stale: { route: string, sealedAt: string | null, reasons: string[], files: string[] }[], fresh: string[] }}
 */
export function status(radice = RADICE) {
  const lock = readLock(radice);
  const stale = [];
  const fresh = [];
  for (const p of loadPages(radice)) {
    const sealed = lock.pages[p.route];
    if (!sealed) {
      stale.push({ route: p.route, sealedAt: null, reasons: ["not sealed yet"], files: [] });
      continue;
    }
    const reasons = [];
    const files = [];
    for (const s of p.front.sources) {
      if (!(s in sealed.sources)) reasons.push(`source added: ${s}`);
      else if (hashSource(radice, s) !== sealed.sources[s]) {
        reasons.push(`changed: ${s}`);
        files.push(s);
      }
    }
    for (const s of Object.keys(sealed.sources)) if (!p.front.sources.includes(s)) reasons.push(`source removed: ${s}`);
    if (reasons.length) stale.push({ route: p.route, sealedAt: sealed.sealedAt, reasons, files });
    else fresh.push(p.route);
  }
  return { stale, fresh };
}

/**
 * Sigilla le pagine: registra gli hash di oggi dei loro `sources:` e le loro ancore. Non toglie mai un'ancora.
 * @param {string[]} routes obbligatorie: si sigilla una pagina alla volta, dopo aver letto il diff
 * @param {{ radice?: string, head?: string | null }} [opzioni] `head`: l'hash del commit (nei test, senza git)
 */
export function seal(routes, { radice = RADICE, head } = {}) {
  if (!routes.length) throw new Error("seal: name the pages to seal (npm run docs:seal -- llm/price). Sealing is page by page, after reading the diff.");
  const pages = loadPages(radice);
  const lock = readLock(radice);
  const sealedAt = head === undefined ? gitHead(radice) : head;
  for (const route of routes) {
    const p = pages.find((x) => x.route === route);
    if (!p) throw new Error(`seal: no page "${route}" in content/`);
    const missing = p.front.sources.filter((s) => hashSource(radice, s) === null);
    if (missing.length) throw new Error(`seal: ${route}: missing source file(s): ${missing.join(", ")}`);
    lock.pages[route] = { sealedAt, sources: Object.fromEntries(p.front.sources.map((s) => [s, hashSource(radice, s)])) };
    lock.anchors.push(route, ...pageIds(p.blocks).map((id) => `${route}#${id}`));
  }
  writeLock(radice, lock);
}

// ───────────────────────────── i file del repo ─────────────────────────────

const SALTA = new Set(["node_modules", "dist", ".git", ".vite", "locale"]);
const TESTO = /\.(md|mdx|js|mjs|cjs|jsx|ts|tsx|json|yml|html|css)$/;

function* cammina(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (SALTA.has(d.name)) continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) yield* cammina(p);
    else yield p;
  }
}

/** I file in cui cercare link al manuale e ai file migrati (elenco nel piano, step 1.7). Percorsi relativi, con /. */
export function scanScope(radice = RADICE) {
  const rel = (p) => relative(radice, p).split("\\").join("/");
  const sotto = (dir) => (existsSync(join(radice, dir)) ? [...cammina(join(radice, dir))].map(rel) : []);
  const tutti = [
    ...["README.md", "CONTRIBUTING.md"],
    ...(existsSync(join(radice, "doc")) ? readdirSync(join(radice, "doc")).filter((n) => n.endsWith(".md")).map((n) => `doc/${n}`) : []),
    "idePlugin/README.md",
    ...sotto("idePlugin/src"),
    ...sotto("launcher"),
    ...sotto("demo").filter((f) => /\/README\.md$|\/vite\.config\.js$|\/src\//.test(f)),
    ...sotto("lib").filter((f) => f.endsWith(".js") && !f.startsWith("lib/dist/")),
    ...sotto("site/landing/src").filter((f) => !f.includes("/theme/")),
    ...sotto("site/pages").filter((f) => /^site\/pages\/[^/]+\/src\//.test(f) && !f.includes("/src/theme/") && !f.includes("/src/generated/")),
    ...sotto(`${PAGINA}/content`),
  ];
  return [...new Set(tutti)].filter((f) => TESTO.test(f) && existsSync(join(radice, f)));
}

// ───────────────────────────── le verifiche ─────────────────────────────

const ok = (name, lines = []) => ({ name, level: "ok", lines });
const ko = (name, lines) => ({ name, level: "ko", lines });
const breve = (nomi, n = 12) => (nomi.length > n ? `${nomi.slice(0, n).join(", ")} (+${nomi.length - n} more)` : nomi.join(", "));

function checkStale(radice) {
  const { stale } = status(radice);
  if (!stale.length) return ok("stale pages");
  return ko("stale pages", [
    `${stale.length} page(s) out of date: read the diff, update the page, then npm run docs:seal -- <route>`,
    ...stale.map((s) => `  ${s.route}: ${s.reasons.join("; ")}${s.sealedAt && s.files.length ? ` (git diff ${s.sealedAt} -- ${s.files.join(" ")})` : ""}`),
  ]);
}

const PUNTATORE = /DOCS-PAGE:\s*([a-z0-9-]+\/[a-z0-9-]+(?:\s*,\s*[a-z0-9-]+\/[a-z0-9-]+)*)/;

function checkBackPointers(radice, pages) {
  const righe = [];
  const routes = new Set(pages.map((p) => p.route));
  for (const p of pages) {
    for (const src of p.front.sources) {
      const s = splitSource(src).file;
      if (s.endsWith(".json") || !existsSync(join(radice, s))) continue;
      const m = PUNTATORE.exec(readFileSync(join(radice, s), "utf8"));
      if (!m || !m[1].split(",").map((r) => r.trim()).includes(p.route)) righe.push(`  ${s} has no "DOCS-PAGE: ${p.route}" line`);
    }
  }
  // l'altro verso: ogni rotta nominata nel codice esiste. Fuori: test/ (fixture finte), doc/, il sito pubblicato e questo file.
  const escluso = (f) => /^(test|doc|node_modules)\//.test(f) || f === "site/docsSources.mjs" || f === "AGENTS.md" || f.includes("/dist/") || f.includes("/generated/");
  for (const f of cammina(radice)) {
    const r = relative(radice, f).split("\\").join("/");
    if (escluso(r) || !/\.(js|mjs|cjs|jsx|ts|tsx|css)$/.test(r) || r.startsWith("site/pages/docs/scripts/")) continue;
    const m = PUNTATORE.exec(readFileSync(f, "utf8"));
    if (m) for (const route of m[1].split(",").map((x) => x.trim())) if (!routes.has(route)) righe.push(`  ${r}: DOCS-PAGE names "${route}", which is not a page`);
  }
  return righe.length ? ko("back-pointers", righe) : ok("back-pointers");
}

// I nomi pubblici da coprire, per file sorgente (piano, step 1.7 punto 3).
function superfici(radice) {
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const nomi = (f, re) => [...leggi(f).matchAll(re)].map((m) => m[1]);
  const out = {};
  if (existsSync(join(radice, "lib/react.d.ts"))) out["lib/react.d.ts"] = nomi("lib/react.d.ts", /^export declare (?:const|function) (\w+)/gm);
  if (existsSync(join(radice, "lib/index.d.ts"))) {
    const t = leggi("lib/index.d.ts");
    const campi = ["VitetranslateOptions", "ErrorSolveOptions", "ErrorSolveMarks", "IcuOptions"].flatMap((nome) => {
      const m = new RegExp(`^export interface ${nome}\\b[^{]*\\{([\\s\\S]*?)^\\}`, "m").exec(t);
      return m ? [...m[1].matchAll(/^ {2}(\w+)\??:/gm)].map((x) => x[1]) : [];
    });
    out["lib/index.d.ts"] = [...nomi("lib/index.d.ts", /^export function (\w+)/gm), ...campi];
  }
  if (existsSync(join(radice, "lib/dev/vite/cli.js"))) out["lib/dev/vite/cli.js"] = nomi("lib/dev/vite/cli.js", /^ {2}(--[\w-]+)/gm);
  if (existsSync(join(radice, "idePlugin/package.json"))) {
    const c = JSON.parse(leggi("idePlugin/package.json")).contributes ?? {};
    const conf = [c.configuration ?? []].flat().flatMap((x) => Object.keys(x.properties ?? {}));
    out["idePlugin/package.json"] = [...(c.commands ?? []).map((x) => x.command), ...conf];
  }
  for (const f of Object.keys(out)) out[f] = [...new Set(out[f])];
  return out;
}

const nomeNelCodice = (nome, testo) => new RegExp(`(^|[^\\w-])${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\w-])`).test(testo);

function checkCoverage(radice, pages) {
  const righe = [];
  for (const [file, nomi] of Object.entries(superfici(radice))) {
    const codice = pages.filter((p) => p.front.sources.some((s) => splitSource(s).file === file)).flatMap((p) => collectCode(p.blocks));
    const manca = nomi.filter((n) => !codice.some((c) => nomeNelCodice(n, c)));
    if (manca.length) righe.push(`  ${file}: ${manca.length}/${nomi.length} not named in \`code\` on a page that lists it in sources: ${breve(manca)}`);
  }
  return righe.length ? ko("API coverage", righe) : ok("API coverage");
}

function checkAnchors(radice, pages) {
  const lock = readLock(radice);
  const byRoute = new Map(pages.map((p) => [p.route, p]));
  const alias = pages.flatMap((p) => p.front.aliases);
  const righe = [];
  for (const a of lock.anchors) {
    const [route, id] = a.split("#");
    const page = byRoute.get(route);
    // un'ancora vive se è un titolo della pagina, o se un alias (di questa pagina o di un'altra, che l'ha accolta) nomina `route#id`
    const vivo = id === undefined ? !!page || alias.some((x) => x.old === undefined && x.route === route) : (page && pageIds(page.blocks).includes(id)) || alias.some((x) => x.route === route && x.old === id);
    if (!vivo) righe.push(`  ${a}: published anchor is gone and no alias covers it`);
  }
  return righe.length ? ko("published anchors", ["A published address must never disappear: add an `aliases:` line (llm/old#id -> new-id) to the page that took it over.", ...righe]) : ok("published anchors");
}

const URL_MANUALE = /https:\/\/sepoina\.github\.io\/viteTranslate\/docs\/([a-z0-9-]+(?:\/[a-z0-9-]*)?)?\/?(?:#([\w-]+))?/g;

function checkInbound(radice, pages) {
  const byRoute = new Map(pages.map((p) => [p.route, p]));
  const aliasRoute = new Set(pages.flatMap((p) => p.front.aliases.filter((a) => a.old === undefined).map((a) => a.route)));
  const aliasAnchor = new Set(pages.flatMap((p) => p.front.aliases.filter((a) => a.old).map((a) => `${a.route}#${a.old}`)));
  const righe = [];
  for (const f of scanScope(radice)) {
    for (const m of readFileSync(join(radice, f), "utf8").matchAll(URL_MANUALE)) {
      const [, ruota, id] = m;
      if (!ruota) continue; // la radice del manuale
      const page = byRoute.get(ruota);
      if (!page && !aliasRoute.has(ruota)) righe.push(`  ${f}: ${m[0]} → no such page`);
      else if (id && !(page && pageIds(page.blocks).includes(id)) && !aliasAnchor.has(`${ruota}#${id}`)) righe.push(`  ${f}: ${m[0]} → no such section`);
    }
  }
  return righe.length ? ko("links into the manual", righe) : ok("links into the manual");
}

function checkMigrated(radice) {
  const nomi = MIGRATED.map((f) => f.slice(4, -3));
  const rif = new RegExp(`doc/(?:${nomi.join("|")})\\.md|\\]\\((?:\\./)?(?:${nomi.join("|")})\\.md`, "g");
  const righe = new Set();
  for (const f of scanScope(radice)) {
    if (MIGRATED.includes(f)) continue; // i segnaposto stessi
    let t = readFileSync(join(radice, f), "utf8");
    if (f.endsWith(".mdx")) t = t.replace(/<!--[\s\S]*?-->/g, ""); // le note "Migrated from doc/x.md" sono la provenienza, non un link
    for (const m of t.matchAll(rif)) {
      if (m[0].startsWith("](") && !f.startsWith("doc/")) continue; // il link relativo "llm.md" vale solo dentro doc/
      righe.add(`  ${f}: ${m[0].replace("](", "")}`);
    }
  }
  return righe.size ? ko("links to migrated files", ["These still point to a doc/*.md file the manual replaced (step 1.10):", ...righe]) : ok("links to migrated files");
}

// Un commento TODO(links) dice che un link punta a una pagina e non alla sezione esatta: a fine migrazione non ne devono restare.
function checkTodoLinks(radice) {
  const dir = join(radice, PAGINA, "content");
  const righe = [];
  for (const rel of listMdx(dir)) {
    readFileSync(join(dir, rel), "utf8")
      .split(/\r?\n/)
      .forEach((riga, i) => riga.includes("TODO(links)") && righe.push(`  content/${rel}:${i + 1}: ${riga.replace(/^<!--\s*|\s*-->$/g, "").slice(0, 150)}`));
  }
  return righe.length ? { name: "TODO(links)", level: "warn", lines: ["Links that still point at a page, not at the exact section:", ...righe] } : ok("TODO(links)");
}

function checkTranslation(radice) {
  const dir = join(radice, PAGINA, "locale");
  if (!existsSync(dir)) return { name: "translation status", level: "warn", lines: ["no locale/ folder yet"] };
  const righe = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".yml")).sort()) {
    const chiavi = [...readFileSync(join(dir, f), "utf8").matchAll(/^[\w-]+:[ \t]*(.*)$/gm)].map((m) => m[1].trim());
    const mancanti = chiavi.filter((v) => v === "null" || v === "").length;
    if (mancanti) righe.push(`  ${f.replace(/\.yml$/, "")}: ${chiavi.length - mancanti}/${chiavi.length} keys translated (${Math.floor(((chiavi.length - mancanti) / chiavi.length) * 100)}%)`);
  }
  return righe.length ? { name: "translation status", level: "warn", lines: ["Not 100%: run the translation (cd site/pages/docs && npx vitetranslate --llm-translate <lang>).", ...righe] } : ok("translation status");
}

/**
 * Le verifiche sul manuale. Una pagina che non si legge (errore nel dialetto) è un KO unico.
 * @returns {{ name: string, level: "ok" | "warn" | "ko", lines: string[] }[]}
 */
export function checks(radice = RADICE) {
  let pages;
  try {
    pages = loadPages(radice);
  } catch (e) {
    return [ko("manual compiles", [e.message])];
  }
  return [
    checkStale(radice),
    checkBackPointers(radice, pages),
    checkCoverage(radice, pages),
    checkAnchors(radice, pages),
    checkInbound(radice, pages),
    checkMigrated(radice),
    checkTodoLinks(radice),
    checkTranslation(radice),
  ];
}

// ───────────────────────────── riga di comando ─────────────────────────────

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (cmd === "status") {
      const { stale, fresh } = status();
      console.log(`manual: ${fresh.length} page(s) up to date, ${stale.length} stale`);
      for (const s of stale) {
        console.log(`  ${s.route}: ${s.reasons.join("; ")}`);
        if (s.sealedAt) for (const f of s.files) console.log(`    git diff ${s.sealedAt} -- ${f}`);
      }
    } else if (cmd === "seal") {
      seal(args);
      console.log(`sealed: ${args.join(", ")}`);
    } else if (cmd === "checks") {
      for (const c of checks()) {
        console.log(`${c.level.toUpperCase().padEnd(4)} ${c.name}`);
        if (c.level !== "ok") for (const l of c.lines) console.log(l);
      }
    } else {
      console.log("usage: node site/docsSources.mjs status | seal <route>… | checks");
      process.exit(1);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
