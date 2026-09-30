// Dai dati letti (package.json, risposta della sonda) alle righe del pannello.
//
// Una riga è un oggetto semplice: { label, description?, tooltip?, icon?, iconColor?, open?,
// choice?, mark?, children?, expanded? }. `icon` è il nome di una codicon e `iconColor` il suo
// colore di tema; `open` il percorso assoluto di un file da aprire al clic; `choice` e `mark`
// marcano le righe di un elenco a scelta singola (choiceList.mjs, che mette anche l'icona). Nessun import di `vscode`: extension.mjs traduce le
// righe in TreeItem, e qui si prova tutto con dati finti.
import path from "node:path";

const onOff = (acceso) => (acceso ? "on" : "off");

/** Il percorso di `dir` relativo alla radice del workspace che lo contiene ("." per la radice). */
export function relativeLabel(dir, roots) {
  const radice = roots.find((r) => dir === r || dir.startsWith(r + path.sep));
  return radice === undefined ? dir : path.relative(radice, dir) || ".";
}

/**
 * La riga di un progetto nella sezione Configs: il nome e la cartella. Il segno della selezione lo
 * aggiunge il ChoiceList di ProjectTree (choiceList.mjs). Nessun figlio: il dettaglio del
 * selezionato sta nella sezione Details (projectChildren).
 *
 * @param {{ dir: string, configFile: string }} project
 * @param {object} p
 * @param {string[]} p.roots - le radici del workspace, per la cartella relativa
 * @param {string | null} [p.name] - il `name` del suo package.json; senza, il nome della cartella
 */
export function projectRow(project, { roots, name }) {
  const rel = relativeLabel(project.dir, roots);
  return {
    label: name || path.basename(project.dir),
    description: rel === "." ? "workspace root" : rel,
    tooltip: path.join(project.dir, project.configFile),
  };
}

/** Le righe della sezione Details: la sintesi di vitetranslate, package.json, vite.config. */
export function projectChildren({ project, pkg, probe }) {
  return [vitetranslateRow(probe, project.dir), packageRow(pkg, project.dir), configRow(probe, project)];
}

// ------------------------------------------------------------------------------ vitetranslate

// I default documentati in lib/index.d.ts (VitetranslateOptions), usati solo per scrivere
// "default" accanto al valore. Se la libreria cambia un default, va cambiato anche qui.
function vitetranslateRow(probe, dir) {
  const label = "vitetranslate";
  if (probe.untrusted || !probe.ok) return { label, description: "unknown: vite.config not read", icon: "circle-slash" };
  const c = probe.vitetranslate;
  if (!c) return { label, description: "not registered in vite.config", icon: "warning" };

  const opt = (nome, valore, predefinito, extra = {}) => ({
    label: nome,
    description: predefinito ? `${valore} · default` : String(valore),
    ...extra,
  });
  const lingue = Array.isArray(c.preloadedLanguages) && c.preloadedLanguages.length ? c.preloadedLanguages.join(", ") : null;
  // Il default di baseDir è la cwd di chi legge la config, e la sonda gira nella cartella del progetto.
  const baseDir = c.baseDir ? path.relative(dir, c.baseDir) || "." : ".";
  const srcDir = c.srcDir ?? "src";
  const children = [
    opt("sourceLanguage", c.sourceLanguage ?? "—", false),
    opt("localeDir", c.localeDir ?? "—", false),
    opt("preloadedLanguages", lingue ?? "none", lingue === null),
    opt("srcDir", srcDir, srcDir === "src"),
    opt("baseDir", baseDir, baseDir === "."),
    opt("autoSyncDev", onOff(c.autoSyncDev !== false), c.autoSyncDev !== false),
    opt("autoSyncBuild", onOff(c.autoSyncBuild !== false), c.autoSyncBuild !== false),
    opt("includeFallback", c.includeFallback === undefined ? "dev only" : onOff(c.includeFallback), c.includeFallback === undefined),
    opt("autoWrap", c.autoWrap?.$regexp ?? onOff(c.autoWrap === true), !c.autoWrap),
    opt("icu.timeZone", c.icu?.timeZone ?? "runtime", !c.icu?.timeZone),
    opt("errorSolve", c.errorSolve ? "custom" : "built-in", !c.errorSolve, c.errorSolve ? { tooltip: JSON.stringify(c.errorSolve, null, 2) } : {}),
    opt("simpleLog", onOff(c.simpleLog === true), c.simpleLog !== true),
    llmRow(c.llm),
  ];
  return { label, description: `${c.sourceLanguage} → ${c.localeDir}/`, icon: "globe", expanded: true, children };
}

// Il blocco llm arriva già normalizzato dal plugin (lib/dev/llm/llmOptions.js). Si legge con
// cautela: una versione più vecchia della libreria può non avere tutti i campi.
function llmRow(llm) {
  if (!llm) return { label: "llm", description: "not configured" };
  const conn = llm.connection ?? {};
  let host = conn.baseURL;
  try {
    host = new URL(conn.baseURL).host;
  } catch {
    // baseURL assente o non un URL: resta com'è
  }
  const u = conn.costUnity ?? "$";
  const children = [
    { label: "model", description: conn.model ?? "—" },
    { label: "endpoint", description: conn.baseURL ?? "—" },
    { label: "apiKeyEnv", description: conn.apiKeyEnv ?? "—", tooltip: "Only the variable name: the key itself is never read." },
  ];
  if (conn.costMillionInput !== undefined) {
    children.push({ label: "price", description: `${u}${conn.costMillionInput} in · ${u}${conn.costMillionOutput} out, per 1M tokens` });
  }
  if (conn.modelClass?.name) children.push({ label: "modelClass", description: conn.modelClass.name });
  if (llm.budget) children.push({ label: "budget", description: llm.budget.preset ?? "custom", tooltip: JSON.stringify(llm.budget, null, 2) });
  if (llm.context?.mode) children.push({ label: "context", description: llm.context.mode });
  return { label: "llm", description: [conn.model, host].filter(Boolean).join(" @ ") || "configured", children };
}

// ------------------------------------------------------------------------------ package.json

function packageRow(pkg, dir) {
  const label = "package.json";
  const open = path.join(dir, "package.json");
  if (!pkg.ok) return { label, description: pkg.error, icon: "warning", ...(pkg.missing ? {} : { open }) };
  const deps = pkg.deps.map((d) => ({
    label: d.name,
    description: `${d.wanted ?? "not declared"} → ${d.installed ?? "not installed"}`,
    icon: d.installed ? "pass" : "warning",
  }));
  const nomi = Object.keys(pkg.scripts);
  const scripts = {
    label: "scripts",
    description: nomi.length ? nomi.join(" · ") : "none",
    tooltip: nomi.map((n) => `${n}: ${pkg.scripts[n]}`).join("\n") || undefined,
    icon: "terminal",
  };
  return {
    label,
    description: [pkg.name, pkg.version].filter(Boolean).join(" ") || undefined,
    icon: "package",
    open,
    expanded: true,
    children: [...deps, scripts],
  };
}

// ------------------------------------------------------------------------------ vite.config

// La prima riga dell'errore, o una frase più utile quando manca un pacchetto: caricare il config
// tira dentro i suoi import, e quasi sempre è un `npm install` non fatto.
export function errorLine(probe) {
  const pacchetto = probe.code === "ERR_MODULE_NOT_FOUND" ? /Cannot find package '([^']+)'/.exec(probe.error)?.[1] : null;
  if (pacchetto) return `needs "${pacchetto}": not installed`;
  return String(probe.error).split("\n")[0];
}

function configRow(probe, project) {
  const base = { label: project.configFile, open: path.join(project.dir, project.configFile) };
  if (probe.untrusted) {
    return {
      ...base,
      description: "not executed: Restricted Mode",
      tooltip: "Trust this workspace to let the panel run vite.config and read the plugin options.",
      icon: "shield",
    };
  }
  if (!probe.ok) {
    return { ...base, description: errorLine(probe), tooltip: [probe.error, probe.output].filter(Boolean).join("\n\n"), icon: "error" };
  }
  const v = probe.vite ?? {};
  const children = [
    { label: "plugins", description: probe.plugins.join(" · ") || "none", tooltip: probe.plugins.join("\n") || undefined, icon: "extensions" },
  ];
  const server = [v.port !== undefined ? `port ${v.port}` : null, v.host !== undefined ? `host ${v.host}` : null].filter(Boolean);
  if (server.length) children.push({ label: "server", description: server.join(" · "), icon: "server" });
  if (v.base !== undefined) children.push({ label: "base", description: String(v.base), icon: "link" });
  if (v.root !== undefined) children.push({ label: "root", description: String(v.root), icon: "folder" });
  if (v.outDir !== undefined) children.push({ label: "build.outDir", description: String(v.outDir), icon: "folder" });
  return {
    ...base,
    description: `${probe.plugins.length} plugins`,
    tooltip: `Run in a separate process in ${probe.ms} ms, the way vtranslate-cli reads it.`,
    icon: "settings-gear",
    children,
  };
}
