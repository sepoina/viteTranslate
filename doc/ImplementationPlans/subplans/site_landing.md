# Piano — un sito solo: `site/landing` + `site/pages/*`

> [!NOTE]
> **Per il revisore umano**
> - **Cosa:** `playground/`, `playEdge/` e `demo/Vite_8/llmRestaurant/` finiscono in `site/pages/`. Nasce `site/landing/`,
>   un'app Vite+React tradotta con viteTranslate: una card per pagina.
> - **URL:** landing in `/viteTranslate/`, pagine in `/viteTranslate/playground/`, `/edge/` e `/llmrestaurant/`. L'URL di edge resta quello di oggi.
> - **Chi è una pagina:** ogni `site/pages/*/package.json` con `"vitetranslateSite": { "slug": "…" }`. Nuovo `site/build.mjs`:
>   builda la landing e le pagine con la loro `base` e le riunisce in `site/dist/`. La CI chiama solo quello.
> - **Autonomia:** ogni cartella resta un progetto Vite che si installa e si builda da solo. I link verso il resto del sito
>   passano per `VITE_SITE_ROOT`: `site/build.mjs` lo imposta, e senza si punta al sito pubblicato.
> - **Dipendenza:** tutte le pagine e la landing dichiarano `"^<versione>"` come le demo, niente più `file:..`. `syncDemoDeps` copre anche `site/`.
> - **Vecchi URL:** la landing rimanda `#ancora` a `/playground/#ancora` e `?edge` a `/edge/`.
> - **Nessuna riga della libreria cambia.** Cambiano solo commenti in `lib/` che citano i vecchi percorsi.
> - **Rischio:** il README ha 3 byte di margine sul limite dei 10 kB. Le modifiche ai link non devono allungarlo.

> [!TIP]
> **logDiary (implementato il 2026-09-19)**
> - Fase 0: c'erano 38 file 4.6.2 non committati; l'utente ha scelto di procedere lo stesso, quindi il diff dello spostamento è mescolato al resto.
> - `llmRestaurant`: cancellati `de-DE.yml`, `en-US.yml`, `fr-FR.yml` in radice e `locale.zip`; `.env` lasciato com'è.
> - `edge` e `llmRestaurant` hanno il link di ritorno («tutte le demo»); il playground ha la voce «Tutte le demo» nell'indice. Chiavi nuove tradotte a mano.
> - Landing in it-IT / en-US / zh-CN, redirect di `#ancora` e `?edge` in `main.jsx`. `site/build.mjs` builda tutto; CI = `npm run site:build`.
> - `test/list/site.test.mjs` nuovo (57 test, 2190 asserzioni). Build del sito e build di `playEdge` da solo riuscite; `npm ls` mostra tutti i workspace collegati a `./`.
> - README a 9902 B (la riga "Live site" sostituisce le due righe sorgenti). Non creati i file `.necessary*.md`: test e doc sono stati fatti subito.
>
> [!IMPORTANT]
> - `llmRestaurant`: `de-DE`, `en-US` e `fr-FR` hanno ancora 228 chiavi `null` (già così prima dello spostamento): serve `vitetranslate --llm-translate` lì. La card dice "quattro lingue riempite" e oggi è vera solo per `ja-JP`.
> - I redirect dei vecchi URL e i link «tutte le demo» sono verificati solo nel codice e negli `index.html`: nessun browser provato.

---

## Istruzioni per chi implementa

Leggi prima `AGENTS.md`, sezione "REGOLE DI IMPLEMENTAZIONE DEL PLAN". Le sette fasi vanno fatte in quest'ordine, senza saltarne nessuna:

1. **Implementazione** (§ "Fase 1"). Annota i test in `site_landing.necessarytest.md` e le modifiche ai doc in
   `site_landing.necessarydoc.md`, tutti e due accanto a questo file. Niente build in questa fase: bastano
   `node --check` e i test in node.
2. **Test** (§ "Fase 2").
3. **Build** (§ "Fase 3").
4. **Review** (§ "Fase 4"). Se qualcosa di architetturale non regge, scrivi `site_landing.necessaryreview.md` e chiedi all'utente.
5. **Documentazione** (§ "Fase 5").
6. **Pulizia**: rimuovi i `site_landing.necessary*.md` che non servono più.
7. **logDiary**: compila la nota `[!TIP]` subito sotto la nota per il revisore, in una decina di righe al massimo.

Ogni ambiguità, e ogni contraddizione fra questo piano e i sorgenti, si risolve **chiedendo all'utente**. Non scegliere da solo.

**Regole di stile**, per ogni file toccato:

- Commenti in italiano, testi a schermo nel formato della pagina (sorgente `it-IT` con marcatori `_%_…_%_`).
- Si seguono le convenzioni del file vicino: virgolette, punto e virgola, indentazione.
- Per spostare file tracciati si usa **`git mv`**, così la storia li segue. `llmRestaurant` non è tracciato e si sposta con `mv`.

---

## Decisioni prese (ask all'utente del 2026-09-19, più le scelte di piano)

| Tema | Decisione |
| :- | :- |
| Landing | App **Vite+React con viteTranslate**: card tradotte e selettore di lingua *(utente)* |
| Dipendenza dalla libreria | **Range npm `"^<versione>"` + workspace**, per landing e pagine. `syncDemoDeps` si estende a `site/` *(utente)* |
| Vecchi URL | **Redirect dalla landing**: `#ancora` va a `playground/#ancora`, `?edge` va a `edge/` *(utente)* |
| Procedura | Prima il piano, poi l'implementazione dopo l'approvazione *(utente)* |
| llmRestaurant fuori da `demo/Vite_8` | Va bene *(utente)* |
| Nomi delle cartelle | Restano `playground`, `playEdge`, `llmRestaurant`. Lo slug dell'URL sta nel `package.json` *(piano)* |
| Slug | `playground`, `edge`, `llmrestaurant` *(dagli URL dati dall'utente)* |
| Link fra le pagine | `VITE_SITE_ROOT` (lo imposta `site/build.mjs`), altrimenti il sito pubblicato. In `npm run dev` i link portano quindi al sito vivo. Il sito completo in locale si vede con `npm run site:preview` *(piano)* |
| Lingue della landing | Sorgente `it-IT` come le altre pagine; `en-US` precaricata e iniziale; `zh-CN` come nel playground *(piano)* |
| `package-lock.json` in `playground/` e `playEdge/` | Si rimuovono: con i workspace fa fede quello della radice, e contengono `file:..` *(piano)* |
| Porte di sviluppo | playground 3000 e edge 3001 restano; landing 3002, llmRestaurant 3003 *(piano)* |

**Da chiedere all'utente in Fase 1, prima di toccare `llmRestaurant`:**

- `de-DE.yml`, `en-US.yml` e `fr-FR.yml` alla radice della cartella sono identici a quelli in `locale/`: si cancellano?
- `locale.zip` (un backup?) si cancella?
- `.env` contiene una chiave vera. Resta ignorato da git (`.gitignore`: `.env`), ma il README dice di usare
  `.env.local`: si lascia com'è?

---

## Stato attuale (verificato il 2026-09-19)

- `.github/workflows/publish.yml`, job `deploy-pages`: builda `playground` con `--base=/viteTranslate/` e `playEdge` con
  `--base=/viteTranslate/edge/`, copia `playEdge/dist` in `playground/dist/edge`, copia `index.html` in `404.html` e
  pubblica `playground/dist`.
- Root `package.json`: `workspaces: ["playground", "playEdge", "demo/Vite_8/*"]`. Gli script `playground*` e `edge*`
  usano `npm --prefix`.
- `playground` e `playEdge` dipendono da `"file:.."`. `llmRestaurant` da `"^4.6.2-rc.1"`. Con i workspace, npm crea
  `node_modules/@sepoina/vitetranslate -> ../..` e il link vale per tutti.
- `playground/src/edgeUrl.js`: `localhost:3001` in dev, `${BASE_URL}edge/` in build. Lo usano `main.jsx` (redirect `?edge`)
  e `TableOfContents.jsx`.
- `playground/pluginOnlyForPlayground.js` risolve `../lib/…` (con `useLocalLibrary: false`, oggi inattivo).
- `test/syncDemoDeps.mjs` → `demoDirs()` prende solo i workspace che iniziano con `demo/`.
- Test che puntano a `playground/`: `test/list/languageResource.test.mjs` e `test/list/preloadRule.test.mjs`
  (`baseDir: join(ROOT, "playground")`), `test/exampleLangCompile.mjs` (default `playground/locale`).
- Ancore del playground: `install`, `install-config-plugin`, `install-esecuzione-dev`, `install-build-linguistico`,
  `install-nuova-lingua`, `playground`, `punti-di-forza`, `cambio-lingua`, `traduzione-statica`, `traduzione-dinamica`,
  `placeholder-e-attributi`. Il README ne usa tre (riga 142).
- `README.md` sta a **9997 B** su 10000 (misurato con il comando di `AGENTS.md`).

---

## Struttura di arrivo

```text
site/
├── build.mjs                 # builda landing + pagine, riunisce in site/dist/
├── dist/                     # (git-ignored: la regola "dist/" c'è già) ciò che va su Pages
├── landing/                  # → /viteTranslate/
│   ├── package.json          # name: vitetranslate-site-landing
│   ├── vite.config.js
│   ├── index.html
│   ├── public/logo.svg       # copia di doc/logo.svg
│   ├── locale/{it-IT,en-US,zh-CN}.yml
│   └── src/{main.jsx,App.jsx,pages.js,siteLinks.js,landing.css}
└── pages/
    ├── playground/           # → /viteTranslate/playground/     (era playground/)
    ├── playEdge/             # → /viteTranslate/edge/           (era playEdge/)
    └── llmRestaurant/        # → /viteTranslate/llmrestaurant/  (era demo/Vite_8/llmRestaurant/)
```

Ogni `site/pages/<dir>/package.json` riceve il campo:

```json
"vitetranslateSite": { "slug": "edge" }
```

È l'unico segnale che una cartella è una pagina del sito. Per aggiungerne una si crea la cartella, si mette il campo e
si aggiunge la card in `site/landing/src/pages.js`. Il test del sito controlla che le due liste coincidano.

---

## Fase 0 — Precondizione

1. `git status`: se ci sono modifiche non committate **fuori** da questo piano (per esempio il lavoro 4.6.2), fermati e
   chiedi all'utente di committarle. Lo spostamento deve essere un commit a sé, altrimenti `git log --follow` e la review
   del diff diventano illeggibili.
2. `npm test` deve essere verde **prima** di iniziare. Annota il numero di file e di asserzioni.

---

## Fase 1 — Implementazione

### 1.1 Spostamenti

```bash
mkdir -p site/pages
git mv playground site/pages/playground
git mv playEdge   site/pages/playEdge
mv demo/Vite_8/llmRestaurant site/pages/llmRestaurant
rm -rf site/pages/*/node_modules site/pages/*/dist   # link e build dei vecchi percorsi: si ricreano
git rm site/pages/playground/package-lock.json site/pages/playEdge/package-lock.json
```

`git mv` di una cartella sposta anche i file non tracciati che contiene. Per questo `node_modules` e `dist` si
cancellano subito dopo.

Poi fai le domande su `llmRestaurant` (§ "Decisioni prese") e applica le risposte.

### 1.2 `package.json` della radice

- `workspaces`: `["site/landing", "site/pages/*", "demo/Vite_8/*"]`.
- Script. Togli `playground:build`, `playground:previewpages`, `edge:build` e `edge:install`. Il resto diventa:

```json
"playground": "npm run dev -w site/pages/playground",
"playground:dump": "node test/exampleLangCompile.mjs",
"edge": "npm run dev -w site/pages/playEdge",
"restaurant": "npm run dev -w site/pages/llmRestaurant",
"site": "npm run dev -w site/landing",
"site:build": "node site/build.mjs",
"site:preview": "node site/build.mjs --preview",
```

### 1.3 `package.json` delle pagine

Per ciascuna delle tre:

| Cartella | `name` | `vitetranslateSite.slug` |
| :- | :- | :- |
| `site/pages/playground` | `vitetranslate-site-playground` | `playground` |
| `site/pages/playEdge` | `vitetranslate-site-edge` | `edge` |
| `site/pages/llmRestaurant` | `vitetranslate-site-llmrestaurant` | `llmrestaurant` |

- `dependencies["@sepoina/vitetranslate"]`: il range della versione della radice (`"^4.6.2-rc.2"` o quella che trovi).
  Lo riscrive comunque `npm run sync:demos` al passo 1.8.
- `playEdge`: togli lo script `link:lib`, non serve più perché il workspace collega già il working tree.
- `playground/package_for_vite7.json` resta com'è: è un esempio per chi usa Vite 7, non un workspace.

### 1.4 Percorsi dentro le pagine spostate

- `site/pages/playground/pluginOnlyForPlayground.js`: `../lib/react/index.js` → `../../../lib/react/index.js`,
  `../lib/index.js` → `../../../lib/index.js`. Aggiorna anche il commento, che dice `../lib`.
- `site/pages/llmRestaurant/vite.config.js`: aggiungi `server.port: 3003`.
- Commenti che citano `playground/vite.config.js` o `playEdge/`: `site/pages/playEdge/vite.config.js` (riga ~41, e
  il commento sulle porte, che parlava dei link fra i due dev server) e `.vscode/settings.json:21`. Aggiorna il percorso
  nel commento.

### 1.5 `siteLinks.js`: un file identico in ogni pagina e nella landing

Il file è copiato, non condiviso: una pagina scaricata da sola non può importare niente da fuori della sua cartella.
Crea `src/siteLinks.js` in `site/landing`, `site/pages/playground`, `site/pages/playEdge` e `site/pages/llmRestaurant`,
con questo contenuto (adatta solo le virgolette al file vicino):

```js
// Dove sta il resto del sito. site/build.mjs, che riunisce landing e pagine per GitHub Pages,
// passa VITE_SITE_ROOT ("/viteTranslate/"). Senza (npm run dev, una build a sé, la cartella
// scaricata da sola) i link portano al sito pubblicato: non c'è un "resto del sito" accanto.
// Copia identica in site/landing e in ogni site/pages/*: una pagina deve restare autonoma.
export const SITE_ROOT = import.meta.env.VITE_SITE_ROOT ?? "https://sepoina.github.io/viteTranslate/";

/** L'indirizzo di una pagina del sito per slug; senza argomento, la landing. */
export const siteUrl = (slug = "") => (slug ? `${SITE_ROOT}${slug}/` : SITE_ROOT);
```

Vite espone a `import.meta.env` le variabili `VITE_*` già presenti in `process.env` quando parte: non serve un `.env`.

### 1.6 Playground: da `edgeUrl.js` a `siteLinks.js`

- Cancella `site/pages/playground/src/edgeUrl.js`.
- `main.jsx`: togli il redirect `?edge` e l'import di `EDGE_URL`. Il redirect passa alla landing (1.7). Resta il solo
  `createRoot(...).render(...)`. Togli anche il commento che spiegava il redirect.
- `TableOfContents.jsx`: `EDGE_URL` → `siteUrl("edge")`. Aggiungi, **prima** della voce "Edge case", una voce uguale
  per forma:

  ```jsx
  <li>
    <a href={siteUrl()} className="toc-group-label">
      <Translate>_%_Tutte le demo_%_</Translate> ↗
    </a>
  </li>
  ```

### 1.7 Edge e llmRestaurant: un link di ritorno

- `playEdge/src/App.jsx`: in cima alla pagina, prima della tabella, un link
  `<a href={siteUrl()}><Translate>_%_← viteTranslate: tutte le demo_%_</Translate></a>`. Mettilo dove c'è già
  l'intestazione e non inventare stili nuovi: la pagina usa Pico.
- `llmRestaurant/src/components/Footer.jsx`: nella riga che già cita librerie e licenze, aggiungi
  `<a href={siteUrl()}><Translate>_%_Le altre demo di viteTranslate_%_</Translate></a>`. Resta un ristorante: il
  link va nel footer e non nell'header.
- Le chiavi nuove si traducono **a mano** in tutte le lingue di ciascuna pagina (edge: 6, llmRestaurant: 5). Lancia
  `npx vitetranslate` nella cartella per creare le chiavi, poi riempi i `null`. Niente run LLM: costa, e sono tre frasi.

### 1.8 `syncDemoDeps` e il lockfile

- `test/syncDemoDeps.mjs` → `demoDirs()`: il filtro `w.startsWith("demo/")` diventa
  `w.startsWith("demo/") || w.startsWith("site/")`. La forma `"site/landing"` (senza `/*`) è già gestita.
- Aggiorna il commento di testa. "Fuori restano playground e playEdge, che dipendono da file:.." non è più vero:
  ora sono dentro. Resta fuori solo `demo/Vite_7/minimal`.
- `npm run sync:demos` poi `npm install` dalla radice. Controlla `npm ls @sepoina/vitetranslate --workspaces`: ogni voce
  deve essere `-> ./` (il link) e **nessuna** deve essere scaricata dal registro.
- `grep -c 'registry.npmjs.org/@sepoina' package-lock.json` deve dare **0**, come dopo `workspaces_demo_vite8.md`.

### 1.9 La landing: `site/landing/`

**`package.json`**: copia la forma di quello di `playEdge`, con `name: "vitetranslate-site-landing"`, senza
`vitetranslateSite` (la landing non è una pagina) e con le stesse versioni di `react`, `vite` e `@vitejs/plugin-react`.
Niente eslint: le altre pagine lo hanno, ma qui non aggiunge nulla.

**`vite.config.js`**:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: "locale",
      sourceLanguage: "it-IT",
      preloadedLanguages: ["en-US"],
    }),
  ],
  // Stesso inciampo di site/pages/playground/vite.config.js: la libreria è un link al
  // repo e, senza dedupe, nel bundle possono finire due React.
  resolve: { dedupe: ["react", "react-dom"] },
  server: { port: 3002 },
});
```

**`index.html`**: `lang="en"`, `<title>viteTranslate</title>`, meta description in inglese (la descrizione del
`package.json` di root), favicon `logo.svg`, Pico da CDN (`https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css`,
lo stesso di llmRestaurant), `<div id="root">` e `<script type="module" src="/src/main.jsx">`.

**`src/main.jsx`**: il redirect dei vecchi URL, poi il render.

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TranslateContainer } from "@sepoina/vitetranslate/react";
import App from "./App.jsx";
import { siteUrl } from "./siteLinks.js";
import "./landing.css";

// Fino alla riorganizzazione del sito la radice era il playground: i link già in giro
// (README vecchi, npm, articoli) portano qui con un'ancora del playground, o con "?edge".
// La landing non usa ancore sue, quindi QUALUNQUE hash appartiene al playground. `replace`
// e non `assign`: il "torna indietro" non deve rimbalzare di nuovo qui.
const { hash, search } = location;
if (new URLSearchParams(search).has("edge")) {
  location.replace(siteUrl("edge"));
} else if (hash) {
  location.replace(siteUrl("playground") + hash);
} else {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <TranslateContainer initialLanguage="en-US">
        <App />
      </TranslateContainer>
    </StrictMode>
  );
}
```

**Vincolo:** la landing non deve usare `href="#…"` né `id` usati come ancore. Scrivilo in un commento in testa ad `App.jsx`.

**`src/pages.js`**: i dati delle card. Solo dati, niente JSX, così il test lo importa in node.

```js
// Una card per pagina del sito. Lo slug deve coincidere con "vitetranslateSite.slug" nel
// package.json della pagina (site/pages/*): lo controlla test/list/site.test.mjs.
export const PAGES = [
  {
    slug: "playground",
    icon: "🎮",
    title: "_%_Playground_%_",
    text: "_%_Il giro completo: installazione, cambio lingua, variabili, markup nelle traduzioni._%_",
    source: "site/pages/playground",
  },
  {
    slug: "edge",
    icon: "🧪",
    title: "_%_Edge case_%_",
    text: "_%_Ogni forma di chiamata e ogni diagnostica, accanto a ciò che dovrebbe rendere._%_",
    source: "site/pages/playEdge",
  },
  {
    slug: "llmrestaurant",
    icon: "⚓",
    title: "_%_Il ristorante tradotto da un LLM_%_",
    text: "_%_Una landing intera, 228 frasi, quattro lingue riempite da `vitetranslate --llm-translate`._%_",
    source: "site/pages/llmRestaurant",
  },
];
```

Le card rendono `title` e `text` con `<Translate t={…} />`, come `Menu.jsx` di llmRestaurant. Se il backtick dentro
`text` dà problemi al marcatore, toglilo: niente workaround.

**`src/App.jsx`**, dall'alto in basso:

1. Header: `logo.svg`, "viteTranslate", e a destra un selettore di lingua con la stessa logica di
   `TopLanguageSwitch.jsx` del playground (`useTranslateLanguage` → `languages`, `proposeNewLanguage`).
2. Hero: una frase (`_%_Estrai i testi da tradurre direttamente dal JSX._%_`) e il blocco
   `npm i @sepoina/vitetranslate` in `<pre><code>`.
3. Griglia di card (`PAGES.map`): icona, titolo, testo, e due link, "Apri" → `siteUrl(slug)` e "Sorgente" →
   `https://github.com/sepoina/viteTranslate/tree/main/${source}`.
4. Footer: GitHub, npm (`https://www.npmjs.com/package/@sepoina/vitetranslate`), e la versione della libreria con
   `version` da `@sepoina/vitetranslate/react`.

**`src/landing.css`**: solo la griglia delle card (`display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: …`)
e l'allineamento dell'header. Tutto il resto lo fa Pico. Lascia il tema chiaro/scuro a Pico: non forzare `data-theme`.

**`public/logo.svg`**: `cp doc/logo.svg site/landing/public/logo.svg`.

**Lingue**: dalla cartella `site/landing`, `npx vitetranslate` (crea `locale/it-IT.yml`), poi
`npx vitetranslate --add en-US zh-CN`, poi riempi i `null` a mano. Per le frasi prese dal playground, riusa le sue
traduzioni.

### 1.10 `site/build.mjs`

Node puro, senza dipendenze. Esporta `sitePages()` per il test; da riga di comando builda.

```js
// Riunisce il sito pubblicato su GitHub Pages: la landing alla radice, ogni pagina di
// site/pages/* nella sottocartella del suo slug. Ogni progetto si builda nella sua cartella,
// da solo, con la sua `base`; qui si copiano i dist uno dentro l'altro.
//
//   node site/build.mjs                          # site/dist per /viteTranslate/
//   node site/build.mjs --root=/altroNome/       # un fork: la CI passa il nome del repo
//   node site/build.mjs --preview                # dopo la build, vite preview su site/dist
//
// Due configurazioni di vitetranslate() nella stessa build non convivono (il modulo virtuale
// delle lingue ha un id unico): per questo sono build separate e non un'app sola con le route.
```

Comportamento, passo per passo:

1. `--root`: default `/viteTranslate/`. Deve iniziare e finire con `/`, altrimenti esci con un errore.
2. `sitePages(radice)`: legge `site/pages/*/package.json` e tiene quelli con `vitetranslateSite.slug`. Restituisce
   `[{ dir, slug }]` ordinati per slug. Lancia un errore se uno slug non rispetta `/^[a-z0-9-]+$/`, se due slug
   coincidono, o se uno slug è una cartella di asset della landing (`assets`).
3. `rmSync("site/dist", { recursive: true, force: true })`.
4. Per la landing (`base = root`) e per ogni pagina (`base = root + slug + "/"`), esegui
   `npm run build -- --base=<base>` con `cwd` = la cartella del progetto, `stdio: "inherit"`,
   `env: { ...process.env, VITE_SITE_ROOT: root }` e `shell: process.platform === "win32"` (su Windows `npm` è un
   `.cmd`). Se lo status non è 0, esci con quello status.
5. Copia `site/landing/dist` in `site/dist` e ogni `<pagina>/dist` in `site/dist/<slug>` (`cpSync(…, { recursive: true })`).
6. Copia `site/dist/index.html` in `site/dist/404.html`: su Pages un URL sbagliato mostra la landing, che lo
   rimanda altrove se porta un'ancora.
7. `--preview`: `npm exec -- vite preview --outDir ../dist --base=<root>` con `cwd: site/landing`. Stampa prima
   l'indirizzo completo (`http://localhost:4173<root>`).

Il main si esegue solo se il file è lanciato direttamente:
`if (import.meta.url === pathToFileURL(process.argv[1]).href) { … }`.

### 1.11 CI: `.github/workflows/publish.yml`, job `deploy-pages`

Tutti gli step fra `Install root deps` e `SPA fallback` diventano:

```yaml
      # Un solo npm install copre libreria, landing e pagine: sono tutti workspace, e il loro
      # "^<versione>" si risolve col link al working tree (vedi test/syncDemoDeps.mjs). Lo
      # "prepare" della radice builda già la libreria; lo step esplicito resta per fallire con
      # un nome leggibile.
      - name: Install deps
        run: npm install

      - name: Build library
        run: npm run build

      # Landing alla radice, ogni pagina di site/pages/* nel suo slug (vedi site/build.mjs).
      - name: Build site
        run: npm run site:build -- --root=/${{ github.event.repository.name }}/
```

E `upload-pages-artifact` → `path: site/dist`. Togli i commenti che parlavano di `playground/dist/edge` e di
`--install-links`.

### 1.12 Test e strumenti che puntano ai vecchi percorsi

- `test/list/languageResource.test.mjs`, `test/list/preloadRule.test.mjs`: `join(ROOT, "playground")` →
  `join(ROOT, "site/pages/playground")`.
- `test/exampleLangCompile.mjs`: default `site/pages/playground/locale`, e il commento.
- `test/list/ssr-check.test.mjs`: il commento "Girato da playground/". Verifica che il test giri ancora (`react-dom`
  sta nella radice).
- Solo commenti, per esattezza: `lib/dev/vite/vitetranslate.js` (~riga 27, "con file:.. (playground/, playEdge/)"
  diventa "con i workspace (site/pages/*)"), `lib/dev/babel/componentScan.js:14`, `launcher/vitetranslate.js:282`,
  `test/list/launcher.test.mjs:206`. **Non** toccare `test/list/logFormat.test.mjs:41`: è una stringa di test, non un
  percorso vero.

Annota in `site_landing.necessarytest.md` il test nuovo del § 2.1.

---

## Fase 2 — Test

### 2.1 Nuovo `test/list/site.test.mjs`

Stesso stile degli altri (`eq`, niente framework, `process.exit`). Controlla:

1. `sitePages()` trova esattamente `edge`, `llmrestaurant`, `playground`.
2. Gli slug di `PAGES` (importato da `site/landing/src/pages.js`) sono **lo stesso insieme** di `sitePages()`.
3. Ogni `PAGES[i].source` esiste ed è la cartella della pagina con quello slug.
4. `sitePages()` lancia su uno slug doppio e su uno slug con maiuscole. Crea le cartelle finte in una tmp
   (`mkdtempSync`) e passala come radice.
5. Ogni `src/siteLinks.js` (landing + 3 pagine) è **byte per byte uguale** agli altri, con le virgolette normalizzate
   prima del confronto. Se sono copie, che restino copie.
6. `demoDirs()` include `site/landing` e le tre pagine.

### 2.2 Verifiche

- `npm test`: tutto verde. Il numero di file sale di 1 rispetto alla Fase 0.
- `node test/syncDemoDeps.mjs --check`: exit 0.
- `node --check site/build.mjs`.

---

## Fase 3 — Build

1. `npm run build` (la libreria).
2. `npm run site:build`. Controlla che esistano `site/dist/index.html`, `site/dist/404.html` e
   `site/dist/{playground,edge,llmrestaurant}/index.html`. In ciascun `index.html`, gli asset devono avere il prefisso
   della propria base (`grep -o 'src="[^"]*"'`).
3. `npm run site:preview` e, nel browser (o con `curl` se non ce n'è uno):
   - `/viteTranslate/`: card visibili, il cambio lingua funziona.
   - Ogni card apre la sua pagina, e le pagine hanno `#root` pieno.
   - `/viteTranslate/#cambio-lingua` porta a `/viteTranslate/playground/#cambio-lingua`.
   - `/viteTranslate/?edge` porta a `/viteTranslate/edge/`.
   - I link "tutte le demo" di playground, edge e ristorante tornano a `/viteTranslate/`.
4. Una pagina da sola: `npm run build -w site/pages/playEdge` (base `/`) deve riuscire. Il suo link di ritorno
   punta a `https://sepoina.github.io/viteTranslate/`.
5. `git status`: nessun `dist/` e nessun `node_modules/` tracciato.

---

## Fase 4 — Review

- Nessun file in `lib/` cambiato, salvo i commenti del § 1.12: `git diff --stat lib/`.
- Cerca i residui: `git grep -nE '(^|[^/])playground/|playEdge/|demo/Vite_8/llmRestaurant'`. Ogni risultato fuori
  da `doc/ImplementationPlans/` è da correggere o da giustificare.
- Il `README.md` sotto i 10000 B (comando in `AGENTS.md`).
- Nessuna chiave `null` rimasta nelle lingue di landing, playground, edge e ristorante: `npx vitetranslate --status`
  in ogni cartella.

---

## Fase 5 — Documentazione

Da portare in `site_landing.necessarydoc.md` durante la Fase 1 ed eseguire qui. Testi in inglese, a eccezione dei
README delle pagine che sono già in italiano (`playEdge`).

| File | Cosa |
| :- | :- |
| `README.md` riga 19 | "Live playground" → `…/viteTranslate/playground/`; aggiungi "Live site" → `…/viteTranslate/` **solo se c'è spazio** |
| `README.md` riga 142 | le tre ancore: `…/viteTranslate/#x` → `…/viteTranslate/playground/#x` (+11 B ciascuna, 33 B in totale: **ricava lo spazio altrove**, per esempio accorciando la riga 238 o la 239) |
| `README.md` righe 238–239 | sorgenti: `site/pages/playground`, `site/pages/playEdge`; valuta di fondere le due righe in una che rimandi al sito |
| `CONTRIBUTING.md` § "Development setup" | nuovi script (`site`, `site:build`, `site:preview`, `restaurant`), workspace sotto `site/` |
| `doc/structure.md` riga ~944 | l'elenco delle cartelle fuori dal pacchetto npm |
| `site/pages/playEdge/README.md` | § "Perché non è una pagina del playground" → "una pagina del sito"; § "In pubblicazione" → `site/build.mjs`; § "Uso" → `npm run edge` e basta (non c'è più `edge:install`); il link `?edge=true` va sulla landing |
| `site/pages/llmRestaurant/README.md` | `../llmTranslate` → `../../../demo/Vite_8/llmTranslate`; aggiungi l'URL live |
| `demo/Vite_8/llmTranslate/README.md`, `demo/Vite_8/minimal/README.md` | link "Live playground" e percorso `playground/` |
| nuovo `site/README.md` | breve: cos'è il sito, come si aggiunge una pagina (cartella + `vitetranslateSite.slug` + card in `pages.js`), `site:build` / `site:preview`, il perché di `VITE_SITE_ROOT` |

---

## Fase 6 — Pulizia

- Rimuovi `site_landing.necessarytest.md` e `site_landing.necessarydoc.md`.
- Se esistono ancora, le cartelle vuote `playground/`, `playEdge/` e `demo/Vite_8/llmRestaurant/` (per esempio con dentro
  solo un `node_modules` orfano) si cancellano.

## Fase 7 — logDiary

Nota `[!TIP]` in testa a questo file, subito sotto la `[!NOTE]`. Se qualcosa è stato rinviato o è rischioso (per esempio
il margine del README), aggiungi una `[!IMPORTANT]`.
