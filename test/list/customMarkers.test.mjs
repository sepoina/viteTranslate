// L'estrazione con delimitatori personalizzati (4.7.0): la CHIAVE di un testo non dipende dal
// delimitatore (invariante 26), quindi la stessa sorgente scritta con `_%_` e con `≼…≽` o `§…§` dà la
// stessa tabella e lo stesso codice trasformato. Poi i casi di confine: marcatori annidati, il
// marcatore vecchio (`_%_` in un progetto che usa altro), una macro con dentro il marcatore vecchio.
//
//   node test/list/customMarkers.test.mjs
import extractMarkers from "../../lib/dev/babel/extractMarkers.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(58), "->", ok ? "" : `${JSON.stringify(ottenuto)} (atteso ${JSON.stringify(atteso)})`);
};

const BASE = "/proj";
const FILE = "/proj/src/App.jsx";

function estrai(code, markers, { rewrite = true, autoWrap = true } = {}) {
  const table = {};
  const avvisi = [];
  const r = extractMarkers(code, {
    filename: FILE, table, baseDir: BASE, autoWrap, rewrite, includeFallback: true, markers,
    warn: (message, kind) => avvisi.push({ kind, message }),
  });
  return { table, avvisi, code: r?.code ?? null };
}

// La stessa sorgente, scritta coi delimitatori `o`…`c`.
const sorgente = (o, c) => `
import { Trans, useTrans } from "@sepoina/vitetranslate/react";
export function App({ nome, n }) {
  const trans = useTrans();
  const elenco = ["${o}Scegli${c}", '${o}Paga l\\'ordine${c}'];
  return (
    <div>
      <input placeholder="${o}Cerca${c}" title={trans("${o}Filtra${c}")} />
      <p>{"${o}Espressione${c}"}</p>
      <p>${o}Ciao <b>{nome}</b> bene${c}</p>
      <Trans>${o}Benvenuto${c}</Trans>
      <Trans>Ciao <b>{nome}</b>, hai {n} messaggi</Trans>
      <Trans t={\`${o}Ciao \${nome}${c}\`} />
      <span>{trans\`Salve \${nome}\`}</span>
      <h1>${o}Titolo${c}</h1>
    </div>
  );
}
`;

const riferimento = estrai(sorgente("_%_", "_%_"), undefined);

console.log("\n== il riferimento: la sorgente con _%_ produce voci ==");
eq("almeno dodici chiavi", true, Object.keys(riferimento.table).length >= 11);

for (const [o, c] of [["≼", "≽"], ["§", "§"], ["[[", "]]"], ["$$", "$$"]]) {
  console.log(`\n== ${o}…${c}: stesse chiavi, stesso codice di _%_ ==`);
  const e = estrai(sorgente(o, c), { start: o, end: c });
  eq("la tabella è identica", riferimento.table, e.table);
  eq("il codice trasformato è identico", riferimento.code, e.code);
  eq("gli avvisi sono gli stessi", riferimento.avvisi.map((a) => a.kind), e.avvisi.map((a) => a.kind));
  // L'unico segno dei delimitatori vecchi: nessuno.
  eq("nessun old-marker", false, e.avvisi.some((a) => a.kind === "old-marker"));
}

console.log("\n== senza riscrittura (la scansione del CLI) le chiavi sono le stesse ==");
{
  const a = estrai(sorgente("_%_", "_%_"), undefined, { rewrite: false });
  const b = estrai(sorgente("≼", "≽"), { start: "≼", end: "≽" }, { rewrite: false });
  eq("rewrite: false, ≼≽", a.table, b.table);
  const c = estrai(sorgente("_%_", "_%_"), undefined, { rewrite: false, autoWrap: false });
  const d = estrai(sorgente("§", "§"), { start: "§", end: "§" }, { rewrite: false, autoWrap: false });
  eq("rewrite: false, autoWrap spento, §", c.table, d.table);
}

console.log("\n== marcatori annidati ==");
{
  const e = estrai(`const a = "≼uno≽ e ≼due≽";`, { start: "≼", end: "≽" });
  eq("avviso nested", ["nested"], e.avvisi.map((a) => a.kind));
  const f = estrai(`const a = "§uno§ e §due§";`, { start: "§", end: "§" });
  eq("avviso nested (delimitatore uguale)", ["nested"], f.avvisi.map((a) => a.kind));
}

console.log("\n== il marcatore vecchio: _%_ in un progetto che usa altro ==");
{
  const e = estrai(`const a = "_%_Ciao_%_"; const b = "≼Salve≽";`, { start: "≼", end: "≽" });
  eq("una sola chiave: quella nuova", 1, Object.keys(e.table).length);
  eq("avviso old-marker", ["old-marker"], e.avvisi.map((a) => a.kind));
  eq("…che nomina il file e il comando", true, /old marker in .*src\/App\.jsx:1:\d+/.test(e.avvisi[0].message) && e.avvisi[0].message.includes("--rewriteMarkerDryRun"));

  const m = estrai(`import { Trans } from "@sepoina/vitetranslate/react";\nconst a = <Trans>_%_ciao_%_</Trans>;`, { start: "≼", end: "≽" });
  eq("macro con _%_ dentro: nessuna chiave", 0, Object.keys(m.table).length);
  eq("…rifiutata col motivo old-marker", true, m.avvisi.some((a) => a.kind === "macro-unsupported" && /old "_%_" marker/.test(a.message)));
  eq("…l'avviso porta il nome scritto nel file", true, m.avvisi.some((a) => a.message.includes("<Trans> left as it was")));

  const t = estrai(`import { Translate as T } from "@sepoina/vitetranslate/react";\nconst a = <T>_%_ciao_%_</T>;`, { start: "≼", end: "≽" });
  eq("…con un alias, quello dell'alias", true, t.avvisi.some((a) => a.message.includes("<T> left as it was")));

  // Con i delimitatori di serie il testo `_%_` è, semplicemente, il marcatore.
  const s = estrai(`const a = "_%_Ciao_%_";`, undefined);
  eq("di serie: nessun old-marker", [], s.avvisi.map((a) => a.kind));
}

console.log("\n== un delimitatore in mezzo alla frase: malformato ==");
{
  const e = estrai(`const a = "ciao ≼ mondo";`, { start: "≼", end: "≽" });
  eq("avviso malformed", ["malformed"], e.avvisi.map((a) => a.kind));
  const f = estrai(`const a = "ciao ≽ mondo";`, { start: "≼", end: "≽" });
  eq("anche con la sola chiusura", ["malformed"], f.avvisi.map((a) => a.kind));
}

console.log("\n== la macro rifiuta un delimitatore del progetto in mezzo alla frase ==");
{
  const e = estrai(`import { Trans } from "@sepoina/vitetranslate/react";\nconst a = <Trans>ciao ≼ mondo {x}</Trans>;`, { start: "≼", end: "≽" });
  eq("nessuna chiave", 0, Object.keys(e.table).length);
  eq("macro-unsupported", true, e.avvisi.some((a) => a.kind === "macro-unsupported" && /stray marker/.test(a.message)));
}

console.log("\n== frase spezzata da un tag, con inizio ≠ fine ==");
{
  const e = estrai(`const a = <p>≼Ciao <b>{x}</b> bene≽</p>;`, { start: "≼", end: "≽" });
  eq("una chiave sola", ["Ciao <b>{x}</b> bene"], Object.values(e.table));
  const f = estrai(`const a = <p>≼Ciao <b>x</b> e <i>y</i>≽</p>;`, { start: "≼", end: "≽" });
  eq("due tag nella frase", ["Ciao <b>x</b> e <i>y</i>"], Object.values(f.table));
  const g = estrai(`const a = <p><b>x</b>≼Ciao≽</p>;`, { start: "≼", end: "≽" });
  eq("un testo avvolto dopo un tag", ["Ciao"], Object.values(g.table));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
