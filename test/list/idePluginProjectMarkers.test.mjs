// ProjectMarkers (idePlugin/src/highlight/projectMarkers.mjs, 4.7.0): i delimitatori del progetto che
// contiene un file, per l'evidenziazione. Sullo stub di `vscode` e con un `Projects` finto.
//   - sceglie il progetto più profondo che contiene il file;
//   - null prima che l'elenco arrivi, prima della lettura, in un workspace non fidato, con una
//     libreria più vecchia (nessun `markers` nella sonda);
//   - chiedere i delimitatori di un file avvia la lettura del suo progetto;
//   - onDidChange scatta quando arriva una lettura o l'elenco cambia.
//
//   node test/list/idePluginProjectMarkers.test.mjs
import module from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";

if (typeof module.registerHooks !== "function") {
  console.log("  --  saltato: questo Node non ha module.registerHooks (serve 22.15+ o 23.5+)");
  process.exit(0);
}
const STUB = new URL("./idePluginVscodeStub.mjs", import.meta.url).href;
module.registerHooks({
  resolve: (specifier, context, next) => (specifier === "vscode" ? { url: STUB, shortCircuit: true } : next(specifier, context)),
});
const vscode = await import("vscode");
const { ProjectMarkers } = await import("../../idePlugin/src/highlight/projectMarkers.mjs");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const pausa = (ms = 10) => new Promise((r) => setTimeout(r, ms));

const RADICE = join(tmpdir(), "vt-pm");
const fuori = { dir: join(RADICE, "mono"), configFile: "vite.config.js" };
const dentro = { dir: join(RADICE, "mono", "app"), configFile: "vite.config.js" };
const FRECCE = { start: "≼", end: "≽" };

/** Un `Projects` finto: l'elenco, le letture già arrivate, e chi ascolta. */
function projectsFinto(lista) {
  const letto = new vscode.EventEmitter();
  const cambio = new vscode.EventEmitter();
  const p = {
    lista, letture: new Map(), richieste: [],
    onDidRead: letto.event, onDidChange: cambio.event,
    currentList: () => Promise.resolve(p.lista),
    ready: (dir) => p.letture.get(dir),
    data: (progetto) => { p.richieste.push(progetto.dir); },
    arriva: (dir, lettura) => { p.letture.set(dir, lettura); letto.fire(dir); },
    cambiaElenco: (nuova) => { p.lista = nuova; cambio.fire(undefined); },
  };
  return p;
}

console.log("\n== prima dell'elenco e prima della lettura ==");
{
  const projects = projectsFinto([fuori, dentro]);
  const pm = new ProjectMarkers({ projects });
  const file = join(dentro.dir, "src", "App.jsx");
  eq("subito dopo la costruzione: null (l'elenco non è arrivato)", null, pm.markersFor(file));
  eq("…e non si avvia nessuna lettura", [], projects.richieste);
  await pausa();
  eq("elenco arrivato, lettura no: null", null, pm.markersFor(file));
  eq("…e la lettura del progetto più profondo è avviata", [dentro.dir], projects.richieste);
  pm.dispose();
}

console.log("\n== il progetto più profondo che contiene il file ==");
{
  const projects = projectsFinto([fuori, dentro]); // l'ordine dell'elenco non conta
  const pm = new ProjectMarkers({ projects });
  await pausa();
  projects.arriva(fuori.dir, { probe: { ok: true, vitetranslate: { markers: { start: "§", end: "§" } } } });
  projects.arriva(dentro.dir, { probe: { ok: true, vitetranslate: { markers: FRECCE } } });
  eq("un file del progetto interno", FRECCE, pm.markersFor(join(dentro.dir, "src", "App.jsx")));
  eq("un file del progetto esterno", { start: "§", end: "§" }, pm.markersFor(join(fuori.dir, "src", "Altro.jsx")));
  eq("un file fuori da ogni progetto: null", null, pm.markersFor(join(RADICE, "altro", "x.js")));
  eq("una cartella con lo stesso prefisso non conta (mono2)", null, pm.markersFor(join(RADICE, "mono2", "x.js")));
  eq("un percorso non stringa: null", null, pm.markersFor(undefined));
  pm.dispose();
}

console.log("\n== workspace non fidato, libreria più vecchia ==");
{
  const projects = projectsFinto([dentro]);
  const pm = new ProjectMarkers({ projects });
  await pausa();
  projects.arriva(dentro.dir, { probe: { ok: false, untrusted: true } });
  eq("Restricted Mode: null", null, pm.markersFor(join(dentro.dir, "x.js")));
  projects.arriva(dentro.dir, { probe: { ok: true, vitetranslate: { localeDir: "locale" } } });
  eq("libreria più vecchia (nessun markers): null", null, pm.markersFor(join(dentro.dir, "x.js")));
  projects.arriva(dentro.dir, { probe: { ok: false, error: "boom" } });
  eq("vite.config non letto: null", null, pm.markersFor(join(dentro.dir, "x.js")));
  projects.arriva(dentro.dir, { probe: { ok: true, vitetranslate: null } });
  eq("plugin non registrato: null", null, pm.markersFor(join(dentro.dir, "x.js")));
  pm.dispose();
}

console.log("\n== onDidChange ==");
{
  const projects = projectsFinto([dentro]);
  const pm = new ProjectMarkers({ projects });
  let scatti = 0;
  pm.onDidChange(() => scatti++);
  await pausa();
  eq("l'elenco arrivato fa scattare", 1, scatti);
  projects.arriva(dentro.dir, { probe: { ok: true, vitetranslate: { markers: FRECCE } } });
  eq("una lettura arrivata fa scattare", 2, scatti);
  projects.cambiaElenco([fuori]);
  await pausa();
  eq("l'elenco cambiato lo rilegge e fa scattare", 3, scatti);
  eq("…e il nuovo elenco vale (il progetto di prima non c'è più)", null, pm.markersFor(join(dentro.dir, "src", "App.jsx")));
  pm.dispose();
  eq("dispose non lascia ascoltatori vivi", true, (() => { projects.arriva(dentro.dir, {}); return scatti === 3; })());
}

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
