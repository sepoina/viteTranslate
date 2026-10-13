// Lo storyboard eseguibile di un progetto: projects/<progetto>/storyboard.yaml, letto e
// controllato qui una volta sola. Tutti gli altri passi (tts, record, compose) ricevono
// l'oggetto già pronto, con i default applicati e i percorsi risolti.
//
// Lo YAML non nasce qui: lo scrive l'LLM dell'editor da storyboard.md (il soggetto, fonte di
// verità) seguendo site/video/README.md. Il legame tra i due file è in subject.mjs.
// LINKED-DATA: chiavi, default e azioni accettate qui sono documentati in README.md
// § "storyboard.yaml": cambiane uno, cambia l'altro.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load as yamlLoad } from "js-yaml";
import { resolveMusic } from "./music.mjs";

export const VIDEO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_DIR = resolve(VIDEO_DIR, "../..");
export const PROJECTS_DIR = join(VIDEO_DIR, "projects");
export const COMMONS_DIR = join(VIDEO_DIR, "commons");
export const CACHE_DIR = join(VIDEO_DIR, ".cache");

// "split-panel": VS Code e l'app affiancati in alto, il pannello di VS Code (il terminale) sotto
// tutti e due, per tutta la larghezza (director.mjs, palco).
export const STAGES = ["vscode", "app", "split", "split-panel", "card"];
const CON_APP = ["app", "split", "split-panel"];
export const ACTIONS = ["wait", "open", "goto", "find", "type", "key", "save", "click", "waitFor", "command", "reload", "scroll", "mark", "unmark"];

// LINKED-DATA: le chiavi di `mark` = README.md § "Marks" = opzioniSegno (director.mjs) e DEFAULTS
// di marker.js. MARK_TARGET dice dove (e quando passare oltre), MARK_STYLE come; in testa allo YAML,
// `mark:` ha solo le seconde.
const MARK_TARGET = ["text", "selector", "role", "name", "exact", "page", "timeout", "selection", "after", "tight", "all"];
const MARK_STYLE = ["shape", "width", "dashes", "color", "opacity", "shadow", "draw", "boil", "dim", "overshoot", "wobble", "pad", "seed"];
export const MARK_SHAPES = ["circle", "box", "underline", "arrow"];

const DEFAULTS = {
  title: "",
  // mbPerMinute: il peso del video finale, in MB al minuto come li conta Windows (MiB): 60 ≈ 8 Mbit/s.
  output: { width: 1920, height: 1080, fps: 30, mbPerMinute: 60 },
  // Quanto ingrandire l'interfaccia: il viewport CSS è output / zoom. VS Code a 1.2 si legge su
  // un telefono; l'app della demo, quasi vuota, regge di più.
  zoom: { vscode: 1.2, app: 1.6, card: 1 },
  voice: {
    model: "google/gemini-3.8-flash-lite-tts",
    voice: "Leda",
    instructions: "",
    sampleRate: 24000,
    apiKeyEnv: "OPENROUTER_API_KEY",
  },
  lead: 0.4, // silenzio prima della voce, in ogni scena
  tail: 0.6, // e dopo, prima del taglio
  split: 0.62, // la quota di VS Code nelle scene "split" (e "split-panel", in alto)
  panel: 0.3, // la quota dell'altezza del pannello di VS Code nelle scene "split-panel"
  fade: [0.5, 0.7], // secondi di dissolvenza del video: dal nero all'inizio, al nero alla fine
  typeDelay: 55, // ms per tasto in `type`
  fixture: null, // la cartella del repo copiata in capture/ prima di ogni ripresa
  app: { port: 5199, style: null },
  vscode: { settings: {}, style: null, env: [] }, // env: nomi di variabili, i valori li cerca record.mjs
  setup: [],
  poster: null,
  mark: {}, // i default dei segni per tutto il video (le chiavi di stile di `mark`)
  music: null, // la musica di fondo (music.mjs): un brano di commons/bkmusic, coi suoi livelli
  source: null, // scritto da `stamp` (subject.mjs), mai a mano
};

/** I percorsi di un progetto, anche prima che esista il suo storyboard.yaml. */
export function projectPaths(name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name ?? "")) throw new Error(`invalid project name "${name}"`);
  const dir = join(PROJECTS_DIR, name);
  if (!existsSync(dir)) throw new Error(`no project folder ${dir}`);
  return {
    dir,
    md: join(dir, "storyboard.md"),
    yaml: join(dir, "storyboard.yaml"),
    audio: join(dir, "audio"),
    capture: join(dir, "capture"),
    preview: join(dir, "preview"),
    output: join(dir, "output"),
    log: join(dir, "log"),
  };
}

/**
 * Un file citato dallo storyboard: `@commons/…` è in site/video/commons, il resto è relativo
 * alla cartella del progetto.
 */
export function resolveRef(paths, ref) {
  const r = String(ref ?? "");
  return r.startsWith("@commons/") ? join(COMMONS_DIR, r.slice("@commons/".length)) : join(paths.dir, r);
}

/**
 * @param {string} name - la cartella del progetto dentro site/video/projects
 */
export function loadProject(name) {
  const paths = projectPaths(name);
  if (!existsSync(paths.yaml)) throw new Error(`no storyboard.yaml in ${paths.dir}: convert storyboard.md first (README.md)`);
  const raw = yamlLoad(readFileSync(paths.yaml, "utf8")) ?? {};

  const sb = {
    ...DEFAULTS,
    ...raw,
    output: { ...DEFAULTS.output, ...raw.output },
    zoom: { ...DEFAULTS.zoom, ...raw.zoom },
    voice: { ...DEFAULTS.voice, ...raw.voice },
    app: { ...DEFAULTS.app, ...raw.app },
    vscode: { ...DEFAULTS.vscode, ...raw.vscode },
  };

  const errori = [];
  const sconosciute = Object.keys(raw).filter((k) => !(k in DEFAULTS) && k !== "scenes");
  if (sconosciute.length) errori.push(`unknown keys: ${sconosciute.join(", ")}`);
  if (!Array.isArray(sb.scenes) || sb.scenes.length === 0) errori.push("scenes: at least one scene is needed");
  const visti = new Set();
  for (const [i, scena] of (sb.scenes ?? []).entries()) {
    const dove = `scenes[${i}]${scena?.id ? ` (${scena.id})` : ""}`;
    if (!/^[a-z0-9-]+$/.test(scena?.id ?? "")) errori.push(`${dove}: id must be lowercase letters, digits and "-"`);
    if (visti.has(scena.id)) errori.push(`${dove}: duplicate id`);
    visti.add(scena.id);
    if (!STAGES.includes(scena.stage)) errori.push(`${dove}: stage must be one of ${STAGES.join(", ")}`);
    if (scena.stage === "card" && !existsSync(resolveRef(paths, scena.card))) errori.push(`${dove}: card "${scena.card}" not found`);
    if (scena.params != null && (typeof scena.params !== "object" || Object.values(scena.params).some((v) => typeof v === "object")))
      errori.push(`${dove}: params must be a map of plain values`);
    if (CON_APP.includes(scena.stage) && !sb.fixture) errori.push(`${dove}: stage "${scena.stage}" needs a fixture`);
    if (scena.url != null) {
      if (!CON_APP.includes(scena.stage)) errori.push(`${dove}: url is for a stage with the app (${CON_APP.join(", ")})`);
      if (!/^https?:\/\//.test(String(scena.url))) errori.push(`${dove}: url must start with http:// or https://`);
    }
    if (scena.anchor != null && (scena.url == null || typeof scena.anchor !== "string"))
      errori.push(`${dove}: anchor is a CSS selector, and goes with url: the page opens scrolled there`);
    if (scena.preload != null && (scena.url == null || typeof scena.preload !== "boolean"))
      errori.push(`${dove}: preload is true or false, and goes with url: the page is scrolled through once before the clip`);
    if (scena.storage != null) {
      if (scena.url == null) errori.push(`${dove}: storage goes with url: it is written on that page's origin`);
      if (typeof scena.storage !== "object" || Array.isArray(scena.storage) || Object.values(scena.storage).some((v) => typeof v === "object"))
        errori.push(`${dove}: storage must be a map of plain values (localStorage keys and values)`);
    }
    errori.push(...controllaAzioni(scena.do, dove));
  }
  errori.push(...controllaAzioni(sb.setup, "setup"));
  errori.push(...controllaSegno(sb.mark, "mark", MARK_STYLE));
  const musica = resolveMusic(raw.music);
  errori.push(...musica.errori);
  sb.music = musica.music;
  if (sb.fixture && !existsSync(join(REPO_DIR, sb.fixture, "package.json"))) errori.push(`fixture: no package.json in ${sb.fixture}`);
  for (const chiave of ["app", "vscode"]) {
    const stile = sb[chiave].style;
    if (stile && !existsSync(resolveRef(paths, stile))) errori.push(`${chiave}.style: ${stile} not found`);
  }
  if (!Array.isArray(sb.vscode.env) || sb.vscode.env.some((n) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)))
    errori.push("vscode.env: a list of environment variable names (the values never go in the YAML)");
  if (sb.poster && !visti.has(sb.poster.scene ?? sb.poster)) errori.push(`poster: no scene "${sb.poster.scene ?? sb.poster}"`);
  if (!(sb.panel > 0.1 && sb.panel < 0.7)) errori.push("panel: the share of the height for VS Code's panel in split-panel, between 0.1 and 0.7");
  if (!(sb.output.mbPerMinute > 0)) errori.push("output.mbPerMinute: the size of the final video, in MB per minute (60 ≈ 8 Mbit/s)");
  sb.fade = [].concat(sb.fade);
  if (sb.fade.length === 1) sb.fade.push(sb.fade[0]);
  if (sb.fade.length !== 2 || sb.fade.some((s) => typeof s !== "number" || s < 0)) errori.push("fade: [in, out], seconds from black and to black");
  if (errori.length) throw new Error(`projects/${name}/storyboard.yaml:\n  - ${errori.join("\n  - ")}`);

  return { name, ...sb, paths };
}

function controllaAzioni(lista, dove) {
  if (lista == null) return [];
  if (!Array.isArray(lista)) return [`${dove}: "do" must be a list`];
  const errori = [];
  for (const [i, azione] of lista.entries()) {
    const chiavi = typeof azione === "string" ? [azione] : Object.keys(azione ?? {});
    if (chiavi.length !== 1 || !ACTIONS.includes(chiavi[0]))
      errori.push(`${dove}, action ${i + 1}: expected one of ${ACTIONS.join(", ")}, got ${JSON.stringify(azione)}`);
    else if (chiavi[0] === "mark") {
      const arg = typeof azione === "string" ? null : azione.mark;
      const qui = `${dove}, action ${i + 1} (mark)`;
      if (arg === "selection") continue;
      if (arg == null || typeof arg !== "object") errori.push(`${qui}: needs a target: selection, or { text | selector | role, … }`);
      else {
        errori.push(...controllaSegno(arg, qui, [...MARK_TARGET, ...MARK_STYLE]));
        if (!arg.selection && arg.text == null && !arg.selector && !arg.role) errori.push(`${qui}: needs a target: text, selector, role or selection`);
      }
    }
  }
  return errori;
}

// Le chiavi di un `mark` (o dei default `mark:` in testa allo YAML): un refuso dell'LLM si ferma qui,
// non a metà ripresa.
function controllaSegno(arg, dove, ammesse) {
  if (arg == null) return [];
  if (typeof arg !== "object" || Array.isArray(arg)) return [`${dove}: must be a map`];
  const errori = [];
  const ignote = Object.keys(arg).filter((k) => !ammesse.includes(k));
  if (ignote.length) errori.push(`${dove}: unknown keys ${ignote.join(", ")} (allowed: ${ammesse.join(", ")})`);
  if (arg.shape != null && !MARK_SHAPES.includes(arg.shape)) errori.push(`${dove}: shape must be one of ${MARK_SHAPES.join(", ")}`);
  return errori;
}

/** Un'azione dello storyboard come [nome, argomento]: `save` e `{ save: null }` sono la stessa. */
export function azione(voce) {
  if (typeof voce === "string") return [voce, null];
  const [nome] = Object.keys(voce);
  return [nome, voce[nome]];
}
