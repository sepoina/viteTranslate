// Il compilatore del manuale: legge content/**/*.mdx (il dialetto descritto in
// doc/ImplementationPlans/docs/manual_v1.md), lo valida e scrive src/generated/ (pagine JSX,
// routes.js, routes.json). Solo node, nessuna dipendenza, nessun import fuori da questa cartella.
//
//   node scripts/compileDocs.mjs      # compila una volta (npm run compile)
//
// Si carica anche da vite.config.js (compileDocs() a ogni avvio) e dalle verifiche in site/docsSources.mjs
// (parseMdx). Regola d'oro del dialetto: ciò che non è elencato è un errore con `file:riga`.
// LINKED-DATA: il dialetto è descritto in manual_v1.md e, in breve, in site/README.md ("The manual").
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync, watch, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PREFIX = "site/pages/docs/content/";
const DELIM = "_%_";
// Dove stanno i componenti, visti da src/generated/pages/<sezione>/<pagina>.jsx.
const UI = "../../../ui/index.js";

// I caratteri speciali del testo corrente: ognuno diventa un valore di K ({K[n]}), mai un'espressione
// {"…"} (lo spike dello step 1.0: {"%s"} fa lasciare il <Trans> com'è, e le altre finirebbero in
// tabella come entità HTML, che una traduzione potrebbe decodificare).
const SPECIAL = /_%_|%s|[{}<>&]/g;
const LANGS = new Set(["jsx", "js", "ts", "tsx", "yaml", "sh", "bash", "json", "text"]);
const ALERTS = new Set(["note", "tip", "important", "warning", "caution"]);
const FRONT_KEYS = { title: "scalar", description: "scalar", sources: "list", aliases: "list", related: "list" };
// "On the same topic", in the right column: links to other pages of the manual, at most this many.
const RELATED_MAX = 7;
const ROUTE_RE = /^[a-z0-9-]+\/[a-z0-9-]+$/;

/** Un id di sezione valido: `[a-z0-9-]+`. */
export const slugOk = (id) => /^[a-z0-9-]+$/.test(id);

/** Prepara una stringa per un template literal: `\`, `` ` `` e `${` protetti, il delimitatore composto da M. */
export function escapeCode(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${").split(DELIM).join("${M}");
}

/**
 * Taglia un testo semplice a ogni sequenza speciale e restituisce il JSX: il testo com'è e, al posto
 * di ogni sequenza, `{K[n]}`.
 * @param {string} s
 * @param {(special: string) => string} slot mette la sequenza in K e restituisce "K[n]"
 */
export function splitProse(s, slot) {
  let out = "";
  let last = 0;
  for (const m of s.matchAll(SPECIAL)) {
    out += s.slice(last, m.index) + `{${slot(m[0])}}`;
    last = m.index + m[0].length;
  }
  return out + s.slice(last);
}

// ───────────────────────────── parsing ─────────────────────────────

/**
 * @param {string} text il contenuto di un .mdx (CRLF o LF)
 * @param {string} [file] il nome da mettere negli errori
 * @returns {{ front: object, blocks: object[] }}
 * @throws {Error} `file:riga: motivo`
 */
export function parseMdx(text, file = "page.mdx") {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const fail = (line, why) => {
    throw new Error(`${file}:${line}: ${why}`);
  };
  const { front, next } = parseFront(lines, fail);
  const blocks = parseBody(lines, next, fail);
  checkPage(front, blocks, fail);
  return { front, blocks };
}

/** Una source è `percorso` oppure `file.json#chiave` (annidata con `.`): in quel caso conta solo quel sottoalbero. */
export function splitSource(s) {
  const i = s.indexOf("#");
  return i < 0 ? { file: s, key: null } : { file: s.slice(0, i), key: s.slice(i + 1) };
}

/** Il sottoalbero `key` di un testo JSON; `undefined` se la chiave non c'è (o il JSON non si legge). */
export function jsonSubtree(text, key) {
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    return undefined;
  }
  for (const k of key.split(".")) {
    if (v === null || typeof v !== "object" || !Object.hasOwn(v, k)) return undefined;
    v = v[k];
  }
  return v;
}

// Il frontmatter: `key: value` per gli scalari, `key:` più righe `  - voce` per le liste. Nient'altro.
function parseFront(lines, fail) {
  if (lines[0] !== "---") fail(1, 'the file must start with the frontmatter ("---")');
  const front = { title: "", description: "", sources: [], sourceLines: [], aliases: [], related: [] };
  const seen = new Set();
  let key = null;
  let i = 1;
  for (; i < lines.length && lines[i] !== "---"; i++) {
    const raw = lines[i].replace(/\s+$/, "");
    const n = i + 1;
    if (raw === "") continue;
    let m = /^ +- +(.+)$/.exec(raw);
    if (m) {
      if (!key || FRONT_KEYS[key] !== "list") fail(n, "list item outside a list key");
      if (key === "sources") {
        const p = m[1].trim();
        if (/[*?]/.test(p) || p.startsWith("/") || p.split("/").includes("..")) fail(n, `source "${p}": use a repo-relative path, no globs`);
        const { file, key: chiave } = splitSource(p);
        if (chiave !== null && !(file.endsWith(".json") && /^[\w$@-]+(\.[\w$@-]+)*$/.test(chiave))) fail(n, `source "${p}": only a JSON file takes a selector (file.json#key, nested with .)`);
        front.sources.push(p);
        front.sourceLines.push(n);
      } else if (key === "related") {
        const r = parseRelated(m[1].trim(), n, fail);
        if (front.related.some((x) => x.raw === r.raw)) fail(n, `related "${r.raw}" is listed twice`);
        if (front.related.length === RELATED_MAX) fail(n, `related: at most ${RELATED_MAX} entries`);
        front.related.push(r);
      } else front.aliases.push(parseAlias(m[1].trim(), n, fail));
      continue;
    }
    m = /^([a-z]+):(?: +(.*))?$/.exec(raw);
    if (!m) fail(n, "expected `key: value` or `  - item`");
    if (!Object.hasOwn(FRONT_KEYS, m[1])) fail(n, `unknown frontmatter key "${m[1]}"`);
    if (seen.has(m[1])) fail(n, `duplicate frontmatter key "${m[1]}"`);
    seen.add(m[1]);
    key = m[1];
    const value = (m[2] ?? "").trim();
    if (FRONT_KEYS[key] === "list") {
      if (value) fail(n, `"${key}" is a list: put one \`  - item\` per line`);
    } else {
      if (!value) fail(n, `"${key}" is empty`);
      front[key] = plainText(value, n, fail, key);
    }
  }
  if (i >= lines.length) fail(1, 'the frontmatter is not closed ("---")');
  for (const k of ["title", "description", "sources"]) if (!seen.has(k)) fail(1, `missing frontmatter key "${k}"`);
  if (!front.sources.length) fail(1, '"sources" needs at least one file');
  return { front, next: i + 1 };
}

// Un alias: `route` (vecchia pagina che rimanda qui) o `route#vecchio -> nuovo` (vecchia ancora).
function parseAlias(s, line, fail) {
  let m = /^([a-z0-9-]+\/[a-z0-9-]+)$/.exec(s);
  if (m) return { raw: s, route: m[1], line };
  m = /^([a-z0-9-]+\/[a-z0-9-]+)#([a-z0-9-]+) *-> *([a-z0-9-]+)$/.exec(s);
  if (m) return { raw: s, route: m[1], old: m[2], to: m[3], line };
  return fail(line, `alias "${s}": expected \`section/page\` or \`section/page#old -> new\``);
}

// A related entry: `/section/page#id | label | detail`. The target is another page or one of its
// sections; the label is the link's text, the detail a sentence the right column shows on hover. Both
// plain text, like a title: they are translated (src/generated/related.js holds them all, so the same
// sentence on two pages is one key).
function parseRelated(s, line, fail) {
  const m = /^\/([a-z0-9-]+\/[a-z0-9-]+)(?:#([a-z0-9-]+))? *\| *([^|]+?) *\| *([^|]+?)$/.exec(s);
  if (!m) fail(line, `related "${s}": expected /section/page#id | label | detail`);
  const raw = `/${m[1]}${m[2] ? `#${m[2]}` : ""}`;
  return { raw, route: m[1], id: m[2] ?? null, label: plainText(m[3], line, fail, "related label"), detail: plainText(m[4], line, fail, "related detail"), line };
}

// Titolo, descrizione, alt: testo semplice, senza markdown e senza sequenze speciali.
function plainText(s, line, fail, what) {
  const bad = /[`*[\]{}<>&]|%s|_%_/.exec(s);
  if (bad) fail(line, `${what}: plain text only, "${bad[0]}" is not allowed (write it in the page body)`);
  return s;
}

// Le liste, le tabelle e i callout contengono solo il testo in linea; i blocchi "veri" iniziano qui.
const LIST_TOP = /^(-|\d+\.) +(\S.*)$/;
const LIST_SUB = /^ {2}- +(\S.*)$/;
const startsBlock = (r) =>
  /^#{1,6}( |$)/.test(r) || r.startsWith("```") || r.startsWith(">") || r.startsWith("|") || r.startsWith("![") ||
  r.startsWith("<!--") || /^<Demo[ />]/.test(r) || LIST_TOP.test(r) || /^[*+] /.test(r) || /^(-{3,}|\*{3,}|_{3,})$/.test(r);

function parseBody(lines, start, fail) {
  const blocks = [];
  const N = lines.length;
  const inl = (s, line, mode = "full") => parseInline(s, line, fail, mode);
  let i = start;
  while (i < N) {
    const raw = lines[i].replace(/\s+$/, "");
    const n = i + 1;
    let m;
    if (raw === "") {
      i++;
      continue;
    }
    if (/^\s/.test(raw)) fail(n, "unexpected indentation (nesting is only for list items and callouts)");
    // commento: scartato (note e LINKED-DATA)
    if (raw.startsWith("<!--")) {
      let j = i;
      while (j < N && !lines[j].includes("-->")) j++;
      if (j >= N) fail(n, "unclosed comment");
      i = j + 1;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw)) fail(n, "horizontal rules are not allowed");
    // blocco di codice
    if (raw.startsWith("```")) {
      const info = /^([A-Za-z0-9]*)(?: +title="([^"]*)")?$/.exec(raw.slice(3).trim());
      if (!info) fail(n, 'code fence: expected ```lang title="file"');
      const lang = info[1] || "text";
      if (!LANGS.has(lang)) fail(n, `unknown code language "${lang}" (${[...LANGS].join(" ")})`);
      if (info[2]?.includes(DELIM)) fail(n, "code fence title: the marker delimiter is not allowed");
      const body = [];
      let j = i + 1;
      while (j < N && !/^```\s*$/.test(lines[j])) body.push(lines[j++]);
      if (j >= N) fail(n, "unclosed code fence");
      blocks.push({ type: "code", lang, title: info[2] ?? null, code: body.join("\n"), line: n });
      i = j + 1;
      continue;
    }
    // titolo
    if ((m = /^(#{1,6})(?: +(.*))?$/.exec(raw))) {
      const depth = m[1].length;
      if (depth === 1) fail(n, "no h1 in the body: the title comes from the frontmatter, use ## or ###");
      if (depth > 3) fail(n, "headings deeper than ### are not allowed");
      const idm = /^(.*?) *\{#([^}]*)\}$/.exec(m[2] ?? "");
      if (!idm) fail(n, "heading without {#id}");
      if (!slugOk(idm[2])) fail(n, `heading id "${idm[2]}": use only a-z, 0-9 and "-"`);
      if (!idm[1]) fail(n, "empty heading");
      blocks.push({ type: "heading", depth, id: idm[2], inline: inl(idm[1], n, "heading"), line: n });
      i++;
      continue;
    }
    // citazione / callout
    if (raw.startsWith(">")) {
      let j = i;
      const body = [];
      while (j < N && lines[j].startsWith(">")) body.push(lines[j++].replace(/\s+$/, "").replace(/^> ?/, ""));
      let kind = "aside";
      const head = /^\[!(\w+)\]$/.exec(body[0]);
      if (head) {
        kind = head[1].toLowerCase();
        if (!ALERTS.has(kind)) fail(n, `unknown alert "[!${head[1]}]" (NOTE TIP IMPORTANT WARNING CAUTION)`);
        body.shift();
      } else if (body[0].startsWith("[!")) fail(n, "malformed alert marker: write `> [!NOTE]` alone on the first line");
      const paras = [];
      let cur = [];
      let curLine = n;
      body.forEach((t, k) => {
        const ln = n + k + (head ? 1 : 0);
        if (t.trim() === "") {
          if (cur.length) paras.push({ text: cur.join(" "), line: curLine });
          cur = [];
          return;
        }
        if (t.startsWith(">")) fail(ln, "nested blockquotes are not allowed");
        if (startsBlock(t) || /^<[A-Za-z/!]/.test(t)) fail(ln, "a callout holds plain paragraphs only");
        if (!cur.length) curLine = ln;
        cur.push(t.trim());
      });
      if (cur.length) paras.push({ text: cur.join(" "), line: curLine });
      if (!paras.length) fail(n, "empty callout");
      blocks.push({ type: "callout", kind, paras: paras.map((p) => inl(p.text, p.line)), line: n });
      i = j;
      continue;
    }
    // elenco
    if (LIST_TOP.test(raw)) {
      const ordered = raw[0] !== "-";
      const items = [];
      let j = i;
      for (; j < N; ) {
        const r = lines[j].replace(/\s+$/, "");
        let t;
        if (r === "") {
          // una riga vuota tiene unito l'elenco se la voce dopo è dello stesso tipo
          let k = j;
          while (k < N && lines[k].trim() === "") k++;
          const nextTop = k < N ? LIST_TOP.exec(lines[k].replace(/\s+$/, "")) : null;
          if (nextTop && (nextTop[1] !== "-") === ordered) {
            j = k;
            continue;
          }
          break;
        }
        if ((t = LIST_TOP.exec(r))) {
          if ((t[1] !== "-") !== ordered) break;
          items.push({ inline: inl(t[2], j + 1), children: [], line: j + 1 });
        } else if ((t = LIST_SUB.exec(r))) {
          if (!items.length) fail(j + 1, "nested item without a parent item");
          items.at(-1).children.push({ inline: inl(t[1], j + 1), line: j + 1 });
        } else if (/^\s/.test(r)) {
          fail(j + 1, /^ +(?:[-*+]|\d+\.) /.test(r) ? "only one nesting level, with two spaces and `- `" : "a list item is one line (no continuation lines)");
        } else break;
        j++;
      }
      blocks.push({ type: "list", ordered, items, line: n });
      i = j;
      continue;
    }
    if (/^[*+] /.test(raw)) fail(n, "list items start with `- `");
    // tabella
    if (raw.startsWith("|")) {
      let j = i;
      const rows = [];
      while (j < N && lines[j].startsWith("|")) rows.push(splitRow(lines[j++].replace(/\s+$/, "")));
      if (rows.length < 2 || !rows[1].every((c) => /^:?-+:?$/.test(c))) fail(n, "table: the second row must be the separator (`| :- | :- |`)");
      const width = rows[0].length;
      rows.forEach((r, k) => {
        if (r.length !== width) fail(n + k, `table: row has ${r.length} cell(s), the header has ${width}`);
      });
      const cell = (c, k) => (c === "" ? null : inl(c, n + k));
      blocks.push({
        type: "table",
        head: rows[0].map((c) => cell(c, 0)),
        rows: rows.slice(2).map((r, k) => r.map((c) => cell(c, k + 2))),
        line: n,
      });
      i = j;
      continue;
    }
    // figura
    if (raw.startsWith("![")) {
      m = /^!\[([^\]]*)\]\(([^)\s]*)\)$/.exec(raw);
      if (!m) fail(n, "an image goes alone on its line: `![alt](img/name.png)`");
      if (!/^img\/[A-Za-z0-9._-]+$/.test(m[2])) fail(n, `image "${m[2]}": the path must be img/<file> (public/img/)`);
      blocks.push({ type: "figure", src: m[2], alt: m[1] === "" ? "" : plainText(m[1], n, fail, "image alt"), line: n });
      i++;
      continue;
    }
    // componente: solo <Demo … />
    if (/^<[A-Za-z/!]/.test(raw)) {
      m = /^<Demo((?: +[A-Za-z]+="[^"]*")*) *\/>$/.exec(raw);
      if (!m) fail(n, /^<Demo/.test(raw) ? 'malformed <Demo>: expected `<Demo page="slug" anchor="id" />`' : "raw HTML and unknown components are not allowed (write code in backticks)");
      const attrs = {};
      for (const a of m[1].matchAll(/([A-Za-z]+)="([^"]*)"/g)) {
        if (a[1] !== "page" && a[1] !== "anchor") fail(n, `<Demo>: unknown attribute "${a[1]}"`);
        attrs[a[1]] = a[2];
      }
      if (!attrs.page || !/^[a-z0-9-]+$/.test(attrs.page)) fail(n, '<Demo>: needs page="slug" (a-z, 0-9, "-")');
      if (attrs.anchor !== undefined && !/^[\w-]+$/.test(attrs.anchor)) fail(n, "<Demo>: anchor has invalid characters");
      blocks.push({ type: "demo", page: attrs.page, anchor: attrs.anchor ?? null, line: n });
      i++;
      continue;
    }
    // paragrafo: righe consecutive unite da uno spazio
    const text = [];
    let j = i;
    while (j < N && lines[j].trim() !== "" && (j === i || !startsBlock(lines[j].replace(/\s+$/, "")))) {
      if (/^\s/.test(lines[j])) fail(j + 1, "unexpected indentation inside a paragraph");
      text.push(lines[j].trim());
      j++;
    }
    blocks.push({ type: "p", inline: inl(text.join(" "), n), line: n });
    i = j;
  }
  return blocks;
}

// Le celle di una riga di tabella. `\|` è una barra letterale; dentro il codice in linea la barra non divide.
function splitRow(line) {
  let s = line.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  let code = false;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === "\\" && s[k + 1] === "|") {
      cur += "|";
      k++;
    } else if (c === "|" && !code) {
      cells.push(cur.trim());
      cur = "";
    } else {
      if (c === "`") code = !code;
      cur += c;
    }
  }
  cells.push(cur.trim());
  return cells;
}

// I controlli che riguardano una pagina sola: id unici, alias che puntano a un id che esiste.
function checkPage(front, blocks, fail) {
  const ids = new Map();
  for (const b of blocks) {
    if (b.type !== "heading") continue;
    if (ids.has(b.id)) fail(b.line, `duplicate heading id "${b.id}" (first at line ${ids.get(b.id)})`);
    ids.set(b.id, b.line);
  }
  const olds = new Set();
  for (const a of front.aliases) {
    if (a.to === undefined) continue;
    if (!ids.has(a.to)) fail(a.line, `alias "${a.raw}": no heading with id "${a.to}" on this page`);
    // "old è un titolo attuale" si controlla in validate(): dipende dalla route dell'alias (altra pagina o no)
    const key = `${a.route}#${a.old}`;
    if (olds.has(key)) fail(a.line, `alias "${a.raw}": "${key}" is already redirected`);
    olds.add(key);
  }
}

// ───────────────────── il testo in linea ─────────────────────
//
// Nodi: { t: "text", v } | { t: "code", v } | { t: "b"|"i", children } | { t: "link", to, kind, children, line }.
// mode: "full" (tutto), "link" (dentro un link: niente altri link), "heading" (testo e codice).

// Cerca `token` da `from` saltando i codici in linea (-1 se manca).
function findClose(s, from, token) {
  for (let k = from; k < s.length; k++) {
    if (s[k] === "`") {
      const e = s.indexOf("`", k + 1);
      if (e < 0) return -1;
      k = e;
    } else if (s.startsWith(token, k)) return k;
  }
  return -1;
}

function parseTarget(to, line, fail) {
  if (to.includes(DELIM)) fail(line, "link target: the marker delimiter is not allowed");
  let m;
  if ((m = /^\/([a-z0-9-]+\/[a-z0-9-]+)(?:#([a-z0-9-]+))?$/.exec(to))) return { kind: "route", route: m[1], id: m[2] ?? null };
  if ((m = /^#([a-z0-9-]+)$/.exec(to))) return { kind: "hash", id: m[1] };
  if ((m = /^site:([a-z0-9-]+)(?:#([\w-]+))?$/.exec(to))) return { kind: "site", slug: m[1], id: m[2] ?? null };
  if ((m = /^repo:([^#\s"&{}<>\\]+)(?:#[\w.-]+)?$/.exec(to))) return { kind: "repo", path: m[1] };
  if (/^https:\/\/[^\s"&{}<>\\]+$/.test(to)) return { kind: "https" };
  return fail(line, `link target "${to}": expected /section/page#id, #id, site:slug#id, repo:path or https://… (no "&", quotes or braces)`);
}

export function parseInline(s, line, fail, mode = "full") {
  const out = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", v: text });
    text = "";
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "`") {
      const j = s.indexOf("`", i + 1);
      if (j < 0) fail(line, "unclosed code span");
      if (j === i + 1) fail(line, "empty code span");
      flush();
      out.push({ t: "code", v: s.slice(i + 1, j) });
      i = j;
      continue;
    }
    if (c === "!" && s[i + 1] === "[") fail(line, "images are block-level: put `![alt](img/name.png)` alone on a line");
    if ((c === "*" || c === "[") && mode === "heading") fail(line, `"${c}": headings take plain text and code only`);
    if (c === "*") {
      const bold = s[i + 1] === "*";
      const tok = bold ? "**" : "*";
      const j = findClose(s, i + tok.length, tok);
      if (j < 0) fail(line, `unclosed ${bold ? "bold" : "italic"}: close it, or put the asterisk in a code span`);
      const inner = s.slice(i + tok.length, j);
      if (!inner.trim()) fail(line, "empty emphasis");
      if (!bold && (s[j + 1] === "*" || inner.replace(/`[^`]*`/g, "").includes("*"))) fail(line, "nested emphasis is not supported");
      flush();
      out.push({ t: bold ? "b" : "i", children: parseInline(inner, line, fail, mode) });
      i = j + tok.length - 1;
      continue;
    }
    if (c === "[") {
      if (mode === "link") fail(line, "a link cannot contain another link");
      const j = findClose(s, i + 1, "]");
      if (j < 0 || s[j + 1] !== "(") fail(line, "`[` without `](target)`: write brackets in a code span");
      const e = s.indexOf(")", j + 2);
      if (e < 0) fail(line, "link without closing `)`");
      const to = s.slice(j + 2, e);
      const inner = s.slice(i + 1, j);
      if (!inner.trim()) fail(line, "link without text");
      flush();
      out.push({ t: "link", to, ...parseTarget(to, line, fail), line, children: parseInline(inner, line, fail, "link") });
      i = e;
      continue;
    }
    text += c;
  }
  flush();
  return out;
}

// Visita ogni lista di nodi in linea della pagina (e i nodi annidati).
function eachInline(blocks, cb) {
  const walk = (nodes) => {
    for (const nd of nodes) {
      cb(nd);
      if (nd.children) walk(nd.children);
    }
  };
  for (const b of blocks) {
    if (b.inline) walk(b.inline);
    if (b.paras) b.paras.forEach(walk);
    if (b.items) for (const it of b.items) [it, ...it.children].forEach((x) => walk(x.inline));
    if (b.type === "table") [b.head, ...b.rows].flat().forEach((c) => c && walk(c));
  }
}

/** I link di una pagina (nodi `link`, con `kind`, `line`, …). */
export function collectLinks(blocks) {
  const links = [];
  eachInline(blocks, (nd) => nd.t === "link" && links.push(nd));
  return links;
}

/** I testi del codice in linea di una pagina (anche nei titoli): per la verifica di copertura dell'API. */
export function collectCode(blocks) {
  const code = [];
  eachInline(blocks, (nd) => nd.t === "code" && code.push(nd.v));
  return code;
}

/** Gli id delle sezioni di una pagina, nell'ordine. */
export const pageIds = (blocks) => blocks.filter((b) => b.type === "heading").map((b) => b.id);

// ───────────────────────────── emissione ─────────────────────────────

/**
 * Il JSX di una pagina.
 * @param {{ front: object, blocks: object[] }} parsed
 * @param {string} route per esempio "llm/price"
 * @param {{ realRoutes?: Set<string>, imageSize?: (src: string) => { width: number, height: number } | null }} [ctx]
 *   `realRoutes`: le pagine che esistono (un alias di ancora verso un'altra pagina vera non emette lo <span>: lo
 *   risolve il router con aliases.json); `imageSize`: le dimensioni di un'immagine di public/ (senza, niente width/height)
 */
export function emitPage(parsed, route, { realRoutes = new Set(), imageSize = () => null } = {}) {
  const { front, blocks } = parsed;
  const K = [];
  const slots = new Map();
  const slot = (s) => {
    if (!slots.has(s)) {
      slots.set(s, K.length);
      K.push(s);
    }
    return `K[${slots.get(s)}]`;
  };

  const inline = (nodes) =>
    nodes
      .map((nd) => {
        switch (nd.t) {
          case "text": return splitProse(nd.v, slot);
          case "code": return `<InlineCode v={${slot(nd.v)}} />`;
          case "b": return `<b>${inline(nd.children)}</b>`;
          case "i": return `<i>${inline(nd.children)}</i>`;
          default: return `<DocLink to="${nd.to}">${inline(nd.children)}</DocLink>`;
        }
      })
      .join("");
  const trans = (nodes) => `<Trans>${inline(nodes)}</Trans>`;

  // Il titolo di una sezione è una stringa marcata: testo e `<code>%s</code>` con i valori in `a`.
  // Il codice e le sequenze speciali sono valori (stesso criterio del testo), non testo traducibile.
  const heading = (nodes) => {
    const args = [];
    const put = (v) => {
      args.push(slot(v));
      return "%s";
    };
    const title = nodes
      .map((nd) => (nd.t === "code" ? `<code>${put(nd.v)}</code>` : nd.v.replace(SPECIAL, (sp) => put(sp))))
      .join("");
    return { title: JSON.stringify(`${DELIM}${title}${DELIM}`), a: args.length ? `[${args.join(", ")}]` : null };
  };

  const anchors = new Map();
  for (const a of front.aliases) if (a.to !== undefined && !(a.route !== route && realRoutes.has(a.route))) anchors.set(a.to, [...(anchors.get(a.to) ?? []), a.old]);

  const metaHeadings = [];
  const out = [];
  const cellsOf = (tag, cells) => cells.map((c) => (c ? `<${tag}>${trans(c)}</${tag}>` : `<${tag} />`)).join("");
  const emit = (b, ind) => {
    switch (b.type) {
      case "heading": {
        const k = metaHeadings.length;
        const h = heading(b.inline);
        metaHeadings.push(`{ id: ${JSON.stringify(b.id)}, depth: ${b.depth}, title: ${h.title}${h.a ? `, a: ${h.a}` : ""} }`);
        const spans = (anchors.get(b.id) ?? []).map((o) => `<span id="${o}" aria-hidden="true" />`).join("");
        const aProp = h.a ? ` a={meta.headings[${k}].a}` : "";
        out.push(`${ind}${spans}<Heading depth={${b.depth}} id="${b.id}"><Trans t={meta.headings[${k}].title}${aProp} /></Heading>`);
        break;
      }
      case "p": out.push(`${ind}<p>${trans(b.inline)}</p>`); break;
      case "list": {
        const tag = b.ordered ? "ol" : "ul";
        out.push(`${ind}<${tag}>`);
        for (const it of b.items) {
          if (!it.children.length) out.push(`${ind}  <li>${trans(it.inline)}</li>`);
          else {
            out.push(`${ind}  <li>`, `${ind}    ${trans(it.inline)}`, `${ind}    <ul>`);
            for (const c of it.children) out.push(`${ind}      <li>${trans(c.inline)}</li>`);
            out.push(`${ind}    </ul>`, `${ind}  </li>`);
          }
        }
        out.push(`${ind}</${tag}>`);
        break;
      }
      case "callout":
        out.push(`${ind}<Callout kind="${b.kind}">`);
        for (const p of b.paras) out.push(`${ind}  <p>${trans(p)}</p>`);
        out.push(`${ind}</Callout>`);
        break;
      case "code":
        out.push(`${ind}<CodeBlock lang="${b.lang}"${b.title === null ? "" : ` title={${JSON.stringify(b.title)}}`} code={${slot(b.code)}} />`);
        break;
      case "table":
        out.push(`${ind}<div className="table-scroll">`, `${ind}  <table>`, `${ind}    <thead><tr>${cellsOf("th", b.head)}</tr></thead>`, `${ind}    <tbody>`);
        for (const r of b.rows) out.push(`${ind}      <tr>${cellsOf("td", r)}</tr>`);
        out.push(`${ind}    </tbody>`, `${ind}  </table>`, `${ind}</div>`);
        break;
      case "figure": {
        const size = imageSize(b.src);
        const dims = size ? ` width={${size.width}} height={${size.height}}` : "";
        out.push(`${ind}<Figure src="${b.src}" alt={${JSON.stringify(b.alt === "" ? "" : `${DELIM}${b.alt}${DELIM}`)}}${dims} />`);
        break;
      }
      default: // demo
        out.push(`${ind}<Demo page="${b.page}"${b.anchor === null ? "" : ` anchor="${b.anchor}"`} />`);
    }
  };
  for (const b of blocks) emit(b, "      ");

  const marked = (s) => JSON.stringify(`${DELIM}${s}${DELIM}`);
  return [
    `// GENERATO da scripts/compileDocs.mjs a partire da content/${route}.mdx: non modificare.`,
    `import { Trans } from "@sepoina/vitetranslate/react";`,
    `import { CodeBlock, InlineCode, DocLink, Callout, Demo, Figure, Heading } from "${UI}";`,
    ``,
    `// Il delimitatore composto a runtime: scritto per intero verrebbe estratto come frase.`,
    `const M = ["_", "%", "_"].join("");`,
    `// Il codice della pagina e i caratteri speciali del testo (graffe, <, >, &, %s): mai tradotti.`,
    K.length ? `const K = [\n${K.map((k) => `  \`${escapeCode(k)}\`,`).join("\n")}\n];` : `const K = [];`,
    ``,
    `export const meta = {`,
    `  route: ${JSON.stringify(route)},`,
    `  title: ${marked(front.title)},`,
    `  description: ${marked(front.description)},`,
    `  source: ${JSON.stringify(`${SOURCE_PREFIX}${route}.mdx`)},`,
    metaHeadings.length ? `  headings: [\n${metaHeadings.map((h) => `    ${h},`).join("\n")}\n  ],` : `  headings: [],`,
    `};`,
    ``,
    `export default function Page() {`,
    `  return (`,
    `    <>`,
    ...out,
    `    </>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}

/**
 * Larghezza e altezza di un'immagine PNG o WebP, lette dall'intestazione (nessuna dipendenza).
 * @param {Buffer} buf il file intero (basta l'inizio)
 * @returns {{ width: number, height: number } | null} null se il formato non è PNG o WebP, o l'intestazione non torna
 */
export function imageSize(buf) {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a && buf.toString("latin1", 12, 16) === "IHDR") {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return width && height ? { width, height } : null;
  }
  if (buf.length >= 30 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    const kind = buf.toString("latin1", 12, 16);
    if (kind === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === "VP8L" && buf[20] === 0x2f) {
      const bits = buf.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    if (kind === "VP8 " && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
  }
  return null;
}

// ───────────────────────────── compilazione ─────────────────────────────

/** I percorsi dei .mdx sotto compileDocs.mjs, relativi e con /, in ordine. */
export const listMdx = (dir, base = dir) =>
  !existsSync(dir)
    ? []
    : readdirSync(dir, { withFileTypes: true })
        .flatMap((d) => (d.isDirectory() ? listMdx(join(dir, d.name), base) : d.name.endsWith(".mdx") ? [relative(base, join(dir, d.name)).split("\\").join("/")] : []))
        .sort();

const siteSlugs = (root) => {
  const dir = join(root, "..");
  const slugs = new Set();
  for (const d of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
    const pkg = join(dir, d.name, "package.json");
    if (d.isDirectory() && existsSync(pkg)) {
      const slug = JSON.parse(readFileSync(pkg, "utf8")).vitetranslateSite?.slug;
      if (slug) slugs.add(slug);
    }
  }
  return slugs;
};

// Le rotte che nav.js nomina: le stringhe tra virgolette fatte come `sezione/pagina`.
const navRoutes = (text) => [...text.matchAll(/["']([a-z0-9-]+\/[a-z0-9-]+)["']/g)].map((m) => m[1]);

// I controlli che toccano più pagine o il disco.
function validate(pages, { root, repo }) {
  const errors = [];
  const err = (file, line, why) => errors.push(`${file}${line ? `:${line}` : ""}: ${why}`);
  const slugs = siteSlugs(root);
  const byRoute = new Map(pages.map((p) => [p.route, p]));
  const idsOf = (p) => new Set([...pageIds(p.parsed.blocks), ...p.parsed.front.aliases.filter((a) => a.old && a.route === p.route).map((a) => a.old)]);
  const claims = new Map();

  for (const p of pages) {
    const { front, blocks } = p.parsed;
    front.sources.forEach((s, k) => {
      const { file, key } = splitSource(s);
      if (!existsSync(join(repo, file))) err(p.file, front.sourceLines[k], `source "${s}" does not exist`);
      else if (key !== null && jsonSubtree(readFileSync(join(repo, file), "utf8"), key) === undefined) err(p.file, front.sourceLines[k], `source "${s}": no key "${key}" in ${file}`);
    });
    for (const l of collectLinks(blocks)) {
      if (l.kind === "route") {
        const t = byRoute.get(l.route);
        if (!t) err(p.file, l.line, `link to "/${l.route}": no such page`);
        else if (l.id && !idsOf(t).has(l.id)) err(p.file, l.line, `link to "/${l.route}#${l.id}": no such section`);
      } else if (l.kind === "hash") {
        if (!idsOf(p).has(l.id)) err(p.file, l.line, `link to "#${l.id}": no such section on this page`);
      } else if (l.kind === "site") {
        if (!slugs.has(l.slug)) err(p.file, l.line, `link "site:${l.slug}": no such site page (${[...slugs].join(", ")})`);
      } else if (l.kind === "repo") {
        if (!existsSync(join(repo, l.path))) err(p.file, l.line, `link "repo:${l.path}": no such file in the repo`);
      }
    }
    // Current sections only: an old id kept by `aliases:` still works as an address, but not as a fresh link.
    for (const r of front.related) {
      const t = byRoute.get(r.route);
      if (r.route === p.route) err(p.file, r.line, `related "${r.raw}": this page itself (related links lead elsewhere)`);
      else if (!t) err(p.file, r.line, `related "${r.raw}": no such page`);
      else if (r.id && !pageIds(t.parsed.blocks).includes(r.id)) err(p.file, r.line, `related "${r.raw}": no such section`);
    }
    for (const b of blocks) {
      if (b.type === "figure") {
        const file = join(root, "public", b.src);
        if (!existsSync(file)) err(p.file, b.line, `image "${b.src}": not found in public/`);
        else if (!imageSize(readFileSync(file))) err(p.file, b.line, `image "${b.src}": cannot read its size (PNG and WebP only)`);
      }
      if (b.type === "demo" && !slugs.has(b.page)) err(p.file, b.line, `<Demo page="${b.page}">: no such site page (${[...slugs].join(", ")})`);
    }
    for (const a of front.aliases) {
      const real = byRoute.get(a.route);
      if (a.old === undefined && a.route === p.route) err(p.file, a.line, `alias "${a.raw}" is the route of this page`);
      else if (a.old === undefined && real) err(p.file, a.line, `alias "${a.raw}": "${a.route}" is a real page`);
      else if (a.old !== undefined && real && real !== p && pageIds(real.parsed.blocks).includes(a.old)) err(p.file, a.line, `alias "${a.raw}": "${a.old}" is still a section of "${a.route}"`);
      else if (a.old !== undefined && (!real || real === p) && pageIds(blocks).includes(a.old)) err(p.file, a.line, `alias "${a.raw}": "${a.old}" is the id of a current heading`);
      const key = a.raw.replace(/ *-> *.*$/, "");
      if (claims.has(key) && claims.get(key) !== p.route) err(p.file, a.line, `alias "${key}" is also claimed by ${claims.get(key)}`);
      claims.set(key, p.route);
    }
  }

  // nav.js e pagine devono coincidere: ogni pagina una volta sola, nessuna rotta senza pagina
  const navFile = join(root, "src/nav.js");
  if (!existsSync(navFile)) err("src/nav.js", 0, "missing: the navigation (groups and page order) lives there");
  else {
    const routes = navRoutes(readFileSync(navFile, "utf8"));
    for (const r of new Set(routes)) if (!byRoute.has(r)) err("src/nav.js", 0, `route "${r}" has no page in content/`);
    for (const p of pages) {
      const count = routes.filter((r) => r === p.route).length;
      if (count !== 1) err(p.file, 0, count ? `listed ${count} times in src/nav.js` : "missing from src/nav.js");
    }
  }
  return errors;
}

// Scrive solo se il contenuto cambia: Vite e la sync non vedono modifiche finte.
function writeIfChanged(file, content) {
  if (existsSync(file) && readFileSync(file, "utf8") === content) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return true;
}

// Toglie i file generati la cui pagina non c'è più, e le cartelle rimaste vuote.
function sweep(dir, keep) {
  if (!existsSync(dir)) return;
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) {
      sweep(p, keep);
      if (!readdirSync(p).length) rmdirSync(p);
    } else if (!keep.has(p)) unlinkSync(p);
  }
}

/**
 * src/generated/related.js: "On the same topic" of every page, route -> [{ route, id, label, detail }].
 * One module for all of them: the same marked sentence twice in one file is one key, translated once.
 * @param {{ route: string, parsed: { front: { related: object[] } } }[]} pages
 */
export function emitRelated(pages) {
  const marked = (s) => JSON.stringify(`${DELIM}${s}${DELIM}`);
  const rows = pages
    .filter((p) => p.parsed.front.related.length)
    .map((p) => {
      const items = p.parsed.front.related.map((r) => `    { route: ${JSON.stringify(r.route)}, id: ${JSON.stringify(r.id)}, label: ${marked(r.label)}, detail: ${marked(r.detail)} },`);
      return `  ${JSON.stringify(p.route)}: [\n${items.join("\n")}\n  ],`;
    });
  return `// GENERATO da scripts/compileDocs.mjs dai \`related:\` delle pagine: non modificare.\nexport const RELATED = {\n${rows.join("\n")}\n};\n`;
}

/**
 * Legge content/, valida tutto, scrive src/generated/.
 * @param {{ root?: string, log?: (line: string) => void }} [opzioni] `root`: la cartella della pagina (nei test, una finta)
 * @returns {{ routes: object[], errors: string[], written: number }}
 * @throws {Error} se ci sono errori: prima li stampa tutti (e li allega come `err.errors`)
 */
export function compileDocs({ root = PAGE_DIR, log = console.error } = {}) {
  const repo = resolve(root, "../../..");
  const contentDir = join(root, "content");
  const errors = [];
  const pages = [];
  for (const rel of listMdx(contentDir)) {
    const route = rel.replace(/\.mdx$/, "");
    const file = `content/${rel}`;
    if (!ROUTE_RE.test(route)) {
      errors.push(`${file}: the path must be section/page, lowercase a-z, 0-9 and "-"`);
      continue;
    }
    try {
      pages.push({ route, file, parsed: parseMdx(readFileSync(join(contentDir, rel), "utf8"), file) });
    } catch (e) {
      errors.push(e.message);
    }
  }
  errors.push(...validate(pages, { root, repo }));
  if (errors.length) {
    for (const e of errors) log(`docs: ${e}`);
    const err = new Error(`docs: ${errors.length} error(s) in the manual`);
    err.errors = errors;
    throw err;
  }

  const gen = join(root, "src/generated");
  const keep = new Set([join(gen, "routes.js"), join(gen, "routes.json"), join(gen, "aliases.json"), join(gen, "related.js")]);
  const realRoutes = new Set(pages.map((p) => p.route));
  const sizeOf = (src) => imageSize(readFileSync(join(root, "public", src)));
  // "route#old" -> "nuova/route#new": le sezioni passate da una pagina all'altra, che il router segue (aliases.json)
  const aliases = {};
  for (const p of pages) for (const a of p.parsed.front.aliases) if (a.old !== undefined) aliases[`${a.route}#${a.old}`] = `${p.route}#${a.to}`;
  let written = 0;
  const routes = [];
  pages.forEach((p) => {
    const file = join(gen, "pages", `${p.route}.jsx`);
    keep.add(file);
    if (writeIfChanged(file, emitPage(p.parsed, p.route, { realRoutes, imageSize: sizeOf }))) written++;
    const f = p.parsed.front;
    routes.push({ route: p.route, title: f.title, description: f.description, ids: pageIds(p.parsed.blocks), aliases: f.aliases.map((a) => a.raw) });
  });
  const imports = pages.map((p, k) => `import * as p${k} from "./pages/${p.route}.jsx";`);
  const table = pages.length ? `{\n${pages.map((p, k) => `  ${JSON.stringify(p.route)}: p${k},`).join("\n")}\n}` : "{}";
  const js = `// GENERATO da scripts/compileDocs.mjs: non modificare.\n${imports.join("\n")}\n\nexport const ROUTES = ${table};\n`;
  if (writeIfChanged(join(gen, "routes.js"), js)) written++;
  if (writeIfChanged(join(gen, "routes.json"), `${JSON.stringify(routes, null, 2)}\n`)) written++;
  if (writeIfChanged(join(gen, "aliases.json"), `${JSON.stringify(aliases, null, 2)}\n`)) written++;
  if (writeIfChanged(join(gen, "related.js"), emitRelated(pages))) written++;
  sweep(join(gen, "pages"), keep);
  return { routes, errors: [], written };
}

/**
 * Ricompila a ogni modifica di content/ (e di src/nav.js), con 100 ms di attesa. Un errore si stampa
 * e si continua a guardare. Restituisce la funzione che smette.
 * @param {{ root?: string, log?: (line: string) => void }} [opzioni]
 */
export function watchDocs({ root = PAGE_DIR, log = console.error } = {}) {
  let timer = null;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const r = compileDocs({ root, log });
        if (r.written) log(`docs: ${r.routes.length} pages compiled (${r.written} files written)`);
      } catch {
        /* compileDocs ha già stampato gli errori: si resta in ascolto */
      }
    }, 100);
  };
  const watchers = [join(root, "content"), join(root, "src/nav.js")]
    .filter((p) => existsSync(p))
    .map((p) => watch(p, { recursive: statSync(p).isDirectory() }, run));
  return () => {
    clearTimeout(timer);
    watchers.forEach((w) => w.close());
  };
}

// Da riga di comando: `node scripts/compileDocs.mjs` (npm run compile).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const r = compileDocs();
    console.log(`docs: ${r.routes.length} pages, ${r.written} files written`);
  } catch {
    process.exit(1);
  }
}
