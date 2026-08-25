// Il rapporto di `--status`: cosa considera a posto, cosa incompleto, cosa un errore.
//
// È un comando di sola lettura, e sono due proprietà distinte a doverlo restare: che dica il
// vero, e che non tocchi niente. La seconda ha un test suo in fondo, perché è la sola cosa che
// distingue una fotografia da una sincronizzazione — ed è anche la sola che, rompendosi, non
// si vedrebbe: `--status` che crea una cartella o riscrive un file continuerebbe a stampare
// esattamente lo stesso rapporto.
//
// Il riferimento è la tabella "appena scansionata dal sorgente", cioè quello che cli.js passa
// dentro `service.sourceTable`: qui viene costruita a mano, così i casi restano leggibili.
//
//   node test/list/languageStatus.test.mjs
import { mkdtempSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectStatus } from "../../lib/dev/vite/uty/languageStatus.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const V = 260824; // la versione di schema attesa, come BUILDER_VERSION in cli.js
const temporanee = [];

/** Una localeDir usa e getta. `scrivi` prende il testo grezzo: il formato lo decide il test. */
function progetto() {
  const localeDir = mkdtempSync(join(tmpdir(), "vt-status-"));
  temporanee.push(localeDir);
  return {
    localeDir,
    scrivi: (file, testo) => writeFileSync(join(localeDir, file), testo, "utf8"),
    /** Una tabella di lingua ben formata, per i casi in cui il formato non è il punto. */
    tabella: (tag, voci) =>
      [`__builder__: {"v":${V},"languageName":"x","incomplete":false}`, ...voci].join("\n") + "\n",
    stato: (sourceTable, sourceLanguage = "it-IT") =>
      collectStatus({ localeDir, sourceLanguage, sourceTable: { __builder__: { v: V }, ...sourceTable } }, V),
  };
}
const riga = (stato, tag) => stato.rows.find((r) => r.tag === tag) ?? {};

// ------------------------------------------------------- tutto a posto
console.log("\n== una tabella completa e allineata non ha niente da dire ==");
{
  const p = progetto();
  p.scrivi("it-IT.yml", p.tabella("it-IT", ['App_a: "ciao"']));
  p.scrivi("fr-FR.yml", p.tabella("fr-FR", ['App_a: "salut"']));
  const s = p.stato({ App_a: "ciao" });

  eq("due lingue trovate", 2, s.rows.length);
  eq("nessun problema in tutto", "ok", s.level);
  eq("la sorgente è riconosciuta come tale", true, riga(s, "it-IT").isSource);
  eq("chiavi contate senza __builder__", 1, riga(s, "fr-FR").keys);
  eq("la lingua tradotta è ok", "ok", riga(s, "fr-FR").level);
}

// ------------------------------------------------------- incompletezza
console.log("\n== chiavi a null: incompleta, non un errore ==");
{
  // Lo stato normale di un progetto in cui si sta ancora traducendo. Se finisse fra gli errori,
  // il controllo in CI andrebbe spento il primo giorno — cioè non servirebbe a niente.
  const p = progetto();
  p.scrivi("it-IT.yml", p.tabella("it-IT", ['App_a: "ciao"', 'App_b: "come stai"']));
  p.scrivi("fr-FR.yml", p.tabella("fr-FR", ['App_a: "salut"', "App_b: null"]));
  const s = p.stato({ App_a: "ciao", App_b: "come stai" });

  eq("una chiave da tradurre", 1, riga(s, "fr-FR").missing);
  eq("livello incomplete", "incomplete", riga(s, "fr-FR").level);
  eq("lo dice a parole", true, riga(s, "fr-FR").notes.join().includes("to translate"));
  eq("incompleta non è un errore", "incomplete", s.level);
}

// ------------------------------------------------------- disallineamento col sorgente
console.log("\n== tabelle ferme rispetto al codice di adesso ==");
{
  // Il confronto che dà senso al comando: non fra le tabelle, ma fra le tabelle e il sorgente.
  // Una chiave nuova nel codice e una chiave rimasta indietro sono due lavori diversi.
  const p = progetto();
  p.scrivi("it-IT.yml", p.tabella("it-IT", ['App_a: "ciao"', 'App_vecchia: "sparita dal codice"']));
  const s = p.stato({ App_a: "ciao", App_nuova: "aggiunta ora" });

  eq("una chiave da aggiungere", 1, riga(s, "it-IT").toAdd);
  eq("una chiave da togliere", 1, riga(s, "it-IT").toRemove);
  eq("livello stale", "stale", riga(s, "it-IT").level);
  eq("stale prevale su incomplete nel riepilogo", "stale", s.level);
}

// ------------------------------------------------------- errori veri
console.log("\n== file illeggibile: errore, e prima che il sync lo rigeneri ==");
{
  // Il sync ne farebbe un backup e lo riscriverebbe da zero: le traduzioni che contiene
  // sopravvivono solo nel .bak. Saperlo prima è metà del motivo per cui --status esiste.
  const p = progetto();
  p.scrivi("it-IT.yml", p.tabella("it-IT", ['App_a: "ciao"']));
  p.scrivi("fr-FR.yml", "questa riga non è del formato\n");
  const s = p.stato({ App_a: "ciao" });

  eq("livello error", "error", riga(s, "fr-FR").level);
  eq("il messaggio porta la riga", true, riga(s, "fr-FR").notes.join().includes("line 1"));
  eq("niente conteggi inventati", null, riga(s, "fr-FR").keys);
  eq("l'errore arriva al riepilogo", "error", s.level);
}

console.log("\n== la lingua sorgente deve esserci: senza, il plugin non parte ==");
{
  const p = progetto();
  p.scrivi("fr-FR.yml", p.tabella("fr-FR", ['App_a: "salut"']));
  const s = p.stato({ App_a: "ciao" });

  eq("sorgente segnalata mancante", true, s.sourceMissing);
  eq("ed è un errore", "error", s.level);
}

console.log("\n== i file 3.x non sono lingue: sono una migrazione da fare ==");
{
  const p = progetto();
  p.scrivi("it-IT.yml", p.tabella("it-IT", ['App_a: "ciao"']));
  p.scrivi("ja-JP.js", "export default {}\n");
  const s = p.stato({ App_a: "ciao" });

  eq("non diventa una riga della tabella", 1, s.rows.length);
  eq("finisce fra i legacy", "ja-JP.js", s.legacy.join());
  eq("ed è un errore", "error", s.level);
}

console.log("\n== localeDir che non esiste ancora ==");
{
  const s = collectStatus(
    { localeDir: join(tmpdir(), "vt-status-inesistente-mai-creata"), sourceLanguage: "it-IT", sourceTable: { __builder__: { v: V } } },
    V,
  );
  eq("nessuna riga", 0, s.rows.length);
  eq("è un errore, non un'eccezione", "error", s.level);
  eq("e dice qual è", true, String(s.localeDirError).includes("ENOENT"));
}

// ------------------------------------------------------- avvisi
console.log("\n== avvisi: usabile, ma qualcosa non va ==");
{
  const p = progetto();
  p.scrivi("it-IT.yml", p.tabella("it-IT", ['App_a: "ciao"']));
  // Tag fuori convenzione: la libreria lo sincronizza e lo compila lo stesso, quindi non è un
  // errore — ma è il modo in cui un refuso diventa una lingua, e va detto.
  p.scrivi("en.yml", p.tabella("en", ['App_a: "hi"']));
  // Schema di una versione precedente: il file si legge, ma va rigenerato.
  p.scrivi("fr-FR.yml", '__builder__: {"v":1,"languageName":"x"}\nApp_a: "salut"\n');
  const s = p.stato({ App_a: "ciao" });

  eq("tag fuori convenzione: warning", "warning", riga(s, "en").level);
  eq("e spiega perché", true, riga(s, "en").notes.join().includes("off-convention"));
  eq("schema vecchio: warning", "warning", riga(s, "fr-FR").level);
  eq("e nomina le due versioni", true, riga(s, "fr-FR").notes.join().includes(`expected v${V}`));
}

console.log("\n== file vuoto: lingua nuova in attesa del sync ==");
{
  const p = progetto();
  p.scrivi("it-IT.yml", p.tabella("it-IT", ['App_a: "ciao"']));
  p.scrivi("de-DE.yml", "");
  const s = p.stato({ App_a: "ciao" });

  eq("non è un errore", "stale", riga(s, "de-DE").level);
  eq("dice cosa fare", true, riga(s, "de-DE").notes.join().includes("run the sync"));
}

// ------------------------------------------------------- sola lettura
console.log("\n== non scrive niente: è una fotografia ==");
{
  const p = progetto();
  p.scrivi("it-IT.yml", p.tabella("it-IT", ['App_a: "ciao"']));
  p.scrivi("fr-FR.yml", "");
  p.scrivi("de-DE.yml", "riga rotta\n");
  const prima = readdirSync(p.localeDir).sort();
  const mtimePrima = prima.map((f) => statSync(join(p.localeDir, f)).mtimeMs);

  p.stato({ App_a: "ciao", App_b: "nuova" });

  const dopo = readdirSync(p.localeDir).sort();
  eq("nessun file creato o rimosso", prima.join(), dopo.join());
  eq("nessun file riscritto", mtimePrima.join(), dopo.map((f) => statSync(join(p.localeDir, f)).mtimeMs).join());
  // Il caso che conta davvero: un file illeggibile è esattamente quello che il sync
  // metterebbe da parte con un .bak-corrupted-*. Qui non deve succedere.
  eq("nessun backup", "", dopo.filter((f) => f.includes(".bak-")).join());
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
