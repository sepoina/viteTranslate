// `--rewriteMarker` e `--rewriteMarkerDryRun` (4.7.0): la riscrittura dei marcatori nei sorgenti, da
// quelli ora scritti a quelli di vite.config. Prima `planRewrite` (pura, un file in e uno out), poi il
// comando vero, dalla riga di comando, su progetti temporanei: le cinque righe della tabella "Quando
// vale", la divergenza delle chiavi, il file bloccante, il rilancio e la scrittura interrotta.
//
//   node test/list/rewriteMarkers.test.mjs
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, chmodSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { planRewrite } from "../../lib/dev/vite/uty/rewriteMarkers.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", ok ? "" : `${JSON.stringify(ottenuto)} (atteso ${JSON.stringify(atteso)})`);
};

const DI_SERIE = { start: "_%_", end: "_%_" };
const FRECCE = { start: "≼", end: "≽" };

// --------------------------------------------------------------------- planRewrite
console.log("\n== planRewrite: i casi del piano (Appendice B.3) ==");
{
  const prova = (nome, ingresso, atteso, count, from = DI_SERIE, to = FRECCE) => {
    const r = planRewrite(ingresso, "/p/src/App.jsx", from, to);
    eq(`${nome}: codice`, atteso, r.code);
    eq(`${nome}: count`, count, r.count);
  };
  prova("stringhe con apostrofo escapato",
    `const a = "_%_Ciao_%_"; const b = '_%_l\\'app_%_';`,
    `const a = "≼Ciao≽"; const b = '≼l\\'app≽';`, 2);
  prova("template con e senza valori",
    "const t = `_%_Ciao ${nome}, ${n} msg_%_`; const u = `_%_solo_%_`;",
    "const t = `≼Ciao ${nome}, ${n} msg≽`; const u = `≼solo≽`;", 2);
  prova("attributo e frase spezzata, CRLF conservato",
    `const a = <p title="_%_Titolo_%_">  _%_hi <b>x</b>_%_\r\n  </p>;`,
    `const a = <p title="≼Titolo≽">  ≼hi <b>x</b>≽\r\n  </p>;`, 2);
  prova("<Trans> con il marcatore dentro", `const a = <Trans>_%_Benvenuto_%_</Trans>;`, `const a = <Trans>≼Benvenuto≽</Trans>;`, 1);
  prova("{\"…\"} riscritto, la frase che non comincia col delimitatore no",
    `const a = <p>{"_%_espr_%_"} e _%_frase {v} spezzata_%_</p>;`,
    `const a = <p>{"≼espr≽"} e _%_frase {v} spezzata_%_</p>;`, 1);
  prova("commento, import e stringa con _%_ in mezzo restano",
    `// "_%_commento_%_"\nimport x from "_%_mod_%_";\nconst a = "non _%_ marcato";`,
    `// "_%_commento_%_"\nimport x from "_%_mod_%_";\nconst a = "non _%_ marcato";`, 0);
  prova("apertura senza chiusura: resta malformata, stesse chiavi",
    `const a = <><b>x</b>_%_dimenticato</>;`, `const a = <><b>x</b>≼dimenticato</>;`, 0);
  prova("tupla con %s", `const a = ts(["_%_Ciao %s_%_", nome]);`, `const a = ts(["≼Ciao %s≽", nome]);`, 1);
  prova("ritorno ≼…≽ → _%_…_%_",
    `const a = "≼Ciao≽"; const b = <p>≼hi <b>x</b>≽</p>;`,
    `const a = "_%_Ciao_%_"; const b = <p>_%_hi <b>x</b>_%_</p>;`, 2, FRECCE, DI_SERIE);
  prova("passaggio a un delimitatore unico",
    `const a = <p>_%_hi <b>x</b>_%_</p>;`, `const a = <p>§hi <b>x</b>§</p>;`, 1, DI_SERIE, { start: "§", end: "§" });
  prova("da § a ≼≽ (fra personalizzati)", `const a = "§Ciao§";`, `const a = "≼Ciao≽";`, 1, { start: "§", end: "§" }, FRECCE);
  prova("un codice senza marcatori: invariato", `const a = "ciao";`, `const a = "ciao";`, 0);
}

// --------------------------------------------------------------------- il comando
const HERE = dirname(fileURLToPath(import.meta.url));
const RADICE_REPO = resolve(HERE, "../..");
const CLI = join(RADICE_REPO, "lib/dev/vite/cli.js");
const PLUGIN = pathToFileURL(join(RADICE_REPO, "lib/index.js")).href;
const temporanee = [];

/** Un progetto temporaneo: `file` = { "src/A.jsx": "..." }, `opzioni` = il testo delle opzioni del plugin. */
function progetto(file, opzioni = "", srcDir = "src") {
  const radice = mkdtempSync(join(tmpdir(), "vt-rewrite-"));
  temporanee.push(radice);
  mkdirSync(join(radice, "node_modules"));
  writeFileSync(join(radice, "package.json"), '{ "type": "module" }');
  for (const [rel, testo] of Object.entries(file)) {
    mkdirSync(dirname(join(radice, rel)), { recursive: true });
    writeFileSync(join(radice, rel), testo);
  }
  configura(radice, opzioni, srcDir);
  return radice;
}

function configura(radice, opzioni, srcDir = "src") {
  writeFileSync(join(radice, "vite.config.mjs"),
    `import { vitetranslate } from ${JSON.stringify(PLUGIN)};\n` +
    `export default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT", srcDir: ${JSON.stringify(srcDir)}${opzioni ? `, ${opzioni}` : ""} })] };\n`);
}

const lancia = (radice, argv = []) => {
  const esito = spawnSync(process.execPath, [CLI, "--simpleLog", ...argv], { cwd: radice, encoding: "utf8" });
  // L'output senza colori né colonna del log, con gli a-capo e gli spazi ridotti a uno: le frasi lunghe
  // vanno a capo dove capita, e un test non deve dipendere da dove.
  const uscita = ((esito.stdout ?? "") + (esito.stderr ?? "")).replace(/\x1b\[[0-9;]*m/g, "").replace(/^:::/gm, "").replace(/\s+/g, " ");
  return { ...esito, uscita };
};
const leggi = (radice, rel) => readFileSync(join(radice, rel), "utf8");
const chiaviDi = (radice) => {
  const t = leggi(radice, "locale/it-IT.yml");
  return t.split(/\r?\n/).filter((r) => /^[A-Za-z0-9_]+:/.test(r)).map((r) => r.split(":")[0]).sort();
};
const SERIE = `export const a = "_%_Ciao_%_";\nexport const b = <p title="_%_Titolo_%_">_%_hi <b>x</b>_%_</p>;\n`;

console.log("\n== tabella \"Quando vale\", riga 1: setup personalizzato, nessun argomento (_%_ → ≼≽) ==");
{
  const radice = progetto({ "src/A.jsx": SERIE, "src/B.jsx": `export const c = "_%_Altro_%_";\n` });
  // Prima, con i delimitatori di serie: le chiavi che la sync scrive.
  eq("sync con i delimitatori di serie: esce 0", 0, lancia(radice).status);
  const chiavi = chiaviDi(radice);
  eq("…tre chiavi in tutto", 4, chiavi.length);
  const A0 = leggi(radice, "src/A.jsx");

  // Il setup passa a ≼≽.
  configura(radice, `markerStart: "≼", markerEnd: "≽"`);
  const secco = lancia(radice, ["--rewriteMarkerDryRun"]);
  eq("dry run: esce 0", 0, secco.status);
  eq("…non scrive niente", A0, leggi(radice, "src/A.jsx"));
  eq("…mostra before e after", true, /before 4 keys/.test(secco.uscita) && /after 4 keys/.test(secco.uscita));
  eq("…dice che è una prova", true, secco.uscita.includes("(dry run)"));
  eq("…e che le chiavi sono le stesse", true, secco.uscita.includes("same keys, same status"));

  const vero = lancia(radice, ["--rewriteMarker"]);
  eq("rewrite: esce 0", 0, vero.status);
  const A1 = leggi(radice, "src/A.jsx");
  eq("A.jsx riscritto", `export const a = "≼Ciao≽";\nexport const b = <p title="≼Titolo≽">≼hi <b>x</b>≽</p>;\n`, A1);
  eq("B.jsx riscritto", `export const c = "≼Altro≽";\n`, leggi(radice, "src/B.jsx"));
  const yml0 = leggi(radice, "locale/it-IT.yml");
  eq("la sync successiva esce 0", 0, lancia(radice).status);
  eq("…le stesse chiavi di prima", chiavi, chiaviDi(radice));
  eq("…e il file di lingua sorgente invariato", yml0, leggi(radice, "locale/it-IT.yml"));
  const stato = lancia(radice, ["--status"]);
  eq("--status: esce 0", 0, stato.status);
  eq("--status: nessun avviso old-marker", false, /old marker/.test(stato.uscita));
  // Rilanciato: i file non contengono più i marcatori di partenza.
  const ancora = lancia(radice, ["--rewriteMarker"]);
  eq("rilanciato: esce 0, nessun file da cambiare", true, ancora.status === 0 && /0 to change/.test(ancora.uscita));
}

console.log("\n== riga 2: setup personalizzato, un argomento (§ → ≼≽) ==");
{
  const radice = progetto({ "src/A.jsx": `export const a = "§Ciao§";\nexport const b = <p>§hi <b>x</b>§</p>;\n` },
    `markerStart: "≼", markerEnd: "≽"`);
  const r = lancia(radice, ["--rewriteMarker", "§"]);
  eq("esce 0", 0, r.status);
  eq("riscritto", `export const a = "≼Ciao≽";\nexport const b = <p>≼hi <b>x</b>≽</p>;\n`, leggi(radice, "src/A.jsx"));
}

console.log("\n== riga 3: setup personalizzato, argomenti uguali al setup: inefficace, nessun file letto ==");
{
  const radice = progetto({}, `markerStart: "≼", markerEnd: "≽"`, "inesistente");
  const r = lancia(radice, ["--rewriteMarker", "≼", "≽"]);
  eq("esce 1", 1, r.status);
  eq("nothing to rewrite, variante 1", true, /nothing to rewrite: "≼…≽" are already the markers in vite\.config/.test(r.uscita));
  eq("…senza leggere srcDir (che non esiste)", false, /cannot read srcDir/.test(r.uscita));
}

console.log("\n== riga 4: setup di serie, nessun argomento: inefficace, nessun file letto ==");
{
  const radice = progetto({}, "", "inesistente");
  const r = lancia(radice, ["--rewriteMarker"]);
  eq("esce 1", 1, r.status);
  eq("nothing to rewrite, variante 2 (spiega come rientrare)", true, /nothing to rewrite: vite\.config uses the default markers/.test(r.uscita) && r.uscita.includes('--rewriteMarker "≼" "≽"'));
  eq("…senza leggere srcDir", false, /cannot read srcDir/.test(r.uscita));
  const d = lancia(radice, ["--rewriteMarkerDryRun"]);
  eq("anche il dry run: esce 1", 1, d.status);
}

console.log("\n== riga 5: setup di serie, argomenti ≼ ≽: il rientro (≼≽ → _%_) ==");
{
  const radice = progetto({ "src/A.jsx": `export const a = "≼Ciao≽";\nexport const b = <p>≼hi <b>x</b>≽</p>;\n` });
  const r = lancia(radice, ["--rewriteMarker", "≼", "≽"]);
  eq("esce 0", 0, r.status);
  eq("riscritto ai delimitatori di serie", `export const a = "_%_Ciao_%_";\nexport const b = <p>_%_hi <b>x</b>_%_</p>;\n`, leggi(radice, "src/A.jsx"));
}

console.log("\n== divergenza: la macro il cui testo contiene il delimitatore nuovo ==");
{
  // Una macro senza marcatori, il cui testo contiene `≼`: con `_%_` si estrae, con `≼≽` è rifiutata
  // (un delimitatore in mezzo alla frase). Nota: `<Trans>_%_ciao ≼x_%_</Trans>` NON diverge, perché un testo
  // solo avvolto per intero passa dalla via di sempre (avviso nested, ma la chiave c'è).
  const macro = `import { Trans } from "@sepoina/vitetranslate/react";\nexport const m = <Trans>ciao ≼ mondo {x}</Trans>;\n`;
  const pulito = `export const p = "_%_Pulito_%_";\n`;
  const radice = progetto({ "src/A.jsx": macro, "src/B.jsx": pulito }, `markerStart: "≼", markerEnd: "≽"`);
  const secco = lancia(radice, ["--rewriteMarkerDryRun"]);
  eq("dry run: esce 1", 1, secco.status);
  eq("…avviso di divergenza, senza \"Nothing was written\"", true, /would change what gets translated: 1 key\(s\) differ/.test(secco.uscita) && !/Nothing was written/.test(secco.uscita));
  eq("…la chiave elencata col suo file", true, /src\/A\.jsx:2:\d+/.test(secco.uscita));
  const vero = lancia(radice, ["--rewriteMarker"]);
  eq("rewrite: esce 1", 1, vero.status);
  eq("…\"Nothing was written\"", true, /Nothing was written/.test(vero.uscita));
  eq("…A.jsx intatto", macro, leggi(radice, "src/A.jsx"));
  eq("…e anche B.jsx, che non aveva problemi", pulito, leggi(radice, "src/B.jsx"));
}

console.log("\n== file bloccante: coi marcatori di partenza e un errore di sintassi ==");
{
  const rotto = `export const x = "_%_Ciao_%_";\nconst = ;\n`;
  const buono = `export const p = "_%_Pulito_%_";\n`;
  const radice = progetto({ "src/Rotto.jsx": rotto, "src/Buono.jsx": buono }, `markerStart: "≼", markerEnd: "≽"`);
  const r = lancia(radice, ["--rewriteMarker"]);
  eq("esce 1", 1, r.status);
  eq("…il file è elencato", true, /could not be parsed/.test(r.uscita) && r.uscita.includes("src/Rotto.jsx"));
  eq("…niente scritto, nemmeno nel file buono", buono, leggi(radice, "src/Buono.jsx"));
  eq("…né nel rotto", rotto, leggi(radice, "src/Rotto.jsx"));
}

console.log("\n== un file rotto SENZA i marcatori di partenza non blocca ==");
{
  const radice = progetto({ "src/Rotto.jsx": `const = ;\n`, "src/Buono.jsx": `export const p = "_%_Pulito_%_";\n` }, `markerStart: "≼", markerEnd: "≽"`);
  const r = lancia(radice, ["--rewriteMarker"]);
  eq("esce 0", 0, r.status);
  eq("…il buono è riscritto", `export const p = "≼Pulito≽";\n`, leggi(radice, "src/Buono.jsx"));
}

console.log("\n== rilancio: un file già riscritto a mano, il comando finisce il secondo ==");
{
  const radice = progetto({
    "src/A.jsx": `export const a = "≼Ciao≽";\n`,
    "src/B.jsx": `export const b = "_%_Altro_%_";\n`,
  }, `markerStart: "≼", markerEnd: "≽"`);
  const r = lancia(radice, ["--rewriteMarker"]);
  eq("esce 0", 0, r.status);
  eq("A invariato", `export const a = "≼Ciao≽";\n`, leggi(radice, "src/A.jsx"));
  eq("B completato", `export const b = "≼Altro≽";\n`, leggi(radice, "src/B.jsx"));
}

console.log("\n== scrittura interrotta (file in sola lettura): si riprende al rilancio ==");
{
  const radice = progetto({
    "src/A.jsx": `export const a = "_%_Ciao_%_";\n`,
    "src/B.jsx": `export const b = "_%_Altro_%_";\n`,
  }, `markerStart: "≼", markerEnd: "≽"`);
  const pathB = join(radice, "src/B.jsx");
  chiudiInScrittura(pathB);
  let scrivibile = true;
  try { writeFileSync(pathB, leggi(radice, "src/B.jsx")); } catch { scrivibile = false; }
  if (!scrivibile) {
    const r = lancia(radice, ["--rewriteMarker"]);
    eq("esce 1", 1, r.status);
    eq("…dice dove si è fermato e quanti file sì e no", true, /writing stopped at "src\/B\.jsx"/.test(r.uscita) && /1 file was rewritten, 1 was not/.test(r.uscita));
    eq("…A è riscritto", `export const a = "≼Ciao≽";\n`, leggi(radice, "src/A.jsx"));
    eq("…B no", `export const b = "_%_Altro_%_";\n`, leggi(radice, "src/B.jsx"));
    eq("…e dice di rilanciare", true, /run the same command again/.test(r.uscita));
    chmodSync(pathB, 0o666);
    const ancora = lancia(radice, ["--rewriteMarker"]);
    eq("rilanciato, tolta la sola lettura: esce 0", 0, ancora.status);
    eq("…B finito", `export const b = "≼Altro≽";\n`, leggi(radice, "src/B.jsx"));
  } else {
    console.log("  --   sola lettura non applicata su questa macchina (root?): saltato");
  }
}

function chiudiInScrittura(p) {
  chmodSync(p, 0o444);
}

console.log("\n== argomenti ==");
{
  const radice = progetto({ "src/A.jsx": `export const a = "_%_Ciao_%_";\n` }, `markerStart: "≼", markerEnd: "≽"`);
  const tre = lancia(radice, ["--rewriteMarker", "a", "b", "c"]);
  eq("tre argomenti: errore", true, tre.status === 1 && /at most two markers/.test(tre.uscita));
  const nonValido = lancia(radice, ["--rewriteMarker", "a b"]);
  eq("argomento non valido: errore di markerProblem", true, nonValido.status === 1 && /whitespace/.test(nonValido.uscita));
  const sovrapposti = lancia(radice, ["--rewriteMarker", "§", "§§"]);
  eq("argomenti che si contengono: errore", true, sovrapposti.status === 1 && /overlap/.test(sovrapposti.uscita));
  const conStatus = lancia(radice, ["--rewriteMarker", "--status"]);
  eq("con --status: errore", true, conStatus.status === 1 && /cannot be combined/.test(conStatus.uscita));
  const conAdd = lancia(radice, ["--rewriteMarker", "--add", "en-US"]);
  eq("con --add: errore", true, conAdd.status === 1 && /cannot be combined/.test(conAdd.uscita));
  const conFast = lancia(radice, ["--rewriteMarker", "--fastverify"]);
  eq("con --fastverify: errore", true, conFast.status === 1 && /cannot be combined/.test(conFast.uscita));
  const conLlm = lancia(radice, ["--rewriteMarker", "--llm-status"]);
  eq("con un flag llm: errore", true, conLlm.status === 1 && /cannot be combined/.test(conLlm.uscita));
  const due = lancia(radice, ["--rewriteMarker", "--rewriteMarkerDryRun"]);
  eq("i due flag insieme: errore", true, due.status === 1 && /cannot be used together/.test(due.uscita));
  const maiuscole = lancia(radice, ["--REWRITEMARKERDRYRUN"]);
  eq("senza badare alle maiuscole", true, maiuscole.status === 0 && maiuscole.uscita.includes("(dry run)"));
  eq("nessuno di questi ha scritto", `export const a = "_%_Ciao_%_";\n`, leggi(radice, "src/A.jsx"));
  eq("--help presenta i due flag", true, /--rewriteMarker \[start\] \[end\]/.test(lancia(radice, ["--help"]).uscita));
}

// Pulizia: la sola lettura su Windows impedisce anche la cancellazione.
for (const d of temporanee) {
  try {
    for (const f of readdirSync(join(d, "src"), { recursive: true })) {
      try { chmodSync(join(d, "src", f), 0o666); } catch { /* una cartella */ }
    }
  } catch { /* nessun src */ }
  rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
