// La suite (test/run.mjs): ogni test in un processo, esce 1 se ne fallisce uno.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "../..");

export const name = "suite";
export const description = "every test in test/list, one process each (node test/run.mjs)";

export async function run({ log = () => {} } = {}) {
  const totale = readdirSync(join(RADICE, "test/list")).filter((f) => f.endsWith(".test.mjs")).length;
  let fatti = 0;
  log(`starting node test/run.mjs: ${totale} tests, one process each; failures shown at once, progress every 10`);
  const r = await new Promise((resolve) => {
    const figlio = spawn(process.execPath, [join(RADICE, "test/run.mjs")], { cwd: RADICE, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let resto = "";
    const raccogli = (pezzo) => {
      out += pezzo;
      resto += pezzo;
      const righe = resto.split("\n");
      resto = righe.pop();
      // Le righe di avanzamento di run.mjs cominciano con ✓ ✗ −: una per test. Si mostrano i falliti subito e
      // il conteggio ogni dieci, non novantanove righe.
      for (const l of righe) {
        if (!/^[✓✗−]/.test(l)) continue;
        fatti++;
        if (!l.startsWith("✓")) log(l.replace(/\s+/g, " ").trim());
        if (fatti % 10 === 0 || fatti === totale) log(`${fatti}/${totale} tests done`);
      }
    };
    for (const flusso of [figlio.stdout, figlio.stderr]) {
      flusso.setEncoding("utf8");
      flusso.on("data", raccogli);
    }
    figlio.on("error", (e) => resolve({ status: 1, out: `${out}${e.stack}` }));
    figlio.on("close", (status) => resolve({ status: status ?? 1, out }));
  });
  const out = r.out;
  if (r.status === 0) return { level: "ok", lines: [out.trim().split("\n").at(-1) ?? ""] };
  // Le righe di riepilogo dei test falliti cominciano con ✗ (senza colori, perché l'uscita non è un terminale).
  const falliti = out.split("\n").filter((l) => l.startsWith("✗")).map((l) => l.replace(/\s+/g, " ").trim());
  return { level: "ko", lines: [`${falliti.length || "some"} test(s) failed (node test/run.mjs)`, ...falliti] };
}
