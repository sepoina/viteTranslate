// La cache marcatore -> chiave deve essere invisibile: stessi risultati di prima, in tutte le
// forme di marcatore e in tutti i rami di risoluzione. Una cache che sbaglia una chiave fa
// comparire la traduzione di un'altra stringa, in silenzio.
//
//   node test/list/markerCache.test.mjs
import { markerKey, markerFallback, stripSourceMarker } from "../../lib/react/parseCompiledMarker.js";
import { resolveEntry, resolveEntryText } from "../../lib/react/resolveEntry.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = Object.is(atteso, ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// Riferimento: l'estrazione com'era prima della cache.
const riferimento = (text) => {
  const sep = text.indexOf("_/_", 3);
  if (sep === -1) return { key: text.slice(3, -3), fallback: undefined };
  return { key: text.slice(3, sep), fallback: text.slice(sep + 3, -3) };
};

console.log("\n== la chiave è quella di prima, in ogni forma ==");
const CASI = [
  ["dev, fallback semplice", "_<_App_abc_/_Ciao mondo_>_"],
  ["build, senza fallback", "_<_App_abc_>_"],
  ["fallback con markup", "_<_App_x1_/_resta <b>grassetto</b>_>_"],
  ["fallback con segnaposto", "_<_App_x2_/_ciao %s, hai %s messaggi_>_"],
  ["fallback vuoto", "_<_App_x3_/__>_"],
  ["chiave vuota", "_<__/_solo testo_>_"],
  ["marcatore vuoto", "_<__>_"],
  ["fallback che contiene _/_", "_<_App_x4_/_a_/_b nel testo_>_"],
  ["fallback con _>_ dentro", "_<_App_x5_/_finisce con _>_ dentro_>_"],
  ["fallback multilinea", "_<_App_x6_/_prima riga\nseconda riga_>_"],
  ["accenti e unicode", "_<_App_x7_/_però è così — 中文_>_"],
];
for (const [nome, marker] of CASI) {
  const atteso = riferimento(marker);
  eq(`${nome} · chiave`, atteso.key, markerKey(marker));
  eq(`${nome} · fallback`, atteso.fallback, markerFallback(marker));
}

console.log("\n== la seconda chiamata dà lo stesso risultato (ed è la stessa istanza) ==");
{
  const marker = "_<_App_stabile_/_testo_>_";
  const primo = markerKey(marker);
  const secondo = markerKey(marker);
  eq("stesso valore", primo, secondo);
  // È il punto della cache: niente slice nuova, quindi nessuna allocazione dopo la prima.
  eq("stessa istanza di stringa", true, primo === secondo);
  // Anche partendo da una stringa costruita a runtime, uguale per valore.
  const costruito = "_<_App_stabile" + "_/_testo_>_";
  eq("stringa equivalente, stessa chiave", primo, markerKey(costruito));
}

console.log("\n== due marcatori diversi non si confondono ==");
{
  // Stessa chiave, fallback diverso: la cache è indicizzata sul marcatore intero.
  eq("stesso id, fallback diverso", "App_k", markerKey("_<_App_k_/_uno_>_"));
  eq("stesso id, altro fallback", "App_k", markerKey("_<_App_k_/_due_>_"));
  eq("il fallback resta distinto (1)", "uno", markerFallback("_<_App_k_/_uno_>_"));
  eq("il fallback resta distinto (2)", "due", markerFallback("_<_App_k_/_due_>_"));
  // Prefissi simili non devono collidere.
  eq("chiave prefisso di un'altra", "App_a", markerKey("_<_App_a_>_"));
  eq("chiave piu' lunga", "App_ab", markerKey("_<_App_ab_>_"));
}

console.log("\n== risoluzione: la chiave trovata vince, il fallback non viene toccato ==");
{
  const table = { App_ok: "tradotto" };
  eq("voce presente", "tradotto", resolveEntry(table, undefined, "App_ok", false, "_<_App_ok_/_originale_>_"));
  // Assente dalla tabella attiva ma presente in quella eager.
  eq("ricade sulla tabella eager", "eager", resolveEntry({}, { App_ok: "eager" }, "App_ok", false, "_<_App_ok_/_originale_>_"));
}

console.log("\n== risoluzione: chiave assente -> il fallback si estrae dal marcatore ==");
{
  // In produzione (import.meta.env.DEV assente in Node) `missing` interpola il testo grezzo.
  eq("usa il testo incorporato", "originale",
    resolveEntry({}, {}, "App_no", false, "_<_App_no_/_originale_>_"));
  eq("con segnaposto interpolati", "ciao aldo",
    resolveEntry({}, {}, "App_no", ["aldo"], "_<_App_no_/_ciao %s_>_"));
  eq("senza fallback resta la chiave", "App_no",
    resolveEntry({}, {}, "App_no", false, "_<_App_no_>_"));
  eq("marcatore assente del tutto", "App_no",
    resolveEntry({}, {}, "App_no", false, undefined));
  eq("resolveEntryText segue la stessa strada", "originale",
    resolveEntryText({}, {}, "App_no", false, "_<_App_no_/_originale_>_"));
}

console.log("\n== stripSourceMarker non è toccato ==");
{
  eq("marcatore sorgente", "Benvenuto", stripSourceMarker("_%_Benvenuto_%_"));
  eq("stringa qualunque", "niente", stripSourceMarker("niente"));
  eq("troppo corta", "_%_", stripSourceMarker("_%_"));
}

console.log("\n== il tetto della cache non altera i risultati ==");
{
  // Oltre il tetto le voci piu' vecchie escono: chi cade fuori ripaga l'estrazione, il
  // risultato resta identico. Si verifica che una chiave inserita per prima sia ancora giusta.
  const primo = "_<_App_primissimo_/_testo iniziale_>_";
  const atteso = markerKey(primo);
  for (let i = 0; i < 6000; i++) markerKey(`_<_App_riempimento${i}_/_testo ${i}_>_`);
  eq("chiave sfrattata e ricalcolata", atteso, markerKey(primo));
  eq("ed è ancora corretta", "App_primissimo", markerKey(primo));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
