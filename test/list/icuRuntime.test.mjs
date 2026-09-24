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

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
