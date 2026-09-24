// Strato 2: validateTranslation.js — il pezzo che vale di più di tutta la funzione LLM.
// Puro: nessun I/O, si prova con due stringhe e basta.
//
//   node test/list/llmValidate.test.mjs
import validateTranslation from "../../lib/dev/llm/validateTranslation.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const reason = (key, source, candidate) => validateTranslation({ key, source, candidate }).reason;
const ok = (key, source, candidate) => validateTranslation({ key, source, candidate }).ok;

// T15 — le sei reason
console.log("\n== T15 le sei reason ==");
eq("not-a-string (numero)", "not-a-string", reason("K", "Hello", 123));
eq("not-a-string (vuota)", "not-a-string", reason("K", "Hello", "   "));
eq("echo-key", "echo-key", reason("K", "Hello", "K"));
eq("placeholder-count", "placeholder-count", reason("K", "Hello %s", "Ciao"));
eq("tag-mismatch", "tag-mismatch", reason("K", "<b>Hello</b>", "Ciao"));
eq("tag-crossed", "tag-crossed", reason("K", "<b>x</b><i>y</i>", "<i><b>x</i></b>y"));
eq("too-long", "too-long", reason("K", "OK", "a".repeat(50)));

// T16 — %s perso, duplicato, invertito (stesso numero -> passa)
console.log("\n== T16 placeholder ==");
eq("perso", "placeholder-count", reason("K", "Hello %s and %s", "Ciao %s"));
eq("duplicato", "placeholder-count", reason("K", "Hello %s", "Ciao %s %s"));
eq("invertito, stesso numero -> passa (limite documentato)", true, ok("K", "Hello %s and %s again", "B %s C %s"));

// T17 — tag persi/inventati/duplicati
console.log("\n== T17 tag-mismatch ==");
eq("<b> perso", "tag-mismatch", reason("K", "<b>Hello</b>", "Ciao"));
eq("<div> inventato", "tag-mismatch", reason("K", "Hello", "<div>Ciao</div>"));
eq("<br> duplicato", "tag-mismatch", reason("K", "a<br>b", "a<br><br>b"));

// T18 — tag incrociati
console.log("\n== T18 tag-crossed ==");
eq("incrociati", "tag-crossed", reason("K", "<b>x</b><i>y</i>", "<b><i>x</b></i>y"));

// T19 — il "+20" di too-long
console.log("\n== T19 too-long guard corto ==");
eq("OK -> Va bene passa", true, ok("K", "OK", "Va bene"));

// T20 — identico al sorgente
console.log("\n== T20 identico al sorgente passa ==");
eq("Email invariato", true, ok("K", "Email", "Email"));

// T21 — identico alla chiave
console.log("\n== T21 echo-key ==");
eq("candidato === chiave", "echo-key", reason("Some_key_abc", "Testo", "Some_key_abc"));

// T22 — whitespace
console.log("\n== T22 whitespace ==");
eq('sorgente " x " -> " y "', " y ", validateTranslation({ key: "K", source: " x ", candidate: "y" }).value);
eq('sorgente "x" -> "y" (trim)', "y", validateTranslation({ key: "K", source: "x", candidate: "  y  " }).value);

// Piano 4.6.3 — messaggi ICU: compareIcu decide, ma resta l'unico confronto (icuSignature.test.mjs
// lo copre a fondo). Qui solo l'integrazione con validateTranslation: le sei reason "di sempre"
// restano quelle sopra, senza toccarle.
console.log("\n== ICU: argomenti riordinati -> ok ==");
eq("riordino", true, ok("K", "{0} e {1}", "{1} e {0}"));

console.log("\n== ICU: rifiuti ==");
eq("{0} sostituito da {1}", "icu-args", reason("K", "hi {0}", "ciao {1}"));
eq("{name} tradotto in {nome}", "icu-args", reason("K", "hi {name}", "ciao {nome}"));
eq(
  "plurale senza 'few' per pl-PL",
  "icu-plural-categories",
  validateTranslation({ key: "K", source: "{0, plural, one {x} other {y}}", candidate: "{0, plural, one {a} other {b}}", targetTag: "pl-PL" }).reason
);
eq("sorgente non ICU, candidato ICU", "icu-introduced", reason("K", "ciao %s", "ciao {0}"));
eq("sorgente ICU, candidato %s", "icu-missing", reason("K", "ciao {0}", "ciao %s"));

console.log("\n== ICU: rami extra e lunghezza fino a 8x sono ammessi ==");
eq(
  "<b> in 3 rami contro 2 nel sorgente -> ok",
  true,
  ok("K", "{0, plural, one {<b>x</b>} other {y}}", "{0, plural, one {<b>a</b>} few {<b>c</b>} other {b}}")
);
{
  const source = "{0, plural, one {x} other {y}}";
  const candidate = `{0, plural, one {${"a".repeat(source.length * 6)}} other {b}}`;
  eq("lunghezza fino a 8x -> ok", true, ok("K", source, candidate));
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
