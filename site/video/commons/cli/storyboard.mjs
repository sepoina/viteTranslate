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
import { controllaCamera } from "./camera.mjs";
import { resolveMusic } from "./music.mjs";
import { controllaVelocita } from "./speed.mjs";

export const VIDEO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const REPO_DIR = resolve(VIDEO_DIR, "../..");
export const PROJECTS_DIR = join(VIDEO_DIR, "projects");
export const COMMONS_DIR = join(VIDEO_DIR, "commons");
export const CACHE_DIR = join(VIDEO_DIR, ".cache");
// Il quadro su cui si disegna ogni video: layout, zoom, segni e offset sono pensati qui. Un
// `output` più grande (2560×1440, 3840×2160) non cambia il layout: aggiunge pixel (director.mjs, scala).
export const FRAME = { width: 1920, height: 1080 };
// Il quadro verticale, per Shorts, Reels e TikTok: tre finestre 16:9 larghe 1080, una sopra l'altra (stage "stack").
export const FRAME_VERTICALE = { width: 1080, height: 1920 };
/** Il quadro su cui si disegna un output: FRAME, o FRAME_VERTICALE se l'output è più alto che largo. */
export const frameDi = (output) => (output.height > output.width ? FRAME_VERTICALE : FRAME);

// "split-panel": VS Code e l'app affiancati in alto, il pannello di VS Code (il terminale) sotto
// tutti e due, per tutta la larghezza (director.mjs, palco).
// "stack": solo in un output verticale: il codice, l'anteprima dell'app e il terminale, ciascuno 16:9, in colonna.
// "tower": in un output 16:9, le stesse tre finestre in un quadro alto (anteprima, codice, terminale, dall'alto in basso)
// su cui scivola la camera (camera.mjs, TORRE).
export const STAGES = ["vscode", "app", "split", "split-panel", "stack", "tower", "card"];
const CON_APP = ["app", "split", "split-panel", "stack", "tower"];
// Gli stage disegnati per un quadro 16:9: in un output verticale non ci sono.
const SOLO_ORIZZONTALI = ["vscode", "app", "split", "split-panel", "tower"];
export const ACTIONS = ["wait", "open", "goto", "find", "type", "key", "save", "click", "waitFor", "command", "reload", "scroll", "mark", "unmark", "camera", "speed"];

// LINKED-DATA: le chiavi di `mark` = README.md § "Marks" = opzioniSegno (director.mjs) e DEFAULTS
// di marker.js. MARK_TARGET dice dove (e quando passare oltre), MARK_STYLE come; in testa allo YAML,
// `mark:` ha solo le seconde.
const MARK_TARGET = ["text", "selector", "role", "name", "exact", "page", "timeout", "selection", "after", "tight", "all"];
const MARK_STYLE = ["shape", "width", "dashes", "color", "opacity", "shadow", "draw", "boil", "dim", "overshoot", "wobble", "pad", "seed", "from"];
export const MARK_SHAPES = ["circle", "box", "underline", "arrow"];
// `from` della freccia: da che lato parte l'asta (marker.js, ARROW_FROM). Senza, la freccia sceglie il lato con più spazio.
export const MARK_FROM = ["left", "right", "top-left", "top-right", "bottom-left", "bottom-right"];

const DEFAULTS = {
  title: "",
  // mbPerMinute: il peso del video finale, in MB al minuto come li conta Windows (MiB): 60 ≈ 8 Mbit/s.
  // gif: { width, fps, colors? } fa anche la GIF dopo compose (compose.mjs, gif); colors: 256 di serie.
  // web: { width, fps?, crf?, webm? } fa anche il video per una pagina web (compose.mjs, videoWeb): mp4 e webm muti, e un poster.
  output: { width: 1920, height: 1080, fps: 30, mbPerMinute: 60, gif: null, web: null },
  // Quanto ingrandire l'interfaccia: il viewport CSS è FRAME / zoom, a ogni risoluzione. VS Code a 1.2 si legge su
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
  look: {}, // manopole e token delle card per tutto il video (commons/layout/card.css); la scena li ritocca
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
  const verticale = sb.output.height > sb.output.width;
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
    else if (scena.stage === "stack" && !verticale) errori.push(`${dove}: stage "stack" is for a vertical output (output: { width: 1080, height: 1920 })`);
    else if (verticale && SOLO_ORIZZONTALI.includes(scena.stage))
      errori.push(`${dove}: a vertical output has the stages stack and card: "${scena.stage}" is drawn for 16:9`);
    // `card: beats` è il prototipo condiviso; `card: ./components/mio` uno del progetto (README.md § "Cards").
    if (scena.stage === "card") {
      const c = String(scena.card ?? "");
      if (/^[a-z0-9-]+$/.test(c)) scena.card = `@commons/components/${c}/${c}.js`;
      else if (/^\.\/components\/[a-z0-9-]+$/.test(c)) scena.card = `components/${c.split("/").pop()}/${c.split("/").pop()}.js`;
      if (!existsSync(resolveRef(paths, scena.card)))
        errori.push(`${dove}: card "${c}" not found (a prototype of commons/components, or ./components/<name> in the project)`);
    }
    for (const chiave of ["look", "anim"])
      if (scena[chiave] != null && scena.stage !== "card") errori.push(`${dove}: ${chiave} is for stage: card`);
    errori.push(...controllaLook(scena.look, `${dove}: look`));
    errori.push(...controllaAnim(scena.anim, `${dove}: anim`));
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
    // before: azioni giocate prima che la clip parta. Il loro tempo non si filma: è il taglio (README.md § "Cut").
    if (scena.before != null) {
      errori.push(...controllaAzioni(scena.before, `${dove}: before`));
      if (Array.isArray(scena.before) && scena.before.some((v) => ["mark", "unmark", "camera", "speed"].includes(azione(v ?? {})[0])))
        errori.push(`${dove}: before is played before the clip, never filmed: no mark, unmark, camera or speed there`);
    }
    // speed: il video va più svelto o più piano da lì in poi (speed.mjs, README.md § "Speed"). La voce no: andrebbe fuori passo.
    if (scena.say && Array.isArray(scena.do) && scena.do.some((v) => azione(v ?? {})[0] === "speed"))
      errori.push(`${dove}: speed is for a scene with no voice (say): the voice would go out of step`);
    // camera: la prima inquadratura della scena; l'azione `camera` la muove (camera.mjs, README.md § "Camera").
    const conCamera = scena.camera != null || (Array.isArray(scena.do) && scena.do.some((v) => azione(v ?? {})[0] === "camera"));
    if (conCamera && scena.stage === "card") errori.push(`${dove}: camera is for a stage with pages; a card moves with anim`);
    else if (conCamera && verticale) errori.push(`${dove}: camera is a 16:9 crop: not in a vertical output, where every window is already in view`);
    // Nella torre la camera va a una finestra (e basta: scivola, non zooma); fuori dalla torre `window` non c'è.
    const camere = [scena.camera, ...(Array.isArray(scena.do) ? scena.do.filter((v) => azione(v ?? {})[0] === "camera").map((v) => azione(v)[1]) : [])];
    if (scena.stage === "tower") {
      for (const c of camere.filter((c) => c != null))
        if (c !== "keep" && !(typeof c === "object" && c.window != null)) errori.push(`${dove}: in a tower the camera goes to a window: camera: { window: preview | code | terminal }`);
        else if (typeof c === "object" && (c.width != null || c.pad != null)) errori.push(`${dove}: in a tower the camera slides, it doesn't zoom: no width or pad`);
    } else if (camere.some((c) => c != null && typeof c === "object" && c.window != null)) errori.push(`${dove}: camera window is for stage: tower`);
    if (scena.camera != null) {
      errori.push(...controllaCamera(scena.camera, `${dove}: camera`));
      if (typeof scena.camera === "object" && (scena.camera.time != null || scena.camera.ease != null))
        errori.push(`${dove}: camera (the scene's) is its first frame: no time or ease`);
    }
  }
  errori.push(...controllaAzioni(sb.setup, "setup"));
  if (Array.isArray(sb.setup) && sb.setup.some((v) => ["camera", "speed"].includes(azione(v ?? {})[0]))) errori.push("setup: no camera or speed there, the setup is not filmed");
  errori.push(...controllaSegno(sb.mark, "mark", MARK_STYLE));
  errori.push(...controllaLook(raw.look, "look"));
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
  const { width: ow, height: oh } = sb.output;
  const quadro = frameDi(sb.output);
  const forma = verticale ? ow * 16 === oh * 9 : ow * 9 === oh * 16;
  if (!(ow >= quadro.width && oh >= quadro.height && ow % 2 === 0 && oh % 2 === 0 && forma))
    errori.push(
      `output: 16:9, even, at least ${FRAME.width}×${FRAME.height} (2560×1440, 3840×2160), or 9:16, even, at least ${FRAME_VERTICALE.width}×${FRAME_VERTICALE.height}: the layout is drawn on ${FRAME.width}×${FRAME.height} or ${FRAME_VERTICALE.width}×${FRAME_VERTICALE.height}, a bigger output only adds pixels`,
    );
  if (!(sb.output.mbPerMinute > 0)) errori.push("output.mbPerMinute: the size of the final video, in MB per minute (60 ≈ 8 Mbit/s)");
  const gif = sb.output.gif;
  if (gif != null) {
    if (typeof gif !== "object" || Array.isArray(gif) || Object.keys(gif).some((k) => !["width", "fps", "colors"].includes(k)))
      errori.push("output.gif: { width, fps }, and optionally colors: the GIF made after compose");
    else {
      if (!(Number.isInteger(gif.width) && gif.width >= 160 && gif.width <= 1920)) errori.push("output.gif.width: pixels, an integer between 160 and 1920");
      if (!(typeof gif.fps === "number" && gif.fps >= 1 && gif.fps <= sb.output.fps))
        errori.push(`output.gif.fps: frames a second, between 1 and output.fps (${sb.output.fps})`);
      if (gif.colors != null && !(Number.isInteger(gif.colors) && gif.colors >= 2 && gif.colors <= 256))
        errori.push("output.gif.colors: the palette size, an integer between 2 and 256 (256 when left out)");
    }
  }
  const web = sb.output.web;
  if (web != null) {
    if (typeof web !== "object" || Array.isArray(web) || Object.keys(web).some((k) => !["width", "fps", "crf", "webm"].includes(k)))
      errori.push("output.web: { width }, and optionally fps, crf, webm: the video for a web page made after compose");
    else {
      if (!(Number.isInteger(web.width) && web.width >= 160 && web.width <= 1920 && web.width % 2 === 0))
        errori.push("output.web.width: pixels, an even integer between 160 and 1920");
      if (web.fps != null && !(typeof web.fps === "number" && web.fps >= 1 && web.fps <= sb.output.fps))
        errori.push(`output.web.fps: frames a second, between 1 and output.fps (${sb.output.fps}; output.fps when left out)`);
      if (web.crf != null && !(Number.isInteger(web.crf) && web.crf >= 18 && web.crf <= 40))
        errori.push("output.web.crf: the x264 quality, an integer between 18 and 40 (30 when left out): the higher, the lighter");
      if (web.webm != null && typeof web.webm !== "boolean") errori.push("output.web.webm: true or false (true when left out): the VP9 file next to the mp4");
    }
  }
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
    } else if (chiavi[0] === "camera") {
      const arg = typeof azione === "string" ? null : azione.camera;
      const qui = `${dove}, action ${i + 1} (camera)`;
      if (arg === "keep") errori.push(`${qui}: keep is for the scene's camera, its first frame`);
      else errori.push(...controllaCamera(arg, qui));
    } else if (chiavi[0] === "speed") {
      errori.push(...controllaVelocita(typeof azione === "string" ? null : azione.speed, `${dove}, action ${i + 1} (speed)`));
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
  if (arg.from != null && !MARK_FROM.includes(arg.from)) errori.push(`${dove}: from (the arrow's side) must be one of ${MARK_FROM.join(", ")}`);
  return errori;
}

// `look`: manopole e token delle card (commons/layout/card.css, i colori di site/theme/tokens.css), per nome
// senza i due trattini. Che il token esista lo controlla il browser (layout.look): qui la forma.
function controllaLook(look, dove) {
  if (look == null) return [];
  if (typeof look !== "object" || Array.isArray(look)) return [`${dove}: must be a map of knobs and tokens, as { type-scale: 0.9 }`];
  const errori = [];
  for (const [k, v] of Object.entries(look)) {
    if (!/^[a-z][a-z0-9-]*$/.test(k)) errori.push(`${dove}: "${k}" is not a token name (lowercase, digits and "-", no leading --)`);
    if (v === null || typeof v === "object") errori.push(`${dove}: ${k} must be a plain value`);
  }
  return errori;
}

// `anim`: effetti con nome e tween GSAP grezzi sulla timeline della card (commons/layout/clock.js, apply).
// Una voce ha uno solo fra fx | set | to | from | fromTo, un `target` (selettore CSS) e `at` (≥ 0).
// fx è il nome di un effetto di motion.js (che esista lo dice il browser) e le altre chiavi sono la
// sua configurazione; set, to e from portano le vars di GSAP; fromTo è [vars di partenza, d'arrivo].
export const ANIM = ["fx", "set", "to", "from", "fromTo"];
function controllaAnim(anim, dove) {
  if (anim == null) return [];
  if (!Array.isArray(anim)) return [`${dove}: must be a list`];
  const errori = [];
  const mappa = (v) => v != null && typeof v === "object" && !Array.isArray(v);
  for (const [i, voce] of anim.entries()) {
    const qui = `${dove}[${i}]`;
    if (!mappa(voce)) {
      errori.push(`${qui}: must be a map, as { fx: rise, target: h1, at: 2 }`);
      continue;
    }
    const tipi = ANIM.filter((k) => k in voce);
    if (typeof voce.target !== "string" || !voce.target.trim()) errori.push(`${qui}: needs a target, a CSS selector`);
    if (voce.at != null && !(typeof voce.at === "number" && voce.at >= 0)) errori.push(`${qui}: at is seconds from the take, 0 or more`);
    if (tipi.length !== 1) {
      errori.push(`${qui}: exactly one of ${ANIM.join(", ")} (got ${tipi.join(", ") || "none"})`);
      continue;
    }
    const [tipo] = tipi;
    if (tipo === "fx" && (typeof voce.fx !== "string" || !voce.fx)) errori.push(`${qui}: fx is the name of an effect of commons/layout/motion.js`);
    if (["set", "to", "from"].includes(tipo) && !mappa(voce[tipo])) errori.push(`${qui}: ${tipo} carries GSAP vars, as { opacity: 0.5, duration: 1 }`);
    if (tipo === "fromTo" && !(Array.isArray(voce.fromTo) && voce.fromTo.length === 2 && voce.fromTo.every(mappa)))
      errori.push(`${qui}: fromTo is [from vars, to vars]`);
    if (tipo !== "fx" && Object.keys(voce).some((k) => ![tipo, "target", "at"].includes(k)))
      errori.push(`${qui}: the vars go inside ${tipo}; next to it only target and at`);
  }
  return errori;
}

/** Un'azione dello storyboard come [nome, argomento]: `save` e `{ save: null }` sono la stessa. */
export function azione(voce) {
  if (typeof voce === "string") return [voce, null];
  const [nome] = Object.keys(voce);
  return [nome, voce[nome]];
}
