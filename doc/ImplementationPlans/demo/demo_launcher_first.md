# Piano — la demo `llmTranslate` guidata dal launcher `vitetranslate`

> [!NOTE]
> **Per il revisore umano**
> - **Cosa**: `demo/Vite_8/llmTranslate` diventa *launcher-first*. L'help (il README) parte da
>   `npm i -g vitetranslate`, e gli script CLI nel suo `package.json` spariscono: restano `dev`,
>   `build`, `lint`, `preview`, che sono il lato Vite.
> - **Scelta utente (opzione 3)**: si aggiorna anche la frase on-screen di `App.jsx` — quella che
>   nomina il comando — e la prosa del README di `minimal` che cita `vtranslate-cli`.
> - **Conseguenza dichiarata**: la frase marcata cambia, quindi **la sua chiave si rigenera**
>   (`App_1qeyda3` → un hash nuovo) e le quattro tabelle della demo si riscrivono. I tre target
>   sono a `null`: nessuna traduzione persa, nessuno orfano.
> - **Verificato prima di scrivere**: il launcher è `vitetranslate@2.0.0` su npm; da dentro la demo
>   `npx vitetranslate --version` risponde `vitetranslate 2.0.0 (launcher)` +
>   `@sepoina/vitetranslate 4.5.0 (vtranslate-cli) <path>` — trova la copia nel `node_modules` di
>   root, via il link del workspace — e `vitetranslate --status` passa le opzioni alla CLI del
>   progetto.
> - **Fuori perimetro**: `README.md` di root, `doc/cli.md`, `doc/llm.md` e `launcher/` non si
>   toccano. Il launcher ha già il suo README.
> - **Verifica**: `--status` e `--translate --dry-run` **attraverso il launcher**, build della demo
>   verde e senza cambi di chiave, lint a 0, link relativi dei due README risolti.
> - **Nome senza versione**: nessuna riga di libreria cambia.

> [!TIP]
> **Log delle sette fasi**
> - **Implementazione**: `package.json` della demo senza i quattro script CLI (restano `dev`,
>   `build`, `lint`, `preview`); README riscritto launcher-first — 89 righe prima, 95 dopo,
>   **4.795 → 5.447 B**: spariscono la tabella degli script npm e la lista di quattro passi,
>   entrano cos'è-il-launcher, `--version`/`--help` e la riga sul launcher tra i link.
>   Allineati anche la frase on-screen di `App.jsx`, il commento in `vite.config.js` e la prosa
>   del README di `minimal`.
> - **Chiave rigenerata, come dichiarato**: `App_1qeyda3` → **`App_14ifuwo`** (1 aggiunta, 1
>   rimossa sul sorgente); i tre target restano a 8 `null`, `it-IT` pieno. Nessun orfano: qui non
>   c'erano traduzioni da recuperare.
> - **Test**: L1 → script = solo i quattro Vite · L2 `vitetranslate --status` exit 0 (8 chiavi, 3
>   incomplete) · L3 `--llm-status` → `API key: not found` · L4 `--dry-run` con chiave finta → 24
>   chiavi, 3 richieste, ≈ **$0.0024**, nessun `locale/.llm/` · L5 `--version` → launcher **2.0.0** +
>   copia **4.5.0** risolta dal `node_modules` di root · L6 tabelle 8/8/8/8 · L7 build **197 ms**,
>   "no changes detected" · L8 lint 0 · L9 4 link per README, 0 rotti, README di root ancora 9.091 B.
> - **Revisione**: nessun `.necessaryreview` — il launcher ha trovato la copia del progetto in ogni
>   prova, anche senza `node_modules` locale (workspace).
> - **Pulizia**: `dist/` stantii delle due demo rimossi, `/tmp` ripulito.
> - **Resta all'utente**: una passata con modello e chiave veri, e il commit di questo giro.

---

## 1. Contesto

Il launcher (`launcher/`, pubblicato come `vitetranslate@2.0.0`) non fa altro che trovare
`@sepoina/vitetranslate` nel progetto corrente — `./node_modules`, poi ogni cartella sopra, come fa
Node — e lanciare **quella** copia con le opzioni ricevute. Ha due flag suoi: `--version` (dice
quale copia lancerebbe e dove sta) e `--help` (l'help del progetto). Tutto il resto passa diretto.

Oggi la demo fa il contrario: il suo `package.json` espone quattro script che chiamano
`vtranslate-cli` a mano, e il README insegna quelli. Il wrapper resta invisibile, e il lettore
impara un comando diverso da quello che userebbe in un progetto vero.

| Dove il comando compare oggi | Cosa dice |
|---|---|
| `package.json` | `translate`, `translate:dry`, `translate:yes`, `llm:status` → `vtranslate-cli …` |
| `README.md` | quick start e tabella comandi sugli script npm; `npx vtranslate-cli --add fr-FR` in prosa |
| `src/App.jsx` | la frase marcata `…quando lanci npx vtranslate-cli --translate…` |
| `vite.config.js` | commento: «legge solo la CLI (`vtranslate-cli --translate`)» |
| `README.md` di `minimal` | prosa: «The `vtranslate-cli` command is still there for …» |

## 2. Decisioni

| Domanda | Risposta | Perché |
|---|---|---|
| Esempio primario | `npm i -g vitetranslate`, poi `vitetranslate <flag>` | richiesta: l'installazione globale del launcher |
| Installazione globale obbligatoria? | no: il README cita `npx vitetranslate` in una riga | non si obbliga nessuno a installare qualcosa di globale per provare una demo |
| Script npm CLI | **rimossi** dal `package.json` | richiesta: la CLI non deve avere una seconda porta d'ingresso nella demo |
| `dev`/`build`/`lint`/`preview` | restano | non sono CLI: sono Vite, e la demo ne ha bisogno |
| Frase on-screen | aggiornata a `vitetranslate --translate` | opzione 3, e senza di lei la pagina contraddirebbe il README |
| Altre stringhe marcate | **non toccate** | «La CLI stima il costo…» resta vera e generica: cambiarla sarebbe churn di chiavi per niente |
| README di `minimal` | prosa allineata al launcher | opzione 3 |
| Commento in `vite.config.js` | allineato al launcher | un commento che nomina un comando che la demo non usa più è una trappola |
| `dist/` delle due demo | rimossi prima di ricostruire | contengono le stringhe vecchie: artefatti stantii, già ignorati da git |
| Piano `demo_llmTranslate.md` | una riga datata che rinvia a questo piano | registro storico: si annota, non si riscrive |
| Commit | **uno solo**, per questa modifica | un concern solo: «la demo passa al launcher» |


---

## 3. Fase 1 — Implementazione

### 3.1 `demo/Vite_8/llmTranslate/package.json`

`scripts` diventa esattamente:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

Nient'altro cambia (dipendenze, `name`, `private`, `type`).

### 3.2 `demo/Vite_8/llmTranslate/README.md`

Struttura nuova, più corta di una sezione (quick start e tabella comandi assorbono «What the flow
looks like»), con il launcher in testa:

```bash
npm install
cp .env.example .env.local     # paste your key after the `=`
npm i -g vitetranslate         # the command, installed once, for every project
vitetranslate --translate      # estimate first, then it asks before spending anything
npm run dev                    # the 🔸 in front of every sentence is gone
```

Seguito da tre righe che spiegano cos'è il launcher (trova la copia del progetto e lancia quella;
`npx vitetranslate` funziona senza installazione globale) e dalla nota sul workspace già presente.

Tabella comandi, tutta dal launcher tranne la riga Vite:

| Command | Does |
| :- | :- |
| `vitetranslate --translate` | Sync, estimate, ask, fill the `null`s |
| `vitetranslate --translate --dry-run` | Print the estimate and stop — nothing sent, nothing written |
| `vitetranslate --translate --yes` | Same, no prompt (CI, scripts) |
| `vitetranslate --llm-status` | Connection, where the key was found, abstract age, today's spend — no network |
| `npm run dev` · `build` · `lint` · `preview` | The Vite side, untouched |

Più le due righe di sempre su `--dry-run`/`--llm-status` e la chiave, con l'aggiunta di
`vitetranslate --version` (`which copy of the library it would run`) e `vitetranslate --help`
(the project's own help).

Ordine delle sezioni: **titolo → intro → quick start → cos'è il launcher → appartiene ai workspaces →
Commands → What the flow looks like → What the model is not allowed to write → Where things land →
Another model, or none at all → Where to find the rest → StackBlitz**. Nelle sezioni restanti,
`npx vtranslate-cli --add fr-FR` diventa `vitetranslate --add fr-FR`, e il `npm run translate` finale
diventa `vitetranslate --translate`. In «Where to find the rest» si aggiunge la riga del launcher
(`https://www.npmjs.com/package/vitetranslate`).

### 3.3 `demo/Vite_8/llmTranslate/src/App.jsx`

Una sola riga dentro la frase marcata:

```
- npx vtranslate-cli --translate, e prima di spendere qualsiasi cosa ti
+ vitetranslate --translate, e prima di spendere qualsiasi cosa ti
```

È l'unica stringa marcata che nomina il comando: le altre restano come sono (e con loro le chiavi).

### 3.4 `demo/Vite_8/llmTranslate/vite.config.js`

Solo il commento:

```
- // legge solo la CLI (`vtranslate-cli --translate`), mai `vite dev` e mai la build.
+ // legge solo il comando (`vitetranslate --translate`, da terminale), mai `vite dev` e mai la build.
```

### 3.5 `demo/Vite_8/minimal/README.md`

La frase in prosa diventa: i comandi che non sono sync (`--add`, `--status`, `--migrate`) si
chiamano col launcher `vitetranslate`, che lancia la copia della CLI installata nel progetto
(`npm i -g vitetranslate`, poi `vitetranslate --status`), con il link a npm.

### 3.6 `demo/Vite_8/llmTranslate/locale/*.yml` (rigenerate, non scritte a mano)

Dopo l'edit di `App.jsx`, una sync (col launcher, che è il modo nuovo) riscrive le quattro tabelle:
la chiave della frase cambia, `it-IT` resta pieno, i tre target restano a `null`.

### 3.7 `doc/ImplementationPlans/demo_llmTranslate.md`

Una riga datata nel logDiary: gli script `npm run translate*` lì nominati sono stati rimossi in
questo giro, il comando ora è `vitetranslate …`, vedi questo piano.

## 4. Fase 2 — Test

| # | Comando (da `demo/Vite_8/llmTranslate`) | Cosa deve dimostrare |
|---|---|---|
| L1 | `node -e "console.log(Object.keys(require('./package.json').scripts))"` | restano **solo** `dev`, `build`, `lint`, `preview` |
| L2 | `npx vitetranslate --status` | il launcher pubblicato trova la copia del progetto e passa le opzioni; exit 0 |
| L3 | `npx vitetranslate --llm-status` | `connection: …/openai (gemini-2.5-flash)`, `API key: not found`, `context: not generated yet` |
| L4 | `VITETRANSLATE_API_KEY=dummy npx vitetranslate --translate --dry-run` | stima coi 3 tag e il costo in `$`, nessuna rete, nessun `locale/.llm/` |
| L5 | `npx vitetranslate --version` | `vitetranslate 2.0.0 (launcher)` + la copia `4.5.0` risolta dal `node_modules` di root |
| L6 | grep delle tabelle | chiave nuova presente in tutte e 4 le lingue; `it-IT` pieno, 3 target a `null`; 8 chiavi |
| L7 | `npm run build` | verde, e **nessun cambio di chiave** (la sync conferma che le tabelle combaciano) |
| L8 | `npm run lint` | 0 errori, 0 warning (App.jsx editato) |
| L9 | link relativi dei due README + byte del README di root | 0 link rotti; README di root ancora 9.091 B |

## 5. Fase 3 — Build

`npm run build` nella demo (L7) e `npm run build` nella radice, per la libreria. La build della
demo è anche la prova che le tabelle rigenerate combaciano con i marcatori dei sorgenti.

## 6. Fase 4 — Revisione

Nessun `.necessaryreview` previsto: se il launcher non trovasse la copia della libreria dentro il
repo (L2/L5), o se la build trovasse cambi di chiave dopo la sync (L7), si aprirebbe il documento e
si porterebbe la contraddizione come **ask**.

## 7. Fase 5 — Documentazione

Questa modifica **è** documentazione: README della demo, README di `minimal`, commento in
`vite.config.js`, riga datata nel piano precedente. Non si toccano `README.md` di root, `doc/cli.md`,
`doc/llm.md`, `launcher/`.

## 8. Fase 6 — Pulizia

- `dist/` delle due demo rimosso prima della build finale (artefatti stantii con le stringhe
  vecchie, già ignorati da git).
- Nessun `.necessary*` di questo piano.
- `/tmp` pulito dalle prove.

## 9. Fase 7 — logDiary

Nota `> [!TIP]` sotto quella per il revisore: cosa è sparito, cosa è cambiato, l'esito di L1-L9 e la
conseguenza dichiarata sulla chiave rigenerata.
