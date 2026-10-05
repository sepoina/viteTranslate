// Estensione per l'editor (idePlugin): il runner dei task del CLI (cliRunner.mjs). Dopo il CLI:
// riuscito, il conto alla rovescia (Invio tiene aperto il terminale, un altro tasto o il tempo lo
// chiudono); fallito, si aspetta un tasto. Poi il runner vero, lanciato su uno script al posto del
// CLI: l'output passa, e il codice d'uscita è quello dello script.
//
//   node test/list/idePluginCliRunner.test.mjs
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterCli, SECONDS } from "../../idePlugin/src/core/cliRunner.mjs";
import { cliHeader, npxLine } from "../../idePlugin/src/core/cliHeader.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// Un terminale finto: stdin che riceve i tasti (e ricorda il raw mode), stdout che accumula.
function terminale() {
  const stdin = Object.assign(new EventEmitter(), { isTTY: true, raw: [], resume() {}, pause() {} });
  stdin.setRawMode = (b) => stdin.raw.push(b);
  const stdout = { testo: "", write(s) { this.testo += s; } };
  return { stdin, stdout, premi: (k) => stdin.emit("data", Buffer.from(k)) };
}
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
const pulito = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").replace(/\r/g, "");

console.log("\n== afterCli ==");
{
  eq("10 secondi", 10, SECONDS);
  const t = terminale();
  const esito = await afterCli({ code: 0, ...t, seconds: 3, tick: 15 });
  eq("nessun tasto: si chiude allo scadere", "timeout", esito);
  eq("…la frase, e il conto che scende", [true, true, true],
    [pulito(t.stdout.testo).includes("Press Enter within 3s to keep the terminal open, any other key to close it now."), t.stdout.testo.includes("\r\x1b[2K\x1b[2mClosing in 2s…"), t.stdout.testo.includes("Closing in 1s…")]);
  eq("…e il raw mode tolto", [true, false], t.stdin.raw);
  eq("…nessun ascoltatore lasciato", [0, 0], [t.stdin.listenerCount("data"), t.stdin.listenerCount("end")]);
}
{
  const t = terminale();
  const p = afterCli({ code: 0, ...t, seconds: 10, tick: 1000 });
  await attesa(20);
  t.premi("x");
  eq("un altro tasto: chiude subito", "key", await p);
}
{
  const t = terminale();
  let finito = false;
  const p = afterCli({ code: 0, ...t, seconds: 2, tick: 15 }).then((e) => ((finito = true), e));
  await attesa(5);
  t.premi("\r");
  await attesa(80);
  eq("Invio: resta aperto oltre il tempo", [false, true], [finito, pulito(t.stdout.testo).includes("Kept open. Press any key to close the terminal.")]);
  t.premi("q");
  eq("…finché non si preme un tasto", "kept", await p);
}
{
  const t = terminale();
  let finito = false;
  const p = afterCli({ code: 2, ...t, seconds: 1, tick: 5 }).then((e) => ((finito = true), e));
  await attesa(50);
  eq("CLI fallito: niente conto, aspetta un tasto", [false, false, true],
    [finito, t.stdout.testo.includes("Closing in"), pulito(t.stdout.testo).includes("Press any key to close the terminal.")]);
  t.premi("z");
  eq("…e il tasto lo chiude", "failed", await p);
}
{
  const t = terminale();
  const p = afterCli({ code: 1, ...t });
  t.stdin.emit("end");
  eq("stdin che finisce: non resta appeso", "failed", await p);
}

console.log("\n== l'intestazione (cliHeader) ==");
{
  const riga = npxLine("vtranslate-cli", ["--llm-translate", "fr-FR", "a b"]);
  eq("il comando da scrivere a mano, le virgolette solo se servono", '$ npx vtranslate-cli --llm-translate fr-FR "a b"', pulito(riga));
  eq("…colori: comando verde, flag ciano, valori gialli", [true, true, true],
    [riga.includes("\x1b[1;32mvtranslate-cli"), riga.includes("\x1b[36m--llm-translate"), riga.includes("\x1b[33mfr-FR")]);
  const p = { name: "vtranslate-cli", args: ["--status"], dir: "D:\\app", runtime: "C:\\node.exe", runner: "C:\\ext\\dist\\cliRunner.mjs", cli: "D:\\lib\\cli.js" };
  eq("di solito: una riga, niente cartella", ["$ npx vtranslate-cli --status"], pulito(cliHeader(p)).split("\n"));
  eq("detailCommand: sotto, come lo si lancia", [
    "$ npx vtranslate-cli --status",
    "  folder:  D:\\app",
    "  runtime: C:\\node.exe",
    "  runner:  C:\\ext\\dist\\cliRunner.mjs",
    "  command: D:\\lib\\cli.js --status",
  ], pulito(cliHeader({ ...p, detail: true })).split("\n"));
}

console.log("\n== il runner, come lo lancia il task ==");
{
  const dir = mkdtempSync(join(tmpdir(), "vt-iderunner-"));
  const finto = join(dir, "finto-cli.mjs");
  writeFileSync(finto, 'console.log("output del cli", process.argv.slice(2).join(" "), "header:" + (process.env.VT_HEADER ?? "none"));\nprocess.exitCode = Number(process.argv[2]);\n');
  const RUNNER = fileURLToPath(new URL("../../idePlugin/src/core/cliRunner.mjs", import.meta.url));
  const lancia = (codice) => new Promise((resolve) => {
    const env = { ...process.env, VT_HEADER: "$ npx finto --status" };
    const p = spawn(process.execPath, [RUNNER, finto, String(codice), "--status"], { stdio: ["pipe", "pipe", "inherit"], env });
    let out = "";
    p.stdout.on("data", (d) => {
      out += d;
      // Quando chiede, un tasto qualunque.
      if (/Closing in|Press any key/.test(out) && !p.premuto) p.premuto = p.stdin.write("x");
    });
    p.on("exit", (code) => resolve({ code, out: pulito(out) }));
  });
  const ok = await lancia(0);
  eq("prima l'intestazione, poi il CLI, che non la eredita", true, /^\$ npx finto --status\n\noutput del cli 0 --status header:none/.test(ok.out));
  eq("…poi il conto, e il codice del CLI", [true, 0], [ok.out.includes("Closing in 10s…"), ok.code]);
  const ko = await lancia(5);
  eq("fallito: si aspetta un tasto, e il codice del CLI", [true, false, 5], [ko.out.includes("Press any key to close the terminal."), ko.out.includes("Closing in"), ko.code]);
  rmSync(dir, { recursive: true, force: true });
}

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
