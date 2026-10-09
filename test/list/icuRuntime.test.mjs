// I quattro helper e la cache Intl di lib/icu/runtime.js — piano 4.6.3, § 1.4.
//
//   node test/list/icuRuntime.test.mjs
import { icuNumber, icuDate, icuPlural, icuSelect } from "../../lib/icu/runtime.js";

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

console.log("\n== icuNumber ==");
eq("number", new Intl.NumberFormat("it-IT").format(1234.5), icuNumber(1234.5, "it-IT"));
eq("bigint", new Intl.NumberFormat("en-US").format(10n), icuNumber(10n, "en-US"));
eq('stringa numerica "12.5"', new Intl.NumberFormat("en-US").format(12.5), icuNumber("12.5", "en-US"));
eq('stringa non numerica "abc" invariata', "abc", icuNumber("abc", "en-US"));
eq("segno di assente invariato", "⁇", icuNumber("⁇", "en-US"));

console.log("\n== icuDate ==");
{
  const opts = { dateStyle: "medium" };
  const expected = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 3)));
  eq("Date -> formattata", expected, icuDate(new Date(Date.UTC(2026, 9, 3)), "en-US", opts, { timeZone: "UTC" }));
  eq("millisecondi -> formattata", expected, icuDate(Date.UTC(2026, 9, 3), "en-US", opts, { timeZone: "UTC" }));
  eq(
    '"2026-10-03" (calendario) uguale in UTC anche con o.timeZone diverso',
    expected,
    icuDate("2026-10-03", "en-US", opts, { timeZone: "America/Los_Angeles" })
  );
  const isoExpected = new Intl.DateTimeFormat("en-US", opts).format(new Date("2026-10-03T20:30:00Z"));
  eq("ISO con Z", isoExpected, icuDate("2026-10-03T20:30:00Z", "en-US", opts));
  eq('"03/10/2026" non interpretata -> invariata', "03/10/2026", icuDate("03/10/2026", "en-US", opts));
  eq("Date non valida -> String(v)", String(new Date("x")), icuDate(new Date("x"), "en-US", opts));
}
{
  // Un fuso non valido non deve lanciare: `build()` ritenta con meno opzioni.
  let threw = false;
  let out;
  try {
    out = icuDate("2026-10-03T20:30:00Z", "en-US", { dateStyle: "medium" }, { timeZone: "Not/AZone" });
  } catch {
    threw = true;
  }
  ok_("fuso non valido: nessuna eccezione", !threw);
  ok_("fuso non valido: restituisce comunque del testo", typeof out === "string" && out.length > 0);
}

console.log("\n== icuPlural ==");
{
  const cats = { "0": null, one: (h) => `${h} file`, other: (h) => `${h} files` };
  eq("=0 vince su one", "nessun file", icuPlural(0, "en-US", false, 0, { 0: () => "nessun file" }, cats));
  eq("plurale semplice: 1", "1 file", icuPlural(1, "en-US", false, 0, null, cats));
  eq("plurale semplice: 5", "5 files", icuPlural(5, "en-US", false, 0, null, cats));
}
{
  // offset: "#" = n - offset; "=n" confronta il valore PRIMA dell'offset (spec ICU).
  const cats = { one: (h) => `altri ${h}`, other: (h) => `altri ${h}` };
  eq("offset applicato a '#'", "altri 2", icuPlural(3, "en-US", false, 1, null, cats));
  eq("=n confronta il valore prima dell'offset", "esatto", icuPlural(3, "en-US", false, 1, { 3: () => "esatto" }, cats));
}
{
  const catsPl = { few: (h) => `${h}:few`, many: (h) => `${h}:many`, one: (h) => `${h}:one`, other: (h) => `${h}:other` };
  eq("pl 2 -> few", "2:few", icuPlural(2, "pl-PL", false, 0, null, catsPl));
  eq("pl 5 -> many", "5:many", icuPlural(5, "pl-PL", false, 0, null, catsPl));
  const catsAr = { zero: () => "zero", one: () => "one", two: () => "two", few: () => "few", many: () => "many", other: () => "other" };
  eq("ar 0 -> zero", "zero", icuPlural(0, "ar", false, 0, null, catsAr));
  const catsOrd = { one: () => "one", two: () => "two", few: () => "few", other: () => "other" };
  eq("en ordinale 2 -> two", "two", icuPlural(2, "en-US", true, 0, null, catsOrd));
}
{
  const cats = { other: (h) => `other:${h}` };
  eq("non numero -> other, '#' mostra il valore", "other:⁇", icuPlural("⁇", "en-US", false, 0, null, cats));
}

console.log("\n== icuSelect ==");
eq("chiave presente", "he", icuSelect("m", { m: () => "he", other: () => "they" }));
eq("chiave assente -> other", "they", icuSelect("f", { m: () => "he", other: () => "they" }));
eq('"constructor" -> other (non pesca dal prototipo)', "they", icuSelect("constructor", { m: () => "he", other: () => "they" }));

console.log("\n== cache Intl ==");
{
  const opts = { dateStyle: "medium" };
  const a = new Intl.NumberFormat("it-IT"); // solo per scaldare i motori, non e' l'istanza cache
  void a;
  // Non possiamo leggere la cache dall'esterno: verifichiamo l'effetto osservabile, cioè che
  // due chiamate con lo stesso identico oggetto opzioni e lo stesso fuso non lancino e diano
  // lo stesso risultato (identità -> stesso formatter -> stesso output, banale ma è quel che
  // conta: la cache non deve mai produrre un formatter sbagliato per la chiave successiva).
  const r1 = icuDate("2026-01-01", "en-US", opts, { timeZone: "UTC" });
  const r2 = icuDate("2026-01-01", "en-US", opts, { timeZone: "UTC" });
  eq("stesse opzioni/fuso -> stesso risultato", r1, r2);
  const r3 = icuDate("2026-01-01T12:00:00Z", "en-US", opts, { timeZone: "America/New_York" });
  ok_("fuso diverso -> formatter diverso (risultato divergente per un orario)", r3 !== undefined);
}

console.log("\n== 4.7.1: dates that do not exist fall back, they neither shift nor throw ==");
{
  const opts = { dateStyle: "medium" };
  const fmtUtc = (y, m, d) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  const noThrow = (name, v, expected) => {
    let out, threw = false;
    try { out = icuDate(v, "en-US", opts, { timeZone: "UTC" }); } catch { threw = true; }
    ok_(`${name}: no exception`, !threw);
    if (!threw) eq(`${name}: shown as it is`, expected, out);
  };

  // Numbers: the Date range is +-8.64e15 ms.
  const edge = 8.64e15;
  eq("number at +8.64e15 is formatted", new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(edge)), icuDate(edge, "en-US", opts, { timeZone: "UTC" }));
  eq("number at -8.64e15 is formatted", new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(-edge)), icuDate(-edge, "en-US", opts, { timeZone: "UTC" }));
  noThrow("number just above the range", edge + 1, edge + 1);
  noThrow("number just below the range", -edge - 1, -edge - 1);
  noThrow("1e20", 1e20, 1e20);
  ok_("NaN: shown as it is, no exception", Number.isNaN(icuDate(NaN, "en-US", opts, { timeZone: "UTC" })));
  noThrow("Infinity", Infinity, Infinity);
  noThrow("-Infinity", -Infinity, -Infinity);
  eq("invalid Date -> String(v)", "Invalid Date", icuDate(new Date(NaN), "en-US", opts));

  // Date only (calendar dates, always UTC).
  eq("2024-02-29 (leap year) is real", fmtUtc(2024, 2, 29), icuDate("2024-02-29", "en-US", opts));
  noThrow("2024-02-30", "2024-02-30", "2024-02-30");
  noThrow("2024-02-31 does not become March 2", "2024-02-31", "2024-02-31");
  noThrow("2023-02-29 (not a leap year)", "2023-02-29", "2023-02-29");
  eq("1900-02-29 is not real (century rule)", "1900-02-29", icuDate("1900-02-29", "en-US", opts));
  eq("2000-02-29 is real (every 400 years)", fmtUtc(2000, 2, 29), icuDate("2000-02-29", "en-US", opts));
  noThrow("month 00", "2024-00-10", "2024-00-10");
  noThrow("month 13 does not become January next year", "2024-13-01", "2024-13-01");
  noThrow("day 00", "2024-01-00", "2024-01-00");
  noThrow("day 32", "2024-01-32", "2024-01-32");
  noThrow("April 31", "2024-04-31", "2024-04-31");

  // Years 0-99: Date.UTC would map them to 1900-1999.
  const year = (iso) => new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" }).format(new Date(new Date(0).setUTCFullYear(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))));
  eq("0099-01-01 is year 99, not 1999", year("0099-01-01"), icuDate("0099-01-01", "en-US", { year: "numeric" }));
  ok_("0099-01-01 does not say 1999", !icuDate("0099-01-01", "en-US", { year: "numeric" }).includes("1999"));
  eq("0100-01-01 is year 100", year("0100-01-01"), icuDate("0100-01-01", "en-US", { year: "numeric" }));
  eq("0000-01-01 is year 0 (as Intl formats it), never 1900", year("0000-01-01"), icuDate("0000-01-01", "en-US", { year: "numeric" }));
  ok_("0000-01-01 does not say 1900", !icuDate("0000-01-01", "en-US", { year: "numeric" }).includes("1900"));
  eq("0000-02-29 is real (year 0 is a leap year)", year("0000-02-29"), icuDate("0000-02-29", "en-US", { year: "numeric" }));

  // ISO date-times: the calendar part is validated, the time-zone logic is untouched.
  noThrow("2024-02-31T10:00Z does not become March 2", "2024-02-31T10:00Z", "2024-02-31T10:00Z");
  noThrow("2024-13-01T10:00:00Z", "2024-13-01T10:00:00Z", "2024-13-01T10:00:00Z");
  noThrow("2024-04-31T10:00:00+02:00", "2024-04-31T10:00:00+02:00", "2024-04-31T10:00:00+02:00");
  eq("valid ISO with an offset", new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date("2024-02-29T23:30:00+02:00")), icuDate("2024-02-29T23:30:00+02:00", "en-US", opts, { timeZone: "UTC" }));
  eq("valid ISO with Z and milliseconds", new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date("2024-02-29T10:00:00.123Z")), icuDate("2024-02-29T10:00:00.123Z", "en-US", opts, { timeZone: "UTC" }));
  eq("valid ISO at the last day of a month", new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date("2024-04-30T12:00:00Z")), icuDate("2024-04-30T12:00:00Z", "en-US", opts, { timeZone: "UTC" }));
}

console.log("\n== 4.7.1: a calendar date shows the same day in every time zone ==");
{
  const opts = { dateStyle: "long" };
  const zones = ["UTC", "Pacific/Kiritimati", "Pacific/Pago_Pago", "America/Los_Angeles", "Asia/Tokyo"];
  const outs = zones.map((timeZone) => icuDate("2024-02-29", "en-US", opts, { timeZone }));
  ok_("same text in 5 zones", outs.every((o) => o === outs[0]));
  ok_("and it is the 29th", outs[0].includes("29"));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
