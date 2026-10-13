# Piano — la forgia delle card: un sistema parametrico, una libreria di prototipi su GSAP, sonde di feedback nella ripresa

> [!NOTE]
> **Per il revisore umano**
> - **La forgia, non i video:** si costruisce lo strumento per fare card, non si rifanno quelle di oggi. Le cinque card attuali rinascono come primi **prototipi**; il loro aspetto ispira e non vincola. Si forgerà dopo.
> - **Sistema parametrico:** colori dal sito (`site/theme/tokens.css`). Spazi, caratteri e tempi nascono da poche **manopole** (base, rapporto, densità, scala, tempo), e `look:` nello YAML le regola per un video o per una scena.
> - **Una pagina sola** (`commons/card.html`) suona ogni prototipo. Il prototipo è una composizione breve di **parti** riusabili (titolo, chip, tessere, parole, spunte, timbro, QR…) in `commons/components/<nome>/`, con la sua **scheda** md e le sue **varianti**.
> - **Adattivo come il web:** il testo segue il suo contenitore, va a capo, le griglie passano su più file bilanciate, il corpo si stringe se il contenuto è troppo. Se ancora non ci sta, è un errore prima della ripresa.
> - **Movimento:** GSAP 3.15, una timeline che parte al ciak e si può portare a un istante preciso; effetti con nome; `anim:` nello YAML con effetti o tween grezzi.
> - **Galleria:** `node uty/card.mjs --gallery` disegna ogni variante di ogni prototipo. Le stesse varianti fanno da documentazione e da test.
> - **Sonde:** in ogni frame, webview comprese, ascoltano clic, focus, tasti e overlay; il regista controlla l'esito di ogni azione e avvisa sotto la scena (`--strict` ferma, `--probe` dà i tempi di reazione).

> [!TIP]
> **logDiary** (2026-10-13)
> - Formato di `anim` scelto dall'utente: `{ fx | set | to | from | fromTo, target, at }`, fx con la sua config accanto, fromTo `[da, a]`.
> - Una tessera in griglia non è contenitore: `container-type` impedisce il subgrid. I fattori `<k>` sono per ruolo (12,5 / 10 / 8,3 cqi); `[data-fit]` parte dalla misura piena.
> - Cornice: righe esplicite e margini al posto del gap; lo strato sopra a `--space-2xl` dal bordo; il controllo copre anche il timbro.
> - Sonde: le webview si scrivono con `document.open`, che cancella i listener, e la sonda si riarma. I treni di tasti si spezzano al lotto e il regista somma `n`.
> - Nessun tempo filmato per le sonde: una sola evaluate per clic, pulizia non attesa, focus in parallelo, `type` contato al taglio. Durate come prima (±0,4 s).
> - Galleria approvata dall'utente; un sesto prototipo (`steps`) ha richiesto 9 righe, poi è stato cancellato. `npm test` 65 verdi.

> [!IMPORTANT]
> - Un `removeAttribute` su un locator staccato aspettava 30 s (restaurant a 69 s): mai `await` su locator dopo un'azione che ridisegna.
> - Vero positivo, corretto: `llm-preview` partiva sul tooltip di una tab perché `pannello()` riportava il mouse vero sulla tab cliccata. Ora va nell'angolo, lì e a ogni taglio, e `--strict` su compare arriva in fondo.

---

## 0. Decisioni

### Prese con l'utente (2026-10-13)

| Tema | Scelta |
| :- | :- |
| Obiettivo | **una libreria di prototipi riusabili**, non la riproduzione fedele dell'output di oggi. "Stiamo lavorando sulla forgia, poi forgeremo." |
| Libertà | lo strumento è il web più una libreria di animazioni (GSAP), lo stile viene dal sito, pochi altri vincoli |
| Card esistenti | tutte e cinque rinascono sul sistema nuovo (title, outro, question, beats, together) |
| Natura delle schede | **intrinsecamente parametriche**, come un layout web adattivo: spaziature, caratteri e il resto sono parametri, così estendere è semplice |
| Animazione nello YAML | effetti con nome + via di fuga (tween GSAP grezzi) |
| Dove stanno | `commons/components/<nome>/`, una cartella per tipo di card |
| Processo | prima il piano, poi le sette fasi |

### Prese nel piano (il revisore può ribaltarle)

1. **GSAP 3.15.0 da `site/video/node_modules`**, versione esatta in `devDependencies`. Licenza "Standard no charge": gratuita, non OSI; non finisce in git. Niente CDN: le card non usano la rete.
2. **Una pagina sola, `commons/card.html`**, suona ogni prototipo. Un prototipo non ha html suo: è `components/<nome>/<nome>.js`, una composizione di parti, accanto alla sua scheda `<nome>.md` e alle sue `variants.yaml`.
3. **Tre livelli:** *token* (colori del sito, scale parametriche) → *primitive* (layout: stack, cluster, griglia, tessera; movimento: effetti) → *parti* (pezzi di pagina con dati, aspetto, entrata) → *prototipi* (composizioni).
4. **Ordine di adattamento**, uguale per tutti: il testo segue il contenitore → va a capo → le griglie aggiungono file → il corpo si stringe (spazi e caratteri insieme, fino a 0,7) → errore "doesn't fit". L'errore ferma `palco()` prima di girare e `card.mjs` lo mostra subito.
5. **Params comuni a ogni prototipo:** `note`, `stamp`, `qr`, `still` (e i loro tempi). Timbro e QR stanno *sopra* la card e non spostano il corpo: così una scena `still` può riprendere quella prima aggiungendoli, senza che il taglio si veda. Il QR non deve coprire il contenuto (controllato).
6. **Le varianti sono documentazione, test e galleria insieme.** Ogni prototipo ne ha alcune normali e alcune estreme; quelle oltre il limite dichiarano `expect: error`, e il limite resta scritto e verificato.
7. **Le tabelle dei params escono dal README** e vanno nelle schede. Il README tiene la panoramica, `card`, `params`, `look`, `anim`, la galleria e la procedura per un prototipo nuovo. Il README di `site/video` deve restare completo (AGENTS.md § SITE/VIDEO): le schede sono nella stessa cartella, linkate.
8. **compare e quick2 cambieranno aspetto.** Qui si verifica solo che la pipeline giri (prova muta); il montaggio nuovo si fa quando si forgia.
9. **Le sonde avvisano e non correggono.** Nessuna azione aggiunta alla ripresa.
10. Commenti: inglese in `commons/` (come le card di oggi), italiano in `uty/`. Documenti in inglese. File spostati su disco, non con `git mv`: i commit li fa l'utente.

### Fuori scopo

- Prototipi oltre i cinque: si forgia dopo. (In fase 4 si scrive un sesto prototipo usa-e-getta solo per misurare quanto costa estendere, e poi si cancella.)
- Card a dimensioni diverse da 1920×1080: il fotogramma è fisso, i contenitori interni si adattano.
- Card composte direttamente nello YAML: un prototipo nuovo sono poche righe, e resta riusabile.
- Il montaggio finale di compare e quick2; ritocchi ai palchi app e VS Code (`darkStyle.md` li descrive come sono).

---

## 1. Architettura

```text
site/video/
  package.json                 + "gsap": "3.15.0" (devDependencies), + "test": "node --test test/"
  commons/
    darkStyle.md               lo stile: manopole, scale, cornice, primitive, parti, movimento, regole
    card.html                  la pagina che suona ogni prototipo
    card.css                   token e scale, cornice, primitive, l'aspetto delle parti
    motion.js                  curve ed effetti GSAP
    clock.js                   lo zero = il ciak; card.tl; params; boot; enter; anim; seek
    layout.js                  look; griglie bilanciate; righe che si stringono; il corpo che si stringe; controllo
    parts.js                   le parti: costruiscono pezzi di pagina dai dati, dicono come entrano
    app-dark.css               invariato
    components/
      title/     title.js     title.md     variants.yaml
      question/  question.js  question.md  variants.yaml
      beats/     beats.js     beats.md     variants.yaml
      together/  together.js  together.md  variants.yaml
      outro/     outro.js     outro.md     variants.yaml   coffee-qr.svg
    (title.html, outro.html, question.html, beats.html, together.html, coffee-qr.svg in commons/: TOLTI)
  uty/
    card.mjs                   NUOVO: una scena, un prototipo, una variante, o la galleria
    probe.js, probe.mjs        NUOVI: le sonde (Parte B)
    storyboard.mjs             + `card` per nome, + `look`, + `anim`
    director.mjs               + urlCard(), card pronta e senza errori prima di girare, + controlli delle sonde
    record.mjs                 + impronta delle card, + sonde e avvisi
    run.mjs                    + --probe, --strict
  test/                        NUOVO: node --test
```

Il flusso di una card:
1. Lo YAML porta `card`, `params`, `look` e `anim`; `urlCard()` costruisce `card.html?proto=<js>&<params>&look=<json>&anim=<json>&clock=take`.
2. `card.html` carica nell'ordine: `card.css`, GSAP, `motion.js`, `clock.js`, `layout.js`, `parts.js`, poi chiama `card.boot()`.
3. `boot` applica `look`, carica il prototipo, che chiama `card.define(...)`, e lo costruisce: parti nelle regioni, entrate sulla timeline. Poi aggiunge le parti comuni, sistema il layout, applica `anim`, controlla che tutto ci stia e mette `card.ready = true`.
4. `palco()` aspetta `ready` e legge `card.errors`; se ce ne sono, si ferma prima di girare.
5. `ciak()` avvia la timeline (`card.tl.play(0)`).

---

## 2. Parte A — la forgia

### A.1 Dipendenza

`cd site/video && npm i -D gsap@3.15.0 --save-exact`. Da `commons/card.html`: `../node_modules/gsap/dist/gsap.min.js` e `CustomEase.min.js`. Logo: `../../theme/logo.svg`.

### A.2 Token e scale (`commons/card.css`, prima parte)

Ogni misura nasce da poche manopole. Cambiata una manopola, tutti i prototipi la seguono. `look` (A.8) può impostare qualunque manopola o token.

```css
/* The forge's tokens. Colors are the site's own (site/theme/tokens.css); sizes come from a few
   knobs, so one change reaches every prototype. `look` in the YAML sets any knob or token.
   LINKED-DATA: commons/darkStyle.md § "Knobs and scales" describes each one; layout.js sets --fit;
   motion.js reads --tempo and --accent. Change one, change the others. */
@import url("../../theme/tokens.css");

:root {
  --density: 1; /* every space, times this */
  --space-base: 8px; /* step 0 of the space scale */
  --space-ratio: 1.5; /* from a step to the next */
  --type-scale: 1; /* every type size, times this */
  --type-base: 34px; /* step 0 of the type scale: text in a column */
  --type-ratio: 1.25;
  --type-min: 26px; /* nothing smaller: still readable on a phone */
  --fit: 1; /* layout.js lowers it on the body when the content is too much */
  --tempo: 1; /* motion.js: every effect's duration, times this */
  --cols-max: 4; /* the most items on a row of a grid */
  --measure: 1680px; /* the widest a block of content gets */
  --safe-x: 120px; /* the frame's margins */
  --safe-y: 96px;
  --radius: 28px; /* a tile; a chip has a third of it */
  --logo: 900px;
}

/* The scales, derived from the knobs. Declared again on .knobs: a custom property resolves where
   it's declared, so a knob set on an element (the body's --fit) reaches the scales only there. */
:root,
.knobs {
  --space-2xs: calc(var(--space-base) * pow(var(--space-ratio), -1) * var(--density) * var(--fit)); /*  5 */
  --space-xs: calc(var(--space-base) * var(--density) * var(--fit)); /*  8 */
  --space-s: calc(var(--space-base) * pow(var(--space-ratio), 1) * var(--density) * var(--fit)); /* 12 */
  --space-m: calc(var(--space-base) * pow(var(--space-ratio), 2) * var(--density) * var(--fit)); /* 18 */
  --space-l: calc(var(--space-base) * pow(var(--space-ratio), 3) * var(--density) * var(--fit)); /* 27 */
  --space-xl: calc(var(--space-base) * pow(var(--space-ratio), 4) * var(--density) * var(--fit)); /* 40 */
  --space-2xl: calc(var(--space-base) * pow(var(--space-ratio), 5) * var(--density) * var(--fit)); /* 61 */
  --space-3xl: calc(var(--space-base) * pow(var(--space-ratio), 6) * var(--density) * var(--fit)); /* 91 */
  --type-fine: calc(var(--type-base) * pow(var(--type-ratio), -2) * var(--type-scale) * var(--fit)); /*  22 */
  --type-small: calc(var(--type-base) * pow(var(--type-ratio), -1) * var(--type-scale) * var(--fit)); /* 27 */
  --type-text: calc(var(--type-base) * var(--type-scale) * var(--fit)); /*  34 */
  --type-body: calc(var(--type-base) * pow(var(--type-ratio), 1) * var(--type-scale) * var(--fit)); /*  42 */
  --type-lead: calc(var(--type-base) * pow(var(--type-ratio), 2) * var(--type-scale) * var(--fit)); /*  53 */
  --type-heading: calc(var(--type-base) * pow(var(--type-ratio), 4) * var(--type-scale) * var(--fit)); /* 83 */
  --type-display: calc(var(--type-base) * pow(var(--type-ratio), 5) * var(--type-scale) * var(--fit)); /* 104 */
  --type-hero: calc(var(--type-base) * pow(var(--type-ratio), 6) * var(--type-scale) * var(--fit)); /* 130 */
}
```

Verificato su Chrome 155: `pow()`, container queries e subgrid funzionano. La manopola ridichiarata su un elemento ricalcola le scale solo dove sono dichiarate (130 → 65 px a scala 0,5 sull'elemento `.knobs`).

### A.3 Cornice e primitive (`commons/card.css`, seconda parte)

**La cornice** è uguale per tutti i prototipi: margini sicuri, tre regioni in colonna e uno strato sopra.

```css
html, body { height: 100%; margin: 0; }
body {
  background: radial-gradient(90% 80% at 50% 10%, var(--surface) 0%, var(--bg) 55%, var(--bg-deep) 100%);
  color: var(--text);
  font-family: "Segoe UI", system-ui, sans-serif;
  overflow: hidden;
}
.frame {
  box-sizing: border-box;
  height: 100%;
  padding: var(--safe-y) var(--safe-x);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto; /* head, body, foot */
  gap: var(--space-xl);
}
.frame-head:empty, .frame-foot:empty { display: none; }
.frame-body {
  container-type: size; /* what's inside can size itself on the body (cqi, cqb) */
  display: grid;
  place-items: safe center; /* "safe": too much content overflows downwards, where it's measured */
  min-height: 0;
}
.frame-over { position: absolute; inset: var(--safe-y) var(--safe-x); pointer-events: none; } /* stamp, QR */
```

**Le primitive di layout.** Ognuna ha i suoi parametri (custom properties con un default dalle scale):

| Primitiva | Cosa fa | Parametri | Come si adatta |
| :- | :- | :- | :- |
| `.stack` | colonna centrata | `--gap` (`--space-2xl`), `--measure` | cresce in altezza, il testo va a capo entro `--measure` |
| `.cluster` | fila che va a capo, centrata | `--gap` (`--space-xl`) | più righe |
| `.grid` | elementi in file bilanciate, al più `--cols-max` per fila | `--gap` (`--space-xl`), `--cols-max` | `layout.js` mette `--cols` (5 → 3+2, 7 → 4+3) e `--rows` (righe interne di ogni elemento, per il subgrid) |
| `.tile` | riquadro sulla superficie; è un contenitore (`container-type: inline-size`) | `--pad` | in una `.grid` usa `grid-row: span var(--rows); grid-template-rows: subgrid`: le righe interne si allineano tra tessere vicine |
| `.t-<ruolo>` | ruolo tipografico: `fine`, `small`, `text`, `body`, `lead`, `heading`, `display`, `hero` | — | `font-size: min(var(--type-<ruolo>), <k>cqi)`: segue la larghezza del contenitore, mai sotto `--type-min` (`max(var(--type-min), …)`) |
| `[data-fit]` | una riga sola, grande quanto il suo spazio permette | — | `layout.js` parte dalla misura CSS e scende fino a `--type-min` |

Il fattore `<k>` di ogni ruolo (quanto pesa la larghezza del contenitore) si sceglie in fase 1: il ruolo deve arrivare alla sua misura piena in un contenitore largo quanto `--measure`. Annotare i valori nel CSS.

### A.4 `commons/layout.js`

Fa le poche cose che il CSS non sa fare da solo, uguali per ogni prototipo.

```js
// The layout of every prototype: what CSS can't do on its own.
//   look()     the YAML's knobs and tokens, on :root, before anything is built
//   arrange()  grids in balanced rows; one-line texts as large as they fit; the body that tightens
//   check()    what still doesn't fit goes to card.errors: the take stops before it starts
// LINKED-DATA: commons/card.css (tokens, primitives), commons/darkStyle.md § "Adapting".
(() => {
  const q = new URLSearchParams(location.search);
  const root = document.documentElement;
  const token = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

  function look(errors) {
    let voci = {};
    try {
      voci = q.has("look") ? JSON.parse(q.get("look")) : {};
    } catch (e) {
      return errors.push(`look: ${e.message}`);
    }
    for (const [k, v] of Object.entries(voci)) {
      if (!token(root, `--${k}`)) errors.push(`look: no token --${k} (commons/card.css, site/theme/tokens.css)`);
      else root.style.setProperty(`--${k}`, String(v));
    }
  }

  // n items, at most --cols-max a row, in rows as even as they get.
  function grids() {
    for (const g of document.querySelectorAll(".grid")) {
      const n = g.children.length || 1;
      const max = Number(token(g, "--cols-max")) || 4;
      g.style.setProperty("--cols", String(Math.ceil(n / Math.ceil(n / max))));
      g.style.setProperty("--rows", String(Math.max(1, ...[...g.children].map((c) => c.children.length))));
    }
  }

  // [data-fit]: one line, from its CSS size down to --type-min, as large as its box allows.
  function lines() {
    for (const el of document.querySelectorAll("[data-fit]")) {
      el.style.fontSize = "";
      el.style.whiteSpace = "nowrap";
      const min = parseFloat(token(el, "--type-min")) || 26;
      for (let size = parseFloat(getComputedStyle(el).fontSize); size > min && el.scrollWidth > el.clientWidth + 1; size -= 2)
        el.style.fontSize = `${size - 2}px`;
    }
  }

  // The body holds what it's given: too much, and its spaces and type tighten together.
  function tighten() {
    const body = document.querySelector(".frame-body");
    const content = body?.firstElementChild;
    if (!content) return;
    const over = () => content.scrollHeight > body.clientHeight + 1 || content.scrollWidth > body.clientWidth + 1;
    for (let f = 1; over() && f > 0.7; ) {
      f = +(f - 0.04).toFixed(2);
      body.style.setProperty("--fit", String(f));
      lines();
    }
  }

  function arrange() {
    grids();
    lines();
    tighten();
  }

  // Measured with every entrance done, then back to zero.
  function check(errors) {
    const W = innerWidth, H = innerHeight, tol = 2;
    const nome = (el) => (el.id ? `#${el.id}` : `${el.localName}${[...el.classList].map((c) => `.${c}`).join("")}`);
    const visti = new Set();
    const errore = (m) => !visti.has(m) && visti.size < 6 && (visti.add(m), errors.push(m));
    card.tl.progress(1, true);
    const body = document.querySelector(".frame-body");
    const content = body?.firstElementChild;
    if (content && (content.scrollHeight > body.clientHeight + tol || content.scrollWidth > body.clientWidth + tol))
      errore(`doesn't fit: the content needs ${content.scrollWidth}×${content.scrollHeight} px, the body has ${body.clientWidth}×${body.clientHeight} (even tightened to --fit 0.7)`);
    for (const el of document.querySelectorAll(".frame *, .frame-over *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.display === "inline" || el.closest("svg, [hidden]")) continue;
      if (el.clientWidth && el.scrollWidth > el.clientWidth + tol) errore(`${nome(el)}: the text runs ${el.scrollWidth - el.clientWidth} px past its box`);
      const r = el.getBoundingClientRect();
      if (r.width && (r.left < -tol || r.top < -tol || r.right > W + tol || r.bottom > H + tol)) errore(`${nome(el)}: past the edge of the frame`);
    }
    const qr = document.querySelector(".qr");
    if (qr && content) {
      const a = qr.getBoundingClientRect();
      for (const el of content.querySelectorAll("*")) {
        const b = el.getBoundingClientRect();
        if (b.width && el.children.length === 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) errore(`the QR covers ${nome(el)}`);
      }
    }
    card.tl.progress(0, true);
  }

  window.layout = { look, arrange, check };
})();
```

### A.5 `commons/motion.js`

Le curve e gli effetti GSAP: il vocabolario del movimento. Ogni effetto fissa entrambi gli estremi (`fromTo`) e non dipende dal CSS di partenza; le eccezioni (`light`, `glow`) partono dallo stato attuale e lo dichiarano. Le durate si moltiplicano per `--tempo`, letto quando l'effetto si crea (dopo `look`). I colori vengono da `--accent`.

```js
// The motion of every prototype: curves and effects, on GSAP.
// LINKED-DATA: commons/darkStyle.md § "Motion" describes each effect; parts.js says which one each
// part enters with (data-enter). Change an effect, change those, and look at the gallery again.
(() => {
  gsap.registerPlugin(CustomEase);
  CustomEase.create("vt", "0.2,0.7,0.2,1"); // entrances: a quick start, a soft landing
  CustomEase.create("vt.out", "0,0,0.58,1"); // lights, fades, glows
  CustomEase.create("vt.press", "0.6,0,0.9,0.4"); // the stamp: speeding up to the hit

  const root = document.documentElement;
  const tempo = () => parseFloat(getComputedStyle(root).getPropertyValue("--tempo")) || 1;
  const accent = (a) => {
    const hex = getComputedStyle(root).getPropertyValue("--accent").trim() || "#4ade80";
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };
  // Every effect: its defaults, its duration times --tempo.
  const fx = (name, defaults, effect) =>
    gsap.registerEffect({ name, defaults, extendTimeline: true, effect: (t, c) => effect(t, { ...c, duration: c.duration * tempo() }) });

  fx("rise", { y: 24, duration: 0.9, stagger: 0 }, (t, c) =>
    gsap.fromTo(t, { opacity: 0, y: c.y }, { opacity: 1, y: 0, duration: c.duration, stagger: c.stagger, ease: "vt" }));

  fx("hit", { duration: 0.7 }, (t, c) => {
    const half = c.duration / 2;
    return gsap.timeline()
      .fromTo(t, { opacity: 0, y: 40, scale: 0.9, borderColor: accent(1) }, { opacity: 1, y: 0, scale: 1.04, borderColor: accent(0.9), duration: half, ease: "vt" }, 0)
      .to(t, { scale: 1, borderColor: accent(0.35), duration: half, ease: "vt" }, half)
      .fromTo(t, { boxShadow: `0 0 80px ${accent(0.5)}` }, { boxShadow: `0 0 0px ${accent(0)}`, duration: c.duration, ease: "vt" }, 0);
  });

  fx("pop", { duration: 0.6 }, (t, c) =>
    gsap.timeline()
      .fromTo(t, { opacity: 0.08 }, { opacity: 1, duration: c.duration * 0.6, ease: "vt.out" }, 0)
      .fromTo(t, { scale: 0.86 }, { scale: 1.06, duration: c.duration * 0.45, ease: "vt", immediateRender: false }, 0)
      .to(t, { scale: 1, duration: c.duration * 0.55, ease: "vt" }, c.duration * 0.45)
      .fromTo(t, { textShadow: `0 0 96px ${accent(0.9)}` }, { textShadow: `0 0 48px ${accent(0.35)}`, duration: c.duration, ease: "vt", immediateRender: false }, 0));

  fx("light", { to: 1, duration: 0.35 }, (t, c) => gsap.to(t, { opacity: c.to, duration: c.duration, ease: "vt.out" }));
  fx("fade", { duration: 0.8 }, (t, c) => gsap.fromTo(t, { opacity: 0 }, { opacity: 1, duration: c.duration, ease: "vt.out" }));
  fx("draw", { duration: 0.4, length: 30 }, (t, c) =>
    gsap.fromTo(t, { strokeDashoffset: c.length }, { strokeDashoffset: 0, duration: c.duration, ease: "vt.out" }));

  fx("glow", { duration: 1.2 }, (t, c) => {
    const base = gsap.getProperty(gsap.utils.toArray(t)[0], "backgroundColor");
    return gsap.timeline()
      .to(t, { backgroundColor: accent(0.55), boxShadow: `0 0 28px ${accent(0.6)}`, duration: c.duration * 0.3, ease: "vt.out" })
      .to(t, { backgroundColor: base, boxShadow: `0 0 0px ${accent(0)}`, duration: c.duration * 0.7, ease: "vt.out" });
  });

  fx("thud", { duration: 0.2, x: 2, y: 3 }, (t, c) =>
    gsap.timeline()
      .to(t, { x: c.x, y: c.y, duration: c.duration * 0.3, ease: "vt.out" })
      .to(t, { x: -c.x / 2, y: -c.y / 3, duration: c.duration * 0.35, ease: "vt.out" })
      .to(t, { x: 0, y: 0, duration: c.duration * 0.35, ease: "vt.out" }));

  fx("stamp", { duration: 0.3, angle: -10, shake: ".frame", thudAt: 0.22 }, (t, c) => {
    const tl = gsap.timeline()
      .fromTo(t, { opacity: 0, rotation: -3, scale: 2.4 }, { opacity: 0.95, rotation: c.angle, scale: 0.95, duration: c.duration * 0.75, ease: "vt.press" }, 0)
      .to(t, { opacity: 0.9, scale: 1, duration: c.duration * 0.25, ease: "vt.press" });
    if (c.shake) tl.add(gsap.effects.thud(c.shake), c.thudAt);
    return tl;
  });
})();
```

Note: `thud` riceve una durata già moltiplicata per `--tempo` (passa da `fx`): dentro `stamp` va chiamato con la durata di default. Lo si verifica in fase 2 con `tempo: 2`. Un effetto nuovo: una chiamata `fx(...)` qui e una riga in `darkStyle.md`.

### A.6 `commons/clock.js`

Restano dall'API di oggi `param`, `list` e `times` (codice identico). Si aggiungono `tl`, `define`, `boot`, `enter`, `fx`, `at`, `apply`, `asset`, `seek`, `errors`, `ready`, `started`.

```js
// The clock and the boot of every prototype. Time zero is the start of the clip, not the page load;
// everything that moves sits on one GSAP timeline (card.tl), started at zero.
// LINKED-DATA: urlCard() and ciak() in uty/director.mjs (the URL, the "take" event, card.ready and
// card.errors); site/video/README.md § "Cards"; commons/darkStyle.md. Change one, change the others.
(() => {
  const q = new URLSearchParams(location.search);
  gsap.ticker.lagSmoothing(0); // the timeline's time is the real time: a hitch doesn't push the entrances off the voice
  const tl = gsap.timeline({ paused: true });
  const errors = [];
  const still = q.has("still");
  let build = null, proto = null, ready = false, started = false;

  const start = () => {
    if (started) return;
    started = true;
    document.documentElement.classList.add("go");
    tl.play(0);
  };
  const param = (name, fallback = "") => (q.has(name) ? q.get(name) : fallback);
  const fx = (name, targets, seconds, config = {}) => {
    if (!gsap.effects[name]) return errors.push(`no effect "${name}" in motion.js (${Object.keys(gsap.effects).join(", ")})`);
    tl.add(gsap.effects[name](targets, config), seconds);
  };

  window.card = {
    param,
    list(name, fallback = []) { /* invariata */ },
    times(count, { name = "at", first = 1, step = 0.8 } = {}) { /* invariata */ },
    tl, errors, still,
    get ready() { return ready; },
    get started() { return started; },
    /** The prototype's script calls this once, with the function that builds it. */
    define(fn) { build = fn; },
    /** A part's entrance at `seconds`, with the effect the part declares (data-enter); `still`: none. */
    enter(node, seconds, override = {}) {
      if (still || !node) return;
      const { fx: nome = node.dataset.enter, ...config } = override;
      fx(nome, node, seconds, { ...JSON.parse(node.dataset.enterConfig ?? "{}"), ...config });
    },
    fx,
    /** Runs `fn` at `seconds`. Prefer tweens: a call can't be seeked back. */
    at(seconds, fn) { tl.call(fn, null, seconds); },
    /** A file next to the prototype (an image, a QR). */
    asset(name) { return new URL(name, proto ?? location.href).href; },
    /** The scene's `anim`: effects and raw tweens added to the timeline (README § "Cards"). */
    apply(list) { /* as in the previous plan: fx | set | fromTo | to | from, target, at, ...vars; errors for unknown fx and empty targets */ },
    /** The card as it is at `seconds`, still: for pictures, never during a take. */
    seek(seconds) {
      started = true;
      document.documentElement.classList.add("go");
      tl.pause().seek(seconds, false);
    },
    /** Builds the prototype named in the URL; see the flow in darkStyle.md. */
    async boot() {
      try {
        layout.look(errors);
        const src = q.get("proto");
        if (!src) throw new Error("no proto in the URL");
        proto = new URL(src, location.href).href;
        await new Promise((ok, ko) => {
          const s = Object.assign(document.createElement("script"), { src: proto });
          s.onload = ok;
          s.onerror = () => ko(new Error(`prototype not found: ${src}`));
          document.body.append(s);
        });
        if (!build) throw new Error(`${src} doesn't call card.define()`);
        const regione = (r) => document.querySelector(`.frame-${r}`);
        build({ ...card, parts, head: regione("head"), body: regione("body"), foot: regione("foot"), over: regione("over") });
        parts.common(); // note, stamp, qr: every prototype has them
        layout.arrange();
        if (q.has("anim")) card.apply(JSON.parse(q.get("anim")));
        layout.check(errors);
      } catch (e) {
        errors.push(e.message);
      }
      for (const e of errors) console.error(`card: ${e}`);
      ready = true;
      if (q.get("clock") === "take") {
        addEventListener("take", start);
        setTimeout(start, 6000); // no take at all: better late than a blank card
      } else start();
    },
  };
})();
```

- `apply` è identica a quella del piano precedente: `fx`, `set`, `fromTo`, `to`, `from`; `target` cercato con `document.querySelectorAll`; errori per un effetto sconosciuto o un bersaglio vuoto. Va scritta per intero.
- `card.html` chiama `card.boot()` in fondo: il listener di `take` si registra dopo `ready`, quindi `palco()` deve aspettare `ready` prima del ciak (A.9).
- **Regole del sistema** (le fissa `darkStyle.md`): niente `animation`, `transition` o `setTimeout` per l'aspetto; ogni movimento sta su `card.tl` a un tempo assoluto; gli elementi che entrano sono nascosti dal loro effetto (`fromTo`), non dal CSS.

### A.7 `commons/parts.js` — le parti

Una parte costruisce un pezzo di pagina da dati semplici, con le classi di `card.css`, e dichiara come entra (`data-enter`). Il prototipo decide dove e quando.

```js
// The parts every prototype is made of. Each builds its piece of page from plain data, with the
// classes of card.css, and says how it enters (data-enter: an effect of motion.js). A prototype
// decides where and when; the parts decide what and how.
// LINKED-DATA: commons/darkStyle.md § "Parts" describes each one; card.css holds their look.
(() => {
  const el = (tag, cls = "", text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const entra = (n, effetto, config) => {
    n.dataset.enter = effetto;
    if (config) n.dataset.enterConfig = JSON.stringify(config);
    return n;
  };
  window.parts = {
    stack(...figli) { const s = el("div", "stack"); s.append(...figli.filter(Boolean)); return s; },
    logo() { const i = entra(el("img", "logo"), "rise"); i.src = "../../theme/logo.svg"; i.alt = "viteTranslate"; return i; },
    headline(text, { role = "heading", tag = "h1" } = {}) { return entra(el(tag, `headline t-${role}`, text), "rise"); },
    lead(line, accent) { /* p.t-lead: line + " " + <b>accent</b> in --accent; wraps within --measure */ },
    chip(text) { return entra(el("code", "chip t-body", text), "rise", { y: 28 }); }, // data-fit inside --measure
    /** A grid of tiles, one per item; `fill(tile, item)` puts its content in. */
    tiles(items, fill) {
      const grid = el("div", "grid");
      const tiles = items.map((item) => { const t = entra(el("div", "tile"), "hit"); fill(t, item); grid.append(t); return t; });
      return { el: grid, tiles };
    },
    /** Tile content: a big line (one line, fit) and a small one (wraps). */
    bigSmall(tile, [big, small = ""]) {
      const b = el("div", "big t-hero", big); b.dataset.fit = "";
      tile.append(b, el("div", "small t-body", small));
    },
    /** Words in a row that wraps, dots between them, waiting barely visible. */
    words(list) { /* ul.cluster.t-display: li.word (opacity .08, data-enter pop) and li.dot (opacity 0, data-enter light) → { el, words, dots } */ },
    /** A column: a heading, then items with a drawn tick. */
    group(tile, [heading, ...items]) { /* h2.t-text accent + ul.stack (--gap: --space-m) of li (tick svg + span.t-text, data-enter rise {duration .5}) */ },
    /** Lines in a column; a line in backticks becomes a chip. */
    lines(list) { /* ul.stack.t-body; li rise; `npm i …` → code.chip */ },
    note(text) { /* p.note.t-small --faint in .frame-foot, data-enter fade */ },
    credits(lines) { /* div.credits.t-fine --quiet, the first line --muted, in .frame-foot, data-enter rise {y: 20} */ },
    stamp(text) { /* .stamp in .frame-over, bottom right; "small|BIG|small"; puts the #ink SVG filter in the page once */ },
    qr(src, label) { /* figure.qr in .frame-over, bottom right under the stamp; img on white (src via card.asset), figcaption */ },
    /** The common params, for every prototype: note, stamp, qr. */
    common() {
      const p = card.param;
      if (p("note")) card.enter(parts.note(p("note")), Number(p("noteAt", "1")));
      if (p("stamp")) card.fx("stamp", parts.stamp(p("stamp")), Number(p("stampAt", "1"))); // also when still
      if (p("qr")) card.fx("rise", parts.qr(card.asset(p("qr")), p("qrLabel")), Number(p("qrAt", "1.5")), { y: 20, duration: 0.6 });
    },
  };
})();
```

- I commenti `/* … */` dentro le parti sono la specifica da implementare: ogni parte va scritta per intero in fase 1, con l'aspetto in `card.css`. Fonte di ispirazione: le card di oggi (le misure del timbro, del QR, della spunta, il filtro `#ink` di `outro.html`), ricondotte a token e scale.
- Il default di `noteAt` lo può spostare il prototipo: `card.noteAt = t` prima di `common()`. Per esempio together la vuole dopo l'ultima voce.
- Le parti stanno tutte in un file finché restano piccole (obiettivo: `parts.js` sotto le 250 righe). Se cresce, si divide in `commons/parts/<parte>.js`, chiedendo prima.

### A.8 I prototipi

Ogni prototipo è una composizione corta. Esempio completo, beats:

```js
// beats: a title, a command, then tiles landing one by one on the voice (2 to 8; more rows past 4).
// Sheet: beats.md. Variants: variants.yaml.
card.define(({ param, list, times, body, parts, enter }) => {
  const title = parts.headline(param("title", "LLM auto-translation"));
  const chip = param("code") ? parts.chip(param("code")) : null;
  const items = list("beats", [["💰", "Cost first"], ["✋", "Asks before spending"], ["🛡️", "Every result validated"]]);
  const grid = parts.tiles(items, parts.bigSmall);
  body.append(parts.stack(title, chip, grid.el));
  enter(title, 0);
  enter(chip, 0.25);
  times(items.length, { first: 1.5, step: 1.2 }).forEach((t, i) => enter(grid.tiles[i], t));
});
```

| Prototipo | Composizione | Params propri (nomi di oggi, compatibili) | Si adatta a |
| :- | :- | :- | :- |
| **title** | stack: `logo`, `lead(line, accent)` | `line`, `accent` | una riga lunga va a capo entro `--measure` |
| **question** | stack: `headline(question, hero)`, `words(words)` | `question`, `words`, `at` | domanda su due righe; parole su più righe |
| **beats** | stack: `headline(title)`, `chip(code)`, `tiles(beats, bigSmall)` | `title`, `code`, `beats`, `at` | 1–4 tessere su una fila, poi file bilanciate; grande su una riga che si stringe; piccola che va a capo; il corpo si stringe |
| **together** | stack: `headline(title)` se c'è, `tiles(groups, group)` | `title`, `groups`, `at`, `beat` | 1–4 colonne per fila, poi più file; voci che vanno a capo; `glow` su tutte le spunte 0,7 s dopo l'ultima; `noteAt` dopo l'ultima voce |
| **outro** | stack: `logo`, `lines(lines)`; `credits` in foot se ci sono | `lines` (nuovo; default le tre righe di oggi: npm, Marketplace, GitHub), `credits` dal recorder | righe quante se ne vogliono; credits su più righe |

`note`, `stamp`, `qr` e `still` valgono per tutti (A.7). In compare la scena coffee usa `stamp` e `qr` su outro con `still`: resta possibile e il taglio non si vede, perché lo strato sopra non sposta il corpo.

**Varianti** (`components/<nome>/variants.yaml`): documentazione, test e galleria insieme.

```yaml
# beats: the variants. The sheet shows them, the tests check them, the gallery draws them.
- name: default # the prototype's own defaults
- name: production # as in compare's `bundle`
  params: { title: In production, beats: "0|runtime dependencies\n5 kB|gzip\nPrecompiled|no message parsing at runtime", note: "ICU plurals, select, numbers and dates: compiled at build time" }
- name: four
  params: { beats: "💰|Cost first\n✋|Asks before spending\n🛡️|Every result validated\n🧠|Any model you like" }
- name: seven # two rows: 4 + 3
  params: { beats: "…seven…" }
- name: too-much # the limit, written down
  params: { beats: "…twelve long ones…" }
  expect: error
```

Per ogni prototipo ci vogliono almeno queste varianti: il default, l'uso reale in compare o quick2, due varianti "di più" (più elementi, testi più lunghi) e una oltre il limite (`expect: error`). Chiavi ammesse: `name`, `params`, `look`, `anim`, `expect` (`fits`, il default, oppure `error`), `note` (una riga per la scheda).

### A.9 Pipeline

**`uty/storyboard.mjs`**
- `card` per nome. Un nome semplice (`beats`) diventa `@commons/components/beats/beats.js`; `./components/<nome>` diventa il prototipo del progetto, `components/<nome>/<nome>.js`. Il file deve esistere.
  ```js
  // `card: beats` è il prototipo condiviso; `card: ./components/mio` uno del progetto (README.md § "Cards").
  if (scena.stage === "card") {
    const c = String(scena.card ?? "");
    if (/^[a-z0-9-]+$/.test(c)) scena.card = `@commons/components/${c}/${c}.js`;
    else if (/^\.\/components\/[a-z0-9-]+$/.test(c)) scena.card = `components/${c.split("/").pop()}/${c.split("/").pop()}.js`;
  }
  ```
- `look` in testa allo YAML (default per tutte le card del video) e nella scena (solo `stage: card`), fusi così: testa, poi scena. Una mappa di valori semplici con chiavi `/^[a-z][a-z0-9-]*$/`. Che il token esista lo controlla il browser (`layout.look`).
- `anim` solo con `stage: card`, con `controllaAnim` (codice nel piano precedente, invariato).
- `DEFAULTS` + `look: {}`.

**`uty/director.mjs`**
- `export function urlCard(project, scena)`: la pagina `commons/card.html`, poi `proto` (l'URL `file://` del js), params, credits, `look` (testa + scena, JSON), `anim` (JSON) e `clock=take`.
- `palco()`: `goto(urlCard(...))`, poi `waitForFunction(() => window.card?.ready, null, { timeout: 15_000 })`, poi `card.errors`. Se ce ne sono, `throw new Error(\`${scena.id}: card ${scena.card}: ${errori.join("; ")}\`)`. Al posto del `networkidle` di oggi.
- `preparaCard()`: `registraErrori(page, "card.log")`. `ciak()`: avviso se `card.started` resta falso (B.3).

**`uty/record.mjs`** — l'impronta di una card copre tutto quello che la fa:
```js
// Quello che fa una card: la cartella del prototipo, la forgia comune, i token del sito, GSAP, i credits.
const FORGIA = ["card.html", "card.css", "motion.js", "clock.js", "layout.js", "parts.js"];
const versioneGsap = () => JSON.parse(readFileSync(join(VIDEO_DIR, "node_modules/gsap/package.json"), "utf8")).version;
const card = (s) =>
  s.stage === "card"
    ? [improntaCartella(dirname(resolveRef(project.paths, s.card))), ...FORGIA.map((f) => leggi(`@commons/${f}`)),
       readFileSync(join(REPO_DIR, "site/theme/tokens.css"), "utf8"), versioneGsap(), music?.credits ?? null, project.look ?? null]
    : null;
```
In `PIPELINE` si aggiungono `probe.js` e `probe.mjs` (Parte B).

**YAML dei progetti** (solo tecnica, niente `stamp`):
- compare: `card: question | title | beats | together | outro`;
- quick2: title, outro.
- `check` deve restare verde su tutti e due.

### A.10 `uty/card.mjs` — vedere, provare, galleria

```text
node uty/card.mjs <project> <scene> [--at 0.5,1,2.4]     una scena com'è nello YAML
node uty/card.mjs <prototype> [<variant>] [--at …]       un prototipo, con una sua variante
node uty/card.mjs --gallery [--open]                     tutte le varianti di tutti i prototipi
```
- Chrome come `Director.launch()` (channel `chrome`, headless) e contesto come `Director.apri()` (1920×1080, `colorScheme: "dark"`). `goto(urlCard(...))`, poi attesa di `card.ready`, poi `card.errors`.
- `--at`: per ogni tempo, in ordine crescente, `card.seek(t)`, due `requestAnimationFrame`, screenshot. Senza `--at`: ogni 0,5 s fino a `card.tl.duration() + 0.5`. Foglio `contact.jpg` (ffmpeg-static, `tile=4xN`). Uscita: `projects/<p>/preview/cards/` (scena) o `.cache/cards/<prototipo>/` (prototipo).
- `--gallery`:
  - per ogni prototipo in `commons/components/` e ogni variante: lo stato finale (`seek(duration)`), gli errori, e se l'esito non è quello di `expect` lo segnala ed esce con codice 1;
  - scrive `.cache/gallery/index.html`, una pagina con una sezione per prototipo: le varianti come immagini, sotto ognuna gli errori, il link per vederla viva (l'URL `file://` di `card.html` con i suoi params, senza `clock=take`) e la sua `note`;
  - `--open` la apre nel browser (`start` su Windows).
  - La pagina usa `card.css` per i colori: la galleria è nello stile delle card.
- `js-yaml` (già una dipendenza) legge le varianti. Commenti in italiano.

---

## 3. Parte B — sonde di feedback

Invariata rispetto alla prima versione del piano, riportata qui per intero.

### B.1 `uty/probe.js` (init script, in ogni frame)

Ascolta e basta: non disegna, non cambia il DOM, non chiama `preventDefault`. Gira anche negli iframe: le webview dell'estensione sono quelle che danno più problemi.

```js
// La sonda: in ogni documento di ogni pagina (iframe e webview comprese) ascolta quello che arriva
// davvero (puntatore, focus, tasti, mutazioni, overlay, spostamenti del layout) e lo manda a lotti a
// probe.mjs, tramite la binding __vtProbeSend. Non disegna e non cambia niente: ascolta soltanto.
// LINKED-DATA: i tipi di evento (k) e i loro campi sono quelli che legge Sonde in uty/probe.mjs e
// che README.md § "Probes" descrive; SOPRA e APERTI sono gli overlay di README.md § "On stage".
(() => {
  if (window.__vtProbe) return;
  const ora = () => performance.timeOrigin + performance.now(); // ms epoch, confrontabili con Date.now() di node
  const coda = [];
  let timer = null;
  const invia = () => {
    timer = null;
    if (!coda.length || typeof window.__vtProbeSend !== "function") return;
    window.__vtProbeSend(coda.splice(0)).catch?.(() => {});
  };
  const metti = (e, subito = false) => {
    coda.push({ t: ora(), ...e });
    if (subito) invia();
    else timer ??= setTimeout(invia, 100);
  };
  // I nostri strati (cursore, onda, segni) non contano come mutazioni della pagina.
  const NOSTRI = "#__vtCursor, #__vtRipple, #__vtMarks";
  const descrivi = (n) => { /* tag#id.cls[data-cmd|data-open|data-value|aria-label|role] "testo (40)" */ };
  const scrivibile = (n) =>
    !!n && (!!n.closest?.(".monaco-editor, .xterm") || n.isContentEditable || ["input", "textarea"].includes(n.localName));

  // Il puntatore: dove arriva davvero il clic, e se è il bersaglio che il regista ha marcato.
  for (const tipo of ["pointerdown", "click"])
    addEventListener(tipo, (e) => {
      const m = e.target.closest?.("[data-vt-target]");
      metti({ k: tipo, x: e.clientX, y: e.clientY, target: descrivi(e.target), mirato: m?.getAttribute("data-vt-target") ?? null }, true);
    }, true);
  let sotto = null;
  addEventListener("mouseover", (e) => {
    if (e.target === sotto) return;
    sotto = e.target;
    metti({ k: "hover", target: descrivi(e.target) });
  }, true);

  // Il focus e i tasti.
  addEventListener("focusin", (e) => metti({ k: "focus", target: descrivi(e.target), scrivibile: scrivibile(e.target) }, true), true);
  addEventListener("blur", (e) => e.target === window && metti({ k: "window", focus: false }, true));
  addEventListener("focus", (e) => e.target === window && metti({ k: "window", focus: true }, true));
  let tasti = null; // un treno di tasti sullo stesso bersaglio: un evento solo
  addEventListener("keydown", (e) => {
    const target = descrivi(e.target);
    if (tasti && tasti.target === target && ora() - tasti.ultimo < 300) {
      tasti.n++;
      tasti.ultimo = ora();
      return;
    }
    tasti = { k: "keys", target, scrivibile: scrivibile(e.target), n: 1, primo: e.key, ultimo: ora() };
    metti(tasti); // stesso oggetto: n continua a crescere finché il lotto parte
  }, true);

  // Le mutazioni, a secchi da 100 ms: quando la pagina reagisce e quando torna ferma.
  let secchio = null;
  new MutationObserver((ms) => {
    const vere = ms.filter((m) => !(m.target.closest?.(NOSTRI) || m.target.parentElement?.closest?.(NOSTRI)) && m.attributeName !== "data-vt-target");
    if (!vere.length) return;
    if (!secchio) {
      secchio = { k: "dom", n: 0 };
      metti(secchio);
      setTimeout(() => (secchio = null), 100);
    }
    secchio.n += vere.length;
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });

  // Gli spostamenti del layout e i blocchi lunghi del main thread.
  try {
    new PerformanceObserver((l) => {
      for (const s of l.getEntries()) metti({ k: "shift", value: +s.value.toFixed(4), da: s.sources?.map((x) => descrivi(x.node)) });
    }).observe({ type: "layout-shift", buffered: false });
    new PerformanceObserver((l) => {
      for (const x of l.getEntries()) metti({ k: "long", ms: Math.round(x.duration) });
    }).observe({ type: "longtask", buffered: false });
  } catch {}

  // Gli overlay: fumetti e suggerimenti (mai voluti in una clip), e ciò che non deve restare aperto
  // al taglio. Ogni 250 ms, solo i cambiamenti.
  const SOPRA = ".monaco-hover:not(.hidden), .suggest-widget.visible, .fumetto.acceso, [role=tooltip]"; // DA VERIFICARE in fase 2
  const APERTI = ".find-widget.visible, .quick-input-widget, .context-view .monaco-menu"; // DA VERIFICARE in fase 2
  const visibili = (sel) =>
    [...document.querySelectorAll(sel)].filter((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== "hidden" && getComputedStyle(n).display !== "none";
    }).map(descrivi);
  let prima = "";
  setInterval(() => {
    const stato = { sopra: visibili(SOPRA), aperti: visibili(APERTI) };
    const s = JSON.stringify(stato);
    if (s !== prima) {
      prima = s;
      metti({ k: "overlay", ...stato }, true);
    }
  }, 250);

  metti({ k: "load", url: location.href.slice(0, 120) }, true);
  window.__vtProbe = { descrivi, scrivibile };
})();
```

Note:
- `descrivi(n)`: `localName` + `#id` + fino a 3 classi + gli attributi `data-cmd`, `data-open`, `data-value`, `aria-label`, `role` (valori tagliati a 40) + il testo `innerText` ripulito e tagliato a 40. Per un nodo non elemento, `nodeName`. Va scritta per intero in fase 1.
- I selettori `SOPRA`/`APERTI` sono una prima ipotesi, da verificare sul VS Code vero in fase 2 (B.6). La classe `fumetto acceso` è il fumetto dell'estensione (`idePlugin/src/webViews/tooltip/tooltipScript.mjs`).
- `keydown` aggrega i treni di tasti: un `type` di 45 caratteri dà un solo evento con `n: 45`.

### B.2 `uty/probe.mjs` (node)

```js
// Le sonde lato node: ricevono gli eventi di probe.js da ogni frame, li tengono (gli ultimi 20.000)
// e li scrivono in log/probe.jsonl; il regista ci chiede cosa è successo dopo un'azione.
// LINKED-DATA: i campi degli eventi sono quelli di probe.js; README.md § "Probes".
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const SONDA = readFileSync(new URL("./probe.js", import.meta.url), "utf8");
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export class Sonde {
  constructor(file) {
    this.file = file;
    this.eventi = [];
    this.azioni = [];
    this.scena = "setup";
    writeFileSync(file, ""); // un diario per ripresa
  }
  /** In un contesto nuovo, prima di aprirne le pagine: la binding e lo script in ogni frame. */
  async collega(ctx, pagina) {
    await ctx.exposeBinding("__vtProbeSend", ({ frame }, lotto) => this.ricevi(pagina, frame, lotto));
    await ctx.addInitScript(SONDA);
  }
  ricevi(pagina, frame, lotto) {
    const f = frame.parentFrame() ? frame.url().replace(/\?.*$/, "").slice(-60) || frame.name() : "top";
    const righe = [];
    for (const e of lotto) {
      const r = { ...e, pagina, frame: f, scena: this.scena };
      this.eventi.push(r);
      righe.push(JSON.stringify(r));
    }
    if (this.eventi.length > 20_000) this.eventi.splice(0, this.eventi.length - 20_000);
    appendFileSync(this.file, righe.join("\n") + "\n");
  }
  /** Una riga del regista nel diario: l'azione, quando comincia e quando finisce. */
  nota(r) {
    const riga = { t: Date.now(), k: "action", scena: this.scena, ...r };
    this.azioni.push(riga);
    appendFileSync(this.file, JSON.stringify(riga) + "\n");
  }
  dal(t, filtro = () => true) {
    return this.eventi.filter((e) => e.t >= t && filtro(e));
  }
  /** Il primo evento dopo `t` che soddisfa `filtro`, aspettandolo fino a `ms`; null se non arriva. */
  async aspetta(t, filtro, ms) {
    const fine = Date.now() + ms;
    for (;;) {
      const e = this.eventi.find((x) => x.t >= t && filtro(x));
      if (e || Date.now() > fine) return e ?? null;
      await pausa(20);
    }
  }
  /** L'ultimo stato degli overlay di una pagina, frame per frame (push: non costa tempo filmato). */
  overlay(pagina) {
    const per = new Map();
    for (const e of this.eventi) if (e.k === "overlay" && e.pagina === pagina) per.set(e.frame, e);
    return [...per.values()];
  }
}
```

`a_type` e `a_key` contano i tasti con `aspetta`/`dal`. Gli eventi `keys` arrivano a lotti: prima di contare, `await pausa(150)` dopo l'ultima pressione. Avviene fuori dal tempo dell'azione, perché c'è già una pausa (vedi B.3).

### B.3 I controlli nel regista (`uty/director.mjs`)

Nuovi membri: `this.sonde = null` (lo assegna `record.mjs`), `this.avvisi = []`, `this.rigido = false`, `this.diario = false`.

```js
/** Un esito che non torna: sotto la scena come avviso, o (`--strict`) la ripresa si ferma qui. */
avvisa(testo) {
  if (this.rigido) throw new Error(`probe: ${testo}`);
  this.avvisi.push(testo);
}
```

- `apri()`: `if (this.sonde) await this.sonde.collega(ctx, nome)` prima degli init script del cursore.
- `esegui()`: per ogni azione `this.sonde?.nota({ azione: nome, arg, fase: "start" })` prima e `{ fase: "end" }` dopo. I controlli stanno dentro i singoli `a_*`, ma **solo se `!veloce`** (l'avanti veloce non si filma). `esegui` passa `veloce` alle azioni tramite `this.veloce = veloce` all'inizio e `false` alla fine.
- Un aiuto `const etichetta = (nome, arg) => \`${nome} ${JSON.stringify(arg)}\``, per avvisi leggibili.

Controlli, azione per azione. Ogni lettura del DOM avviene **dopo** l'azione, dentro una pausa che c'è già, oppure aggiunge al massimo pochi ms: le riprese non devono cambiare durata in modo visibile.

| Azione | Controllo | Come | Avviso (inglese, come gli altri `!`) |
| :- | :- | :- | :- |
| `click` | il bersaglio non è coperto | prima di muovere il cursore: `bersaglio.evaluate(n => { const r = n.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !h \|\| n === h \|\| n.contains(h) \|\| h.contains(n) ? null : window.__vtProbe?.descrivi(h) })` | `click {…}: the target is covered by <descr>` |
| `click` | il clic arriva sul bersaglio | prima del clic `bersaglio.evaluate(n => n.setAttribute("data-vt-target", "1"))`; `const t = Date.now()`; dopo il clic `sonde.aspetta(t, e => e.k === "pointerdown", 800)`; poi `removeAttribute` (`.catch(() => {})`) | nessun evento: `click {…}: no click reached the page`; `mirato` nullo: `click {…}: landed on <target>, not on the target` |
| `click` | il cursore disegnato sta dove clicca quello vero | dopo la pausa finale di `a_click`: rect di `#__vtCursor` (+2 px) contro `x, y` | oltre 4 px: `click {…}: the drawn pointer is N px from the real one` |
| `type` | il focus è in un editor | prima di scrivere: `fuoco(page)` (sotto) | non scrivibile: `type: the focus is on <el> (<frame>), not in an editor: the keys may go nowhere` |
| `type` | i tasti arrivano | dopo: `await pausa(150)`, somma `n` degli eventi `keys` con `scrivibile` da `t` | meno del 90 % dei caratteri: `type: N of M keys reached an editor` |
| `key` | i tasti arrivano da qualche parte | dopo la pausa di 120 ms che c'è già: almeno un evento `keys` da `t` | `key <k>: no key reached the page` |
| `goto` | la riga è quella | dopo: testo di `[id="status.editor.selection"]` (DA VERIFICARE), `/Ln (\d+), Col (\d+)/` | `goto 11: the cursor is on line 12` (con colonna: `line 11, column 4`) |
| `find` | c'è una selezione lunga quanto il testo | dopo l'Escape: stesso elemento della status bar, `/\((\d+) selected\)/` | nessuna: `find "null": nothing selected (the search box seeded with the same word? Field notes)`; lunghezza diversa: `find "null": N characters selected, expected M` |
| `save` | il file è salvato | dopo la pausa: `.tabs-container .tab.active.dirty` deve sparire entro 1 s (`waitFor({ state: "detached" })`) | `save: the file still has unsaved changes` |
| `command` | la palette si è chiusa | dopo la pausa: `.quick-input-widget:visible` assente entro 1 s | `command "…": the palette is still open` |
| `mark` | il bersaglio è fermo e intero | durante la pausa di disegno, senza aggiungere tempo: rimisura il box 150 ms dopo l'`add` e lo confronta col primo; poi controlla che stia nel viewport | oltre 3 px (pixel del video): `mark {…}: the target moved N px while drawn: mark when the layout is still`; fuori: `mark {…}: the target is partly off screen` |
| card | il ciak ha avviato la card | `ciak()`, dopo il `dispatchEvent`: `card.started` | `card: the take didn't start the card` |

Il focus attuale (pull, solo prima di un `type`; pochi ms):
```js
/** Dove sta il focus adesso: il frame più profondo che lo ha, e il suo elemento attivo. */
async fuoco(page) {
  let qui = null;
  for (const frame of page.frames()) {
    const r = await frame
      .evaluate(() => {
        if (!document.hasFocus()) return null;
        const a = document.activeElement;
        if (!a || a.localName === "iframe") return null; // il focus sta più giù
        return { el: window.__vtProbe?.descrivi(a) ?? a.localName, scrivibile: window.__vtProbe?.scrivibile(a) ?? false };
      })
      .catch(() => null);
    if (r) qui = { ...r, frame: frame === page.mainFrame() ? "top" : frame.url().replace(/\?.*$/, "").slice(-60) };
  }
  return qui;
}
```

Al taglio (chiamato da `record.mjs` dopo l'attesa finale, prima di fermare i recorder; legge solo lo stato push, nessun ritardo):
```js
/** Al taglio: gli overlay rimasti aperti, e i fumetti comparsi durante la clip, sulle pagine in scena. */
igiene(pagine, t0) {
  if (!this.sonde) return;
  for (const p of pagine) {
    for (const e of this.sonde.overlay(p)) {
      for (const o of e.sopra) this.avvisa(`at the cut, ${p}: a tooltip is on screen: ${o}`);
      for (const o of e.aperti) this.avvisa(`at the cut, ${p}: still open: ${o}`);
    }
    const visti = new Set();
    for (const e of this.sonde.dal(t0, (x) => x.k === "overlay" && x.pagina === p))
      for (const o of e.sopra) if (!visti.has(o)) {
        visti.add(o);
        this.avvisa(`${((e.t - t0) / 1000).toFixed(1)} s, ${p}: a tooltip showed up: ${o}`);
      }
  }
}
```

`--probe` (diario a video): a fine scena, per ogni azione filmata, una riga calcolata dal diario (nessun costo durante la clip):
```text
    · click {"text":"Sync"} · hit vscode-button[data-cmd="sync"] · reaction 35 ms · still at 640 ms
```
`reaction` = primo evento `dom` della stessa pagina dopo la fine dell'azione. `still` = fine dell'ultimo secchio `dom` prima di 300 ms senza secchi. Lo calcola un metodo `riassunto(scena)` di `Sonde` a partire da `this.azioni`.

### B.4 `uty/record.mjs` e `uty/run.mjs`

- `record(project, { …, probe = false, strict = false })`: `regista.sonde = new Sonde(join(paths.log, "probe.jsonl"))`, `regista.rigido = strict`, `regista.diario = probe`.
- Prima di ogni scena: `regista.sonde.scena = scena.id`. Prima del setup, `"setup"`.
- Dopo l'attesa finale (accanto a `regista.chiudiSegno()`): `regista.igiene(viste.map((v) => v.page), t0Epoch)`, con `t0Epoch = Date.now()` preso insieme a `t0`.
- Sotto la riga `●` della scena, dopo i `segniBrevi`: `for (const a of regista.avvisi.splice(0)) console.warn(\`    ! ${a}\`)`, poi le righe `·` se `probe`.
- Gli avvisi del setup si stampano dopo `parcheggia()` come `  ! setup: …`.
- `run.mjs`: `--probe` e `--strict` in testa al file, in `USO` e passati a `record`, come oggi `--headed`/`--full`.

### B.5 Impronta

`PIPELINE` in `record.mjs`: + `"probe.js"`, `"probe.mjs"`. Cambiarli rigira tutto, come il resto di `uty/`.

### B.6 Selettori da verificare sul VS Code vero (fase 2)

| Cosa | Ipotesi | Come verificarlo |
| :- | :- | :- |
| riga e colonna | `[id="status.editor.selection"]`, testo `Ln 11, Col 23` | `record --to write` su compare, poi `probe.jsonl` + una stampa del testo |
| selezione | `(4 selected)` nello stesso elemento | dopo il `find` di `sync` |
| fumetto dell'editor | `.monaco-hover:not(.hidden)` | in un banco: `page.hover` su un token del codice, `editor.hover.delay` 3000 → aspettare 3,5 s |
| fumetto della webview | `.fumetto.acceso` | `page.hover` su una riga di Project |
| palette, find, menu | `.quick-input-widget`, `.find-widget.visible`, `.context-view .monaco-menu` | aprirli da script e leggere lo stato `overlay` |
| eventi dalle webview | la binding arriva negli iframe out-of-process | in `probe.jsonl`, il clic su Sync deve avere `frame` ≠ `top` e `mirato: "1"` |

Se un'ipotesi non regge, si corregge il selettore. Se **la binding non raggiunge le webview**, si scrive `video_gsap_probes.necessaryreview.md` con la variante a richiesta (`frame.evaluate(() => __vtProbe.svuota())` per frame, solo nei controlli) e si chiede all'utente prima di procedere.

---

## 4. Documentazione (fase 5)

### 4.1 `commons/darkStyle.md` — il manuale della forgia (inglese)

Per chi forgia: tabelle, poche frasi.
1. **Intro.** Cosa copre; dove vivono i valori (`card.css`, `motion.js`, `layout.js`, `parts.js`, `tokens.css` del sito, `app-dark.css`, `VSCODE_SETTINGS`/`FRECCIA`/`CURSORE` in `director.mjs`, `COLORS`/`DEFAULTS` in `marker.js`). Commento LINKED-DATA.
2. **Knobs and scales.** Ogni manopola con il suo default; le due scale con i valori a manopole di serie; come `look` le cambia, per video e per scena; perché le scale sono ridichiarate su `.knobs`.
3. **Color.** I token del sito usati, con il loro ruolo; il fondo della cornice; le velature dell'accento del movimento.
4. **The frame.** Regioni (head, body, foot, over), margini sicuri, il corpo come contenitore, lo strato sopra che non sposta niente.
5. **Primitives.** La tabella di A.3.
6. **Parts.** Per ogni parte: dati, aspetto (ruoli e token), come si adatta, effetto di entrata.
7. **Adapting.** L'ordine (contenitore → a capo → file → si stringe fino a 0,7 → errore) e il controllo finale, con i suoi messaggi.
8. **Motion.** Curve, effetti (nome, cosa fa, default), `--tempo`. Le regole: lo zero è il ciak; ogni cosa entra sulla parola che la nomina; tutto su `card.tl`; niente animazioni CSS né `setTimeout`.
9. **The other stages.** VS Code, palco app, cursore, segni, dissolvenza: come sono oggi.
10. **Forging.** Una lista di controllo per un prototipo nuovo (cartella, `define`, parti, tempi, scheda, varianti, galleria) e una per una parte nuova o un effetto nuovo (dove, cosa documentare, una variante che li usi).

### 4.2 La scheda `components/<nome>/<nome>.md` (inglese)

````markdown
# <nome>

<one line>. Good for: <…>. In the YAML: `card: <nome>`.

## Params
| Param | Default | |        ← i suoi; poi una riga: "and the common ones: note, stamp, qr, still"

## Built from
<parts, regions>               ← la composizione in due righe

## How it adapts
<limits, from its variants>    ← cosa succede con più elementi e testi più lunghi, dov'è il limite

## Timeline
| When | What | Effect |

## Targets for `anim`
| Selector | Is |

## Variants
<the list in variants.yaml, with their note> · `node uty/card.mjs <nome> <variant>`

## Example
```yaml
<the scene that uses it in compare or quick2>
```
````

### 4.3 `site/video/README.md`

- **§ Cards** riscritto come **Cards: the forge**:
  - in breve, cos'è un prototipo e dove sta il manuale (`commons/darkStyle.md`);
  - la tabella dei prototipi con un link per scheda;
  - `card`, `params` e i params comuni;
  - `look`, con un esempio;
  - `anim`: le chiavi, un esempio, gli errori fermati prima;
  - **Timing on the voice**;
  - la galleria;
  - **A new prototype**, che rimanda a `darkStyle.md` § Forging;
  - via le tabelle per card.
- **§ Converting**, punto 3: scegliere il prototipo dalla galleria e dalle schede; un contenuto oltre il limite di una scheda è un ask, non un `look` a caso; `anim` solo se il `.md` chiede un movimento che il prototipo non fa.
- **§ storyboard.yaml**: `look` in testa e nella scena, `anim` nella scena; **Files**: `card` per nome.
- **§ Commands**: `--probe`, `--strict`, `node uty/card.mjs` (tre forme).
- **§ Probes**, nuova: vedi la Parte B.
- **§ Folders**, **§ The pipeline**, **§ Rules for agents** (regola 8: avvisi e `probe.jsonl`), **§ Field notes** (i fumetti li segnala la sonda; le card si guardano con `card.mjs`, non con Chrome a mano), il comando del QR (in `components/outro/`).

### 4.4 `site/video/projects/index.md`

Voce di log; la riga "Pipeline" (forgia, prototipi, galleria, sonde); in "Next":
- la prima forgiatura (rifare compare e quick2 coi prototipi nuovi e montarli);
- i prototipi che mancano;
- la voce *Small node tests…*, ridotta a quello che resta.

---

## 5. Le sette fasi

> Chi implementa segue lo schema e non salta fasi. Ogni dubbio, e ogni contraddizione tra piano e sorgenti, è un ask all'utente. I test che servono si annotano in `video_gsap_probes.necessarytest.md`, le modifiche ai documenti in `video_gsap_probes.necessarydoc.md`, nella cartella di questo piano; si eseguono nelle fasi 2 e 5. Si costruisce in quest'ordine, e ogni pezzo si guarda appena esiste, con `card.mjs`: la forgia si vede lavorando.

### Fase 1 — Implementazione

1. `npm i -D gsap@3.15.0 --save-exact`; aggiungi lo script `"test": "node --test test/"`.
2. `card.css` (A.2, A.3), `motion.js` (A.5), `clock.js` (A.6), `layout.js` (A.4), `card.html`. Poi `parts.js` (A.7), con le parti che servono a beats.
3. `storyboard.mjs` (A.9, solo `card`, `look`, `anim`) e `urlCard()` in `director.mjs`, che servono a `card.mjs`. Poi `card.mjs` (A.10) nelle prime due forme.
4. **beats per primo** (A.8): `beats.js`, `variants.yaml`, con `card.mjs beats <variante>` a ogni passo. È il banco di prova del sistema: tessere, file bilanciate, subgrid, testo che si stringe, corpo che si stringe. Si scelgono qui i fattori `<k>` dei ruoli (A.3).
5. Le altre parti e gli altri quattro prototipi, ciascuno con le sue varianti. Poi `--gallery`.
6. Si cancellano `commons/{title,outro,question,beats,together}.html`; `coffee-qr.svg` si sposta in `components/outro/`.
7. Il resto della pipeline (A.9): `palco()` con `ready` ed errori, `card.log`, impronta. YAML di compare e quick2, poi `check`.
8. Le sonde (B.1–B.5).
9. Niente riprese in questa fase: `node --check` sui file toccati, `card.mjs` e la galleria. Annotare test e documenti man mano.

### Fase 2 — Test

`site/video/test/`, con `node --test` e `node:assert/strict`; Chrome come nella pipeline.
1. `storyboard.test.mjs` (solo node), su un progetto temporaneo `projects/zz-test-<pid>/` cancellato in `after()`:
   - `card: beats` porta al js condiviso, `card: ./components/x` a quello del progetto;
   - un nome che non esiste dà errore;
   - `look` in testa e nella scena, con chiavi non valide;
   - `anim`: su uno stage che non è card, con due tipi insieme, senza `target`, con `at` negativo, con `fromTo` sbagliato.
2. `forge.test.mjs` (Chrome):
   - **Scale:** `--type-hero` ≈ 130 px e `--space-xl` ≈ 40 px; con `look { type-scale: 0.5 }` il titolo dimezza; con `look { nope: 1 }` errore.
   - **Manopole su `.knobs`:** `--fit: 0.8` sul corpo riduce i caratteri del corpo, non quelli del foot.
   - **Tempo:** con `look { tempo: 2 }` la timeline di beats dura il doppio (`card.tl.duration()`), stamp e thud compresi.
   - **Ogni variante di ogni prototipo:** errori vuoti se `expect` è `fits` (o manca), non vuoti se è `error`.
   - **Griglie:** `--cols` vale 3 per 5 elementi, 4 per 7, 4 per 8.
   - **Subgrid:** nella stessa fila di beats i `.big` hanno lo stesso `top` (±1 px) anche se le `.small` hanno righe diverse.
   - **Corpo che si stringe:** una variante "di più" che entra solo stretta ha `--fit` < 1 e nessun errore.
   - **`still`:** a `seek(0)` gli elementi sono già visibili; timbro e QR entrano lo stesso.
   - **Il QR che copre** una tessera dà errore.
   - **`anim`:** un effetto sconosciuto dà un errore che elenca gli effetti; un bersaglio vuoto dà errore; `{ fx: rise, target: h1, at: 2 }` dà opacità 0 a `seek(1.9)` e 1 a `seek(3)`.
   - **Ripetibilità:** due `seek(2.3)` danno screenshot identici (hash).
   - **Curva:** `gsap.parseEase("vt")` coincide con la cubic-bezier (.2,.7,.2,1) entro 0,01 in 0,25/0,5/0,75 (la bezier si calcola nel test, risolvendo x(t) per bisezione).
3. `probe.test.mjs` (Chrome). Una pagina di prova scritta dal test (`page.setContent`) con un bottone, un div che ne copre metà, un `<iframe srcdoc>` con un input e un `.fumetto.acceso` da accendere, più `Sonde` su un contesto vero. Si verifica:
   - un clic sul bottone marcato dà `pointerdown` con `mirato: "1"`;
   - un clic sulla metà coperta dà il `target` del div;
   - un focus nell'input dell'iframe dà `scrivibile: true` e `frame` ≠ `top`;
   - 10 tasti danno un solo evento `keys` con `n: 10`;
   - il fumetto acceso dà `overlay.sopra` non vuoto;
   - una mutazione dà un secchio `dom`.
4. **Selettori sul VS Code vero** (B.6): `node uty/run.mjs compare record --to sync --silent`, poi `log/probe.jsonl`.
5. `npm test` verde; `node uty/card.mjs --gallery` esce con 0.
6. **La galleria all'utente:** gliela si mostra (`--open`) e si chiede (ask) se i prototipi vanno, prima della fase 3. È la forgia: conta il suo occhio.

### Fase 3 — Build (prova della pipeline)

Nel video non c'è un bundler: la "build" è una ripresa muta, che serve a vedere che la pipeline gira con la forgia nuova. L'aspetto cambia, ed è previsto. L'utente la segue dal vivo: si dice prima cosa si lancia, timeout lungo, una ripresa alla volta.
1. `node uty/run.mjs compare tts record preview --silent`. Le voci vere restano, perché sono in cache. Si controlla:
   - nessun errore di card;
   - le strisce delle card;
   - coffee che continua outro senza salti;
   - gli avvisi `!` delle sonde: ognuno o è un difetto vero (YAML o regista) o un falso positivo (sonda).
2. `node uty/run.mjs quick2 tts record preview --silent`.
3. Una ripresa di compare con `--strict` arriva in fondo.
4. Niente `compose`: il montaggio si fa quando si forgia.

### Fase 4 — Review

- Il diff contro il piano. Gli scostamenti vanno in `video_gsap_probes.necessaryreview.md`; se architetturali, ask e si riparte dalla fase 1.
- **Prova di estensibilità:** un sesto prototipo usa-e-getta (per esempio "steps": un titolo e 3–6 passi numerati in tessere), scritto solo con parti esistenti. Si misura quante righe servono e cosa manca, si annota nel logDiary e lo si cancella. Se servono più di ~25 righe o una parte nuova, va scritto in necessaryreview.
- Controlli fissi:
  - nessun esadecimale nei prototipi né in `parts.js` (solo token; il bianco del QR in `card.css`, commentato);
  - nessuna `animation`, `transition` o `setTimeout` per l'aspetto;
  - LINKED-DATA presenti nei due versi;
  - `parts.js` e `layout.js` dentro le dimensioni previste;
  - le sonde non scrivono nel DOM, salvo `data-vt-target`;
  - nessun controllo durante l'avanti veloce.

### Fase 5 — Documentazione

La sezione 4: `darkStyle.md`, le cinque schede (con i limiti misurati dalle varianti), `site/video/README.md` e `projects/index.md`. Valgono le regole di AGENTS.md § SITE/VIDEO; il README della radice non si tocca. Le lunghezze eccessive si segnalano all'utente.

### Fase 6 — Pulizia

- Si cancellano i file `video_gsap_probes.necessary*.md` non più utili, il prototipo usa-e-getta, gli script nello scratchpad e `.cache/cards/`.
- Nessun `projects/zz-test-*` deve restare.

### Fase 7 — logDiary

Il `[!TIP] logDiary` in testa a questo file, al più dieci righe. Avvertimenti in `[!IMPORTANT]` o `[!CAUTION]`.

---

## 6. Rischi e trappole

- **Una forgia troppo grande.** Il rischio vero è un mini-framework. I limiti: `parts.js` sotto 250 righe e `layout.js` sotto 150; nessuna parte senza un prototipo che la usa; la prova del sesto prototipo in fase 4.
- **Il caricamento del prototipo.** Uno script inserito da `boot` non trattiene `DOMContentLoaded`, quindi tutto passa per `boot()` e `card.ready`. `palco()` aspetta `ready`, non `networkidle`.
- **Custom properties.** Le scale si ricalcolano solo dove sono dichiarate (`:root`, `.knobs`): una manopola messa altrove non ha effetto. Lo dice `darkStyle.md` e lo verifica un test.
- **`container-type: size` sul corpo** vuole un'altezza definita: la dà la riga `minmax(0, 1fr)` della cornice. Senza, il corpo collassa a zero.
- **`place-items: safe center`.** Senza `safe`, un contenuto troppo alto esce anche sopra, e lì non lo misura nessuno.
- **GSAP e transform CSS.** Nessun elemento animato ha un `transform` in CSS (il timbro inclinato lo fa l'effetto).
- **`lagSmoothing(0)`.** Senza, un intoppo di oltre 500 ms fermerebbe la timeline: le entrate arriverebbero in ritardo sulla voce.
- **La binding nelle webview** (Parte B): se non arriva, piano B e ask (B.6).
- **compare e quick2 cambiano aspetto:** è previsto. Le modifiche non committate della sessione precedente in `site/video` restano come sono.
