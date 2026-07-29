// Lanciatore della suite: gira ogni test in un processo separato e riassume l'esito.
// Ogni test resta autonomo (`node test/list/<nome>.test.mjs` continua a funzionare da solo):
// qui si aggiunge solo la scoperta automatica dei file, il riepilogo e un unico codice di uscita.
//
//   node test/run.mjs                # tutta la suite, una riga per test
//   node test/run.mjs -v             # mostra anche l'output completo dei test che passano
//   node test/run.mjs markup marker  # solo i test il cui nome contiene una di queste parole
//
// Un test e' un file `test/list/*.test.mjs` che esce con 0 se tutto passa. In `test/` restano
// solo il lanciatore e gli strumenti che non fanno parte della suite (exampleLangCompile.mjs,
// browserMarkupParity.mjs): cosi' "cosa gira" e' il contenuto di una cartella, non una lista da
// tenere aggiornata. Le asserzioni vengono contate leggendo le righe "  ok  " / "  KO  "
// stampate dai test: se un test non le stampa il conteggio resta a zero, ma l'esito (il codice
// di uscita) e' comunque corretto.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// I test vivono in test/list; il lanciatore resta in test/ perche' e' il punto di ingresso.
const HERE = join(dirname(fileURLToPath(import.meta.url)), "list");

// Test che dipendono da pacchetti non installati alla radice (react e react-dom sono
// peerDependencies opzionali): si tenta di caricarli prima, e se mancano il test viene saltato
// invece di far fallire tutta la suite su una macchina che non li ha. Sono test come gli
// altri — stesso nome, stessa scoperta automatica — e questa tabella dice solo di cosa hanno
// bisogno per poter girare.
const OPZIONALI = [
  { file: "ssr-check.test.mjs", richiede: ["react-dom/server", "react/jsx-runtime"], come: "npm i -D react react-dom" },
  { file: "translateComponent.test.mjs", richiede: ["react-dom/server", "react"], come: "npm i -D react react-dom" },
  { file: "languageList.test.mjs", richiede: ["react-dom/server", "react"], come: "npm i -D react react-dom" },
];

const argomenti = process.argv.slice(2);
const verboso = argomenti.some((a) => a === "-v" || a === "--verbose");
const filtri = argomenti.filter((a) => !a.startsWith("-"));

const colora = process.stdout.isTTY
  ? (codice, testo) => `\x1b[${codice}m${testo}\x1b[0m`
  : (_codice, testo) => testo;
const verde = (t) => colora(32, t);
const rosso = (t) => colora(31, t);
const giallo = (t) => colora(33, t);
const tenue = (t) => colora(90, t);

// Esegue un file in un processo figlio, restituendo codice di uscita e output raccolto.
// L'output viene sempre catturato (serve per il conteggio e per ristamparlo in caso di KO) e,
// con -v, rimandato a schermo mentre scorre.
const esegui = (file, argv = []) =>
  new Promise((resolve) => {
    const inizio = Date.now();
    const figlio = spawn(process.execPath, [join(HERE, file), ...argv], { cwd: HERE, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const raccogli = (flusso, destinazione) => {
      flusso.setEncoding("utf8");
      flusso.on("data", (pezzo) => {
        output += pezzo;
        if (verboso) destinazione.write(pezzo);
      });
    };
    raccogli(figlio.stdout, process.stdout);
    raccogli(figlio.stderr, process.stderr);
    figlio.on("error", (errore) => resolve({ codice: 1, output: `${output}${errore.stack}\n`, ms: Date.now() - inizio }));
    figlio.on("close", (codice) => resolve({ codice: codice ?? 1, output, ms: Date.now() - inizio }));
  });

// Verifica che i moduli richiesti si risolvano davvero: `import.meta.resolve` non basta, perche'
// puo' pescare un pacchetto rimasto in un node_modules di una cartella genitore che poi non si
// carica. L'unica prova affidabile e' importarli sul serio, in un processo usa e getta.
const disponibili = async (specificatori) => {
  const codice = specificatori.map((s) => `await import(${JSON.stringify(s)});`).join("");
  const figlio = spawn(process.execPath, ["--input-type=module", "-e", codice], { cwd: HERE, stdio: "ignore" });
  return new Promise((resolve) => {
    figlio.on("error", () => resolve(false));
    figlio.on("close", (uscita) => resolve(uscita === 0));
  });
};

const conta = (output, marcatore) => output.split("\n").filter((riga) => riga.startsWith(marcatore)).length;
const secondi = (ms) => `${(ms / 1000).toFixed(2)}s`;

// Un solo criterio: il nome. Gli opzionali erano elencati a parte perché si chiamavano
// diversamente, e finché è stato così un test dimenticato in quella lista non sarebbe girato
// mai, senza che nulla lo dicesse.
const tutti = readdirSync(HERE).filter((f) => f.endsWith(".test.mjs")).sort();
const daGirare = filtri.length ? tutti.filter((f) => filtri.some((p) => f.toLowerCase().includes(p.toLowerCase()))) : tutti;

if (!daGirare.length) {
  console.log(rosso(`nessun test corrisponde a: ${filtri.join(", ")}`));
  console.log(tenue(`disponibili: ${tutti.join(", ")}`));
  process.exit(1);
}

const nome = (file) => file.replace(/\.(test\.)?mjs$/, "");
const larghezza = Math.max(...daGirare.map((f) => nome(f).length));

const esiti = [];
for (const file of daGirare) {
  const opzionale = OPZIONALI.find((o) => o.file === file);
  if (opzionale && !(await disponibili(opzionale.richiede))) {
    console.log(`${giallo("−")} ${nome(file).padEnd(larghezza)}  ${tenue(`saltato: manca ${opzionale.richiede[0]} (${opzionale.come})`)}`);
    esiti.push({ file, stato: "saltato" });
    continue;
  }
  if (verboso) console.log(tenue(`\n─── ${file} ${"─".repeat(Math.max(0, 60 - file.length))}`));
  const { codice, output, ms } = await esegui(file);
  const ok = conta(output, "  ok  ");
  const ko = conta(output, "  KO  ");
  const passato = codice === 0;
  const dettaglio = ok + ko ? `${ok + ko} asserzioni` : "nessuna asserzione contata";
  console.log(
    `${passato ? verde("✓") : rosso("✗")} ${nome(file).padEnd(larghezza)}  ${tenue(dettaglio.padEnd(22))}${tenue(secondi(ms))}` +
      (passato ? "" : rosso(`  ${ko ? `${ko} KO` : `uscita ${codice}`}`)),
  );
  esiti.push({ file, stato: passato ? "passato" : "fallito", ok, ko, output });
}

// L'output di un test fallito si ristampa per intero solo qui in fondo: cosi' le righe di
// riepilogo restano leggibili anche quando a rompersi sono piu' test insieme.
const falliti = esiti.filter((e) => e.stato === "fallito");
if (falliti.length && !verboso) {
  for (const e of falliti) {
    console.log(rosso(`\n─── ${e.file} ${"─".repeat(Math.max(0, 60 - e.file.length))}`));
    console.log(e.output.trimEnd());
  }
}

const passati = esiti.filter((e) => e.stato === "passato").length;
const saltati = esiti.filter((e) => e.stato === "saltato").length;
const asserzioni = esiti.reduce((somma, e) => somma + (e.ok ?? 0) + (e.ko ?? 0), 0);

const riepilogo = [
  `${passati}/${passati + falliti.length} test`,
  `${asserzioni} asserzioni`,
  ...(saltati ? [`${saltati} saltat${saltati === 1 ? "o" : "i"}`] : []),
];
const disfatta = `${falliti.length} TEST FALLIT${falliti.length === 1 ? "O" : "I"}`;
console.log(falliti.length ? rosso(`\n${disfatta}  ${tenue(riepilogo.join(" · "))}`) : verde(`\nTUTTI OK  ${tenue(riepilogo.join(" · "))}`));
process.exit(falliti.length ? 1 : 0);
