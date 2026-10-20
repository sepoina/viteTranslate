// La camera virtuale: inquadra una parte del quadro (1920×1080, il FRAME di storyboard.mjs) e scivola
// da un'inquadratura all'altra. Il regista (director.mjs, a_camera) misura i bersagli durante la
// ripresa e scrive i fotogrammi chiave in capture/takes.json; il montaggio (compose.mjs, segmento) li
// trasforma in un filtro zoompan. Qui solo funzioni pure: si provano in node, senza Chrome né ffmpeg.
// LINKED-DATA: chiavi, default e limiti = README.md § "Camera". Cambiane uno, cambia l'altro.
// Il quadro è anche FRAME in storyboard.mjs: qui ripetuto per non importarlo (storyboard.mjs importa
// questo file, e un import circolare è una trappola).
const QW = 1920;
const QH = 1080;

export const CAMERA_MIN = 480; // la larghezza più stretta, in pixel del quadro (zoom 4×): sotto, si sgrana
export const CAMERA_PAD = 40; // il margine attorno al bersaglio, quando non si dà `width`
export const CAMERA_TIME = 0.5; // secondi di un movimento
export const CAMERA_EASES = ["cubic", "sine", "linear"];
export const CAMERA_TARGET = ["text", "selector", "role", "name", "exact", "page", "timeout"];
export const CAMERA_KEYS = [...CAMERA_TARGET, "rect", "pad", "width", "time", "ease", "window"];
// Quanto si ingrandisce il quadro prima di zoompan: zoompan arrotonda x e y al pixel del suo
// ingresso, e a 1× un movimento lento trema. A 2× il tremolio è mezzo pixel del quadro.
export const SOVRACAMPIONA = 2;

export const PIENO = { x: 0, y: 0, width: QW, height: QH };

// La torre (stage "tower"): tre finestre 16:9 una sopra l'altra, nere tra l'una e l'altra, in un quadro alto
// TORRE. La camera non zooma: scivola in verticale, una finestra intera alla volta (filtroPan).
// PIENO è già la prima finestra, in cima: da lì partono i movimenti, come nel quadro 16:9.
// LINKED-DATA: l'ordine e il vuoto = director.mjs (palco, stage tower) e README.md § "Tower".
export const TORRE_VUOTO = 40; // il nero tra due finestre, in pixel del quadro
export const TORRE_FINESTRE = ["preview", "code", "terminal"]; // dall'alto in basso
export const TORRE = { width: QW, height: 3 * QH + 2 * TORRE_VUOTO };

/** La finestra `nome` della torre, nei pixel del quadro alto: l'inquadratura di una camera `window`. */
export function finestraTorre(nome) {
  const i = TORRE_FINESTRE.indexOf(nome);
  if (i < 0) throw new Error(`tower: no window "${nome}" (${TORRE_FINESTRE.join(", ")})`);
  return { x: 0, y: i * (QH + TORRE_VUOTO), width: QW, height: QH };
}

const due = (n) => Math.round(n * 100) / 100;

/**
 * L'inquadratura 16:9 che contiene `box` (pixel del quadro) col suo margine, dentro il quadro.
 * Con `width` la larghezza è quella, centrata sul bersaglio. Mai più stretta di CAMERA_MIN.
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {{ pad?: number, width?: number }} [o]
 */
export function inquadra(box, { pad = CAMERA_PAD, width } = {}) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let w = width ?? Math.max(box.width + 2 * pad, ((box.height + 2 * pad) * QW) / QH);
  w = Math.min(QW, Math.max(CAMERA_MIN, w));
  const h = (w * QH) / QW;
  const x = Math.min(QW - w, Math.max(0, cx - w / 2));
  const y = Math.min(QH - h, Math.max(0, cy - h / 2));
  return { x: due(x), y: due(y), width: due(w), height: due(h) };
}

/** `rect: [x, y, width]` dello YAML (pixel del quadro): l'altezza la dà il 16:9. */
export function daRect([x, y, width]) {
  return inquadra({ x, y, width, height: (width * QH) / QW }, { width });
}

const CURVE = {
  linear: (p) => p,
  cubic: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  sine: (p) => (1 - Math.cos(Math.PI * p)) / 2,
};
// Le stesse curve nel linguaggio delle espressioni di ffmpeg: P è il progresso, da 0 a 1.
const CURVE_FF = {
  linear: (P) => `(${P})`,
  cubic: (P) => `if(lt(${P},0.5),4*pow(${P},3),1-pow(-2*${P}+2,3)/2)`,
  sine: (P) => `(1-cos(PI*${P}))/2`,
};
const COORD = ["x", "y", "width", "height"];

/**
 * Dove sta la camera al secondo `t` della clip. Prima del primo fotogramma chiave: il quadro pieno.
 * Ogni fotogramma chiave parte dal bersaglio di quello prima (o dal quadro pieno) e arriva al suo
 * in `time` secondi. È il modello di filtroCamera: se cambi uno, cambi l'altro.
 * @param {{ t: number, x: number, y: number, width: number, height: number, time: number, ease?: string }[]} chiavi
 */
export function posizione(chiavi, t) {
  let r = PIENO;
  for (const [i, k] of chiavi.entries()) {
    if (t < k.t) break;
    const da = i === 0 ? PIENO : chiavi[i - 1];
    const p = k.time > 0 ? Math.min(1, (t - k.t) / k.time) : 1;
    const e = CURVE[k.ease ?? "cubic"](p);
    r = Object.fromEntries(COORD.map((c) => [c, da[c] + (k[c] - da[c]) * e]));
  }
  return r;
}

/** L'inquadratura con cui finisce una clip (il bersaglio dell'ultimo fotogramma chiave), o null. */
export function ultima(chiavi) {
  const k = chiavi?.at(-1);
  return k ? { x: k.x, y: k.y, width: k.width, height: k.height } : null;
}

// Un numero per un'espressione di ffmpeg: mai in notazione esponenziale.
const num = (n) => String(Number(n.toFixed(3)));

/**
 * La coordinata `c` della camera come espressione di ffmpeg: un if annidato per fotogramma chiave, come
 * posizione(). `T` è l'espressione dei secondi della clip.
 */
function espressione(chiavi, c, T) {
  const tratto = (i) => {
    const k = chiavi[i];
    const da = i === 0 ? PIENO : chiavi[i - 1];
    if (!(k.time > 0)) return num(k[c]);
    const P = `clip((${T}-${num(k.t)})/${num(k.time)},0,1)`;
    return `(${num(da[c])}+(${num(k[c] - da[c])})*${CURVE_FF[k.ease ?? "cubic"](P)})`;
  };
  let e = tratto(chiavi.length - 1);
  for (let i = chiavi.length - 2; i >= 0; i--) e = `if(lt(${T},${num(chiavi[i + 1].t)}),${tratto(i)},${e})`;
  return `if(lt(${T},${num(chiavi[0].t)}),${num(PIENO[c])},${e})`;
}

/**
 * Il filtro ffmpeg della camera per una clip: si appende alla catena video del segmento.
 * Le espressioni sono un if annidato per fotogramma chiave, come posizione().
 * Tra apici singoli: lì dentro le virgole non spezzano il filtergraph. Mai un apice nelle espressioni.
 * @param {object[]} chiavi - i fotogrammi chiave della clip (takes.json, take.camera)
 * @param {{ width: number, height: number, fps: number }} uscita - pixel del segmento (W, H di compose)
 */
export function filtroCamera(chiavi, { width, height, fps }) {
  const T = `(on/${fps})`; // on: il numero del fotogramma in uscita; d=1, quindi uno per ingresso
  const z = `${QW}/${espressione(chiavi, "width", T)}`;
  const x = `iw*${espressione(chiavi, "x", T)}/${QW}`;
  const y = `ih*${espressione(chiavi, "y", T)}/${QH}`;
  return [
    `scale=iw*${SOVRACAMPIONA}:ih*${SOVRACAMPIONA}:flags=lanczos`,
    `zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${width}x${height}:fps=${fps}`,
    "setpts=PTS-STARTPTS",
  ].join(",");
}

/**
 * La camera della torre: un ritaglio fisso (la finestra, width × height) che scivola in verticale sul quadro
 * alto. Niente zoompan: zoompan ritaglia sempre nella proporzione dell'ingresso, e un quadro alto non è 16:9.
 * Niente zoom, quindi niente sovracampionamento: la finestra è già in pixel veri. y è pari: la crominanza del
 * yuv420 è a metà altezza, e crop arrotonda comunque; così lo si dice e non lo si lascia al caso.
 * Senza fotogrammi chiave: la finestra in cima.
 * @param {object[]} chiavi - i fotogrammi chiave della clip (takes.json, take.camera), o null
 * @param {{ width: number, height: number, fps: number }} uscita - pixel della finestra (W, H di compose)
 */
export function filtroPan(chiavi, { width, height, fps }) {
  const y = chiavi?.length ? `2*round(ih*${espressione(chiavi, "y", `(n/${fps})`)}/${TORRE.height}/2)` : "0";
  return `crop=w=${width}:h=${height}:x=0:y='${y}',setpts=PTS-STARTPTS`;
}

/**
 * La forma di una `camera` (della scena o di un'azione), per storyboard.mjs: gli errori, o [].
 * full · selection · keep · { text | selector | role | rect | window, page, exact, name, timeout, pad, width, time, ease }
 * `window` (preview, code, terminal) è per lo stage tower, e lì solo `window`: lo dice storyboard.mjs.
 */
export function controllaCamera(arg, dove) {
  if (arg === "full" || arg === "selection" || arg === "keep") return [];
  if (arg == null || typeof arg !== "object" || Array.isArray(arg))
    return [`${dove}: full, selection, keep, or a map: { text | selector | role | rect | window, … }`];
  const errori = [];
  const ignote = Object.keys(arg).filter((k) => !CAMERA_KEYS.includes(k));
  if (ignote.length) errori.push(`${dove}: unknown keys ${ignote.join(", ")} (allowed: ${CAMERA_KEYS.join(", ")})`);
  const bersagli = ["text", "selector", "role", "rect", "window"].filter((k) => arg[k] != null);
  if (bersagli.length !== 1) errori.push(`${dove}: exactly one target: text, selector, role, rect or window`);
  if (arg.window != null && !TORRE_FINESTRE.includes(arg.window)) errori.push(`${dove}: window is one of ${TORRE_FINESTRE.join(", ")}`);
  if (arg.rect != null) {
    const r = arg.rect;
    if (!Array.isArray(r) || r.length !== 3 || r.some((n) => typeof n !== "number"))
      errori.push(`${dove}: rect is [x, y, width], pixels of the ${QW} × ${QH} frame`);
    else if (r[2] < CAMERA_MIN || r[2] > QW || r[0] < 0 || r[1] < 0 || r[0] + r[2] > QW || r[1] + (r[2] * QH) / QW > QH)
      errori.push(`${dove}: rect must lie inside the ${QW} × ${QH} frame, at least ${CAMERA_MIN} wide`);
  }
  if (arg.width != null && !(typeof arg.width === "number" && arg.width >= CAMERA_MIN && arg.width <= QW))
    errori.push(`${dove}: width is between ${CAMERA_MIN} and ${QW}, pixels of the frame`);
  if (arg.pad != null && !(typeof arg.pad === "number" && arg.pad >= 0)) errori.push(`${dove}: pad is pixels of the frame, 0 or more`);
  if (arg.time != null && !(typeof arg.time === "number" && arg.time >= 0)) errori.push(`${dove}: time is seconds, 0 or more (0: a cut)`);
  if (arg.ease != null && !CAMERA_EASES.includes(arg.ease)) errori.push(`${dove}: ease is one of ${CAMERA_EASES.join(", ")}`);
  return errori;
}
