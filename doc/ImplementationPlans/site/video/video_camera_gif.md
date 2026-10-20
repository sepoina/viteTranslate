# Piano video — taglio, camera e GIF (per `gif10`)

> [!NOTE]
> **Per il revisore umano**
> - Tre funzioni nuove nella pipeline di `site/video`, tutte parametri facoltativi: chi non li usa non vede differenze.
> - **Taglio:** la chiave di scena `before:` esegue azioni *prima* che la clip parta. Il loro tempo non si filma (l'attesa dell'LLM).
> - **Camera:** un ritaglio 16:9 del quadro 1920×1080 che scivola tra un'inquadratura e l'altra. Chiave di scena `camera:` (prima inquadratura) e azione `camera:` (movimenti). Il regista misura i bersagli durante la ripresa, il montaggio applica `zoompan`.
> - **GIF:** `output.gif: { width, fps }` produce `output/<progetto>.gif` dopo `compose`, con palette in due passate.
> - Nuovo modulo puro `commons/cli/camera.mjs`, provato in node; ritocchi a `storyboard.mjs`, `director.mjs`, `record.mjs`, `compose.mjs`.
> - Poi la fixture e la conversione di `projects/gif10`, la ripresa, la GIF da 800 px a 12 fps.
> - **Costo:** ogni ripresa di gif10 lancia una traduzione vera su OpenRouter (frazioni di centesimo). Nessuna voce.
> - **Effetto collaterale atteso:** cambiano `director.mjs` e `record.mjs`, quindi la prossima `record` di *ogni* progetto rigira tutto (impronta del palco).

> [!TIP]
> **logDiary (2026-10-19)**
> - Sette fasi fatte. Test: 70 → 117 (camera, GIF, `before`, `colors`, `speed`). `npm run commit -- --dry-run` OK dopo la fase 6; da rilanciare dopo `colors` e `speed`.
> - Domande all'utente e risposte: **`split` → `split-panel`** per `write`, `translate`, `french` (nello `split` il terminale è stretto e la riga della corsa LLM va a capo: `waitFor` andava in timeout); `camera.mjs` **fuori** dall'impronta del palco.
> - Numeri: `SOVRACAMPIONA` 2, `typeDelay` 35, ritagli `rect` misurati sulle strisce. gif10: 10,7 s, 800×450, 12 fps, 2,1 MB, loop; nessun lampo a quadro pieno ai confini.
> - Trovato: il modello ragionava il 92% dell'output (`providerOptions: { reasoning: { enabled: false } }` nella fixture: la corsa dura meno di un secondo); il pannello aperto da `palco` ruba il focus (un `before` con `View: Focus Active Editor Group`); `--to` toglie dal `takes.json` le scene dopo; il commit citato dal piano per la vecchia fixture di compare è `580676a^`; il piano B "bayer_scale 5→3" peggiora il peso.
> - Oltre il piano, su richiesta dell'utente: **gif20** (20 s, "indietro e avanti" ad ogni spostamento di camera), `output.gif.colors`, e l'azione **`speed`** (cambio di velocità al posto del taglio, solo in scene senza voce), il quadro verticale (`stack`) e la **torre** (`tower`: tre finestre in colonna, camera che ci scivola sopra). Dei progetti di prova resta solo **gif20t**: gif10, gif20 e gif20v sono stati cancellati su richiesta (erano non tracciati), la sua GIF è copiata in `doc/workflow.gif`. Vedi `site/video/projects/index.md`.

> [!IMPORTANT]
> - La prossima `record` di **ogni** progetto rigira tutto. `compare2` e `quickstart` non si caricano (già prima: fixture cancellata, cartella assente).
> - `output/` di gif20t ha una GIF, un `.srt` **vuoto** e un poster che git aggiungerebbe: da decidere (solo l'mp4 è in `.gitignore`).
> - Un terminale del task **video: live** rimasto aperto con il vecchio percorso `uty/live.mjs` fallisce: chiuderlo e rilanciare il task.

---

## La richiesta (2026-10-19)

> prepara il piano per una intelligenza inferiore alla tua

Contesto: lo storyboard `site/video/projects/gif10/storyboard.md` (la GIF di 10 s della campagna) chiede tre cose che la pipeline non fa: un **taglio** durante l'attesa della corsa LLM, una **camera** che zooma dove va l'attenzione (a 800 px un quadro intero non si legge), un'**uscita GIF** (800 px, 12 fps, loop). Le scelte sono state fatte con l'utente in chat (taglio sì, camera sì, card finale sì).

## Decisioni

| Tema | Decisione | Perché |
| :- | :- | :- |
| Come si fa il taglio | chiave di scena `before:`, una lista di azioni giocate dopo `palco` e prima che partano i recorder | il confine tra due clip è già un taglio: basta che l'attesa cada fuori dalla clip. Generale: serve a qualsiasi attesa (un reload, una build) |
| Cosa è vietato in `before` | `mark`, `unmark`, `camera` | non si filma: un segno lì non lo vede nessuno |
| Dove vive la camera | **misura** in `director.mjs` (durante la ripresa, dove gli elementi esistono), **applicazione** in `compose.mjs` (ffmpeg) | solo durante la ripresa si sa dove sta un bottone; il montaggio può rifarsi senza rigirare |
| Coordinate | tutto in **pixel del quadro** (FRAME 1920×1080), come segni e offset | indipendenti da `output` (2K, 4K) e dall'anteprima a 960 |
| Forma | sempre **16:9**, larghezza minima **480** px del quadro (zoom 4×) | l'uscita è 16:9; sotto 480 l'immagine si sgrana |
| Movimento | interpolazione del rettangolo con curva `cubic` (default), `sine` o `linear`; **0,5 s** di default | "movimenti morbidi, circa mezzo secondo" (storyboard) |
| L'azione `camera` aspetta? | **no**: registra il fotogramma chiave e passa oltre; il movimento avviene nel montaggio mentre le azioni dopo vanno avanti | come una camera vera: si muove mentre succede la cosa |
| Prima inquadratura | chiave di scena `camera:`, misurata **prima** che partano i recorder | un'azione al primo istante costerebbe 1–3 fotogrammi a quadro pieno (lampo) |
| Continuità tra scene | `camera: keep` = la scena parte dove la precedente è finita | "senza stacco" (storyboard: translate, french) |
| Filtro ffmpeg | `scale` 2× poi `zoompan` con espressioni a tratti, tempo `on/fps` | `crop` valuta w/h una sola volta (niente zoom); `zoompan` valuta z, x, y per fotogramma. `on` esiste in ogni ffmpeg; `it` no |
| GIF da cosa | dai **segmenti** quasi senza perdita (la lista concat di `compose`), non dall'mp4 finale | niente doppia compressione |
| GIF come | `palettegen=stats_mode=diff` poi `paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, `-loop 0` | la ricetta standard per GIF di interfacce: colori puliti, peso basso |
| GIF e impronta | `output.gif` **non** entra nell'impronta del palco (come `mbPerMinute`) | cambiarla chiede solo `compose` |
| Strisce e foglio di contatto | **senza** camera | servono a controllare la ripresa, non il montaggio |

## Fuori perimetro

- Nessun formato verticale (9:16): `output` resta 16:9.
- Nessuna camera sulle card (`stage: card`): una card si muove con `anim`.
- Nessuna modifica a `tts.mjs`, `music.mjs`, `subject.mjs`, alla forgia delle card, all'estensione o alla libreria.
- Nessun cambiamento ai progetti esistenti (`quick2`, `compare2`, `quickstart`): li tocca solo l'impronta (rigirano alla prossima `record`, ma nessuno la lancia in questo piano).

---

## Regole per chi implementa (leggere prima di tutto)

1. **Leggi prima** `site/video/README.md` per intero e `site/video/projects/index.md`: comandano la cartella (AGENTS.md § "REGOLE DI SITE/VIDEO"). Poi questo piano.
2. **Sette fasi, in ordine:** 1 implementazione · 2 test · 3 build (qui: le riprese) · 4 revisione · 5 documentazione · 6 pulizia · 7 logDiary. Non saltarne, non mescolarle. Alla fine di ogni fase scrivi all'utente una riga: "Fase N fatta: …".
3. **File di appoggio**, accanto a questo piano, creati quando servono:
   - `video_camera_gif.necessarytest.md`: i test che ti vengono in mente durante la fase 1 (li scrivi in fase 2).
   - `video_camera_gif.necessarydoc.md`: le modifiche ai documenti che noti in fase 1 (le fai in fase 5).
   - `video_camera_gif.necessaryreview.md`: solo se in fase 3–4 qualcosa del piano non regge (vedi fase 4).
4. **Ogni dubbio è una domanda all'utente** (ask), non un'improvvisazione. In particolare: una contraddizione tra questo piano e i sorgenti; uno storyboard che non si può girare com'è scritto; un numero (tempi, larghezze) che non torna con le prove.
5. **Mai modificare `storyboard.md`** (README § "Rules for agents", regola 2). Se va cambiato, lo chiedi all'utente.
6. **Lingua:** commenti nel codice in **italiano**, come il codice intorno (nomi italiani: `regista`, `scena`, `errori`…). Messaggi d'errore e README di `site/video` in **inglese**.
7. **Git:** niente `git checkout/restore/reset/stash/clean` su file che non hai modificato tu in questa sessione. **Non committare:** alla fine consegni all'utente un comando `npm run commit "…"` con il testo proposto.
8. **Una ripresa alla volta**, da `site/video`, con timeout ≥ 5 minuti (o in background, leggendo `log/run.log`). Prima di lanciarla di' all'utente cosa fa: la guarda dal vivo (README § "Watching a run").
9. **Mai la voce vera** (non serve: gif10 non ha voce). Ogni `record` di gif10 lancia però una traduzione LLM vera: avvisa l'utente prima della prima.
10. **Non toccare** `.cache/`, `node_modules/`, le cartelle generate (`audio/`, `capture/`, `preview/`, `output/`, `log/`): non vanno in git.

---

## Mappa dei file

| File | Cosa cambia |
| :- | :- |
| `site/video/commons/cli/camera.mjs` | **nuovo**: costanti, `inquadra`, `daRect`, `posizione`, `ultima`, `filtroCamera`, `controllaCamera` (funzioni pure) |
| `site/video/commons/cli/storyboard.mjs` | `DEFAULTS.output.gif`, `camera` in `ACTIONS`, convalida di `before`, `camera` (scena e azione), `output.gif` |
| `site/video/commons/cli/director.mjs` | `palco` ricorda le viste; campi camera; `iniziaCamera`, `fineCamera`, `rettangolo`, `nelQuadro`, `a_camera` |
| `site/video/commons/cli/record.mjs` | `before` (scene girate e tenute), prima inquadratura, `camera` nel take, `ultimaCamera` per le tenute, `gif` fuori dall'impronta |
| `site/video/commons/cli/compose.mjs` | filtro camera in `segmento`; nuova `gif()`; chiamata dopo il finale; `compose` restituisce anche `gif` |
| `site/video/commons/cli/run.mjs` | stampa il percorso della GIF |
| `site/video/commons/test/camera.test.mjs` | **nuovo**: test di `camera.mjs` e di `gif()` |
| `site/video/commons/test/storyboard.test.mjs` | casi nuovi: `before`, `camera`, `output.gif` |
| `site/video/projects/gif10/fixture/` | **nuova**: copia di `demo/Vite_8/quickApp` con il blocco `llm` |
| `site/video/projects/gif10/storyboard.yaml` | **nuovo**: la conversione, poi `stamp` |
| `site/video/README.md` | sezioni nuove e ritocchi (fase 5) |
| `site/video/projects/index.md` | tabella, "Next", voce di diario (fase 5) |

---

## Fase 1 — Implementazione

Ordine consigliato: 1.1 → 1.7. Dopo ogni passo che tocca il codice, prova veloce: `cd site/video && node -e "import('./commons/cli/storyboard.mjs')"` (si carica?) e, da 1.2 in poi, `npm test` (gira tutto in pochi secondi, la forgia vuole Chrome).

### 1.1 `camera.mjs` (nuovo)

Crea `site/video/commons/cli/camera.mjs` con questo contenuto (completo: puoi incollarlo, poi leggilo riga per riga e capiscilo).

```js
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
export const CAMERA_KEYS = [...CAMERA_TARGET, "rect", "pad", "width", "time", "ease"];
// Quanto si ingrandisce il quadro prima di zoompan: zoompan arrotonda x e y al pixel del suo
// ingresso, e a 1× un movimento lento trema. A 2× il tremolio è mezzo pixel del quadro.
export const SOVRACAMPIONA = 2;

export const PIENO = { x: 0, y: 0, width: QW, height: QH };

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
 * Il filtro ffmpeg della camera per una clip: si appende alla catena video del segmento.
 * Le espressioni sono un if annidato per fotogramma chiave, come posizione().
 * Tra apici singoli: lì dentro le virgole non spezzano il filtergraph. Mai un apice nelle espressioni.
 * @param {object[]} chiavi - i fotogrammi chiave della clip (takes.json, take.camera)
 * @param {{ width: number, height: number, fps: number }} uscita - pixel del segmento (W, H di compose)
 */
export function filtroCamera(chiavi, { width, height, fps }) {
  const T = `(on/${fps})`; // on: il numero del fotogramma in uscita; d=1, quindi uno per ingresso
  const valore = (c) => {
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
  };
  const z = `${QW}/${valore("width")}`;
  const x = `iw*${valore("x")}/${QW}`;
  const y = `ih*${valore("y")}/${QH}`;
  return [
    `scale=iw*${SOVRACAMPIONA}:ih*${SOVRACAMPIONA}:flags=lanczos`,
    `zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${width}x${height}:fps=${fps}`,
    "setpts=PTS-STARTPTS",
  ].join(",");
}

/**
 * La forma di una `camera` (della scena o di un'azione), per storyboard.mjs: gli errori, o [].
 * full · selection · keep · { text | selector | role | rect, page, exact, name, timeout, pad, width, time, ease }
 */
export function controllaCamera(arg, dove) {
  if (arg === "full" || arg === "selection" || arg === "keep") return [];
  if (arg == null || typeof arg !== "object" || Array.isArray(arg))
    return [`${dove}: full, selection, keep, or a map: { text | selector | role | rect, … }`];
  const errori = [];
  const ignote = Object.keys(arg).filter((k) => !CAMERA_KEYS.includes(k));
  if (ignote.length) errori.push(`${dove}: unknown keys ${ignote.join(", ")} (allowed: ${CAMERA_KEYS.join(", ")})`);
  const bersagli = ["text", "selector", "role", "rect"].filter((k) => arg[k] != null);
  if (bersagli.length !== 1) errori.push(`${dove}: exactly one target: text, selector, role or rect`);
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
```

**Prova veloce** (da `site/video`):

```sh
node --input-type=module -e "import { inquadra, filtroCamera } from './commons/cli/camera.mjs'; console.log(inquadra({x:100,y:100,width:200,height:40})); console.log(filtroCamera([{t:0,x:0,y:0,width:1920,height:1080,time:0},{t:1,x:480,y:270,width:960,height:540,time:0.5,ease:'cubic'}],{width:1920,height:1080,fps:30}))"
```

Atteso: `{ x: 0, y: 0, width: 480, height: 270 }` (il minimo, centrato su (200, 120) e spinto dentro il quadro); un filtro di una riga con `scale=…,zoompan=z='…':x='…':y='…':d=1:s=1920x1080:fps=30,setpts=PTS-STARTPTS`.

> [!TIP]
> **Già verificato in pianificazione (2026-10-19)**, con l'`ffmpeg-static` di `site/video`: questo blocco, estratto dal piano, si carica; il filtro di due chiavi (pieno, poi zoom 2× al centro) su `testsrc2` 1920×1080 esce 0, dura 2,00 s, e a 1,5 s mostra esattamente la fascia x 480–1440 del quadro di prova. Anche la ricetta GIF della 1.5 (palette in due passate, `-loop 0`) produce un `GIF89a` valido. Se qualcosa non va, il problema è nell'integrazione, non qui.

### 1.2 `storyboard.mjs`

1. **Import** in testa, dopo quello di `music.mjs`:
   ```js
   import { controllaCamera } from "./camera.mjs";
   ```
2. **`ACTIONS`** (riga ~28): aggiungi `"camera"` in fondo alla lista.
3. **`DEFAULTS.output`** (riga ~40): diventa `{ width: 1920, height: 1080, fps: 30, mbPerMinute: 60, gif: null }`. Aggiungi al commento sopra: `gif: { width, fps } fa anche la GIF dopo compose (compose.mjs, gif).`
4. **Nel ciclo delle scene** di `loadProject`, subito dopo la riga `errori.push(...controllaAzioni(scena.do, dove));`, aggiungi:
   ```js
   // before: azioni giocate prima che la clip parta. Il loro tempo non si filma: è il taglio (README.md § "Cut").
   if (scena.before != null) {
     errori.push(...controllaAzioni(scena.before, `${dove}: before`));
     if (Array.isArray(scena.before) && scena.before.some((v) => ["mark", "unmark", "camera"].includes(azione(v ?? {})[0])))
       errori.push(`${dove}: before is played before the clip, never filmed: no mark, unmark or camera there`);
   }
   // camera: la prima inquadratura della scena; l'azione `camera` la muove (camera.mjs, README.md § "Camera").
   const conCamera = scena.camera != null || (Array.isArray(scena.do) && scena.do.some((v) => azione(v ?? {})[0] === "camera"));
   if (conCamera && scena.stage === "card") errori.push(`${dove}: camera is for a stage with pages; a card moves with anim`);
   if (scena.camera != null) {
     errori.push(...controllaCamera(scena.camera, `${dove}: camera`));
     if (typeof scena.camera === "object" && (scena.camera.time != null || scena.camera.ease != null))
       errori.push(`${dove}: camera (the scene's) is its first frame: no time or ease`);
   }
   ```
   `azione` è la funzione esportata in fondo al file: è una dichiarazione di funzione, quindi si può usare qui sopra.
5. **In `controllaAzioni`**, dopo il ramo `else if (chiavi[0] === "mark") { … }`, aggiungi un ramo gemello:
   ```js
   else if (chiavi[0] === "camera") {
     const arg = typeof azione === "string" ? null : azione.camera;
     const qui = `${dove}, action ${i + 1} (camera)`;
     if (arg === "keep") errori.push(`${qui}: keep is for the scene's camera, its first frame`);
     else errori.push(...controllaCamera(arg, qui));
   }
   ```
   Attenzione: dentro `controllaAzioni` la variabile del ciclo si chiama `azione` e copre la funzione omonima. Il ramo `mark` fa già così: copia lo stesso schema, non usare la funzione lì dentro.
6. **Setup senza camera**: subito dopo `errori.push(...controllaAzioni(sb.setup, "setup"));` aggiungi:
   ```js
   if (Array.isArray(sb.setup) && sb.setup.some((v) => azione(v ?? {})[0] === "camera")) errori.push("setup: no camera there, the setup is not filmed");
   ```
7. **`output.gif`**: subito dopo la riga del controllo `output.mbPerMinute`, aggiungi:
   ```js
   const gif = sb.output.gif;
   if (gif != null) {
     if (typeof gif !== "object" || Array.isArray(gif) || Object.keys(gif).some((k) => !["width", "fps"].includes(k)))
       errori.push("output.gif: { width, fps }, the GIF made after compose");
     else {
       if (!(Number.isInteger(gif.width) && gif.width >= 160 && gif.width <= 1920)) errori.push("output.gif.width: pixels, an integer between 160 and 1920");
       if (!(typeof gif.fps === "number" && gif.fps >= 1 && gif.fps <= sb.output.fps))
         errori.push(`output.gif.fps: frames a second, between 1 and output.fps (${sb.output.fps})`);
     }
   }
   ```
8. Aggiorna il commento `LINKED-DATA` in testa al file? Dice già "chiavi, default e azioni accettate qui sono documentati in README.md". Basta così.

**Prova veloce:** `npm test` deve restare verde (i test esistenti non conoscono le chiavi nuove: non devono rompersi).

### 1.3 `director.mjs`

1. **Import**: aggiungi `CAMERA_TIME, PIENO, daRect, inquadra` da `./camera.mjs`. Guarda come sono scritti gli import in testa al file e segui lo stesso stile.
2. **Costruttore** (dopo `this.pendenti = [];`):
   ```js
   // La camera (camera.mjs): i fotogrammi chiave della scena in ripresa, misurati dallo zero della
   // clip; null fuori da una clip (setup, avanti veloce). ultimaCamera: come è finita la scena prima (`keep`).
   this.viste = [];
   this.cameraT0 = null;
   this.camera = [];
   this.ultimaCamera = null;
   ```
3. **`palco(scena)`**: subito prima di `return viste;` aggiungi `this.viste = viste; // la camera misura nel quadro: dove sta ogni pagina`.
4. **Metodi nuovi**, da mettere dopo `a_unmark` / `cancellaSegni`, nello stesso stile (commento sopra ogni metodo):
   ```js
   /** Lo zero della clip per la camera, e la sua prima inquadratura (già misurata, o null). */
   iniziaCamera(t0, apertura) {
     this.cameraT0 = t0;
     this.camera = apertura ? [{ t: 0, ...apertura, time: 0, ease: "linear" }] : [];
   }

   /** Il taglio: i fotogrammi chiave della clip (o null) per takes.json; la scena dopo può ripartire da qui. */
   fineCamera() {
     const chiavi = this.camera.splice(0);
     this.cameraT0 = null;
     const k = chiavi.at(-1);
     this.ultimaCamera = k ? { x: k.x, y: k.y, width: k.width, height: k.height } : null;
     return chiavi.length ? chiavi : null;
   }

   /** Un riquadro di una pagina (pixel CSS, quelli di boundingBox) in pixel del quadro. */
   nelQuadro(nome, box) {
     const v = this.viste.find((v) => v.page === nome);
     if (!v) throw new Error(`camera: the page "${nome}" is not on this stage`);
     const z = this.project.zoom[nome];
     return { x: box.x * z + v.x / this.k, y: box.y * z + v.y / this.k, width: box.width * z, height: box.height * z };
   }

   /** L'inquadratura che una `camera` chiede (camera.mjs): full, keep, selection, rect, o un bersaglio come per click. */
   async rettangolo(arg, scena) {
     if (arg === "full") return PIENO;
     if (arg === "keep") return this.ultimaCamera ?? PIENO;
     if (arg.rect) return daRect(arg.rect);
     if (arg === "selection") return inquadra(this.nelQuadro("vscode", await selezione(this.pages.vscode)));
     const { nome, page } = this.paginaDi(arg, scena);
     const box = await (await trova(page, arg, (arg.timeout ?? 15) * 1000)).boundingBox();
     if (!box) throw new Error(`camera: ${JSON.stringify(arg)} has no box`);
     return inquadra(this.nelQuadro(nome, box), arg);
   }

   // camera: { text | selector | role | rect, page, width, pad, time, ease } · full · selection: la camera
   // scivola su quel riquadro. Non aspetta: il movimento lo fa il montaggio, mentre le azioni dopo vanno avanti.
   async a_camera(arg, scena) {
     if (this.veloce || this.cameraT0 == null) return; // fuori da una clip la camera non serve
     const t = (performance.now() - this.cameraT0) / 1000; // prima di cercare: il movimento parte quando l'azione comincia
     const r = await this.rettangolo(arg, scena);
     const prima = this.camera.at(-1);
     if (prima && t < prima.t + prima.time - 0.01)
       this.avvisa(`camera: a move starts ${(prima.t + prima.time - t).toFixed(2)} s before the last one ends`);
     this.camera.push({ t: Math.round(t * 1000) / 1000, ...r, time: arg?.time ?? CAMERA_TIME, ease: arg?.ease ?? "cubic" });
   }
   ```
   Note per capire:
   - `"full".time` è `undefined`: per le forme stringa valgono i default.
   - `boundingBox()` di Playwright dà coordinate rispetto alla pagina principale anche per gli elementi dentro una webview (iframe): `nelQuadro` funziona anche per il pannello dell'estensione.
   - `v.x` e `v.y` sono pixel del **video**; dividere per `this.k` li porta in pixel del **quadro**.
   - `selezione` e `trova` sono funzioni già presenti in fondo al file: non duplicarle.
5. **`esegui`**: la riga che calcola `pagina` per le sonde va bene così (usa `arg?.page`). Non toccarla.

### 1.4 `record.mjs`

1. **Import**: `import { ultima } from "./camera.mjs";`
2. **`impronte()`** (riga ~90): nella destrutturazione cambia `output: { mbPerMinute, ...formato }` in `output: { mbPerMinute, gif, ...formato }`, e aggiorna il commento sopra: `// mbPerMinute e gif pesano solo sul montaggio: cambiarli non chiede di rigirare.`
3. **Scene tenute** (il ramo `if (i < start) { … }`): dopo `await regista.palco(scena);` aggiungi
   ```js
   await regista.esegui(scena.before, scena, { veloce: !pieno }); // lo stato che il taglio aspettava (README.md § "Cut")
   ```
   e, prima di `takes.push({ ...prima.takes[i], fingerprint: nuove.scenes[i] });`, aggiungi
   ```js
   regista.ultimaCamera = ultima(prima.takes[i].camera); // `keep` nella scena dopo riparte da qui
   ```
4. **Scene girate**: dopo `const viste = await regista.palco(scena);` aggiungi
   ```js
   // Il taglio: `before` gioca prima che i recorder partano, il suo tempo non è nella clip (README.md § "Cut").
   await regista.esegui(scena.before, scena);
   // La prima inquadratura, misurata prima della clip: nessun fotogramma a quadro pieno in testa.
   const apertura = scena.camera ? await regista.rettangolo(scena.camera, scena) : null;
   ```
   Poi, subito dopo `const t0Epoch = Date.now(); // l'orologio delle sonde`, aggiungi
   ```js
   regista.iniziaCamera(t0, apertura);
   ```
   Infine, nell'oggetto `take`, dopo `say: …`, aggiungi
   ```js
   camera: regista.fineCamera(), // i fotogrammi chiave della camera (camera.mjs), o null
   ```
   **Attenzione:** `fineCamera()` va chiamata **dopo** `esegui(scena.do, …)` e l'attesa finale, cioè dove costruisci il `take`: è lì. Il nome `prima` nel ciclo è già usato per il vecchio `takes.json`: per la prima inquadratura usa `apertura`, come sopra.
5. **Commento in testa al file**: aggiungi una riga: `// before (le azioni prima della clip: il taglio) e la camera (camera.mjs) entrano qui: takes.json porta i fotogrammi chiave.`

### 1.5 `compose.mjs`

1. **Import**: `import { filtroCamera } from "./camera.mjs";` e aggiungi `statSync` all'import da `node:fs`.
2. **`segmento()`**: dopo la riga `let video = \`${uscita}fps=${fps},tpad=…,setpts=PTS-STARTPTS\`;` aggiungi
   ```js
   // La camera (camera.mjs): il ritaglio che scivola, prima delle dissolvenze. Senza fotogrammi chiave, niente.
   if (take.camera?.length) video += `,${filtroCamera(take.camera, { width: W, height: H, fps })}`;
   ```
   `W` e `H` arrivano già a `segmento` (sono in scala per l'anteprima): non ricalcolarli.
3. **Nuova funzione esportata** `gif`, in fondo alla sezione del montaggio (prima di "sottotitoli"):
   ```js
   /**
    * La GIF del video: dai segmenti quasi senza perdita (non dal finale, già compresso), in due
    * passate: la palette dei colori che il video usa davvero, poi la GIF con quella palette. In loop.
    * @param {{ input: string[], file: string, width: number, fps: number, tmp: string }} p - input: gli argomenti -i di ffmpeg
    */
   export async function gif({ input, file, width, fps, tmp }) {
     const palette = join(tmp, "palette.png");
     const scala = `fps=${fps},scale=${width}:-1:flags=lanczos`;
     await ffmpeg([...input, "-vf", `${scala},palettegen=stats_mode=diff`, palette]);
     await ffmpeg([...input, "-i", palette, "-lavfi", `${scala}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, "-loop", "0", file]);
     rmSync(palette, { force: true });
   }
   ```
4. **In `compose()`**, nel ramo `else` di `if (preview) { … } else { … }` (quello che scrive `.srt`, `credits.txt`, `poster.jpg`), in fondo, aggiungi:
   ```js
   // output.gif: la GIF accanto all'mp4 (README.md § "GIF").
   const fileGif = join(dir, `${project.name}.gif`);
   if (project.output.gif) {
     await gif({ input: ["-f", "concat", "-safe", "0", "-i", fileLista], file: fileGif, ...project.output.gif, tmp: segDir });
     console.log(`  gif: ${project.output.gif.width} px, ${project.output.gif.fps} fps, ${(statSync(fileGif).size / MIB).toFixed(1)} MB`);
   } else rmSync(fileGif, { force: true });
   ```
   E cambia il `return` finale in `return { video, duration: totale, gif: !preview && project.output.gif ? join(dir, \`${project.name}.gif\`) : null };`.
   Nota: `project.output.gif` viene dallo YAML (loadProject), non da `takes.json`: va bene così, la GIF non è nell'impronta.
5. **Commento in testa**: nella riga `compose → output/<progetto>.mp4, …` aggiungi `output/<progetto>.gif (con output.gif)`.

### 1.6 `run.mjs`

Nel ramo `if (passo === "preview" || passo === "compose")`: prendi anche `gif` dal risultato e, se c'è, stampa `console.log(\`  ${gif}\`);` dopo la riga del video.

### 1.7 La fixture di gif10

1. Crea `site/video/projects/gif10/fixture/` copiando da `demo/Vite_8/quickApp/` **solo**: `index.html`, `package.json`, `src/`, `locale/`, `vite.config.js`. Non copiare `node_modules`, `dist`, `.vite`, `README.md`. (Le dipendenze arrivano dai `node_modules` del repo: `servers.mjs`, `startApp`.)
2. In `fixture/vite.config.js`:
   - **togli** la riga `// DOCS-PAGE: …` (questa copia non è una sorgente del manuale);
   - aggiungi il blocco `llm` **identico** a quello della vecchia fixture di compare (recuperabile con `git show 580676a:site/video/projects/compare/fixture/vite.config.js`), con il commento LINKED-DATA che punta a gif10:
   ```js
   // LINKED-DATA: the video "gif10" (site/video/projects/gif10/storyboard.yaml, scenes translate and french)
   // runs --llm-translate from the panel. The key never lands here: the pipeline hands
   // OPENROUTER_API_KEY to VS Code's terminals (vscode.env in the YAML).
   llm: {
     connection: {
       baseURL: "https://openrouter.ai/api/v1",
       model: "deepseek/deepseek-v4.1-flash",
       apiKeyEnv: "OPENROUTER_API_KEY",
       costMillionInput: 0.15, // OpenRouter, October 2026
       costMillionOutput: 0.6,
     },
     costGuard: 0.05, // one key costs far less: no question on camera
     context: { mode: "off" }, // one request, not two
   },
   ```
3. Controlla che `fixture/src/App.jsx` abbia la riga 9 uguale a `      </p>` (la chiusura del primo paragrafo): la conversione ci fa `goto: 9`.
4. Controllo veloce: `git status` deve mostrare solo file nuovi sotto `projects/gif10/fixture/`.

### 1.8 La conversione di gif10

Segui **README § "Converting"** passo per passo. Questa è una bozza di partenza, da verificare sui sorgenti e sulle prove (selettori e numeri marcati `# verifica` sono ipotesi):

```yaml
# Generated from storyboard.md (the source of truth) following site/video/README.md.
# Content (scenes, order) lives in storyboard.md; tune the technique here.
# Run from site/video: `node commons/cli/run.mjs gif10 record preview` to rehearse (no voice in this project).
#
# LINKED-DATA: the fixture is projects/gif10/fixture: demo/Vite_8/quickApp plus an `llm` block (OpenRouter,
# a DeepSeek model, costGuard so it never asks). `goto: 9` is the closing </p> of the first paragraph of its
# src/App.jsx. Panel selectors: idePlugin/src/webViews (commandBar data-cmd, the LLM page's `.azione[data-value]`).
# Translate runs the sync itself (`--llm-translate`: "Sync, then fill the null keys"). Change those, check this.

title: viteTranslate in ten seconds
fixture: site/video/projects/gif10/fixture
app:
  port: 5199
  style: "@commons/layout/app-dark.css"
vscode:
  settings:
    "terminal.integrated.gpuAcceleration": "off" # the terminal's text can be found by waitFor and camera
  env: [OPENROUTER_API_KEY] # --llm-translate, run from the panel's terminal
output:
  gif: { width: 800, fps: 12 } # "GIF larga 800 px, 12 fps"
fade: [0, 0] # "nessuna dissolvenza": the loop closes clean on the first frame
typeDelay: 35 # "la digitazione è svelta ma si legge tutta"  # verifica
poster: { scene: french, at: 3 } # the page in French  # verifica

setup:
  - click: { selector: '.activitybar [aria-label^="viteTranslate"]' }
  - waitFor: { selector: 'vscode-button[data-cmd="sync"]', timeout: 60 }
  - wait: 2
  - open: src/App.jsx
  - wait: 3
  - click: { selector: 'vscode-button[data-cmd="llm"]' } # "la pagina LLM è aperta prima della ripresa"
  - wait: 1.5 # its checks: the key, the settings, a ping
  - goto: 9

scenes:
  - id: write
    stage: split
    camera: { selector: ".monaco-editor .cursors-layer .cursor", width: 1100 } # verifica: the line being typed, with a strip of the panel
    do:
      - key: Enter
      - type: "<p><Trans>Nice to see you, {name}!</Trans></p>"
      - save
      - camera: { page: app, text: "Nice to see you, Ada!", exact: false, width: 900 } # verifica
      - waitFor: { page: app, text: "Nice to see you", exact: false }
      - wait: 0.8 # "il browser resta fermo un attimo sulla frase nuova"

  - id: translate
    stage: split
    camera: keep # "senza stacco"
    do:
      - camera: { selector: '#actions .azione[data-value="translate"]', width: 1000 } # verifica
      - wait: 0.5
      - click: { selector: '#actions .azione[data-value="translate"]' }
    hold: 0.2 # "subito dopo il clic, il taglio"

  - id: french
    stage: split
    before: # the cut: the LLM's run is never on screen
      - waitFor: { text: "Full translate!", exact: false, timeout: 90 }
      - wait: 1.5 # the last write reloads the page, back in English
    camera: { text: "Full translate!", exact: false, width: 900 } # "per un attimo la camera è sul terminale"  # verifica
    do:
      - wait: 0.5 # "mezzo secondo, non di più"
      - camera: { page: app, text: "Welcome back", exact: false, width: 900 } # verifica
      - wait: 0.5
      - click: { page: app, text: Français }
      - waitFor: { page: app, text: Bon retour, exact: false }
    hold: 1.5 # "fermo almeno un secondo e mezzo prima della card"

  - id: pillars
    stage: card
    card: title
    params: { line: "VS Code · Vite · LLM · React", accent: "", still: 1 } # verifica: see the open question below
    hold: 1.5
```

Punti da verificare durante la conversione (non improvvisare: misura o chiedi):

- **Il cursore come bersaglio** (`.monaco-editor .cursors-layer .cursor`): le impostazioni della pipeline hanno `"editor.renderLineHighlight": "none"`, quindi non c'è un elemento `.current-line`. Se il cursore non si trova o è invisibile (larghezza 0), usa `rect: [x, y, width]` letto da un fotogramma della prova.
- **`accent: ""`** della card `title`: leggi `commons/components/title/title.md` e prova con `node commons/cli/card.mjs gif10 pillars`. Se un accento vuoto non è ammesso o si vede male, **chiedi all'utente** come dividere la riga (per esempio `line: "VS Code · Vite · LLM ·"`, `accent: "React"`). `still` mostra la card già composta dal primo fotogramma: con 1,5 s non c'è tempo per l'entrata (logo 1 s, riga da 0,45 s).
- **Il terminale nello split**: in `split` il terminale di VS Code sta sotto il codice, largo il 62% del quadro. Se la riga "Full translate!" va a capo o non si legge a 800 px, **chiedi all'utente** se cambiare lo storyboard in `split-panel` (terminale per tutta la larghezza). È contenuto: decide lui, nel `.md`.
- **La durata**: l'obiettivo è ~10 s in tutto. Dopo la prima prova leggi le durate in `capture/takes.json`. Se si sfora, lo storyboard dice "si accorcia la frase, mai le pause di lettura": quindi prima `typeDelay`, poi le attese tecniche; mai i `hold` di lettura senza chiedere.

Poi `node commons/cli/run.mjs gif10 check` e `node commons/cli/run.mjs gif10 stamp`.

---

## Fase 2 — Test

Scrivi i test elencati qui e quelli annotati in `video_camera_gif.necessarytest.md`. Stile: come `commons/test/storyboard.test.mjs` (`node:test`, `assert/strict`, messaggi in inglese).

### 2.1 `commons/test/camera.test.mjs` (nuovo)

- **`inquadra`**
  - un box piccolo dà larghezza `CAMERA_MIN` (480) e altezza 270;
  - un box largo 1000 con `pad` 40 dà larghezza 1080;
  - un box alto (100×600) dà una larghezza dal 16:9 dell'altezza col margine: `(600 + 80) × 16/9`;
  - `width: 960` vince sul box ed è centrata sul box (finché resta dentro);
  - vicino al bordo sinistro o in basso a destra il rettangolo resta dentro il quadro (`x ≥ 0`, `x + width ≤ 1920`, `y + height ≤ 1080`);
  - ogni risultato è 16:9: `Math.abs(width * 9 - height * 16) < 0.1`.
- **`daRect`**: `[100, 50, 960]` dà `{ x: 100, y: 50, width: 960, height: 540 }`.
- **`posizione`**
  - senza chiavi o prima della prima: `PIENO`;
  - a `t = k.t` con `time: 0`: esattamente il bersaglio;
  - a metà di un movimento `linear`: la media tra partenza e arrivo;
  - a metà di un movimento `cubic`: anche lui la media (la curva vale 0,5 a metà), ma a un quarto meno di un quarto della strada;
  - dopo la fine: il bersaglio;
  - due chiavi: la seconda parte dal bersaglio della prima.
- **`ultima`**: `null` per `null` e per `[]`; l'ultima chiave senza `t`, `time`, `ease`.
- **`controllaCamera`**: `full`, `selection`, `keep` e `{ text: "x" }` passano; `{}` (nessun bersaglio), `{ text: "a", rect: [0, 0, 960] }` (due bersagli), `{ text: "a", zoom: 2 }` (chiave ignota), `width: 100`, `rect: [1500, 0, 960]` (esce dal quadro), `ease: "bounce"`, `time: -1` danno un errore ciascuno, con un messaggio che lo dice.
- **`filtroCamera` + ffmpeg vero** (`ffmpeg` da `../cli/ffmpeg.mjs`, `probeDuration`): su `-f lavfi -i testsrc2=size=1920x1080:rate=30:duration=2`, il filtro di due chiavi (pieno a 0, poi zoom 2× al centro da 0,5 s in 0,5 s) scritto in un mp4 temporaneo (in `os.tmpdir()`, cancellato in `after`) → ffmpeg esce 0, durata 2 s ± 1 fotogramma.
  - In più, **una volta a mano** (non in un test): estrai il fotogramma a 1,5 s con `ffmpeg -ss 1.5 -i <mp4> -frames:v 1 x.png` e guardalo (Read tool): deve essere il centro del quadro di prova, ingrandito 2×. Annota l'esito in `necessarytest.md`.
- **`gif()`**: input `["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=1"]`, `width: 320`, `fps: 10` → il file esiste, i primi 6 byte sono `GIF89a`, la palette temporanea non c'è più.

### 2.2 `commons/test/storyboard.test.mjs` (casi nuovi)

Usa l'helper `carica()` che c'è già. Per le scene di prova usa `stage: vscode`: non chiede una `fixture` (la chiedono solo `app`, `split`, `split-panel`).

- `before` con un `waitFor` passa; `before` con un `mark` dà `/before is played before the clip/`; `before: 3` dà l'errore delle liste.
- `camera` di scena `{ text: "a" }` passa; `camera: { text: "a", time: 1 }` dà `/first frame: no time or ease/`; una card con `camera` dà `/a card moves with anim/`.
- azione `camera: full` passa; azione `camera: keep` dà `/keep is for the scene's camera/`; azione `camera: { zoom: 2 }` dà le chiavi ignote.
- `setup` con una `camera` dà `/the setup is not filmed/`.
- `output: { gif: { width: 800, fps: 12 } }` passa e `project.output.gif` lo conserva; `gif: { width: 800 }` (manca fps) dà `/output.gif.fps/`; `gif: { width: 800, fps: 60 }` dà l'errore (sopra `output.fps`); `gif: { width: 800, fps: 12, loop: 1 }` dà `/output.gif: \{ width, fps \}/`.

### 2.3 Esito

`cd site/video && npm test`: tutto verde. Scrivi il conteggio (test e asserzioni, prima e dopo) nel log finale (fase 7).

---

## Fase 3 — Build (le riprese di gif10)

Qui la "build" è la ripresa vera. Da `site/video`, una alla volta, avvisando l'utente prima di ognuna (rischi e costi: regola 8 e 9).

1. `node commons/cli/run.mjs gif10 check`: deve dire allineato.
2. **Prova:** `node commons/cli/run.mjs gif10 record preview`. Durata attesa: ~1,5–4 minuti per `record`, più un minuto la prima volta (server di VS Code). **Tutti i progetti** hanno l'impronta del palco cambiata: per gif10 è la prima ripresa comunque.
3. Guarda:
   - `preview/contact.jpg` (un fotogramma a metà di ogni scena, **con** la camera);
   - `capture/strips/*.jpg` (**senza** camera: tutto il quadro, utile per misurare un `rect`);
   - la fine di ogni scena: un fotogramma da `preview/gif10.mp4` all'inizio della scena + la sua durata (`capture/takes.json`), con il binario di `ffmpeg-static`;
   - `log/run.log`: avvisi sotto le scene (`!`), soprattutto `camera: a move starts … before the last one ends`.
4. Correggi la tecnica nello YAML (selettori, larghezze, attese) e riprova da quella scena: `record --from <scena> preview` (README § "Partial takes"). La tecnica non chiede un nuovo `stamp`.
5. **Finale:** `node commons/cli/run.mjs gif10 compose`. Escono `output/gif10.mp4`, `output/gif10.gif`, `output/poster.jpg`.
6. **Criteri di accettazione** della GIF:
   - 800 px di larghezza, 12 fps, in loop (si apre in Chrome e ricomincia da sola);
   - **~10 s** in tutto (±1 s; oltre, chiedi all'utente);
   - si legge: il codice in `write`, il pulsante Translate, la riga del terminale, le frasi francesi;
   - nessun lampo a quadro pieno all'inizio di `write`, `translate`, `french`;
   - nessun tremolio visibile durante i movimenti lenti (vedi Rischi);
   - peso: **≤ 5 MB** (meglio ≤ 3). Oltre, vedi Rischi.

Se un punto fallisce per un limite del piano (non per un numero da ritoccare), vai alla fase 4.

## Fase 4 — Revisione

Checklist, una riga di esito per voce nel log finale:

- [ ] `npm test` verde.
- [ ] I progetti esistenti si **caricano** ancora: `node -e "import('./commons/cli/storyboard.mjs').then(m => ['quick2','compare2','quickstart'].forEach(p => m.loadProject(p)))"` da `site/video` (nessuna eccezione). Non rigirarli.
- [ ] Senza `camera`, `segmento` genera lo stesso filtro di prima (leggi il codice: il ramo nuovo scatta solo con `take.camera?.length`).
- [ ] Senza `output.gif`, `compose` non crea `.gif` (e ne cancella una vecchia).
- [ ] Un `takes.json` vecchio, senza `camera`, si monta ancora (`take.camera` undefined → nessun filtro).
- [ ] `output.gif` cambiato non fa rigirare: cambia `width` nello YAML e lancia solo `record`: deve dire "every scene matches its take".
- [ ] `before` in una scena tenuta (`--from` dopo di lei) viene rigiocato: lo stato arriva giusto alla scena girata.
- [ ] I commenti nuovi sono in italiano, i messaggi in inglese; nessun `console.log` di debug rimasto.
- [ ] I LINKED-DATA sono a coppie: `camera.mjs` ↔ README § "Camera"; `storyboard.mjs` ↔ README § "storyboard.yaml".

**Se qualcosa non regge** (un fallimento architetturale, non un numero): scrivi `video_camera_gif.necessaryreview.md` con il problema, cosa hai provato, e una proposta di emendamento al piano. Chiedi all'utente. Se approva, si riparte dalla fase 1 con l'emendamento.

## Fase 5 — Documentazione

Tutto in **inglese**, nello stile di `site/video/README.md` (frasi corte, tabelle, esempi YAML). Le regole dei 10 kB non valgono per questo README (AGENTS.md § "REGOLE DI SITE/VIDEO"): deve descrivere per intero come funziona la cartella.

1. **README § "storyboard.md"**, la tabella che traduce le parole del `.md` in YAML (quella dei segni): aggiungi una tabella gemella per camera e taglio, per esempio:

   | In **Si vede** / header | In the YAML |
   | :- | :- |
   | *la camera stringe su X*, *si avvicina a X* | `camera: { text \| selector: X }` (an action; the scene's `camera:` for its first frame) |
   | *la camera scivola su X* | the same, default `time: 0.5` |
   | *di colpo* (the camera) | `time: 0` |
   | *la camera torna larga*, *tutto il quadro* | `camera: full` |
   | *senza stacco*, *la camera resta dov'era* | the scene's `camera: keep` |
   | *taglio*, *l'attesa non si vede* | `before:` with the waiting actions |
   | **Formato:** *GIF larga N px, F fps* | `output.gif: { width: N, fps: F }`, and usually `fade: [0, 0]` |

2. **README § "Converting"**, punto 3 (Map): una voce per `before` (il taglio cade al confine della scena: l'attesa va in `before` della scena *dopo*) e una per la camera (prima inquadratura nella chiave di scena, poi le azioni; misura i `rect` sulle strisce, che sono a quadro pieno).
3. **README § "storyboard.yaml"**:
   - Top level: `output.gif` (`{ width, fps }`, after `compose`; not in the stage's fingerprint).
   - Scene: `before` (actions played before the clip starts: their time is not filmed, a jump cut; no `mark`, `unmark`, `camera`), `camera` (the first frame: `full`, `keep`, `selection`, `rect`, or a target; no `time`/`ease`; not on cards).
   - Action table: una riga `camera: { text: Translate, width: 960 }` · `camera: full` | "the camera glides to that frame: see Camera" | "about 0.1 s (it doesn't wait: the move happens in compose)".
   - Il blocco YAML d'esempio può restare com'è.
4. **README, nuova sottosezione `### Camera`** dopo `### Marks`, con il commento `<!-- LINKED-DATA: these keys and defaults are CAMERA_* in commons/cli/camera.mjs, a_camera and rettangolo in commons/cli/director.mjs, filtroCamera's use in commons/cli/compose.mjs. Change one, change the others. -->`. Contenuto:
   - cosa fa: un ritaglio 16:9 del quadro che scivola, misurato durante la ripresa, applicato nel montaggio. Ce l'hanno l'mp4, l'anteprima, la GIF e il foglio di contatto (estratto dall'anteprima); le strisce di `capture/strips/` no, sono a quadro pieno (servono a misurare un `rect`);
   - esempio YAML (scena con `camera:` e due azioni);
   - tabella delle chiavi: target (`text`, `selector`, `role` + `name`, `page`, `exact`, `timeout`; oppure `rect: [x, y, width]`; oppure `full`, `selection`, `keep`), `width` (480–1920), `pad` (40), `time` (0.5), `ease` (`cubic`, `sine`, `linear`);
   - le regole: sempre 16:9, mai più stretta di 480 (4×); un movimento non aspetta; un movimento che parte prima della fine del precedente → avviso; la scena senza `camera` parte a quadro pieno;
   - **qualità**: a 1920 di uscita ogni zoom ingrandisce i pixel (morbido); per la GIF a 800 px un ritaglio ≥ 800 resta nitido.
5. **README, nuova sottosezione `### Cut`** (o un paragrafo in "storyboard.yaml" se resta breve): `before`, perché esiste, l'esempio dell'LLM, e che una scena tenuta lo rigioca (lo stato).
6. **README, nuova sottosezione `### GIF`**: `output.gif`, la ricetta (palette in due passate, dai segmenti), `-loop 0`, il consiglio `fade: [0, 0]` per un loop pulito, il peso.
7. **README § "Folders"** e **§ "The pipeline"** (passo compose): `output/<project>.gif`.
8. **README § "Field notes"**: quello che hai imparato nelle riprese (per esempio il selettore del cursore che funziona, il tremolio di zoompan e il `SOVRACAMPIONA` scelto, il peso della GIF).
9. **README § "On stage"**: se hai trovato un selettore utile per inquadrare il codice, scrivilo lì.
10. **`projects/index.md`**: aggiorna la riga di gif10 nella tabella (stato reale), la riga "Pipeline" (taglio, camera, GIF), le voci di "Next" (spunta quelle fatte, aggiungi quelle nuove) e una **voce di diario** in testa al Log (data, cosa, decisioni e perché, cosa resta; avvisi in **grassetto**: "every project's next record shoots everything").
11. Esegui le voci di `video_camera_gif.necessarydoc.md`.
12. Se una sezione ti sembra troppo lunga, non tagliarla: avvisa l'utente alla fine.

## Fase 6 — Pulizia

- Cancella `video_camera_gif.necessarytest.md` e `video_camera_gif.necessarydoc.md` quando le loro voci sono fatte; `necessaryreview.md` solo se non serve più (chiedi, se c'è).
- Nessun file temporaneo nel repo (mp4 di prova, png estratti): i test usano `os.tmpdir()`; le prove a mano nella scratchpad.
- `git status`: devono comparire solo i file della mappa. Niente in `capture/`, `preview/`, `output/`, `log/`, `audio/` (sono ignorati: controlla che `git status` non li mostri; se li mostra, **chiedi** prima di toccare `.gitignore`).
- Lancia `npm run commit -- --dry-run` dalla radice del repo e riporta l'esito all'utente (le modifiche di `site/video` non dovrebbero toccare i controlli della libreria; se qualcosa fallisce, riporta l'errore, non aggirarlo).

## Fase 7 — logDiary

In testa a questo file, **subito dopo** la nota `[!NOTE]` per il revisore, aggiungi una nota `[!TIP]` (massimo una decina di righe, elenco puntato) con le decisioni prese lungo la strada: gli ask e le risposte, i numeri scelti (larghezze, `typeDelay`, `SOVRACAMPIONA`), il conteggio dei test, peso e durata della GIF. Se ci sono avvertimenti o scelte rischiose, una nota `[!IMPORTANT]` o `[!CAUTION]` in più. Poi consegna all'utente il comando `npm run commit "…"` con un testo proposto, per esempio: `npm run commit "video: cut, camera and GIF output; gif10 campaign GIF"`.

---

## Rischi noti e piani B

| Rischio | Come si vede | Piano B (in ordine) |
| :- | :- | :- |
| `zoompan` trema nei movimenti lenti | i bordi del testo saltano di un pixel avanti e indietro | `SOVRACAMPIONA = 3`, poi `4` (più lento e più memoria); annota la scelta in Field notes |
| `on` parte da 1 invece che da 0 | il movimento arriva un fotogramma dopo | trascurabile (33 ms a 30 fps); non correggere |
| ffmpeg rifiuta l'espressione | `compose` fallisce con l'errore di `zoompan` | stampa il filtro (`console.log`) e provalo da solo con `testsrc2`; controlla apici e numeri in notazione esponenziale (`num()` li evita) |
| Il cursore di Monaco non si trova | `camera: … not found` in `write` | `rect` misurato sulle strisce |
| La riga del terminale non si trova | `before` di `french` va in timeout (90 s) | `vscode.settings` ha `gpuAcceleration: off`? Il testo è davvero "Full translate!" (leggi lo screenshot `log/error-vscode.png`)? Se l'LLM fallisce (rete, chiave), la riga è un'altra: riprova, poi chiedi |
| L'LLM chiede conferma | la ripresa resta ferma su Translate | `costGuard` nella fixture; non usare `--llm-noask` senza chiedere |
| GIF troppo pesante (> 5 MB) | `compose` stampa i MB | `bayer_scale=5` → `3`; poi `fps: 10` (chiedi: lo storyboard dice 12); poi `palettegen=max_colors=128` |
| Card illeggibile in 1,5 s | la riga non c'è ancora a fine scena | `still` (già in bozza); se non basta, chiedi all'utente |
| Durata oltre 11 s | somma di `capture/takes.json` | `typeDelay` più basso (non sotto 25), attese tecniche più corte; poi chiedi |
