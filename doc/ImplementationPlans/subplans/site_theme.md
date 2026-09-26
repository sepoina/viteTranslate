# Piano — un tema solo per il sito: `site/theme`, nello stile di tailthemes.com

> [!NOTE]
> **Per il revisore umano**
> - **Cosa:** landing, playground ed edge prendono il linguaggio di [tailthemes.com](https://tailthemes.com/): grafite piatta, un solo accento verde `#4ade80`, etichette mono, hero a griglia con una riga di terminale che si scrive da sola, card piatte da 12 px. llmRestaurant resta com'è.
> - **Un tema solo:** nasce `site/theme/` (token, CSS, barra, selettore di lingua e di tema, blocchi di codice, logo). `npm run site:theme` lo copia in `src/theme/` di ogni progetto, così le pagine restano scaricabili da sole. Un test boccia le copie diverse, i colori scritti fuori da `tokens.css` e le coppie di testo sotto 4,5:1.
> - **Caratteri:** restano Geist e Geist Mono. Escono Instrument Serif e il gradiente sull'`<em>` dei titoli, che diventa verde.
> - **Logo verde ovunque:** il `%` di `doc/logo.svg` diventa verde, `#16a34a` su fondo chiaro e `#4ade80` su fondo scuro (media query dentro l'SVG).
> - **Landing:** stesse sezioni e stessi testi, nessuna chiave nuova: le traduzioni seguono le frasi spostate. Hero a sinistra con le statistiche, card delle pagine subito sotto. Escono aurora, grana e la luce che segue il cursore.
> - **Extra:** edge smette di scaricare highlight.js. Si ripara lo zip StackBlitz del playground, che importava `site/runtimeSize.json` da fuori cartella.
> - **Rischio:** le frasi si spostano senza perdere traduzioni solo se il sync gira una volta sola, a modifiche finite: niente `npm run dev` durante la Fase 1. `compileGolden` va rigenerato (cambiano solo nomi di chiave del sito).

> [!TIP]
> **logDiary**
> - Sync una volta sola a modifiche finite (§ 1.15): `matchRenamedKeys` ha portato tutte le traduzioni sulle
>   chiavi nuove al primo giro, in tutti e tre i progetti — nessun rollback necessario.
> - Chiavi finali: landing 69, playground 103, edge 258, tutte tradotte in tutte le lingue. Combaciano col piano.
> - Suite: 67/67 file, 2580 asserzioni (baseline 2557, +23 dai test del tema in `test/list/site.test.mjs`).
> - Bug dello zip StackBlitz (`StrengthsSection.jsx` importava fuori cartella) risolto insieme al resto: il
>   test del § 2.1 (blocco 12) lo conferma per tutte e quattro le pagine, `llmRestaurant` compresa.
> - Screenshot delle card rifatti in Chrome headless, tema scuro; verifica visiva su landing/playground/edge,
>   scuro e chiaro, desktop e telefono: nessun resto viola, contrasti a norma, barra senza tagli.
>
> [!IMPORTANT]
> - Verifica visiva: `--virtual-time-budget` di Chrome headless non fa avanzare in modo affidabile
>   l'animazione CSS del terminale (`steps()`) quando GSAP/Lenis tengono un `requestAnimationFrame`
>   continuo — lo screenshot mostra il comando a metà anche con budget alti. Confermato via CDP con
>   un'attesa reale: nel browser vero l'animazione finisce in ~2s, non è un bug del tema. Chi rifà
>   questi screenshot in futuro dovrebbe usare un'attesa reale (CDP) invece di `--virtual-time-budget`
>   per le pagine con animazioni CSS a tempo.

> [!TIP]
> **Revisione (2026-09-27): il sorgente di edge in una sezione fissa.** Il riquadro in un angolo si notava poco; un primo tentativo (riquadro sopra la tabella che saltava in alto o in basso) è stato scartato dall'utente.
> - Ora è una sezione fissa in fondo, alta `max(9.5rem, 25dvh)` (`--dock-h`); la pagina ha lo stesso spazio in fondo e `scroll-padding-bottom`, così non nasconde niente.
> - Il codice si ingrandisce fino a riempirla, solo CSS: `SourceDock` scrive `--cols`/`--rows` e il carattere è `clamp(14px, min(100cqw / (cols·0.6), 100cqh / (rows·1.4)), 32px)`. Geist Mono misurato: 0,6 em per carattere.
> - La segue la riga sotto il mouse, non solo il `</>` (che resta per tastiera e tocco); l'ultimo sorgente resta, con la sua riga accesa. Intestazione con nome del caso e pallino dell'esito: approvata.
> - Scura anche nel tema chiaro: in `tokens.css` il blocco scuro vale anche per `[data-theme="dark"]` su qualunque elemento.
> - Nessuna chiave nuova (il suggerimento iniziale riusa la frase delle note, stesso file); `site.test` verde.

---

## Istruzioni per chi implementa

Leggi prima `AGENTS.md`, sezione "REGOLE DI IMPLEMENTAZIONE DEL PLAN". Le sette fasi vanno fatte in quest'ordine, senza saltarne nessuna:

1. **Implementazione** (§ "Fase 1"). Annota i test che servono in `site_theme.necessarytest.md` e le modifiche ai doc in
   `site_theme.necessarydoc.md`, tutti e due accanto a questo file. Niente build in questa fase: bastano `node --check`,
   `node site/syncTheme.mjs --check` e i test in node.
2. **Test** (§ "Fase 2").
3. **Build** (§ "Fase 3").
4. **Review** (§ "Fase 4"). Se qualcosa di architetturale non regge, scrivi `site_theme.necessaryreview.md` e chiedi all'utente.
5. **Documentazione** (§ "Fase 5").
6. **Pulizia**: rimuovi i `site_theme.necessary*.md` che non servono più.
7. **logDiary**: aggiungi la nota `[!TIP]` subito sotto la `[!NOTE]` qui sopra, in una decina di righe al massimo.

Ogni ambiguità, e ogni contraddizione fra questo piano e i sorgenti, si risolve **chiedendo all'utente**. Non scegliere da solo.

> [!CAUTION]
> **Niente `npm run dev`, `npm run site` né `vite build` fino al § 1.15.** Il plugin sincronizza le tabelle da solo
> all'avvio di Vite: se parte a metà lavoro, vede una frase sparita dal vecchio file prima che esista nel nuovo e ne
> **butta la traduzione**. Le traduzioni passano da una chiave all'altra solo se nello stesso sync una chiave sparisce
> e un'altra con lo **stesso identico testo** compare (`matchRenamedKeys` in `lib/dev/vite/updateLanguage.js`).
> Se succede lo stesso: `git checkout -- site/landing/locale site/pages/playground/locale site/pages/playEdge/locale`,
> finisci le modifiche e rifai il § 1.15.

**Regole di stile**, per ogni file toccato:

- Commenti in italiano, testi a schermo come marcatori `_%_…_%_` in italiano (la sorgente è `it-IT`).
- I file nuovi di `site/theme/` usano virgolette doppie e punto e virgola. Gli altri seguono il file vicino: `site/pages/playEdge` usa virgolette **singole**.
- **Le frasi che si spostano si copiano, non si riscrivono.** Taglia e incolla il marcatore dal vecchio file: una
  virgola o uno spazio di differenza creano una chiave nuova, senza traduzione.
- Nei CSS del sito **nessun colore scritto a mano** fuori da `site/theme/tokens.css`: niente `#…`, `rgb(…)`, `rgba(…)`, `hsl(…)`.
  Per le maschere si usa la parola `black`. Lo controlla il test del § 2.1.
- Si cancella con `git rm`, così la storia resta leggibile.

---

## Decisioni prese (ask all'utente del 2026-09-26, più le scelte di piano)

| Tema | Decisione |
| :- | :- |
| Riferimento | Il linguaggio di tailthemes.com (vedi § "Cosa prendiamo da tailthemes") *(utente)* |
| Accento | **Verde tailthemes `#4ade80`**, uno solo *(utente)* |
| Caratteri | **Geist + Geist Mono**, via Instrument Serif e il gradiente sull'`<em>` *(utente)* |
| Profondità sulla landing | **Restyle + nuovo layout**, stesse sezioni e stessi testi, nessuna chiave nuova *(utente)* |
| Centralizzazione | **Copia sincronizzata + test**: sorgente in `site/theme/`, copie in `<progetto>/src/theme/` *(utente)* |
| Logo | **Verde ovunque**, anche `doc/logo.svg` (README, npm) *(utente)*. Su fondo chiaro `#16a34a` (3,3:1 su bianco), su fondo scuro `#4ade80`: una media query dentro l'SVG *(piano)* |
| `runtimeSize.json` | **Viaggia con il sync**: resta in `site/`, `estimateSize` e `AGENTS.md` non cambiano *(utente)* |
| Pagine coinvolte | landing, playground, edge. **llmRestaurant fuori**: è un ristorante inventato con il suo marchio *(utente, dalla richiesta)* |
| Tema chiaro | **Resta** (pulsante e chiave `vt-theme` invariati), con verdi più scuri per il testo: `#4ade80` su bianco fa 1,7:1 *(piano)* |
| Chi riceve il tema | La landing sempre; una pagina se il suo `package.json` ha `"vitetranslateSite": { …, "theme": true }` *(piano)* |
| Copia | Tutta `src/theme/`, identica byte per byte, riscritta intera a ogni sync. Si committa: la cartella scaricata da GitHub deve buildare *(piano)* |
| Font | Li carica `theme.css` con `@import url(…)`, non più gli `index.html`. Verificato: Vite porta l'`@import` in cima al CSS finale *(piano)* |
| Favicon | `<link rel="icon" href="/src/theme/logo.svg">` in ogni `index.html`. Verificato: Vite lo riscrive con la `base` *(piano)* |
| Barra in alto | Un componente solo (`SiteBar`), sticky e sempre piena. Sparisce lo stato "trasparente finché non scorri" della landing *(piano)* |
| Blocco di codice | Un componente solo, API `{ code, lang, title, className }`. La barra col titolo c'è solo se c'è `title` *(piano)* |
| highlight.js in edge | Via: il riquadro del sorgente usa `highlight()` del tema. Una CDN in meno, stessi colori del resto *(piano)* |
| Movimento | GSAP e Lenis restano sulla landing, con entrate più corte; la parallasse esce con l'aurora. Sulle pagine un'entrata solo CSS (`.rise`) *(piano)* |
| Emoji delle card | Escono: tailthemes non ne usa *(piano)* |
| Screenshot delle card | Si rigenerano quelli di playground ed edge con Chrome headless, in tema scuro *(piano)* |
| Libreria | Nessuna riga di `lib/` cambia: niente `estimateSize` di chiusura né bump di versione *(piano)* |

---

## Cosa prendiamo da tailthemes (misurato sul sito il 2026-09-26)

| Elemento | tailthemes | Qui |
| :- | :- | :- |
| Fondo pagina / bande | `#101418` / `#0C0F13` | `--bg` / `--bg-deep` |
| Card / superfici | `#171D24`, `#12181E`, hover `#202831` | `--surface-2`, `--surface`, `--surface-3` |
| Linee | `#2A3138`, tenue `#1C232B`, forte `#38414B` | `--line`, `--line-soft`, `--line-strong` |
| Testo | `#E8ECEF`, secondario `#9BA6B2`, tenue `#7C8894` | `--text`, `--muted`, `--faint` |
| Accento | `#4ADE80`, testo sopra `#0B0D10` | `--accent`, `--accent-fill`, `--accent-ink` |
| Contenitore | `max-width: 1120px`, margini 16/28 px | `.wrap` |
| Raggi | 4 / 8 / 12 / 14 px | `--r-sm` / `--r-md` / `--r-lg` / `--r-xl` |
| Curva | `cubic-bezier(.22,1,.36,1)`, 150–500 ms | `--ease` |
| Barra | sticky, 56 px, bordo sotto, sfondo al 90% con blur | `.bar` |
| Hero | griglia da 44 px, un alone verde, riga `$ …` che si scrive, statistiche mono | `.grid-backdrop`, `.term`, `.stats` |
| Etichette | mono 11 px, maiuscole spaziate, in verde | `.eyebrow`, `.stat-l` |
| Tag | mono 10 px, bordo, raggio 4 px | `.tag` |
| Selettori | segmented control (mensile / annuale / a vita) | `.seg` (lingue, tab della demo) |

Non prendiamo: Space Grotesk e IBM Plex Mono (l'utente tiene Geist), il tema solo scuro, il logo a quadretti.

---

## Stato attuale (verificato il 2026-09-26)

- **Tre CSS con gli stessi token copiati a mano**: `site/landing/src/landing.css` (26,8 kB), `site/pages/playground/src/playground.css`
  (12,5 kB), `site/pages/playEdge/src/edge.css` (12,3 kB). Circa il 70% di playground ed edge ripete la landing: token,
  barra, selettore di lingua, bottone del tema, apertura, blocchi di codice, note in fondo.
- **Tre copie di `LanguageSwitch` e `ThemeToggle`**: in `landing/src/Nav.jsx`, `playground/src/playgroundComponents/TopBar.jsx`
  e `playEdge/src/App.jsx`. Tre copie del blocco che applica `localStorage["vt-theme"]` prima del render, nei tre `main.jsx`.
- **Due `Code.jsx` che hanno divergito**: `landing/src/Code.jsx` (`{ src, lang, title, className }`, barra solo con `title`,
  esporta `Code`, `M`, `highlight`) e `playground/src/playgroundComponents/Code.jsx` (`default`, `{ code, language, title }`,
  barra sempre, alias `js`/`bash`, `text` senza colori). Edge usa highlight.js da CDN.
- **Logo**: `doc/logo.svg` e `site/landing/public/logo.svg` sono identici (14 193 byte). Due `<path>`: il testo `fill:#78788a`
  e il `%` `opacity:0.716622;fill:#646cff`.
- **Chiavi** (`npx vtranslate-cli --status` in ogni cartella): landing 69, playground 103, edge 258, **tutte tradotte** in
  tutte le lingue. Le frasi di `LanguageSwitch`/`ThemeToggle` hanno chiavi `Nav_…` (landing), `TopBar_…` (playground), `App_…` (edge).
- **Bug trovato**: `playground/src/playgroundComponents/StrengthsSection.jsx` importa `../../../../runtimeSize.json`, cioè
  `site/runtimeSize.json`, **fuori dalla cartella della pagina**. Lo zip StackBlitz del playground non lo contiene e non builda.
  È l'unico import che esce da una pagina (verificato su tutte e quattro).
- `test/compileGolden.mjs` confronta byte per byte le tabelle compilate di `site/landing/locale`, `site/pages/playground/locale`
  e `site/pages/playEdge/locale`: rinominare le chiavi lo fa fallire, e va rigenerato (§ 2.3).
- `README.md` sta a **9903 B**. Questo piano non lo tocca.
- Strumenti presenti: `google-chrome-stable` e `magick` (per gli screenshot del § 3.3). Verificato che
  `--blink-settings=preferredColorScheme=0` forza il tema scuro in headless.

---

## Struttura di arrivo

```text
site/
├── syncTheme.mjs              # NUOVO: copia site/theme/ (+ runtimeSize.json) in src/theme/ di ogni progetto
├── runtimeSize.json           # invariato: lo scrive `npm run estimateSize`, che ora rilancia il sync
├── theme/                     # NUOVO: la sorgente del tema. Tutto ciò che sta qui viene copiato.
│   ├── tokens.css             # l'unico file con colori scritti a mano (scuro + chiaro)
│   ├── theme.css              # base, tipografia, componenti; importa tokens.css e i font
│   ├── boot.js                # applySavedTheme(), THEME_KEY
│   ├── ThemeToggle.jsx
│   ├── LanguageSwitch.jsx
│   ├── SiteBar.jsx            # la barra in alto: logo, contenuto della pagina, lingua, tema
│   ├── Code.jsx               # Code, highlight, M
│   └── logo.svg               # copia identica di doc/logo.svg (lo controlla il test)
├── landing/src/theme/         # COPIA GENERATA (9 file: gli 8 qui sopra + runtimeSize.json)
└── pages/
    ├── playground/src/theme/  # COPIA GENERATA
    ├── playEdge/src/theme/    # COPIA GENERATA
    └── llmRestaurant/         # invariato: non chiede il tema
```

---

## Fase 0 — Precondizione

1. `git status`: se ci sono modifiche non committate estranee a questo piano, fermati e chiedi all'utente di committarle.
2. `npm test` deve essere verde **prima** di iniziare. Annota il numero di file e di asserzioni.
3. Annota lo stato delle lingue: in `site/landing`, `site/pages/playground` e `site/pages/playEdge` lancia
   `npx vtranslate-cli --status`. Atteso: 69, 103 e 258 chiavi, colonna MISSING tutta a 0.

---

## Fase 1 — Implementazione

### 1.1 Il logo, verde

In `doc/logo.svg` due sostituzioni esatte (usa lo strumento Edit, non sed):

1. `id="defs1" />` diventa:

   ```xml
   id="defs1"><style
       id="style1">.pct{fill:#16a34a}@media (prefers-color-scheme:dark){.pct{fill:#4ade80}}</style></defs>
   ```

2. `style="opacity:0.716622;fill:#646cff;fill-opacity:1;stroke-width:1.38396;stroke-dasharray:1.38396, 1.38396"` diventa
   `class="pct" style="stroke-width:1.38396;stroke-dasharray:1.38396, 1.38396"`.
   Il `fill` va tolto dallo `style`: uno `style` in linea vince sul blocco `<style>`.

Poi `mkdir -p site/theme && cp doc/logo.svg site/theme/logo.svg`.

Il testo grigio `#78788a` non cambia: regge sia su bianco (4,3:1) sia su scuro (4,4:1).

### 1.2 `site/theme/tokens.css`

Contenuto intero. I due blocchi del tema chiaro devono restare **identici** (lo controlla il test del § 2.1). Ogni coppia
testo/fondo è già verificata a ≥ 4,5:1 in entrambi i temi: se cambi un valore, il test te lo dice.

```css
/* I token del sito viteTranslate: l'unico file con colori scritti a mano. Tutto il resto del CSS
   del sito usa solo var(--…) (un test lo controlla, insieme al contrasto delle coppie di testo).
   SORGENTE in site/theme/. Le cartelle src/theme/ dei progetti sono copie generate da
   `npm run site:theme`: si modifica qui e si rilancia, mai la copia. */

:root {
  color-scheme: dark;

  /* Superfici, dalla più bassa alla più alta. */
  --bg-deep: #0c0f13; /* bande dell'hero, piè di pagina, fondo del codice */
  --bg: #101418;
  --surface: #12181e;
  --surface-2: #171d24; /* card */
  --surface-3: #202831; /* hover, voce attiva, codice in linea */

  /* Linee. */
  --line-soft: #1c232b;
  --line: #2a3138;
  --line-strong: #38414b;

  /* Testo. */
  --text: #e8ecef;
  --muted: #9ba6b2;
  --faint: #7c8894;

  /* Accento: --accent per testo e linee, --accent-fill per i fondi pieni, --accent-ink per il testo sopra. */
  --accent: #4ade80;
  --accent-fill: #4ade80;
  --accent-ink: #0b0d10;
  --accent-soft: color-mix(in srgb, var(--accent) 12%, transparent);
  --ring: var(--accent);

  /* Stati. */
  --ok: var(--accent);
  --warn: #fbbf24;
  --error: #f87171;

  /* Sfondo dell'hero. */
  --grid: #161c22;
  --glow: rgba(74, 222, 128, 0.09);

  /* Codice. */
  --code-bg: var(--bg-deep);
  --tk-c: #7c8894; /* commenti */
  --tk-s: #fcd34d; /* stringhe */
  --tk-t: #7dd3fc; /* tag */
  --tk-k: #c4b5fd; /* parole chiave */
  --tk-n: #fdba74; /* numeri, null */
  --tk-m: var(--accent); /* il marcatore _%_…_%_ */

  /* Forma e movimento. */
  --r-sm: 4px;
  --r-md: 8px;
  --r-lg: 12px;
  --r-xl: 14px;
  --bar-h: 56px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);

  /* Caratteri (li carica theme.css). */
  --font: "Geist", system-ui, -apple-system, "Segoe UI", "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
  --mono: "Geist Mono", ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
}

/* Il tema chiaro: quello del sistema, se l'utente non ha scelto lo scuro... */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    color-scheme: light;
    --bg-deep: #f3f5f8;
    --bg: #f7f8fa;
    --surface: #ffffff;
    --surface-2: #ffffff;
    --surface-3: #e9edf1;
    --line-soft: #e6eaef;
    --line: #dde2e8;
    --line-strong: #c5ccd5;
    --text: #101418;
    --muted: #4b5563;
    --faint: #5f6874;
    --accent: #15803d;
    --warn: #b45309;
    --error: #b91c1c;
    --grid: #e9edf1;
    --glow: rgba(22, 163, 74, 0.08);
    --code-bg: #ffffff;
    --tk-c: #6b7280;
    --tk-s: #a16207;
    --tk-t: #0369a1;
    --tk-k: #6d28d9;
    --tk-n: #c2410c;
  }
}

/* ...o quello scelto con il pulsante. Stesso contenuto del blocco sopra: tenerli uguali. */
:root[data-theme="light"] {
  color-scheme: light;
  --bg-deep: #f3f5f8;
  --bg: #f7f8fa;
  --surface: #ffffff;
  --surface-2: #ffffff;
  --surface-3: #e9edf1;
  --line-soft: #e6eaef;
  --line: #dde2e8;
  --line-strong: #c5ccd5;
  --text: #101418;
  --muted: #4b5563;
  --faint: #5f6874;
  --accent: #15803d;
  --warn: #b45309;
  --error: #b91c1c;
  --grid: #e9edf1;
  --glow: rgba(22, 163, 74, 0.08);
  --code-bg: #ffffff;
  --tk-c: #6b7280;
  --tk-s: #a16207;
  --tk-t: #0369a1;
  --tk-k: #6d28d9;
  --tk-n: #c2410c;
}
```

`--accent-fill` e `--accent-ink` non cambiano nel chiaro: il bottone verde con il testo scuro fa 11,2:1 in tutti e due i temi.
`--ok`, `--ring`, `--tk-m` e `--accent-soft` puntano a `--accent` e lo seguono da soli.

### 1.3 `site/theme/theme.css`

Contenuto intero. L'ordine conta: i due `@import` devono stare in cima.

```css
/* Il tema del sito viteTranslate (landing, playground, edge): base, tipografia e componenti
   condivisi. Solo token: i colori stanno in tokens.css.
   SORGENTE in site/theme/. Le cartelle src/theme/ dei progetti sono copie generate da
   `npm run site:theme`: si modifica qui e si rilancia, mai la copia. */
@import url("https://fonts.googleapis.com/css2?family=Geist:wght@300..800&family=Geist+Mono:wght@400..600&display=swap");
@import "./tokens.css";

/* ---------- Base ---------- */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 1rem;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: clip;
}

h1,
h2,
h3,
h4,
p {
  margin: 0;
}

a {
  color: inherit;
  text-decoration-color: var(--line-strong);
  text-underline-offset: 0.2em;
}

a:hover {
  text-decoration-color: var(--accent);
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}

input,
select {
  font: inherit;
  color: inherit;
}

img {
  display: block;
}

code {
  font-family: var(--mono);
  font-size: 0.88em;
}

p code,
li code {
  padding: 0.05em 0.35em;
  border-radius: var(--r-sm);
  background: var(--surface-3);
}

:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}

::selection {
  background: var(--accent-fill);
  color: var(--accent-ink);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.wrap {
  width: 100%;
  max-width: 1120px;
  margin-inline: auto;
  padding-inline: 16px;
}

@media (min-width: 640px) {
  .wrap {
    padding-inline: 28px;
  }
}

/* ---------- Tipografia ---------- */
/* L'enfasi nei titoli è il verde dell'accento: niente corsivo, vale uguale in cinese e giapponese. */
:is(h1, h2) em {
  font-style: normal;
  color: var(--accent);
}

.eyebrow {
  margin: 0 0 0.75rem;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.lead {
  max-width: 36rem;
  color: var(--muted);
  font-size: clamp(1rem, 1.6vw, 1.125rem);
  line-height: 1.65;
  text-wrap: pretty;
}

/* L'apertura delle pagine (playground, edge). La landing ha la sua. */
.page-hero {
  padding-block: clamp(2.5rem, 6vw, 4.5rem) 1rem;
}

.page-hero h1 {
  max-width: 50rem;
  font-size: clamp(2.1rem, 5vw, 3.5rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.05;
  text-wrap: balance;
}

.page-hero .lead {
  margin-top: 1rem;
}

/* ---------- Sfondo a griglia con un alone ---------- */
.grid-backdrop {
  position: relative;
  isolation: isolate;
}

.grid-backdrop::before,
.grid-backdrop::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.grid-backdrop::before {
  background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(ellipse 80% 70% at 30% 20%, black 30%, transparent 80%);
  mask-image: radial-gradient(ellipse 80% 70% at 30% 20%, black 30%, transparent 80%);
}

.grid-backdrop::after {
  background: radial-gradient(600px 340px at 30% 25%, var(--glow), transparent 70%);
}

/* ---------- Riga di terminale che si scrive da sola ---------- */
/* --n è il numero di caratteri del comando: lo scrive il JSX. Lo stato di riposo è il testo
   intero, quindi senza animazioni (movimento ridotto) si legge tutto. */
.term {
  display: flex;
  align-items: center;
  gap: 1ch;
  min-height: 1.2em;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 500;
}

.term-text {
  display: inline-block;
  max-width: calc(var(--n, 40) * 1ch);
  overflow: hidden;
  white-space: nowrap;
  animation: vt-type 1.9s steps(var(--n, 40), end) both;
}

.term-cursor {
  display: inline-block;
  width: 7px;
  height: 13px;
  margin-left: -0.6ch;
  background: var(--accent);
  animation: vt-blink 1s steps(2, start) infinite;
}

@keyframes vt-type {
  from {
    max-width: 0;
  }
}

@keyframes vt-blink {
  to {
    visibility: hidden;
  }
}

/* ---------- Statistiche: un numero, cosa conta, perché crederci ---------- */
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem 3rem;
}

.stat {
  max-width: 17rem;
}

.stat-n {
  font-family: var(--mono);
  font-size: 1.875rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.stat-l {
  margin-top: 0.15rem;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 0.6875rem;
  font-weight: 500;
}

.stat-d {
  margin-top: 0.6rem;
  color: var(--muted);
  font-size: 0.8125rem;
  line-height: 1.6;
}

/* ---------- Bottoni ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 44px;
  padding-inline: 1.25rem;
  border-radius: var(--r-md);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: filter 150ms var(--ease), border-color 150ms var(--ease), transform 150ms var(--ease);
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: var(--accent-fill);
  color: var(--accent-ink);
}

.btn-primary:hover {
  filter: brightness(1.08);
}

.btn-ghost {
  border: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--text);
}

.btn-ghost:hover {
  border-color: var(--line-strong);
}

.icon-btn {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface-2);
  color: var(--muted);
  text-decoration: none;
  transition: color 150ms var(--ease), border-color 150ms var(--ease);
}

.icon-btn:hover {
  color: var(--text);
  border-color: var(--line-strong);
}

/* ---------- Segmented control (lingue, tab) ---------- */
.seg {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-deep);
}

.seg button {
  min-width: 2rem;
  height: 26px;
  padding-inline: 0.6rem;
  border-radius: 6px;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.6875rem;
  font-weight: 500;
  transition: background-color 150ms var(--ease), color 150ms var(--ease);
}

.seg button:hover {
  color: var(--text);
}

.seg button[aria-pressed="true"] {
  background: var(--surface-3);
  color: var(--text);
  cursor: default;
}

/* ---------- Barra in alto (SiteBar.jsx) ---------- */
.bar {
  position: sticky;
  top: 0;
  z-index: 40;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.bar-in {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: var(--bar-h);
}

.bar-brand {
  display: flex;
  flex: none;
  align-items: center;
}

.bar-brand img {
  width: auto;
  height: 20px;
}

.bar-nav {
  display: flex;
  gap: 1rem;
}

.bar-nav :is(a, button),
.bar-back {
  color: var(--muted);
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: color 150ms var(--ease);
}

.bar-nav :is(a, button):hover,
.bar-back:hover {
  color: var(--text);
}

.bar-tools {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

@media (max-width: 980px) {
  .bar-nav {
    display: none;
  }
}

@media (max-width: 720px) {
  .bar-in {
    flex-wrap: wrap;
    padding-block: 0.5rem;
  }
}

/* ---------- Tag e card ---------- */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.625rem;
  font-weight: 500;
  line-height: 1.4;
  text-decoration: none;
}

.tag-accent {
  border-color: transparent;
  background: var(--accent-fill);
  color: var(--accent-ink);
}

.card {
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface-2);
  transition: border-color 250ms var(--ease);
}

/* ---------- Blocchi di codice (Code.jsx) ---------- */
.code {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: var(--code-bg);
}

.code-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.9rem;
  border-bottom: 1px solid var(--line-soft);
  color: var(--faint);
  font-family: var(--mono);
  font-size: 0.6875rem;
}

.code-bar::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 1.5px;
  background: var(--accent);
}

.code pre {
  margin: 0;
  padding: 0.9rem 1rem;
  overflow-x: auto;
  font-family: var(--mono);
  font-size: 0.78rem;
  line-height: 1.75;
  text-align: left;
  tab-size: 2;
}

.code code {
  padding: 0;
  background: none;
  color: var(--text);
  font-size: inherit;
}

.tk-c,
.tk-p {
  color: var(--tk-c);
}

.tk-s {
  color: var(--tk-s);
}

.tk-t {
  color: var(--tk-t);
}

.tk-k {
  color: var(--tk-k);
}

.tk-n {
  color: var(--tk-n);
}

.tk-o {
  color: var(--ok);
}

.tk-m {
  color: var(--tk-m);
  background: color-mix(in srgb, var(--tk-m) 14%, transparent);
  border-radius: var(--r-sm);
  padding: 0.05em 0.25em;
}

/* ---------- Ancore, indice, note in fondo (playground, edge) ---------- */
.anchor {
  margin-right: 0.45em;
  color: var(--accent);
  font-family: var(--mono);
  font-weight: 400;
  text-decoration: none;
  opacity: 0.55;
  transition: opacity 150ms var(--ease);
}

:is(h2, h3):hover .anchor,
.anchor:focus-visible {
  opacity: 1;
}

.toc {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 2rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--line);
}

.toc a {
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 0.8125rem;
  text-decoration: none;
  transition: color 150ms var(--ease), border-color 150ms var(--ease);
}

.toc a:hover {
  color: var(--text);
  border-color: var(--line-strong);
}

.notes {
  margin-top: clamp(3rem, 8vw, 5rem);
  padding-block: 2rem 4rem;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 0.9rem;
}

.notes h2 {
  margin: 0 0 1rem;
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 600;
}

.notes ul {
  max-width: 52rem;
  margin: 0;
  padding-left: 1.1rem;
}

.notes li + li {
  margin-top: 0.5rem;
}

.notes b {
  color: var(--text);
  font-weight: 600;
}

/* ---------- Movimento ---------- */
/* Entrata in cascata: --i è la posizione dell'elemento (0, 1, 2…), la scrive il JSX. */
.rise {
  animation: vt-rise 500ms var(--ease) both;
  animation-delay: calc(var(--i, 0) * 80ms);
}

@keyframes vt-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

### 1.4 `site/theme/boot.js`

```js
// Il tema scelto in una visita precedente, applicato prima del primo rendering: senza, il tema del
// sistema lampeggia per un attimo. La chiave è la stessa in tutto il sito (stessa origine, stesso
// localStorage): il tema scelto sulla landing vale anche nelle pagine, e viceversa.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
export const THEME_KEY = "vt-theme";

/** Da chiamare in main.jsx, prima di createRoot(). localStorage può mancare o lanciare: vale il sistema. */
export function applySavedTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch {
    /* storage bloccato: vale il tema del sistema */
  }
}
```

### 1.5 `site/theme/ThemeToggle.jsx`

Il marcatore `_%_Cambia tema_%_` deve essere **identico** a quello di oggi (è la condizione perché la traduzione passi alla chiave nuova).

```jsx
// Il pulsante del tema: segue il sistema finché l'utente non sceglie, poi ricorda la scelta per
// tutto il sito (THEME_KEY, vedi boot.js).
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
import { useState } from "react";
import { useTranslateToString } from "@sepoina/vitetranslate/react";
import { THEME_KEY } from "./boot.js";

const SUN = [
  "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  "M12 2v2",
  "M12 20v2",
  "m4.93 4.93 1.41 1.41",
  "m17.66 17.66 1.41 1.41",
  "M2 12h2",
  "M20 12h2",
  "m6.34 17.66-1.41 1.41",
  "m19.07 4.93-1.41 1.41",
];
const MOON = ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"];

export default function ThemeToggle() {
  const ts = useTranslateToString();
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
  );

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* navigazione privata o storage bloccato: il tema vale per questa visita */
    }
    setTheme(next);
  };

  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={ts("_%_Cambia tema_%_")}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {(theme === "dark" ? SUN : MOON).map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </button>
  );
}
```

### 1.6 `site/theme/LanguageSwitch.jsx`

Stessa condizione per `_%_Lingua della pagina_%_`.

```jsx
// Il selettore di lingua: un bottone per lingua, con il codice corto (EN, IT, ZH…). È anche la demo
// più diretta della libreria: cambia la lingua di tutta la pagina.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
import { useTranslateLanguage, useTranslateToString } from "@sepoina/vitetranslate/react";

export default function LanguageSwitch() {
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();
  const ts = useTranslateToString();

  return (
    <div className="seg lang-switch" role="group" aria-label={ts("_%_Lingua della pagina_%_")}>
      {languages.map(({ tag, languageName }) => (
        <button
          key={tag}
          type="button"
          title={languageName}
          aria-pressed={id === tag}
          onClick={() => id !== tag && proposeNewLanguage({ lang: tag })}
        >
          {tag.split("-")[0].toUpperCase()}
        </button>
      ))}
    </div>
  );
}
```

### 1.7 `site/theme/SiteBar.jsx`

Il logo è alto 20 px; il rapporto dell'SVG è 5,61:1, quindi 112 px di larghezza.

```jsx
// La barra in alto di ogni progetto del sito: il logo (porta alla landing), ciò che la pagina ci
// mette (menu o link di ritorno), poi lingua, tema ed eventuali bottoni in più.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
import LanguageSwitch from "./LanguageSwitch.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import logo from "./logo.svg";

/**
 * @param {object} props
 * @param {string} props.home l'indirizzo della landing: siteUrl() nelle pagine, import.meta.env.BASE_URL nella landing
 * @param {import("react").ReactNode} [props.children] ciò che sta dopo il logo
 * @param {import("react").ReactNode} [props.tools] bottoni in più, dopo lingua e tema
 */
export default function SiteBar({ home, children, tools }) {
  return (
    <header className="bar">
      <div className="wrap bar-in">
        <a className="bar-brand" href={home}>
          <img src={logo} alt="viteTranslate" width="112" height="20" />
        </a>
        {children}
        <div className="bar-tools">
          <LanguageSwitch />
          <ThemeToggle />
          {tools}
        </div>
      </div>
    </header>
  );
}
```

### 1.8 `site/theme/Code.jsx`

L'unione delle due copie di oggi: le regole del playground (virgolette singole, `function`, `useState`, alias, `text`)
più il gruppo `o` della landing (`✓` e `✗` nel terminale). Il codice si ripulisce sempre con `trim()`.

```jsx
// Codice di esempio colorato a mano: pochi token per tre linguaggi, niente libreria di highlighting.
// Il testo non passa da <Translate>: sono esempi, non frasi della pagina.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.

// Il delimitatore di viteTranslate, composto a runtime: scritto per intero in un sorgente
// verrebbe estratto come frase da tradurre, anche dentro una stringa di esempio.
export const M = ["_", "%", "_"].join("");

const RULES = {
  jsx: new RegExp(
    `(?<c>//.*)|(?<m>${M}[^\\n]*?${M})|(?<s>"[^"\\n]*"|'[^'\\n]*')|(?<t></?[A-Za-z][\\w.]*|/?>)|(?<k>\\b(?:import|from|export|default|function|const|return|useState)\\b)`,
    "g"
  ),
  yaml: /(?<c>#.*)|(?<k>^[\w-]+(?=:))|(?<s>"[^"\n]*")|(?<n>\bnull\b)/gm,
  sh: /(?<c>#.*)|(?<k>--[\w-]+)|(?<s>"[^"\n]*")|(?<o>✓|✗)|(?<p>^\$)/gm,
};
const ALIAS = { js: "jsx", javascript: "jsx", bash: "sh" };
const CLASS = { c: "tk-c", m: "tk-m", s: "tk-s", t: "tk-t", k: "tk-k", n: "tk-n", o: "tk-o", p: "tk-p" };

/** Divide `src` in nodi: testo semplice e <span class="tk-…"> per i token riconosciuti. "text" resta senza colori. */
export function highlight(src, lang) {
  const rule = RULES[ALIAS[lang] ?? lang];
  if (!rule) return src;
  const re = new RegExp(rule);
  const out = [];
  let last = 0;
  for (const m of src.matchAll(re)) {
    if (m.index > last) out.push(src.slice(last, m.index));
    const kind = Object.keys(m.groups).find((g) => m.groups[g] !== undefined);
    out.push(
      <span key={m.index} className={CLASS[kind]}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

/** Un blocco di codice colorato. La barra con il titolo (nome del file, "terminal"…) c'è solo se c'è `title`. */
export function Code({ code, lang = "jsx", title, className = "" }) {
  return (
    <div className={`code ${className}`.trim()}>
      {title && (
        <div className="code-bar">
          <span>{title}</span>
        </div>
      )}
      <pre>
        <code>{highlight(code.trim(), lang)}</code>
      </pre>
    </div>
  );
}
```

### 1.9 `site/syncTheme.mjs`

Contenuto intero. Sta **fuori** da `site/theme/`, altrimenti copierebbe anche se stesso.

```js
// Il tema del sito vive in site/theme/ e si COPIA dentro ogni progetto che lo usa, in src/theme/.
// Una pagina deve restare autonoma (lo zip per StackBlitz, la cartella scaricata da GitHub), quindi
// non può importare da fuori della sua cartella. La copia è intera e identica byte per byte, e
// src/theme/ si riscrive tutta: i file tolti da site/theme/ spariscono anche dalle copie.
// Con il tema viaggiano i dati del sito che le pagine mostrano (EXTRA).
//
//   node site/syncTheme.mjs            # riscrive le copie (npm run site:theme; lo fa anche site:build)
//   node site/syncTheme.mjs --check    # non scrive: elenca le differenze, esce con 1 se ce ne sono
//   node site/syncTheme.mjs --watch    # riscrive a ogni modifica, per lavorare al tema con un dev server aperto
//
// Chi riceve il tema: site/landing, e ogni site/pages/* con "vitetranslateSite": { "theme": true }.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, watch } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// runtimeSize.json lo scrive `npm run estimateSize` in site/ (AGENTS.md lo cerca lì) e lo leggono le pagine.
const EXTRA = ["site/runtimeSize.json"];

/**
 * I file che ogni progetto riceve: quelli di site/theme/ più EXTRA.
 * @param {string} [radice] la radice del repo (nei test, una cartella finta)
 * @returns {{ name: string, from: string }[]} ordinati per nome
 */
export function themeSources(radice = RADICE) {
  const tema = readdirSync(join(radice, "site/theme"), { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => ({ name: d.name, from: join(radice, "site/theme", d.name) }));
  const extra = EXTRA.filter((rel) => existsSync(join(radice, rel))).map((rel) => ({ name: basename(rel), from: join(radice, rel) }));
  const tutti = [...tema, ...extra];
  const doppio = tutti.find((f, i) => tutti.findIndex((g) => g.name === f.name) !== i);
  if (doppio) throw new Error(`site/theme/${doppio.name}: il nome è già usato da un file che arriva da fuori (${EXTRA.join(", ")})`);
  return tutti.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * I progetti che ricevono il tema: la landing, poi le pagine che lo chiedono.
 * @param {string} [radice]
 * @returns {string[]} relativi alla radice, per esempio "site/pages/playground"
 */
export function themeTargets(radice = RADICE) {
  const pagine = [];
  const base = join(radice, "site/pages");
  if (existsSync(base)) {
    for (const d of readdirSync(base, { withFileTypes: true })) {
      const file = join(base, d.name, "package.json");
      if (!d.isDirectory() || !existsSync(file)) continue;
      if (JSON.parse(readFileSync(file, "utf8")).vitetranslateSite?.theme === true) pagine.push(`site/pages/${d.name}`);
    }
  }
  const landing = existsSync(join(radice, "site/landing/package.json")) ? ["site/landing"] : [];
  return [...landing, ...pagine.sort()];
}

/**
 * Le differenze fra la sorgente e le copie, una riga per file mancante, diverso o in più.
 * @param {string} [radice]
 * @returns {string[]} vuoto se tutto è allineato
 */
export function checkTheme(radice = RADICE) {
  const sorgenti = themeSources(radice);
  const nomi = sorgenti.map((f) => f.name);
  const diff = [];
  for (const t of themeTargets(radice)) {
    const dir = join(radice, t, "src/theme");
    const copie = existsSync(dir) ? readdirSync(dir).sort() : [];
    for (const { name, from } of sorgenti) {
      if (!copie.includes(name)) diff.push(`${t}/src/theme/${name}: manca`);
      else if (!readFileSync(join(dir, name)).equals(readFileSync(from))) diff.push(`${t}/src/theme/${name}: diverso`);
    }
    for (const name of copie) if (!nomi.includes(name)) diff.push(`${t}/src/theme/${name}: in più`);
  }
  return diff;
}

/**
 * Riscrive src/theme/ in ogni progetto che riceve il tema.
 * @param {string} [radice]
 * @returns {string[]} i progetti scritti
 */
export function syncTheme(radice = RADICE) {
  const sorgenti = themeSources(radice);
  const targets = themeTargets(radice);
  for (const t of targets) {
    const dir = join(radice, t, "src/theme");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const { name, from } of sorgenti) cpSync(from, join(dir, name));
  }
  return targets;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    const diff = checkTheme();
    for (const d of diff) console.error(d);
    if (diff.length) console.error("\ncopie del tema non allineate: npm run site:theme");
    process.exit(diff.length ? 1 : 0);
  }
  const scrivi = () => console.log(`tema copiato in ${syncTheme().join(", ")}`);
  scrivi();
  if (args.includes("--watch")) {
    let timer = 0;
    const ancora = () => {
      clearTimeout(timer);
      timer = setTimeout(scrivi, 100);
    };
    watch(join(RADICE, "site/theme"), ancora);
    for (const rel of EXTRA) if (existsSync(join(RADICE, rel))) watch(join(RADICE, rel), ancora);
    console.log("in ascolto su site/theme/ (Ctrl+C per uscire)");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

Verifica: `node --check site/syncTheme.mjs`.

### 1.10 Collegamenti

1. **`package.json` della radice**, in `scripts`:
   - aggiungi `"site:theme": "node site/syncTheme.mjs",` (dopo `"site:preview"`);
   - `"site"` diventa `"node site/syncTheme.mjs && npm --prefix site/landing run dev"`.
2. **`site/build.mjs`**: `import { syncTheme } from "./syncTheme.mjs";` accanto all'import di `zipPages`. In `main()`, subito
   prima di `const pagine = sitePages();`:

   ```js
   // Il tema per primo: ogni progetto builda la sua copia in src/theme/ (vedi site/syncTheme.mjs).
   console.log(`tema copiato in ${syncTheme().join(", ")}`);
   ```

   Aggiorna il commento in testa al file: una riga "Prima di buildare copia il tema in ogni progetto (site/syncTheme.mjs)."
3. **`test/estimateSize.mjs`**: `import { syncTheme } from "../site/syncTheme.mjs";` fra gli import. Subito dopo il blocco
   `if (prevJson !== nextJson) { … } else { … }`:

   ```js
   // Le pagine leggono la loro copia (src/theme/runtimeSize.json): si riallineano subito.
   syncTheme();
   console.log("site/theme: copies updated");
   ```

4. **`site/pages/playground/package.json`** e **`site/pages/playEdge/package.json`**: `"vitetranslateSite": { "slug": "…" }`
   diventa `"vitetranslateSite": { "slug": "…", "theme": true }` (lo slug resta quello che c'è). `llmRestaurant` **no**.

### 1.11 Prima copia

`npm run site:theme`. Atteso: `tema copiato in site/landing, site/pages/playEdge, site/pages/playground`, e in ognuna
`src/theme/` con 9 file. Poi `node site/syncTheme.mjs --check`: esce con 0 e non stampa niente.

Da qui in avanti **non modificare mai un file dentro un `src/theme/`**: si modifica `site/theme/` e si rilancia il sync.

### 1.12 La landing

Tutti i percorsi sono relativi a `site/landing/`.

**`index.html`**
- `<meta name="theme-color" content="#06060b" />` → `content="#101418"`.
- `<link rel="icon" href="/logo.svg" …>` → `href="/src/theme/logo.svg"`.
- Togli il `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?…">`. Tieni i due `preconnect`. Il commento sopra
  diventa: `<!-- Font: li carica src/theme/theme.css (Geist e Geist Mono); qui solo il preconnect -->`.
- Gli script di GSAP e Lenis restano.

**`git rm public/logo.svg`** e **`git rm src/Code.jsx`**.

**`src/main.jsx`**
- Import, in quest'ordine: `import { applySavedTheme } from "./theme/boot.js";`, poi `import "./theme/theme.css";`,
  poi `import "./landing.css";` (il tema prima: la landing lo sovrascrive dove serve).
- Nel ramo `else`, il blocco `try { const theme = localStorage.getItem("vt-theme"); … } catch { … }` e il suo commento
  diventano `applySavedTheme();` con il commento `// Il tema scelto in una visita precedente, prima del primo rendering.`

**`src/Nav.jsx`** (intero)

```jsx
import { Translate } from "@sepoina/vitetranslate/react";
import { Icon } from "./icons.jsx";
import { scrollToSection } from "./motion.js";
import { REPO } from "./links.js";
import SiteBar from "./theme/SiteBar.jsx";

// La barra del sito (src/theme/SiteBar.jsx) con il menu delle sezioni e il link a GitHub.
export default function Nav() {
  return (
    <SiteBar
      home={import.meta.env.BASE_URL}
      tools={
        <a className="icon-btn" href={REPO} aria-label="GitHub">
          <Icon name="github" size={16} />
        </a>
      }
    >
      <nav className="bar-nav">
        <button type="button" onClick={() => scrollToSection("features")}>
          <Translate>_%_Funzioni_%_</Translate>
        </button>
        <button type="button" onClick={() => scrollToSection("how")}>
          <Translate>_%_Come funziona_%_</Translate>
        </button>
        <button type="button" onClick={() => scrollToSection("compare")}>
          <Translate>_%_Confronto_%_</Translate>
        </button>
        <button type="button" onClick={() => scrollToSection("demos")}>
          <Translate>_%_Demo_%_</Translate>
        </button>
      </nav>
    </SiteBar>
  );
}
```

I quattro marcatori del menu restano in questo file: le loro chiavi non cambiano.

**`src/icons.jsx`**: togli le voci `globe`, `sun` e `moon`, ma solo dopo aver verificato con
`grep -rn 'name="globe"\|name="sun"\|name="moon"' src` che nessuno le usa più.

**`src/Hero.jsx`** (intero). Le quattro frasi delle statistiche arrivano da `Features.jsx`: **tagliale da lì e incollale
qui**, marcatore compreso, senza ritoccarle.

```jsx
import { Translate, version } from "@sepoina/vitetranslate/react";
import CopyCommand from "./CopyCommand.jsx";
import { Icon } from "./icons.jsx";
import { REPO } from "./links.js";
import { siteUrl } from "./siteLinks.js";
import SIZE from "./theme/runtimeSize.json";

// Il comando che si scrive da solo sopra il titolo: la novità della release, da terminale.
// È codice, non una frase: niente <Translate>.
const LLM_CMD = "npx vitetranslate --llm-translate";

export default function Hero() {
  return (
    <section className="hero grid-backdrop">
      <div className="wrap hero-in">
        <p className="term">
          <span aria-hidden="true">$</span>
          <span className="term-text" style={{ "--n": LLM_CMD.length }}>
            {LLM_CMD}
          </span>
          <span className="term-cursor" aria-hidden="true" />
        </p>

        <h1 data-hero>
          <Translate t="_%_Scrivi il testo <em>una volta</em>.<br>Vite fa il resto._%_" />
        </h1>

        <p className="lead" data-hero>
          <Translate>
            _%_Estrai i testi da tradurre direttamente dal JSX. Nessuna chiave da mantenere, nessun flusso di estrazione a parte,
            nessuna dipendenza a runtime._%_
          </Translate>
        </p>

        <div className="cta-row" data-hero>
          <CopyCommand />
          <a className="btn btn-primary" href={siteUrl("playground")}>
            <Translate>_%_Prova il playground_%_</Translate>
            <Icon name="arrow" size={16} />
          </a>
        </div>

        {/* Le cifre vengono da Features.jsx: stesse frasi, così le traduzioni le seguono. */}
        <div className="stats" data-hero>
          <div className="stat">
            <p className="stat-n">
              <span data-count={SIZE.gzipBytes}>{SIZE.gzipBytes}</span>
            </p>
            <p className="stat-l">
              <Translate>_%_byte di runtime, in gzip_%_</Translate>
            </p>
            <p className="stat-d">
              <Translate t={["_%_%s, misurati dalla suite di test: non una promessa a parole._%_", SIZE.real]} />
            </p>
          </div>
          <div className="stat">
            <p className="stat-n">0</p>
            <p className="stat-l">
              <Translate>_%_dipendenze a runtime_%_</Translate>
            </p>
            <p className="stat-d">
              <Translate>_%_Babel, Vite e React sono peer: girano sulla tua macchina e non entrano mai nel bundle._%_</Translate>
            </p>
          </div>
        </div>
      </div>

      <div className="hero-strip">
        <div className="wrap hero-strip-in">
          <a className="release" href={`${REPO}/releases`}>
            <span className="tag tag-accent">v{version}</span>
            <Translate>_%_Nuovo: traduzione automatica con LLM_%_</Translate>
            <Icon name="arrow" size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
```

Controllo: le quattro frasi in `Hero.jsx` devono essere carattere per carattere quelle che c'erano in `Features.jsx`
(`git diff` sui due file le mostra una tolta e una aggiunta, identiche).

**`src/Demos.jsx`** (intero). Non sta più dentro l'hero: è una sezione a sé, subito sotto.

```jsx
import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";
import { Icon } from "./icons.jsx";
import { PAGES } from "./pages.js";
import { REPO } from "./links.js";
import { SITE_ROOT, siteUrl } from "./siteLinks.js";

// Le pagine del sito, subito sotto l'hero: una card per pagina, con lo screenshot della pagina vera.
export default function Demos() {
  const ts = useTranslateToString();
  return (
    <section className="section section-demos" data-section="demos">
      <div className="wrap demos" data-stagger>
        {PAGES.map((page) => (
          <article key={page.slug} className="card demo-card">
            <a className="demo-card-main" href={siteUrl(page.slug)}>
              <div className="shot" aria-hidden="true">
                <img src={`${import.meta.env.BASE_URL}${page.preview}`} alt="" width="960" height="600" loading="lazy" />
                <span className="shot-open">
                  <Translate>_%_Apri_%_</Translate>
                  <Icon name="arrow" size={12} />
                </span>
              </div>
              <div className="demo-body">
                <h3>
                  <Translate t={page.title} />
                </h3>
                <p className="demo-path">/{page.slug}/</p>
                <p className="demo-text">
                  <Translate t={page.text} />
                </p>
              </div>
            </a>
            <div className="demo-foot">
              <a className="tag" href={`${REPO}/tree/main/${page.source}`}>
                <Icon name="github" size={12} />
                <Translate>_%_Sorgente_%_</Translate>
              </a>
              {/* Lo zip lo scrive site/build.mjs in site/dist/zip: il progetto della pagina, pronto per StackBlitz. */}
              <a
                className="tag"
                href={`${SITE_ROOT}zip/${page.slug}.zip`}
                download
                title={ts("_%_Il progetto della pagina, da importare su stackblitz.com_%_")}
              >
                <Icon name="download" size={12} />
                <Translate>_%_Zip per StackBlitz_%_</Translate>
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
```

**`src/pages.js`**: togli il campo `icon` dalle tre card (non si mostra più).

**`src/App.jsx`**: `import Demos from "./Demos.jsx";` e in `<main>` l'ordine diventa
`<Hero />`, `<Demos />`, `<CodeDemo />`, `<Marquee />`, `<Features />`, `<Steps />`, `<Compare />`, `<Outro />`.
`Hero.jsx` non importa più `Demos`.

**`src/Features.jsx`**
- `import { Code, M } from "./Code.jsx";` → `from "./theme/Code.jsx"`. Togli `import SIZE from "../../runtimeSize.json";`.
- Togli la funzione `follow` con il suo commento, e `onPointerMove={follow}` dal `<div className="bento">`.
- Togli le due `<article>` `t-size` e `t-zero` (le loro quattro frasi sono già in `Hero.jsx`).
- Nei due `<Code … />`: `src=` → `code=`.

**`src/Steps.jsx`**: import da `./theme/Code.jsx`; nei tre `<Code … />` `src=` → `code=`.

**`src/CodeDemo.jsx`**
- Import da `./theme/Code.jsx`; nei due `<Code … />` `src=` → `code=`.
- Togli `<div className="demo-glow" aria-hidden="true" />`.
- `<div className="demo-tabs" role="group" aria-label="demo">` → `className="seg demo-tabs"`.

**`src/Compare.jsx`**: `import SIZE from "../../runtimeSize.json";` → `import SIZE from "./theme/runtimeSize.json";`.

**`src/Marquee.jsx`**: il contenuto della `<section>` va dentro un `<div className="wrap marquee-in">`:

```jsx
<section className="marquee-sec" data-reveal>
  <div className="wrap marquee-in">
    <p className="marquee-cap">
      <Translate>_%_Una sola sorgente. Tutte le lingue che vuoi._%_</Translate>
    </p>
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        <div className="marquee-row">{row}</div>
        <div className="marquee-row">{row}</div>
      </div>
    </div>
  </div>
</section>
```

**`src/Outro.jsx`**: togli il `<div className="aurora aurora-small" …>` con i suoi due `<i>`. `btn btn-light` → `btn btn-ghost`.

**`src/motion.js`**
- `scrollToSection`: `offset: -72` → `offset: -64` (barra da 56 px più un respiro).
- Entrata dell'hero: `{ y: 12, opacity: 0, duration: 0.6, ease: "power4.out", stagger: 0.08, delay: 0.1 }`.
- `[data-reveal]`: `y: 16, duration: 0.6, ease: "power4.out"` (resto invariato).
- `[data-stagger]`: `y: 16, duration: 0.5, ease: "power4.out", stagger: 0.06` (resto invariato).
- Togli il blocco "Parallasse lieve dell'aurora dietro l'hero" (`gsap.to("[data-parallax]", …)`): l'aurora non c'è più.
- Nel commento in testa, se cita l'aurora, toglila.

**`src/landing.css`** (intero, sostituisce il file). Tutto ciò che non c'è qui è passato a `theme.css` o è sparito
(aurora, grana, gradienti, puntini colorati, luce che segue il cursore, `.big`).

```css
/* La landing di viteTranslate. Base, token e componenti condivisi (barra, bottoni, codice, tag,
   segmented control, statistiche) arrivano da ./theme/theme.css, importato prima di questo file:
   qui restano solo le sezioni della landing. Solo token: nessun colore scritto a mano. */

a {
  text-decoration: none;
}

ol,
ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* ---------- Hero ---------- */
.hero {
  border-bottom: 1px solid var(--line);
  background: var(--bg-deep);
}

.hero-in {
  padding-block: clamp(2.5rem, 5vw, 4rem) clamp(2.25rem, 4vw, 3.25rem);
}

.hero h1 {
  max-width: 50rem;
  margin-top: 1rem;
  font-size: clamp(2.4rem, 5.6vw, 4rem);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.05;
  text-wrap: balance;
}

.hero .lead {
  margin-top: 1rem;
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  margin-top: 2rem;
}

.hero .stats {
  margin-top: 2.5rem;
}

.hero-strip {
  border-top: 1px solid var(--line-soft);
}

.hero-strip-in {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding-block: 0.9rem;
}

.release {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--muted);
  font-size: 0.8125rem;
  transition: color 150ms var(--ease);
}

.release:hover {
  color: var(--text);
}

/* Il comando da copiare: alto quanto il bottone accanto. */
.copy {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 100%;
  height: 44px;
  padding-inline: 1rem 0.4rem;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  font-family: var(--mono);
  font-size: 0.8125rem;
  transition: border-color 150ms var(--ease);
}

.copy:hover {
  border-color: var(--line-strong);
}

.copy-prompt {
  color: var(--accent);
}

.copy code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: inherit;
}

.copy-state {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 32px;
  padding-inline: 0.6rem;
  border-radius: 6px;
  background: var(--surface-3);
  color: var(--muted);
  font-family: var(--font);
  font-size: 0.75rem;
}

.copy-state.is-done {
  color: var(--ok);
}

/* ---------- Sezioni ---------- */
.section {
  padding-block: clamp(3.5rem, 8vw, 4.5rem);
}

.section-head {
  max-width: 40rem;
  margin-bottom: 1.75rem;
}

.section-head h2,
.outro h2 {
  font-size: clamp(1.6rem, 3.2vw, 2.25rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
  text-wrap: balance;
}

.section-text {
  max-width: 62ch;
  margin-top: 0.6rem;
  color: var(--muted);
  font-size: 0.9375rem;
  text-wrap: pretty;
}

/* ---------- Le pagine del sito ---------- */
.section-demos {
  padding-top: 2.5rem;
}

.demos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}

.demo-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.demo-card:hover {
  border-color: var(--line-strong);
}

.demo-card-main {
  display: flex;
  flex: 1;
  flex-direction: column;
}

/* Lo screenshot è ritagliato in alto; al passaggio scorre piano verso il basso. */
.shot {
  position: relative;
  height: 180px;
  overflow: hidden;
  border-bottom: 1px solid var(--line);
  background: var(--bg-deep);
}

.shot img {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  object-position: top;
  transition: transform 1400ms var(--ease);
}

.demo-card:hover .shot img {
  transform: translateY(-8%);
}

.shot-open {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
  padding: 1.5rem 0.75rem 0.6rem;
  background: linear-gradient(transparent, color-mix(in srgb, var(--bg-deep) 85%, transparent));
  color: var(--text);
  font-family: var(--mono);
  font-size: 0.6875rem;
  font-weight: 500;
  opacity: 0;
  transition: opacity 250ms var(--ease);
}

.demo-card:hover .shot-open,
.demo-card-main:focus-visible .shot-open {
  opacity: 1;
}

.demo-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.9rem 1rem 0.5rem;
}

.demo-card h3 {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.35;
}

.demo-path {
  color: var(--faint);
  font-family: var(--mono);
  font-size: 0.6875rem;
}

.demo-text {
  margin-top: 0.4rem;
  color: var(--muted);
  font-size: 0.8125rem;
  line-height: 1.6;
}

.demo-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.6rem 1rem 1rem;
}

.demo-foot .tag {
  gap: 0.35rem;
  transition: color 150ms var(--ease), border-color 150ms var(--ease);
}

.demo-foot .tag:hover {
  color: var(--text);
  border-color: var(--faint);
}

/* ---------- La demo del codice ---------- */
.demo-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 14px;
}

.demo-side {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 14px;
}

.demo-out {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 84px;
  padding: 1.1rem 1.2rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
}

.demo-chip {
  flex: none;
  display: grid;
  place-items: center;
  min-width: 2.4rem;
  height: 2.4rem;
  padding-inline: 0.5rem;
  border-radius: var(--r-md);
  background: var(--accent-fill);
  color: var(--accent-ink);
  font-family: var(--mono);
  font-size: 0.8rem;
  font-weight: 600;
}

.demo-out p {
  font-size: clamp(1.1rem, 2.2vw, 1.4rem);
  font-weight: 560;
  letter-spacing: -0.02em;
  line-height: 1.25;
  animation: vt-rise 400ms var(--ease);
}

.demo-tabs {
  margin-top: 1rem;
}

/* ---------- Striscia delle lingue ---------- */
.marquee-sec {
  border-block: 1px solid var(--line-soft);
  background: var(--bg-deep);
}

.marquee-in {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-block: 0.9rem;
}

.marquee-cap {
  flex: none;
  color: var(--faint);
  font-family: var(--mono);
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.marquee {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
  mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
}

.marquee-track {
  display: flex;
  width: max-content;
  animation: slide 60s linear infinite;
}

.marquee-row {
  display: flex;
  gap: 2rem;
  padding-right: 2rem;
}

.marquee-row span {
  color: var(--muted);
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
}

@keyframes slide {
  to {
    transform: translateX(-50%);
  }
}

/* ---------- Funzioni ---------- */
.bento {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.tile {
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface-2);
  transition: border-color 250ms var(--ease);
}

.tile:hover {
  border-color: var(--line-strong);
}

.t-keyless,
.t-yaml,
.t-llm,
.t-build {
  grid-column: span 2;
}

.t-lazy {
  grid-column: span 4;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.tile-copy {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tile-ico {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-bottom: 0.4rem;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  color: var(--accent);
}

.tile h3 {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.tile p {
  color: var(--muted);
  font-size: 0.875rem;
  line-height: 1.6;
}

.tile-code {
  margin-top: auto;
}

.tile-copy + .tile-code {
  margin-top: 1.2rem;
}

.verdicts {
  display: grid;
  gap: 0.4rem;
  margin-top: 1.2rem;
}

.verdicts li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--r-md);
  font-family: var(--mono);
  font-size: 0.75rem;
}

.verdicts .bad {
  background: color-mix(in srgb, var(--error) 10%, transparent);
  color: var(--error);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--error) 50%, transparent);
}

.verdicts .ok {
  background: color-mix(in srgb, var(--ok) 10%, transparent);
  color: var(--ok);
}

.flow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 1.4rem;
}

.flow span {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-md);
  background: var(--surface);
  font-family: var(--mono);
  font-size: 0.75rem;
}

.flow .flow-end {
  border-color: transparent;
  background: var(--accent-fill);
  color: var(--accent-ink);
}

.flow i {
  flex: 1;
  min-width: 14px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent) 0 0 / 200% 100%;
  animation: run 2.4s linear infinite;
}

@keyframes run {
  to {
    background-position: -200% 0;
  }
}

.chunks {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
  max-width: 26rem;
}

.chunks span {
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.75rem;
  animation: load 5.6s ease-in-out infinite;
  animation-delay: calc(var(--n) * 0.7s);
}

@keyframes load {
  0%,
  16%,
  100% {
    border-color: var(--line);
    background: var(--surface);
    color: var(--muted);
  }
  6% {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--text);
  }
}

/* ---------- Passi ---------- */
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.25rem;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface-2);
}

.step-n {
  color: var(--accent);
  font-family: var(--mono);
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.1em;
}

.step h3 {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.step p {
  color: var(--muted);
  font-size: 0.875rem;
}

.step-code {
  margin-top: auto;
}

.step p + .step-code {
  margin-top: 1rem;
}

/* ---------- Confronto ---------- */
.compare {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface-2);
}

.compare-scroll {
  overflow-x: auto;
}

.compare table {
  width: 100%;
  min-width: 660px;
  border-collapse: collapse;
}

.compare th,
.compare td {
  padding: 0.8rem 1rem;
  text-align: center;
}

.compare thead th {
  color: var(--faint);
  font-family: var(--mono);
  font-size: 0.6875rem;
  font-weight: 500;
}

.compare tbody th {
  min-width: 15rem;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 500;
}

.compare tbody tr {
  border-top: 1px solid var(--line);
}

.compare .col-us {
  background: var(--accent-soft);
}

.compare thead .col-us {
  color: var(--accent);
  font-weight: 600;
}

.mk {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r-md);
}

.mk-y {
  background: color-mix(in srgb, var(--ok) 16%, transparent);
  color: var(--ok);
}

.mk-n {
  color: var(--faint);
}

.mk-p {
  background: color-mix(in srgb, var(--warn) 16%, transparent);
  color: var(--warn);
}

.compare-note {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.8rem 1rem;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 0.8125rem;
}

/* ---------- Chiusura e piè di pagina ---------- */
.outro-sec {
  padding-bottom: clamp(3rem, 8vw, 5rem);
}

.outro {
  position: relative;
  overflow: hidden;
  padding: clamp(1.75rem, 4vw, 2.25rem);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  background: linear-gradient(120deg, var(--surface), color-mix(in srgb, var(--accent) 6%, var(--surface)));
}

/* Un riflesso che attraversa la banda ogni tanto. */
.outro::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 -60px;
  width: 60px;
  background: linear-gradient(90deg, transparent, var(--accent-soft), transparent);
  animation: shine 6s var(--ease) infinite;
}

@keyframes shine {
  60%,
  100% {
    transform: translateX(calc(100vw + 120px));
  }
}

.outro > * {
  position: relative;
}

.outro .lead {
  margin-top: 0.6rem;
}

.outro .cta-row {
  margin-top: 1.5rem;
}

.footer {
  padding-block: 1.5rem;
  border-top: 1px solid var(--line);
  background: var(--bg-deep);
  color: var(--faint);
  font-size: 0.8125rem;
}

.footer-in {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.footer b {
  color: var(--text);
  font-family: var(--mono);
  font-weight: 500;
}

.footer nav {
  display: flex;
  gap: 1.5rem;
}

.footer a:hover {
  color: var(--text);
}

/* ---------- Adattamenti ---------- */
@media (max-width: 980px) {
  .demos {
    grid-template-columns: repeat(2, 1fr);
  }

  .bento {
    grid-template-columns: repeat(2, 1fr);
  }

  .t-lazy {
    flex-direction: column;
    align-items: flex-start;
  }

  .chunks {
    justify-content: flex-start;
  }

  .steps {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .demos,
  .bento {
    grid-template-columns: 1fr;
  }

  .t-keyless,
  .t-yaml,
  .t-llm,
  .t-build,
  .t-lazy {
    grid-column: auto;
  }

  .marquee-in {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.6rem;
  }

  .marquee {
    width: 100%;
  }

  .copy {
    font-size: 0.75rem;
  }

  .footer-in {
    flex-direction: column;
    text-align: center;
  }
}
```

### 1.13 Il playground

Percorsi relativi a `site/pages/playground/`.

**`index.html`**: togli il `<link rel="stylesheet" href="https://fonts.googleapis.com/…">` (tieni i `preconnect`, il commento
diventa quello della landing). Aggiungi, dopo il `<meta name="color-scheme" …>`:

```html
<meta name="theme-color" content="#101418" />
<link rel="icon" href="/src/theme/logo.svg" type="image/svg+xml" />
```

**`src/main.jsx`**: import `applySavedTheme` da `./theme/boot.js`, poi `import "./theme/theme.css";` **prima** di
`import "./playground.css";`. Il blocco `try { const theme = localStorage.getItem("vt-theme"); … }` e il suo commento
diventano `applySavedTheme();` con il commento `// Il tema scelto sul sito (src/theme/boot.js), prima del primo rendering.`

**`src/playgroundComponents/TopBar.jsx`** (intero). `_%_Tutte le demo_%_` resta in questo file: chiave invariata.

```jsx
import { Translate } from "@sepoina/vitetranslate/react";
import SiteBar from "../theme/SiteBar.jsx";
import { siteUrl } from "../siteLinks.js";

// La barra del sito (src/theme/SiteBar.jsx) con il ritorno alla landing.
export default function TopBar() {
  return (
    <SiteBar home={siteUrl()}>
      <a className="bar-back" href={siteUrl()}>
        ← <Translate>_%_Tutte le demo_%_</Translate>
      </a>
    </SiteBar>
  );
}
```

**`git rm src/playgroundComponents/Code.jsx`**.

**`src/playgroundComponents/DocSection.jsx`**: `import Code from "./Code.jsx";` → `import { Code } from "../theme/Code.jsx";`.

**`src/playgroundComponents/InstallSection.jsx`**
- Stesso import di `DocSection.jsx`.
- In ogni `<Code … />`: `language=` → `lang=`.
- I cinque `<Code lang="bash" … />` **senza** `title` (oggi mostrano "terminal" di default) ricevono `title="terminal"`.
  Sono quelli con `npm install @sepoina/vitetranslate`, `npx vitetranslate`, `npx vitetranslate --status`,
  `npx vitetranslate --add fr-FR` e `npx vitetranslate --llm-translate`. Controllo: `grep -n "<Code" … | grep -v title` non trova più niente.

**`src/playgroundComponents/StrengthsSection.jsx`**: `import SIZE from "../../../../runtimeSize.json";` →
`import SIZE from "../theme/runtimeSize.json";`. È la riparazione dello zip StackBlitz.

**`src/App.jsx`**
- `<section className="hero">` → `<section className="page-hero grid-backdrop">`.
- Entrata in cascata: `eyebrow` → `className="eyebrow rise" style={{ "--i": 0 }}`, `<h1 className="rise" style={{ "--i": 1 }}>`,
  `lead` → `className="lead rise" style={{ "--i": 2 }}`, `lead-more` → `className="lead-more rise" style={{ "--i": 3 }}`,
  `<nav className="toc rise" style={{ "--i": 4 }}>`.

**`src/playground.css`**: si tiene solo ciò che è del playground. Tabella dei token (vale per ogni regola che resta):

| Prima | Dopo |
| :- | :- |
| `var(--surface-2)` | `var(--surface-3)` — **sostituisci questo per primo** |
| `var(--surface)` | `var(--surface-2)` |
| `var(--line-2)` | `var(--line-strong)` |
| `var(--cyan)` | `var(--accent)` |
| `border-radius: 999px` | `border-radius: var(--r-md)` |
| `border-radius: 16px` / `18px` | `border-radius: var(--r-lg)` |
| `border-radius: 10px` | `border-radius: var(--r-md)` |

Blocco per blocco:

1. Commento in testa: `/* Il playground: solo ciò che è suo. Base, token, barra, codice, indice e note arrivano da ./theme/theme.css. */`
2. **Token** (i tre blocchi `:root`, `@media … light`, `:root[data-theme="light"]`): togli tutto.
3. **Base** (`*`, `body`, `a`, `a:hover`, `button, input, select`, `button`, `code`, `p code, li code`, `:focus-visible`,
   `::selection`, `.wrap`): togli tutto.
4. **Barra in alto** (`.top`, `.top-in`, `.back`, `.back:hover`, `.top-tools`, `.lang-switch…`, `.icon-btn…`): togli tutto.
5. **Apertura**: togli `.hero`, `.eyebrow`, `.hero h1`, `.hero h1 em`, i due `:lang(…) .hero h1 em`, `.lead`, `.toc a`,
   `.toc a:hover`. Tieni `.lead-more`, `.toc-group`, `.toc-label` (`font-size: 0.6875rem`), `.toc a.is-new`. `.toc` diventa
   solo `.toc { display: grid; gap: 0.9rem; }` (margine e bordo arrivano dal tema).
6. **Sezioni**: tieni tutto tranne `.anchor` e `.doc h3:hover .anchor, .anchor:focus-visible` (ora nel tema). I due
   `scroll-margin-top: 60px` diventano `64px`. Applica la tabella dei token. `.demo-label`: `font-size: 0.6875rem`.
   `.chips button:disabled` diventa `background: var(--accent-fill); border-color: var(--accent-fill); color: var(--accent-ink);`.
7. **Blocchi di codice**: togli tutto (`.code`, `.code-bar…`, `.code pre`, `.code code`, `.tk-…`) **tranne**
   `.code + .doc-text, .doc-text + .code, .code + .code { margin-top: 1rem; }`.
8. **Punti di forza**: tieni, con la tabella dei token.
9. **Note in fondo**: togli tutto (è identico al tema).
10. **Telefono**: togli `.top-in` dal `@media (max-width: 720px)`; il resto resta.

### 1.14 La pagina dei casi limite

Percorsi relativi a `site/pages/playEdge/`. Qui le virgolette sono **singole**.

**`index.html`**: togli il `<link>` dei font, il `<link>` di `github-dark.min.css` con il suo commento e lo `<script>` di
`highlight.min.js`. Aggiungi `theme-color` e `icon` come nel playground.

**`src/main.jsx`**: come il playground, con virgolette singole; `import './theme/theme.css';` prima di `import './edge.css';`.

**`src/App.jsx`**
- Togli le funzioni `LanguageSwitch` e `ThemeToggle` con i loro commenti.
- Import: togli `useTranslateLanguage` e `useTranslateToString` se non li usa più nessuno (controlla con grep nel file);
  aggiungi `import SiteBar from './theme/SiteBar.jsx';` e `import { highlight } from './theme/Code.jsx';`.
- L'`<header className="top">…</header>` diventa:

  ```jsx
  <SiteBar home={siteUrl()}>
    <a className="bar-back" href={siteUrl()}>
      <Translate>_%_← viteTranslate: tutte le demo_%_</Translate>
    </a>
  </SiteBar>
  ```

- Il `useMemo` che costruisce `html` con `window.hljs` diventa:

  ```jsx
  // colorato con lo stesso highlight dei blocchi di codice del sito (src/theme/Code.jsx)
  const nodes = useMemo(() => highlight(src ?? lastSrc.current, 'jsx'), [src]);
  ```

- Il `<code className="hljs language-javascript" dangerouslySetInnerHTML={{ __html: html }} />` diventa `<code>{nodes}</code>`.
- Togli la funzione `escapeHtml` in fondo con il suo commento.
- `<section className="hero">` → `<section className="page-hero grid-backdrop">`; entrata in cascata come nel playground:
  `eyebrow` (0), `h1` (1), `lead` (2), `legend` (3), `toc` (4).

**`src/edge.css`**: stessa tabella dei token del playground, più `border-radius: 6px` → `var(--r-sm)` e
`border-radius: 14px` → `var(--r-xl)`.

1. Commento in testa: `/* I casi limite: solo ciò che è di questa pagina. Base, token, barra, indice e note arrivano da ./theme/theme.css. */`
2. **Token**: togli i tre blocchi; resta solo `:root { --tint: 8%; }` (la tinta delle righe, una percentuale e non un colore).
3. **Base** (`*`, `body`, `a`, `button`, `code`, `:focus-visible`, `::selection`, `.wrap`, `.sr-only`): togli tutto.
4. **Barra in alto**: togli tutto.
5. **Apertura**: togli `.hero`, `.eyebrow`, `.hero h1`, `.hero h1 em`, i `:lang(…)`, `.lead`, `.toc`, `.toc a`, `.toc a:hover`.
   Tieni `.legend`, `.chip` (con `border-radius: var(--r-md)`), `.chip::before`, `.legend-more`, `.toc-count`.
6. **Categorie**: `.cases` con `scroll-margin-top: 64px`. Il selettore `.cases h2, .notes h2` diventa solo `.cases h2`.
   Togli `.anchor` e `.cases h2:hover .anchor, .anchor:focus-visible`. `.out input`: sfondo `var(--surface-2)`.
   `.av-badge`: `background: var(--accent-fill); color: var(--accent-ink);`. Applica la tabella dei token.
7. **Note in fondo**: togli `.notes`, `.notes h2`, `.notes ul`, `.notes li + li`, `.notes b`; aggiungi
   `.notes { scroll-margin-top: 64px; }`.
8. **`.src-pop`**: `background: var(--code-bg); color: var(--text); border: 1px solid var(--line);
   border-radius: var(--r-xl); box-shadow: 0 24px 60px -24px color-mix(in srgb, black 55%, transparent);`. Il resto resta.
9. **Telefono**: togli `.top-in` dal `@media (max-width: 720px)`; il resto resta.

### 1.15 Le traduzioni seguono le frasi

Solo adesso, a modifiche finite, in quest'ordine:

```bash
npm run site:theme                       # le copie sono aggiornate
(cd site/landing && npx vtranslate-cli)
(cd site/pages/playground && npx vtranslate-cli)
(cd site/pages/playEdge && npx vtranslate-cli)
```

Poi `npx vtranslate-cli --status` in ognuna. **Atteso: landing 69, playground 103, edge 258 chiavi, MISSING tutto a 0.**
Se una lingua ha chiavi mancanti, una frase è stata ritoccata nello spostamento: trova la differenza con `git diff` (vecchio
e nuovo marcatore), rimettila identica, ripristina le tabelle (vedi il riquadro CAUTION in cima) e rifai questo passo.
Se non trovi la causa, **chiedi all'utente**: non tradurre a mano e non lanciare `--llm-translate`.

Nelle tabelle devono comparire chiavi `ThemeToggle_…`, `LanguageSwitch_…` (tutti e tre i progetti) e quattro `Hero_…` in più
(landing), mentre spariscono le `Nav_…`/`TopBar_…`/`App_…` di lingua e tema e le quattro `Features_…` delle statistiche.

---

## Fase 2 — Test

### 2.1 `test/list/site.test.mjs`

Aggiorna il commento in testa (una riga: "il tema di site/theme/ è copiato identico nei progetti, i colori stanno solo in
tokens.css, le coppie di testo passano AA e nessuna pagina importa da fuori della sua cartella"). Import da aggiungere:
`readdirSync` da `node:fs`, `sep` da `node:path`, e
`import { checkTheme, syncTheme, themeTargets } from "../../site/syncTheme.mjs";`.

In fondo, prima di `process.exit`, questi blocchi:

```js
// 8. Il tema: site/theme/ (più runtimeSize.json) copiato identico in src/theme/ di ogni progetto che lo usa.
eq("themeTargets: la landing e le pagine con theme: true", ["site/landing", "site/pages/playEdge", "site/pages/playground"], themeTargets(ROOT));
eq("le copie del tema sono allineate (npm run site:theme)", [], checkTheme(ROOT));
for (const t of themeTargets(ROOT)) {
  eq(`${t}: main.jsx importa theme/theme.css`, true, readFileSync(join(ROOT, t, "src/main.jsx"), "utf8").includes("./theme/theme.css"));
}
eq("site/theme/logo.svg è doc/logo.svg", true, readFileSync(join(ROOT, "site/theme/logo.svg")).equals(readFileSync(join(ROOT, "doc/logo.svg"))));

// 9. syncTheme su un albero finto: scrive, toglie i file che non ci sono più, lascia stare chi non lo chiede.
const alberoTema = mkdtempSync(join(tmpdir(), "vt-theme-"));
try {
  const scrivi = (rel, testo) => {
    mkdirSync(dirname(join(alberoTema, rel)), { recursive: true });
    writeFileSync(join(alberoTema, rel), testo);
  };
  scrivi("site/theme/a.css", "a{}");
  scrivi("site/theme/B.jsx", "export default 1;");
  scrivi("site/runtimeSize.json", "{}");
  scrivi("site/landing/package.json", "{}");
  scrivi("site/pages/p1/package.json", JSON.stringify({ vitetranslateSite: { slug: "p1", theme: true } }));
  scrivi("site/pages/p2/package.json", JSON.stringify({ vitetranslateSite: { slug: "p2" } }));
  eq("tema finto: chi lo riceve", ["site/landing", "site/pages/p1"], themeTargets(alberoTema));
  eq("tema finto: prima della copia mancano 3 file x 2 progetti", 6, checkTheme(alberoTema).length);
  syncTheme(alberoTema);
  eq("tema finto: dopo la copia è allineato", [], checkTheme(alberoTema));
  eq("tema finto: la copia porta anche runtimeSize.json", true, existsSync(join(alberoTema, "site/pages/p1/src/theme/runtimeSize.json")));
  scrivi("site/pages/p1/src/theme/vecchio.css", "x");
  eq("tema finto: un file in più si vede", ["site/pages/p1/src/theme/vecchio.css: in più"], checkTheme(alberoTema));
  syncTheme(alberoTema);
  eq("tema finto: e la copia lo toglie", false, existsSync(join(alberoTema, "site/pages/p1/src/theme/vecchio.css")));
  eq("tema finto: p2 non riceve niente", false, existsSync(join(alberoTema, "site/pages/p2/src/theme")));
} finally {
  rmSync(alberoTema, { recursive: true, force: true });
}

// 10. I colori stanno solo in tokens.css: nel resto del CSS del sito, solo var(--…).
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");
for (const f of ["site/theme/theme.css", "site/landing/src/landing.css", "site/pages/playground/src/playground.css", "site/pages/playEdge/src/edge.css"]) {
  const trovati = senzaCommenti(readFileSync(join(ROOT, f), "utf8")).match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g) ?? [];
  eq(`${f}: nessun colore scritto a mano`, [], trovati);
}

// 11. tokens.css: i due blocchi del tema chiaro sono uguali, e ogni coppia di testo passa 4.5:1 in entrambi i temi.
const tokens = readFileSync(join(ROOT, "site/theme/tokens.css"), "utf8");
const blocco = (selettore) => {
  const a = tokens.indexOf("{", tokens.indexOf(selettore));
  return tokens.slice(a + 1, tokens.indexOf("}", a));
};
const variabili = (testo) => Object.fromEntries([...testo.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const chiaroSistema = blocco(':root:not([data-theme="dark"])');
eq("tokens.css: i due blocchi chiari sono uguali", chiaroSistema.replace(/\s+/g, " ").trim(), blocco(':root[data-theme="light"]').replace(/\s+/g, " ").trim());
const scuro = variabili(blocco(":root {"));
const chiaro = { ...scuro, ...variabili(chiaroSistema) };
const risolvi = (mappa, nome, n = 0) => {
  const v = mappa[nome] ?? "";
  const r = /^var\(--([\w-]+)\)$/.exec(v);
  return r && n < 5 ? risolvi(mappa, r[1], n + 1) : v;
};
const luminanza = (hex) => {
  const c = hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrasto = (a, b) => {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const COPPIE = [
  ...["text", "muted", "faint", "accent"].flatMap((f) => ["bg", "surface-2", "bg-deep"].map((b) => [f, b])),
  ["accent-ink", "accent-fill"],
  ...["warn", "error"].flatMap((f) => ["bg", "surface-2"].map((b) => [f, b])),
  ...["tk-c", "tk-s", "tk-t", "tk-k", "tk-n"].map((f) => [f, "code-bg"]),
];
const esa = /^#[0-9a-f]{6}$/i;
for (const [nome, mappa] of [["scuro", scuro], ["chiaro", chiaro]]) {
  const sotto = COPPIE.filter(([f, b]) => {
    const [a, c] = [risolvi(mappa, f), risolvi(mappa, b)];
    return !esa.test(a) || !esa.test(c) || contrasto(a, c) < 4.5;
  }).map(([f, b]) => `${f} su ${b}`);
  eq(`tema ${nome}: ogni coppia di testo passa 4.5:1`, [], sotto);
}

// 12. Una pagina resta autonoma: nessun import relativo esce dalla sua cartella (lo zip per StackBlitz non lo avrebbe).
const sorgenti = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (["node_modules", "dist"].includes(e.name) ? [] : sorgenti(join(dir, e.name))) : /\.(jsx?|mjs|css)$/.test(e.name) ? [join(dir, e.name)] : []
  );
for (const { dir } of pagine) {
  const radicePagina = join(ROOT, dir);
  const fuori = [];
  for (const f of sorgenti(radicePagina)) {
    for (const m of readFileSync(f, "utf8").matchAll(/(?:from\s*|import\s*\(\s*|@import\s+(?:url\()?)["'](\.{1,2}\/[^"']+)["']/g)) {
      if (!resolve(dirname(f), m[1]).startsWith(radicePagina + sep)) fuori.push(`${f.slice(radicePagina.length + 1)} -> ${m[1]}`);
    }
  }
  eq(`${dir}: nessun import fuori dalla cartella`, [], fuori);
}
```

Lancia `node test/list/site.test.mjs`: tutto `ok`. Se il blocco 12 trova un import fuori cartella in `llmRestaurant` (oggi
non ce ne sono), **chiedi all'utente** prima di toccare quella pagina.

### 2.2 Prova a mano del controllo

`echo "/* x */" >> site/landing/src/theme/tokens.css && node site/syncTheme.mjs --check; echo "exit $?"`: deve stampare
`site/landing/src/theme/tokens.css: diverso` ed `exit 1`. Poi `npm run site:theme` e di nuovo `--check`: `exit 0`.

### 2.3 `compileGolden`

`node test/compileGolden.mjs` (senza `--write`) stampa le differenze. Devono riguardare **solo** `site/landing/locale`,
`site/pages/playground/locale` e `site/pages/playEdge/locale`, e solo le chiavi spostate al § 1.15. È il "cambiamento voluto
della compilazione, dichiarato nel piano" che il file chiede: rigenera con `node test/compileGolden.mjs --write`.
Se compare una differenza in `demo/…`, o in una chiave che non si è spostata, **fermati e chiedi**.

### 2.4 Suite

`npm test`: tutto verde. Annota file e asserzioni accanto ai numeri della Fase 0.

---

## Fase 3 — Build

### 3.1 Build del sito

`npm run site:build`. Deve stampare `tema copiato in site/landing, site/pages/playEdge, site/pages/playground` prima delle
build, e finire con `sito pronto in site/dist`.

### 3.2 Controlli sull'output

```bash
# Favicon riscritta con la base di ogni progetto: /viteTranslate/assets/logo-….svg, …/playground/assets/…, …/edge/assets/…
grep -o 'rel="icon"[^>]*' site/dist/index.html site/dist/playground/index.html site/dist/edge/index.html
# Ogni CSS comincia con l'@import dei font (Vite lo porta in cima)
for f in site/dist/assets/*.css site/dist/playground/assets/*.css site/dist/edge/assets/*.css; do head -c 70 "$f"; echo; done
# Niente serif, niente highlight.js: nessuna riga
grep -rl "Instrument\|highlight.min.js\|github-dark" site/dist/index.html site/dist/playground site/dist/edge
# Gli zip portano il tema: 9 righe ciascuno, runtimeSize.json compreso
unzip -l site/dist/zip/playground.zip | grep "src/theme/"
unzip -l site/dist/zip/edge.zip | grep "src/theme/"
```

### 3.3 Screenshot delle card

Gli screenshot di `playground` ed `edge` mostrano il tema vecchio: si rifanno, in tema scuro. `llmrestaurant.webp` resta.
`$SCRATCH` è la tua cartella temporanea.

1. Avvia l'anteprima **in background**:
   `cd site/landing && npm exec -- vite preview --outDir ../dist --base=/viteTranslate/ --port 4173 --strictPort`.
2. Per `playground` e poi per `edge`:

   ```bash
   google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
     --blink-settings=preferredColorScheme=0 --window-size=1280,800 --virtual-time-budget=4000 \
     --screenshot="$SCRATCH/playground.png" http://localhost:4173/viteTranslate/playground/
   magick "$SCRATCH/playground.png" -resize 960x600 -quality 82 site/landing/public/previews/playground.webp
   ```

   (`preferredColorScheme=0` è il tema scuro; `--virtual-time-budget` lascia finire le entrate.)
3. Guarda i due `.webp` (con lo strumento Read): barra verde, niente viola, niente pagina bianca.
4. Ferma l'anteprima e rilancia `npm run site:build`: le card pubblicate devono avere gli screenshot nuovi.

### 3.4 Verifica visiva

Con l'anteprima accesa, screenshot di landing (`/viteTranslate/`, finestra `1280,4200`), playground ed edge
(`1280,1600`), in scuro (`preferredColorScheme=0`) e in chiaro (`=1`), e di tutti e tre a `390,844`. Guardali uno per uno:

- La barra sta su una riga a 1280 px e su due a 390 px, senza pezzi tagliati né scroll orizzontale.
- Hero della landing allineato a sinistra, riga `$ npx vitetranslate --llm-translate` intera, due statistiche sotto.
- Nessun viola: l'unico resto voluto è il colore delle parole chiave nel codice (`--tk-k`).
- Il `%` del logo è verde in tutti e due i temi.
- In chiaro tutto si legge: nessun testo verde chiaro su bianco (il bottone verde con il testo scuro va bene).
- Le card delle pagine mostrano gli screenshot nuovi.

Se qualcosa non torna ed è una regola del § 1.3 o § 1.12, correggila e annotalo per il logDiary. Se è una scelta di
disegno (proporzioni, cosa mostrare), **chiedi all'utente** allegando lo screenshot.

---

## Fase 4 — Review

- `node site/syncTheme.mjs --check` esce con 0; `npm test` verde; `README.md` ancora a 9903 B (comando di `AGENTS.md`).
- Nessun resto del tema vecchio, nessuna riga:
  `grep -rn -- "--serif\|--grad\|--cyan\|--line-2\|--mint\|--shadow\|Instrument\|hljs\|lang-switch button\|className=\"top\"" site/theme site/landing/src site/pages/playground/src site/pages/playEdge/src`
  (le cartelle `src/theme` sono copie: se trovi qualcosa lì, correggi in `site/theme/`).
- Nessun file modificato a mano dentro un `src/theme/` (`git diff --stat` mostra le tre copie con gli stessi numeri di `site/theme/`).
- `lib/` intatto: `git diff --stat lib` vuoto.
- Le tre tabelle hanno ancora 69, 103 e 258 chiavi, tutte tradotte.
- Se qualcosa di architetturale non regge (per esempio il sync che si scontra con un formattatore, o una pagina che non può
  usare `SiteBar`), scrivi `site_theme.necessaryreview.md` e chiedi all'utente.

---

## Fase 5 — Documentazione

In inglese, rivolta a chi lavora al sito, frasi brevi. Tutto in `site/README.md`:

1. **Nuova sezione `## Theme`**, dopo "Run":
   - `site/theme/` is the theme: tokens, CSS, the top bar, language and theme switches, code blocks, the logo.
   - Each project gets a copy in `src/theme/` (`npm run site:theme`; `site:build` and `estimateSize` do it too). Never edit a copy.
   - Why a copy: a page must build on its own (StackBlitz zip, a folder downloaded from GitHub).
   - `tokens.css` is the only file with colors. The site test fails on a color written elsewhere, on a copy that differs,
     or on a text/background pair below 4.5:1 — so a rebrand is one file and a test run.
   - Working on the theme with a dev server open: `node site/syncTheme.mjs --watch` in a second terminal.
2. **"Add a page"**: al punto 1, il campo diventa `"vitetranslateSite": { "slug": "<slug>", "theme": true }` (`theme` se la
   pagina usa il tema), e un punto nuovo: `import "./theme/theme.css"` in `main.jsx`, `<SiteBar>` per la barra.
3. **Nuova sezione `## Card previews`**: i due comandi del § 3.3 (Chrome headless in tema scuro, poi `magick` a 960×600).
4. Il paragrafo "Why `VITE_SITE_ROOT`" dice già che una pagina non importa niente da fuori: aggiungi che il test lo controlla.

Il `README.md` della radice non cambia. Se un documento supera la lunghezza ragionevole, avvisa l'utente alla fine.

---

## Fase 6 — Pulizia

Rimuovi `site_theme.necessarytest.md`, `site_theme.necessarydoc.md` ed eventuali `site_theme.necessaryreview.md` risolti.
Controlla che in `site/` non restino file orfani: `git status` non deve mostrare `landing/public/logo.svg`,
`landing/src/Code.jsx` o `playgroundComponents/Code.jsx` se non come cancellati.

---

## Fase 7 — logDiary

Aggiungi la nota `[!TIP]` subito sotto la `[!NOTE]` in cima (al posto del commento `<!-- logDiary … -->`): le decisioni prese
lungo il percorso, i numeri della suite, le deviazioni dal piano e perché. Massimo una decina di righe. Se c'è un rischio
aperto (per esempio uno screenshot non rifatto, o una regola CSS che ha richiesto un ask), mettilo in una `[!IMPORTANT]`.
