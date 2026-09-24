// Architettura d'insieme: doc/structure.md § "2c. ICU MessageFormat".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Il file è SENZA import, perché va nel bundle dell'app: lo importano solo i chunk di lingua
// che usano l'ICU, tramite il modulo virtuale "virtual:vitetranslate/icu" (vedi
// lib/dev/vite/vitetranslate.js). Usa import.meta.env?.DEV solo per gli avvisi: Vite lo
// sostituisce in dev e in build, e in Node vale undefined.

const EMPTY = {};
const CARDINAL = { type: "cardinal" };
const ORDINAL = { type: "ordinal" };
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

// Oggetto opzioni -> Map("Costruttore\0locale\0fuso" -> istanza). Le opzioni sono costanti di
// modulo dei chunk (vedi compileIcu.js): l'identità basta, niente JSON.stringify a ogni render.
// Nessun tetto: le combinazioni sono fissate a build time, salvo i fusi passati a runtime,
// che sono una manciata.
const cache = new WeakMap();

const warned = new Set();
function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[vitetranslate] ${message}`);
}

function intl(Ctor, locale, options, timeZone) {
  const opts = options ?? EMPTY;
  let byKey = cache.get(opts);
  if (byKey === undefined) { byKey = new Map(); cache.set(opts, byKey); }
  const key = `${Ctor.name}\u0000${locale ?? ""}\u0000${timeZone ?? ""}`;
  let f = byKey.get(key);
  if (f === undefined) {
    f = build(Ctor, locale, opts, timeZone);
    byKey.set(key, f);
  }
  return f;
}

// Un fuso o un'opzione che il motore non conosce non devono rompere un render: si ritenta
// con meno, e in sviluppo lo si dice una volta.
function build(Ctor, locale, opts, timeZone) {
  const tries = [
    [locale, timeZone === undefined ? opts : { ...opts, timeZone }],
    [locale, opts], [locale, EMPTY], [undefined, EMPTY],
  ];
  for (let i = 0; i < tries.length; i++) {
    try {
      const f = new Ctor(tries[i][0], tries[i][1]);
      if (i > 0 && import.meta.env?.DEV) warnOnce(`intl:${Ctor.name}:${locale}:${timeZone}`, `${Ctor.name} rejected locale "${locale}" with ${JSON.stringify(tries[0][1])}: formatted with fewer options.`);
      return f;
    } catch { /* tentativo successivo */ }
  }
  return new Ctor();
}

function toNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** `{n, number}` e `{n, plural/selectordinal}`. Un valore mancante o non numerico resta com'è. */
export function icuNumber(v, locale, options) {
  if (typeof v === "bigint") return intl(Intl.NumberFormat, locale, options).format(v);
  const n = toNumber(v);
  if (n === null) return v;
  return intl(Intl.NumberFormat, locale, options).format(n);
}

function toInstant(v) {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : { date: v, dateOnly: false };
  }
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    if (import.meta.env?.DEV && v !== 0 && Math.abs(v) < 1e11) {
      warnOnce("seconds", `${v} looks like a timestamp in seconds, but dates take milliseconds: multiply by 1000.`);
    }
    return { date: new Date(v), dateOnly: false };
  }
  if (typeof v === "string") {
    const dateOnly = DATE_ONLY_RE.exec(v);
    if (dateOnly) {
      const ms = Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
      return { date: new Date(ms), dateOnly: true };
    }
    if (ISO_RE.test(v)) {
      const ms = Date.parse(v);
      return Number.isNaN(ms) ? null : { date: new Date(ms), dateOnly: false };
    }
    return null;
  }
  return null;
}

/** `{n, date}` / `{n, time}`. Un valore non interpretabile si mostra com'è (Date -> String). */
export function icuDate(v, locale, options, o) {
  const t = toInstant(v);
  if (t === null) return v instanceof Date ? String(v) : v;
  const tz = t.dateOnly ? "UTC" : o?.timeZone;
  return intl(Intl.DateTimeFormat, locale, options, tz).format(t.date);
}

/** `{n, plural}` / `{n, selectordinal}`. */
export function icuPlural(v, locale, ordinal, offset, exact, cats) {
  const n = toNumber(v);
  if (n === null) return cats.other(v);                  // valore mancante o non numerico: ramo other, "#" mostra il valore
  const shown = n - offset;
  const h = intl(Intl.NumberFormat, locale, EMPTY).format(shown);
  const hit = exact === null ? undefined : exact[n];      // "=n" confronta il valore PRIMA dell'offset (spec ICU)
  if (hit !== undefined) return hit(h);
  const cat = intl(Intl.PluralRules, locale, ordinal ? ORDINAL : CARDINAL).select(shown);
  return (Object.hasOwn(cats, cat) ? cats[cat] : cats.other)(h);
}

/** `{n, select}`. */
export function icuSelect(v, branches) {
  const key = typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : "other";
  return (Object.hasOwn(branches, key) ? branches[key] : branches.other)();
}
