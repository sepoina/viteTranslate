# Piano — seconda demo: `demo/Vite_8/llmTranslate`

> [!NOTE]
> **Per il revisore umano**
> - **Cosa**: una seconda demo sotto `demo/Vite_8`, accanto a `minimal`, che mette in scena la
>   traduzione automatica introdotta nella 4.5.0 (`vtranslate-cli --translate`).
> - **Scelta dell'utente**: le tre lingue target (`en-US`, `de-DE`, `ja-JP`) nascono **tutte a
>   `null`**. La demo mostra il flusso (stima costi, conferma, validatore, abstract) e si popola
>   quando il lettore lancia `npm run translate` con la propria chiave.
> - **Zero file della libreria toccati**: solo file nuovi dentro `demo/Vite_8/llmTranslate/`,
>   più una riga di richiamo in `doc/llm.md`.
> - **`README.md` di root non si tocca**: è a 9.091 B su 10 kB di budget e non parla mai delle
>   demo; la demo ha il proprio README.
> - **Niente segreti nel repo**: solo `.env.example` col *nome* della variabile; `.env.local` è
>   già ignorato dal `.gitignore` di root.
> - **Niente `.llm/` versionato**: l'abstract di contesto nasce al primo `--translate`.
> - **Verifica prevista**: install, `--add`, `--llm-status`, `--translate --dry-run` con chiave
>   finta (non spedisce niente), `eslint`, `vite build`.
> - **Nome del file senza versione**, apposta: nessuna riga di libreria cambia, quindi non c'è
>   una versione a cui legare questo piano.

> [!TIP]
> **Log delle sette fasi**
> - **Implementazione**: 12 file nuovi in `demo/Vite_8/llmTranslate/` (6 a mano, 4 tabelle generate
>   dalla CLI, `README` + `.env.example`), più una riga di richiamo in `doc/llm.md`. `README.md` di
>   root non toccato (resta 9.091 B).
> - **Test**: `--add en-US de-DE ja-JP` → 8 chiavi per lingua, 8 `null` per target; `--status` 0
>   errori (exit 0); `--llm-status` → `API key: not found` / `context: not generated yet`;
>   `--translate --dry-run` con chiave finta → `24 key(s), 3 request(s)`, ~1.6k in + ~783 out,
>   ≈ **$0.0024**, nessuna richiesta inviata e nessun `locale/.llm/` creato; senza chiave → errore
>   che nomina i tre posti guardati (exit 1); lint 0; dev server: gli 8 marcatori compilati portano
>   gli stessi id dei `locale/*.yml`.
> - **Build**: verde in **222 ms**, nessuna chiave richiesta e nessuna riga `::: llm` — provata su un
>   mirror identico in `/tmp`, perché sull'unità esterna `npm install` è lentissimo e sputa warning
>   `tar`. Il repo resta senza `node_modules`: i `locale/*.yml` sono stati generati nel mirror e
>   ricopiati (un `diff -r` conferma che i file sono gli stessi).
> - **Revisione**: nessun `necessaryreview`, nessun `necessarytest`, nessun `necessarydoc` — il piano
>   non ha incontrato contraddizioni.
> - **Resta all'utente**: `npm install` nella demo, la chiave in `.env.local`, `npm run translate`:
>   è l'unico passo che nessun test può fare al posto suo.

---

## 1. Contesto

`demo/Vite_8/minimal` è la demo «hello world»: Vite 8 + React 19, solo `.jsx`, Pico CSS da CDN,
`<TranslateContainer>` in `main.jsx`, `<Translate>` e `useTranslateLanguage()` in `App.jsx`,
tabelle in `locale/` tenute in sync dal plugin, libreria presa **da npm** (non dal repo).

La 4.5.0 aggiunge il comando `vtranslate-cli --translate`, configurato dal nuovo blocco `llm` in
`vite.config.js`. Tre fatti che vincolano questa demo, letti nei sorgenti (non dedotti):

1. **L'LLM non gira mai nel plugin** (`lib/dev/vite/vitetranslate.js` importa solo
   `llmOptions.js`, che valida e normalizza). L'unico ingresso è la CLI: la demo lo deve dire a
   chiare lettere, altrimenti qualcuno aspetta che `vite dev` traduca da solo.
2. **`--dry-run` risolve comunque la chiave** (`lib/dev/llm/translatePass.js`, righe 89-92 prima
   del ramo `if (dryRun)`): la stima si vede senza spendere, ma con una chiave *presente*.
   `--llm-status` invece funziona anche senza chiave e riporta `API key: not found`.
3. **Markup inline solo nel dialetto HTML, non come figli JSX**: `<Translate>_%_ciao <b>x</b>_%_</Translate>`
   spezza il marcatore (è il caso documentato in `playEdge/src/autoWrapCases.jsx`). Il grassetto va
   scritto in `t="_%_...<b>x</b>_%_"`.

## 2. Decisioni

| Domanda | Risposta | Perché |
|---|---|---|
| Dove | `demo/Vite_8/llmTranslate/` | richiesta dell'utente: seconda demo accanto a `minimal`, stessa riga Vite 8 |
| Lingue | `it-IT` sorgente, `en-US`, `de-DE`, `ja-JP` target **a `null`** | scelta dell'utente nell'ask |
| Modello di default | Gemini 2.5 Flash via endpoint OpenAI-compatibile, con i due prezzi | è l'esempio di `doc/llm.md`, e i prezzi rendono visibile la stima |
| Budget | `"safe"` | default della libreria, 50 chiavi per run: una demo non deve poter spendere |
| Contesto | `mode: "auto"` | l'abstract nasce da solo al primo run, senza comandi in più |
| Chiave | solo `apiKeyEnv: "VITETRANSLATE_API_KEY"` + `.env.example` | `connection.apiKey` non esiste, per progetto |
| Script npm | `translate`, `translate:dry`, `translate:yes`, `llm:status` | un comando per ogni passo del flusso, nessun flag da ricordare |
| `.llm/` nel repo | no | lo crea la CLI al primo run, col suo `.gitignore` dentro |
| Demo gemella in `Vite_7` | no | richiesta dell'utente: la demo vive sotto `Vite_8` |
| `README.md` di root | non si tocca | 9.091 B su 10 kB, e le demo non vi sono mai citate |
| `doc/llm.md` | una riga di richiamo con link alla demo | è la pagina che si legge prima di lanciare il comando |


---

## 3. Fase 1 — Implementazione

Sei file nuovi più le tabelle generate, in `demo/Vite_8/llmTranslate/`.

### 3.1 `package.json`

Gemello di `minimal/package.json`, con `@sepoina/vitetranslate` portato a `^4.5.0` (la versione
che introduce `--translate`; `npm view` conferma `latest = 4.5.0`) e gli script del flusso.

```json
{
  "name": "vite-react19-llmtranslate",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "translate": "vtranslate-cli --translate",
    "translate:dry": "vtranslate-cli --translate --dry-run",
    "translate:yes": "vtranslate-cli --translate --yes",
    "llm:status": "vtranslate-cli --llm-status"
  },
  "dependencies": {
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "@sepoina/vitetranslate": "^4.5.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@rolldown/binding-wasm32-wasi": "^1.2.1",
    "@vitejs/plugin-react": "^6.0.4",
    "eslint": "^10.8.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.3",
    "globals": "^17.8.0",
    "rolldown": "^1.2.1",
    "vite": "^8.1.5"
  }
}
```

`@rolldown/binding-wasm32-wasi` resta perché è ciò che fa girare Vite 8/Rolldown su WebContainer
(StackBlitz), esattamente come in `minimal`.

### 3.2 `vite.config.js`

Base di `minimal` + blocco `llm`. Commenti in italiano, come nel resto delle demo.

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitetranslate } from '@sepoina/vitetranslate';

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: 'locale', // lang dir
      sourceLanguage: 'it-IT', // source Language
      // Come parlare col modello. Nessuna chiamata parte da qui: questo blocco lo legge
      // solo la CLI (`vtranslate-cli --translate`), mai `vite dev` e mai la build.
      llm: {
        connection: {
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', // endpoint OpenAI-compatibile
          model: 'gemini-2.5-flash',
          apiKeyEnv: 'VITETRANSLATE_API_KEY', // il NOME della variabile, mai la chiave
          costMillionInput: 0.3, // $/milione di token, per la stima: o entrambi o nessuno
          costMillionOutput: 2.5,
        },
        budget: 'safe', // 50 chiavi e 20 richieste per run
        context: { mode: 'auto' }, // l'abstract di contesto nasce (e si aggiorna) da solo
      },
    }),
  ],
  server: {
    host: true,
  },
});
```

### 3.3 `.env.example`

```bash
# Copy this file to `.env.local` (already git-ignored) and paste the key.
# The key never goes into vite.config.* — there goes only the NAME of the variable,
# through `llm.connection.apiKeyEnv`.
VITETRANSLATE_API_KEY=
```

### 3.4 `index.html`

Copia di `minimal/index.html` con `<title>` cambiato.

### 3.5 `src/main.jsx`

Copia **verbatim** di `minimal/src/main.jsx` (stesso commento incluso): `<TranslateContainer
initialLanguage="it-IT">` sopra `<App />`.

### 3.6 `src/App.jsx`

Stessa struttura di `minimal` (carosello lingue, `article`, header con versione), con gli stessi
commenti italiani nei punti identici. I testi marcati cambiano, e sono scelti perché mostrino il
lavoro del modello e le regole del validatore:

- una stringa con `<b>` e un `%s` (header, come in `minimal`): il validatore confronta il
  multiset dei tag e il numero di `%s` col sorgente;
- un paragrafo che spiega la scena (tabelle a `null`, la stima prima di spendere);
- una lista ordinata di 4 passi: è contenuto *e* documentazione tradotta;
- una citazione con `<b>` scritto **nel dialetto HTML dentro `t=`**, non come figlio JSX.

Niente `<code>`, niente `<b>` e nessun `%` isolato dentro i `_%_..._%_` dei figli JSX: spezzano il
marcatore. Il testo dei figli è solo testo.

### 3.7 `eslint.config.js`

Copia verbatim di `minimal/eslint.config.js`.

### 3.8 `locale/` (generata, non scritta a mano)

1. `npm install` nella demo (scarica dalla rete: è la stessa cosa che fa `minimal`).
2. `npx vtranslate-cli --add en-US de-DE ja-JP` → crea `locale/it-IT.yml` (sorgente, riempito) e i
   tre file target **con tutte le chiavi a `null`**.

Nessun file di lingua si scrive a mano: le chiavi sono `App_xxxxx` e le calcola la libreria.

### 3.9 `README.md`

Stile di `minimal/README.md`, in inglese (regole di documentazione): cosa mostra la demo, setup
della chiave, tabella dei comandi, dove finiscono abstract e ledger, cosa rifiuta il validatore,

---

## 4. Fase 2 — Test (comandi eseguiti sul campo, nessun file di test nuovo)

Questo piano non tocca la libreria, quindi non aggiunge test alla suite `test/`: la verifica è la
demo che gira. In ordine:

| # | Comando (dentro `demo/Vite_8/llmTranslate`) | Cosa deve dimostrare |
|---|---|---|
| T1 | `npm install` | le peer dependency della 4.5.0 si risolvono da npm, senza altro |
| T2 | `npx vtranslate-cli --add en-US de-DE ja-JP` | i tre file target nascono con le stesse chiavi del sorgente e tutti i valori a `null` |
| T3 | `npx vtranslate-cli --status` | 0 errori, chiavi mancanti contate, exit code 0 |
| T4 | `npx vtranslate-cli --llm-status` | il blocco `llm` è valido: baseURL, modello, `API key: not found`, `context: not generated yet`, `today: 0 key(s)` |
| T5 | `VITETRANSLATE_API_KEY=dummy npx vtranslate-cli --translate --dry-run` | la stima coi tre tag e il costo in `$` dai due prezzi, **senza nessuna chiamata di rete**, e `.llm/` non creato |
| T6 | `npx vtranslate-cli --translate --dry-run` **senza** chiave | errore esplicito che nomina i tre posti guardati (il caso di chi ha dimenticato `.env.local`) |
| T7 | `npm run lint` | 0 warning, 0 errori |
| T8 | `npm run build` | build verde e **nessuna chiave richiesta**: la build sincronizza, non traduce |
| T9 | `git check-ignore -v .env.local` e `git status --short` | `.env.local` ignorato, `.env.example` versionabile, nessun `node_modules` o `dist` in lista |
| T10 | leak check | nessuna chiave dentro `locale/`, `.llm/`, `node_modules/.viteTranslate/llm.json` (T5 non deve lasciare tracce) |

## 5. Fase 3 — Build

`npm run build` (Rolldown). Atteso: verde. La build non deve chiedere la chiave e non deve stampare
righe `::: llm`; se lo facesse sarebbe un difetto della libreria, non della demo, e diventerebbe una
voce di `necessaryreview`.

## 6. Fase 4 — Revisione

Si apre un `demo_llmTranslate.necessaryreview.md` **solo** se: la build fallisce, `--add` produce
file con chiavi diverse dal sorgente, la stima non riporta il costo, o il plugin accetta il blocco
`llm` ma la CLI lo rifiuta (contraddizione col piano → ask all'utente, non patch silenziosa).

## 7. Fase 5 — Documentazione

1. `demo/Vite_8/llmTranslate/README.md` (§ 3.9).
2. Una riga in `doc/llm.md`, sotto il titolo, che punta alla demo runnable.
3. Nessun tocco a `README.md` di root, a `doc/plugin-options.md` (già completo sul blocco `llm`) e
   a `doc/cli.md`.

## 8. Fase 6 — Pulizia

- Rimuovere gli eventuali `demo_llmTranslate.necessarytest.md` / `.necessarydoc.md` /
  `.necessaryreview.md`: questo piano non ne prevede nessuno se tutto passa.
- Nessun file temporaneo lasciato nel repo (lo script di misura del README gira da `/tmp`).
- `demo/Vite_8/llmTranslate/node_modules` e `dist` restano sul disco (già ignorati), non nel commit.

## 9. Fase 7 — logDiary

Nota `> [!TIP]` subito sotto quella per il revisore, con decisioni, numeri dei test e ciò che è
rimasto all'utente (la verifica con modello e chiave veri).

link a `doc/llm.md`, al progetto, al playground e a npm.
