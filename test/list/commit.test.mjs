// Il lanciatore dei controlli di `npm run commit` (test/commit.mjs): scoperta, ordine, fix, tabella,
// codice di uscita, l'elenco dei file riscritti, gli argomenti e la stima del tempo che manca.
//
// Perché è un test: è il cancello del commit. Se un controllo che crasha venisse contato come "ok", o se un
// KO non cambiasse il codice di uscita, il commit partirebbe con un manuale o un README fuori posto. Gira su
// una cartella finta di controlli (il lanciatore la prende come parametro). Il commit e il push veri non si
// provano qui: toccherebbero il repo.
//
//   node test/list/commit.test.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { barra, confronta, formatta, instantanea, lancia, leggiArgomenti, scopri, stima } from "../../test/commit.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(64), ok ? "" : `-> ${JSON.stringify(ottenuto)} (atteso ${JSON.stringify(atteso)})`);
};

const tmp = mkdtempSync(join(tmpdir(), "vt-release-"));
const controllo = (file, nome, corpo) => writeFileSync(join(tmp, file), `export const name = ${JSON.stringify(nome)};\nexport async function run() { ${corpo} }\n`);
try {
  // ------------------------------------------------------- scoperta e ordine
  console.log("\n== scoperta ==");
  controllo("20-ok.check.mjs", "beta", 'return { level: "ok", lines: [] };');
  controllo("10-warn.check.mjs", "alfa", 'return { level: "warn", lines: ["un avviso", "dettaglio"] };');
  writeFileSync(join(tmp, "altro.mjs"), "export {};\n");
  writeFileSync(join(tmp, "note.md"), "x\n");
  eq("scopri: solo *.check.mjs, in ordine di nome", ["10-warn.check.mjs", "20-ok.check.mjs"], scopri(tmp));

  let r = await lancia(tmp);
  eq("lancia: un ok e un warn → uscita 0", [0, ["alfa", "beta"], ["warn", "ok"]], [r.code, r.results.map((x) => x.name), r.results.map((x) => x.level)]);
  eq("lancia: porta le righe del controllo", ["un avviso", "dettaglio"], r.results[0].lines);

  // ------------------------------------------------------- KO, crash, esito non valido
  console.log("\n== KO e crash ==");
  controllo("30-ko.check.mjs", "gamma", 'return { level: "ko", lines: ["rotto"] };');
  r = await lancia(tmp);
  eq("un KO → uscita 1", 1, r.code);
  controllo("30-ko.check.mjs", "gamma", 'throw new Error("boom");');
  r = await lancia(tmp);
  eq("un controllo che lancia è un KO, non un ok", ["ko", 1], [r.results.find((x) => x.name === "gamma").level, r.code]);
  eq("…e dice che è andato in crash, con il messaggio", true, r.results.find((x) => x.name === "gamma").lines[0].includes("crashed") && r.results.find((x) => x.name === "gamma").lines[0].includes("boom"));
  controllo("30-ko.check.mjs", "gamma", 'return { level: "forse", lines: [] };');
  r = await lancia(tmp);
  eq("un level che non è ok|warn|ko è un KO", "ko", r.results.find((x) => x.name === "gamma").level);
  writeFileSync(join(tmp, "30-ko.check.mjs"), "export const name = 'rotto'; export async function run( {\n");
  r = await lancia(tmp);
  eq("un controllo che non si carica è un KO", ["ko", 1], [r.results.find((x) => x.file === "30-ko.check.mjs").level, r.code]);
  rmSync(join(tmp, "30-ko.check.mjs"));

  // ------------------------------------------------------- --only
  console.log("\n== --only ==");
  r = await lancia(tmp, { only: "ALF" });
  eq("only: filtra per nome, senza badare alle maiuscole", ["alfa"], r.results.map((x) => x.name));
  r = await lancia(tmp, { only: "nessuno" });
  eq("only: nessun controllo corrisponde", [], r.results);

  // ------------------------------------------------------- la tabella
  console.log("\n== tabella ==");
  r = await lancia(tmp);
  const testo = formatta(r.results);
  eq("tabella: una riga per controllo, con esito, nome e prima riga", true, /^WARN\s+alfa\s+un avviso/m.test(testo) && /^OK\s+beta/m.test(testo));
  eq("tabella: le righe di un controllo non ok vengono dopo", true, testo.includes("── alfa") && testo.includes("dettaglio"));
  eq("tabella: nessuna riga compare due volte (la prima sta solo nella tabella)", 1, testo.split("un avviso").length - 1);
  eq("tabella: un controllo ok non ripete le sue righe", false, testo.includes("── beta"));
  eq("lo URL del modulo è file: (il lanciatore importa per URL)", true, pathToFileURL(join(tmp, "20-ok.check.mjs")).href.startsWith("file:"));

  // ------------------------------------------------------- fix
  console.log("\n== fix ==");
  // "alfa" (10) controlla un file che solo il fix di "delta" (40) scrive: passa se i fix girano tutti prima.
  const segno = join(tmp, "segno.txt").split("\\").join("/");
  controllo("10-warn.check.mjs", "alfa", `const { existsSync } = await import("node:fs"); return { level: existsSync(${JSON.stringify(segno)}) ? "ok" : "ko", lines: [] };`);
  writeFileSync(join(tmp, "40-fix.check.mjs"), [
    'export const name = "delta";',
    `export async function fix() { (await import("node:fs")).writeFileSync(${JSON.stringify(segno)}, "x"); return ["segno scritto"]; }`,
    'export async function run() { return { level: "ok", lines: [] }; }',
    "",
  ].join("\n"));
  r = await lancia(tmp);
  eq("senza fix: niente viene rigenerato", "ko", r.results.find((x) => x.name === "alfa").level);
  const riferiti = [];
  r = await lancia(tmp, { fix: true, onFix: (nome, righe) => riferiti.push([nome, righe]) });
  eq("con fix: tutti i fix prima di ogni run", ["ok", 0], [r.results.find((x) => x.name === "alfa").level, r.code]);
  eq("onFix riceve nome e righe, solo per chi ha un fix", [["delta", ["segno scritto"]]], riferiti);
  r = await lancia(tmp, { fix: true, only: "alfa" });
  eq("only vale anche per i fix", 0, riferiti.length - 1);
  writeFileSync(join(tmp, "40-fix.check.mjs"), 'export const name = "delta";\nexport async function fix() { throw new Error("pum"); }\nexport async function run() { return { level: "ok", lines: [] }; }\n');
  r = await lancia(tmp, { fix: true });
  const delta = r.results.find((x) => x.name === "delta");
  eq("un fix che lancia è un KO del suo controllo", ["ko", 1], [delta.level, r.code]);
  eq("…e dice che è il fix ad essere andato in crash", true, delta.lines[0].startsWith("the fix crashed") && delta.lines[0].includes("pum"));
  rmSync(join(tmp, "40-fix.check.mjs"));

  // ------------------------------------------------------- file riscritti
  console.log("\n== file riscritti ==");
  const repo = join(tmp, "repo");
  mkdirSync(join(repo, "sub"), { recursive: true });
  const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.autocrlf=false", ...args], { cwd: repo, encoding: "utf8" });
  git("init", "-q");
  writeFileSync(join(repo, "a.txt"), "a\n");
  writeFileSync(join(repo, "b.txt"), "b\n");
  git("add", ".");
  git("commit", "-q", "-m", "x");
  writeFileSync(join(repo, "b.txt"), "b già cambiato\n");
  const primaFoto = instantanea(repo);
  eq("instantanea: i file che git vede cambiati", ["b.txt"], [...primaFoto.keys()]);
  writeFileSync(join(repo, "a.txt"), "a riscritto\n");
  writeFileSync(join(repo, "sub/nuovo.txt"), "n\n");
  const c = confronta(primaFoto, instantanea(repo));
  eq("confronta: riscritti dal giro, non quelli già cambiati prima", ["a.txt", "sub/nuovo.txt"], c.riscritti);
  eq("confronta: i non tracciati, uno per file", ["sub/nuovo.txt"], c.nonTracciati);
  writeFileSync(join(repo, "b.txt"), "b\n");
  eq("confronta: un file tornato come nel commit è riscritto anche lui", true, confronta(primaFoto, instantanea(repo)).riscritti.includes("b.txt"));

  // ------------------------------------------------------- progress
  console.log("\n== progress ==");
  writeFileSync(join(tmp, "50-passi.check.mjs"), 'export const name = "passi";\nexport async function run({ progress }) { progress(0.5); progress(1); return { level: "ok", lines: [] }; }\n');
  const frazioni = [];
  await lancia(tmp, { only: "passi", onProgress: (nome, f) => frazioni.push([nome, f]) });
  eq("progress arriva a onProgress col nome del controllo", [["passi", 0.5], ["passi", 1]], frazioni);
  rmSync(join(tmp, "50-passi.check.mjs"));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ------------------------------------------------------- argomenti
console.log("\n== argomenti ==");
{
  eq("il testo del commit, tra virgolette", "Update messaggistica", leggiArgomenti(["Update messaggistica"]).messaggio);
  eq("…o senza: le parole si uniscono", "Update messaggistica", leggiArgomenti(["Update", "messaggistica"]).messaggio);
  eq("senza testo e senza --dry-run: si ferma prima di tutto", true, /no commit message/.test(leggiArgomenti([]).errore));
  eq("--dry-run non chiede un testo", [undefined, true], [leggiArgomenti(["--dry-run"]).errore, leggiArgomenti(["--dry-run"]).dryRun]);
  eq("--dry-run tenuto da npm (npm_config_dry_run) vale lo stesso", true, leggiArgomenti([], { npm_config_dry_run: "true" }).dryRun);
  const o = leggiArgomenti(["--dry-run", "--only", "docs"]);
  eq("--only prende la parola dopo, che non finisce nel testo", ["docs", ""], [o.only, o.messaggio]);
  eq("--only senza parola è un errore", true, /--only wants a word/.test(leggiArgomenti(["--dry-run", "--only"]).errore));
  eq("--only con un commit vero: no, un commit fa tutti i controlli", true, /go with --dry-run/.test(leggiArgomenti(["msg", "--only", "docs"]).errore));
  eq("--check con un commit vero: no", true, /go with --dry-run/.test(leggiArgomenti(["msg", "--check"]).errore));
}

// ------------------------------------------------------- stima e barra
console.log("\n== stima e barra ==");
{
  const passi = ["a", "b", "c"];
  const tempi = { a: 10, b: 20, c: 10 };
  eq("all'inizio: 0 %, manca tutto", { frazione: 0, mancanoS: 40 }, stima({ passi, tempi, corrente: 0, trascorsoMs: 0 }));
  eq("a metà del secondo passo, a tempo", { frazione: 0.5, mancanoS: 20 }, stima({ passi, tempi, corrente: 1, trascorsoMs: 10000 }));
  eq("la frazione dichiarata vince sul tempo", { frazione: 0.625, mancanoS: 15 }, stima({ passi, tempi, corrente: 1, trascorsoMs: 0, frazione: 0.75 }));
  const lento = stima({ passi, tempi, corrente: 0, trascorsoMs: 60000 });
  eq("un passo più lento del previsto si ferma al 95 %, non va oltre", [true, true], [lento.frazione < 0.25, lento.mancanoS > 30]);
  eq("un passo senza tempo vale 1 s", { frazione: 0, mancanoS: 41 }, stima({ passi: [...passi, "nuovo"], tempi, corrente: 0, trascorsoMs: 0 }));
  eq("a lavoro finito: 100 %, 0 s", { frazione: 1, mancanoS: 0 }, stima({ passi, tempi, corrente: 3, trascorsoMs: 0 }));
  eq("barra: pieni e vuoti in proporzione, percentuale, secondi", "[█████░░░░░]  50 %  ~20 s left", barra(0.5, 20, 10));
  eq("barra: mai oltre la larghezza", "[██████████] 100 %  ~0 s left", barra(1.2, 0, 10));
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
