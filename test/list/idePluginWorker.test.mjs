// Estensione per l'editor (idePlugin): la vita del processo di Marked (scanWorker.mjs), con una
// sonda finta che risponde come le si chiede. Il processo resta acceso solo se ha caricato Babel
// (`babel: true`), e per `idleMs`; si chiude subito altrimenti, su un timeout e con dispose(). Un
// processo riusato morto senza rispondere, o una libreria cambiata sotto di lui (STALE_WORKER):
// un nuovo tentativo, con un processo nuovo. Le richieste passano una alla volta.
//
//   node test/list/idePluginWorker.test.mjs
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScanWorker } from "../../idePlugin/src/scanWorker.mjs";
import { forkProbe } from "../../idePlugin/src/runProbe.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), "vt-ideworker-"));
const FINTA = join(dir, "finta.mjs");
// input.mode: "cold" (babel false), "warm" (babel true), "slow" (50 ms, babel false),
// "hang" (non risponde), "die" / "stale" (la prima volta muore / risponde STALE_WORKER: lo
// ricorda un file accanto, `input.flag`).
writeFileSync(FINTA, `import fs from "node:fs";
process.on("message", async ({ id, input, overlay }) => {
  const risposta = (extra) => process.send({ id, ok: true, pid: process.pid, overlay, ...extra });
  const primaVolta = input.flag && !fs.existsSync(input.flag);
  if (primaVolta) fs.writeFileSync(input.flag, "");
  if (input.mode === "hang") return;
  if (input.mode === "die" && primaVolta) process.exit(3);
  if (input.mode === "stale" && primaVolta) return process.send({ id, ok: false, code: "STALE_WORKER", error: "changed" });
  if (input.mode === "slow") await new Promise((r) => setTimeout(r, 50));
  risposta({ babel: input.mode === "warm" || input.mode === "die" || input.mode === "stale" });
});
process.on("disconnect", () => process.exit(0));
`);

let avvii = 0;
const nuovo = (opzioni = {}) => new ScanWorker({ dir, probePath: FINTA, fork: (...a) => (avvii++, forkProbe(...a)), ...opzioni });

console.log("\n== senza Babel: si chiude subito ==");
{
  const w = nuovo();
  const r = await w.request({ mode: "cold" }, { a: 1 });
  eq("risposta, con l'overlay passato di là e ritorno", [true, { a: 1 }], [r.ok, r.overlay]);
  eq("…ms e output aggiunti", [true, ""], [typeof r.ms === "number", r.output]);
  eq("processo chiuso", false, w.alive);
  await w.request({ mode: "cold" });
  eq("la richiesta dopo ne apre un altro", 2, avvii);
}

console.log("\n== con Babel: resta vivo, poi scade ==");
{
  avvii = 0;
  const w = nuovo({ idleMs: 150 });
  const r1 = await w.request({ mode: "warm" });
  eq("acceso dopo la risposta", true, w.alive);
  const r2 = await w.request({ mode: "cold" });
  eq("la seconda richiesta usa lo stesso processo", [1, r1.pid], [avvii, r2.pid]);
  eq("…che ha risposto babel: false, quindi si chiude", false, w.alive);
  await w.request({ mode: "warm" });
  await pausa(300);
  eq("dopo idleMs di silenzio: chiuso", false, w.alive);
}

console.log("\n== le richieste in coda ==");
{
  avvii = 0;
  const w = nuovo();
  const [a, b, c] = await Promise.all([w.request({ mode: "slow" }), w.request({ mode: "slow" }), w.request({ mode: "cold" })]);
  eq("tre richieste insieme: un processo solo, non chiuso a metà", [1, a.pid, a.pid], [avvii, b.pid, c.pid]);
  eq("…chiuso alla fine", false, w.alive);
}

console.log("\n== i guasti ==");
{
  avvii = 0;
  const w = nuovo();
  await w.request({ mode: "warm" });
  const r = await w.request({ mode: "die", flag: join(dir, "die") });
  eq("processo riusato morto senza rispondere: riprova con uno nuovo", [true, 2], [r.ok, avvii]);

  avvii = 0;
  const s = await nuovo().request({ mode: "stale", flag: join(dir, "stale") });
  eq("STALE_WORKER: riprova con uno nuovo", [true, 2], [s.ok, avvii]);

  avvii = 0;
  const f = nuovo();
  const nuovoMorto = await f.request({ mode: "die", flag: join(dir, "die2") });
  eq("processo nuovo morto: nessun secondo tentativo", [false, "NO_ANSWER", 1], [nuovoMorto.ok, nuovoMorto.code, avvii]);

  const t = nuovo({ timeoutMs: 100 });
  const bloccato = await t.request({ mode: "hang" });
  eq("timeout: errore, e il processo si chiude", [false, "TIMEOUT", false], [bloccato.ok, bloccato.code, t.alive]);

  const d = nuovo({ idleMs: 60000 });
  await d.request({ mode: "warm" });
  d.dispose();
  eq("dispose: chiuso", false, d.alive);
  const dopo = await d.request({ mode: "cold" });
  eq("…e non ne apre altri", [false, "DISPOSED"], [dopo.ok, dopo.code]);

  const x = new ScanWorker({ dir, probePath: join(dir, "non-esiste.mjs") });
  const assente = await x.request({ mode: "cold" });
  eq("sonda che non c'è: una risposta d'errore, mai un rifiuto", false, assente.ok);
}

rmSync(dir, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
