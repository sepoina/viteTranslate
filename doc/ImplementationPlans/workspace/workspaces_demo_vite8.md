# Piano — `demo/Vite_8/*` dentro i workspaces npm del repo

> [!NOTE]
> **Per il revisore umano**
> - **Cosa**: `workspaces` alla radice passa da `["playground", "playEdge"]` a
>   `["playground", "playEdge", "demo/Vite_8/*"]`.
> - **Conseguenza voluta (scelta utente, opzione A)**: i demo risolvono `@sepoina/vitetranslate`
>   dal **repo** — il link `node_modules/@sepoina/vitetranslate -> .` che `playground` crea col suo
>   `file:..` soddisfa anche il `^4.5.0` dei demo. Il tarball npm esce dall'albero: nessuno dei
>   quattro sottoprogetti prova più l'artefatto pubblicato. La nota [!IMPORTANT] di `4_2_0.md`, che
>   diceva l'opposto, viene marcata come superata.
> - **Costo sul lock quasi nullo**: +2 voci (i link `node_modules/vite-react19-js` e
>   `node_modules/vite-react19-llmtranslate`), zero pacchetti nuovi — le dipendenze dei demo erano
>   già nel tree via `playground`/`playEdge`.
> - **Effetti collaterali verificati**: `npm install` dentro una cartella demo opera sull'albero
>   intero (nessun lock locale, aggiorna quello di root); `npm run dev`/`build` dentro la demo
>   trovano ancora i bin, perché npm mette nel PATH il `.bin` di **ogni** antenato.
> - **Nessuna riga della libreria toccata**: runtime byte per byte invariato, `README.md` di root
>   invariato (9.091 B).
> - **Da aggiornare**: la nota di `4_2_0.md` (superata), `CONTRIBUTING.md` § setup e una riga in
>   ciascun README delle due demo.
> - **Verifica**: coerenza del lock, `npm ls`, `npm test` di root, build e dev server della demo
>   `llmTranslate` contro il link locale, `git status` pulito.
> - **Nome del file senza versione**: nessuna versione della libreria è coinvolta.

> [!TIP]
> **Log delle sette fasi**
> - **Implementazione**: una riga — `workspaces` da `["playground","playEdge"]` a
>   `["playground","playEdge","demo/Vite_8/*"]` — più il lock rigenerato: **4 voci nuove**
>   (2 pacchetti workspace + 2 link) e `npm install` che ha aggiunto 128 pacchetti a
>   `node_modules` (erano già nel lock) in 13 s, `prepare`/rolldown verde.
> - **Il lock era anche fermo**: il refresh ha corretto due metadati già presenti in
>   `package.json` da prima — `version` 4.2.4 → 4.5.0 e il peer opzionale `@napi-rs/keyring`.
>   Nessuna versione di dipendenza è cambiata.
> - **Effetto dichiarato, verificato**: `grep registry.npmjs.org/@sepoina package-lock.json` → **0**.
>   I demo girano la libreria del repo (`node_modules/@sepoina/vitetranslate -> ../..`), non il
>   tarball npm.
> - **Test**: `npm ls --workspaces --depth=0` pulito (nessun `UNMET`); build di `llmTranslate`
>   contro il link locale verde (359 ms, **vite 8.2.2** preso dal `.bin` di root); build di
>   `minimal` verde (216 ms); dev server lanciato dalla cartella demo → HTTP 200 e 8 marcatori
>   compilati; `npm test` → **TUTTI OK 52/52 · 1718 asserzioni**.
> - **Revisione**: nessun blocco, ma un **imprevisto** dalla controprova su `minimal`: le sue
>   tabelle erano più vecchie della libreria attuale (una sync rigenerava 2 chiavi e lasciava orfane
>   le traduzioni `en-US`/`zh-CN`). Risolto con la scelta (b) dell'utente, in un commit separato:
>   sync rifatta, traduzioni riportate sui nuovi hash, **`missing key: 0`** per tutte e tre le
>   lingue. La demo nuova non è mai stata coinvolta: 8 chiavi, identiche.
> - **Doc**: la nota [!IMPORTANT] di `4_2_0.md` è marcata superata con data e rimando a questo
>   piano; `CONTRIBUTING.md` spiega che un solo `npm install` copre tutti i workspace; una riga
>   d'uso in ciascuno dei due README delle demo.
> - **Non eseguito**: i job Pages (`npm run playground`, `npm run edge`) richiedono mkcert e una
>   build completa — da rilanciare in CI, dove il passaggio `npm install` alla radice è identico
>   a quello già provato qui.

---

## 1. Contesto e prove già raccolte

`package.json` di root dichiara oggi `workspaces: ["playground", "playEdge"]`; i due dichiarano la
libreria come `file:..`. I sottoprogetti di `demo/Vite_8/` (`minimal`, `llmTranslate`) stanno fuori
dai workspaces e dichiarano il pacchetto pubblicato (`^4.2.0`, `^4.5.0`).

Prove raccolte **prima** di scegliere (npm 11.16.0, struttura reale ricopiata in `/tmp` con i
`package.json` veri e il lock attuale):

| Prova | Comando | Esito |
|---|---|---|
| Il link al repo esiste già nel lock | `grep -A3 '"node_modules/@sepoina/vitetranslate"' package-lock.json` | `{ "resolved": "", "link": true }` (creato dal `file:..` di playground) |
| Con i demo nei workspaces il registry sparisce | `grep -c registry.npmjs.org/@sepoina package-lock.json` | **0** — nessuna copia npm nel tree |
| Nessuna copia annidata per i demo | `grep 'demo/Vite_8/llmTranslate/node_modules' package-lock.json` | nessuna riga |
| Voci nuove nel lock | `diff` delle chiavi `node_modules/*` | solo i 2 link dei workspace |
| `npm install` in un membro | `cd demo/Vite_8/llmTranslate && npm install --package-lock-only` | nessun lock locale; aggiornato quello di root |
| I bin restano raggiungibili dal membro | `npm run <script>` in un workspace, `printenv PATH` | `/repo/node_modules/.bin` è nel PATH |

## 2. Decisioni

| Domanda | Risposta | Perché |
|---|---|---|
| Forma dei workspaces | **glob `demo/Vite_8/*`** | richiesta: «tutti i sottoprogetti di demo vite_8», presenti e futuri |
| Libreria nei demo | **dal repo** (link implicito di playground) | scelta utente A: niente alias, niente `file:..` esplicito |
| `demo/Vite_7/minimal` | **fuori** | non richiesto, e usa React 18/Vite 7 |
| Note di `4_2_0.md` | **marcate superate**, non riscritte | i piani sono un registro storico: la correzione va datata, non cancellata |
| Script di comodo alla radice (`demo`, `demo:llm`) | **non aggiunti** | non richiesti: `npm run dev -w demo/Vite_8/llmTranslate` c'è già, e lo si documenta |
| `^4.2.0` in `minimal/package.json` | **non toccata** | resta il pavimento giusto per chi copia la cartella e la usa da sola |


---

## 3. Fase 1 — Implementazione

### 3.1 `package.json` di root

```json
"workspaces": [
  "playground",
  "playEdge",
  "demo/Vite_8/*"
],
```

Una riga sola. Nessun altro campo toccato: `version`, `files`, `scripts`, `devDependencies`,
`peerDependencies` restano come sono.

### 3.2 `package-lock.json` di root

Rigenerato con `npm install` dalla radice. Atteso:

- due nuove voci `packages` (`demo/Vite_8/minimal`, `demo/Vite_8/llmTranslate`) e due nuove voci
  link (`node_modules/vite-react19-js`, `node_modules/vite-react19-llmtranslate`);
- **nessuna** voce `registry.npmjs.org/@sepoina/vitetranslate`: il link al repo la sostituisce;
- nessun pacchetto nuovo da scaricare.

Se comparisse una copia npm della libreria (una voce `registry.npmjs.org/@sepoina/...`), la
conclusione della fase 1 sarebbe falsa e si passa alla fase 4.

### 3.3 Nessun altro file di codice

I `package.json` dei demo non si toccano (§ 2). Nessun file di `lib/` si tocca.

## 4. Fase 2 — Test

| # | Comando | Cosa deve dimostrare |
|---|---|---|
| W1 | `npm install` (radice) | albero coerente, `prepare` (build della libreria) verde, nessun conflitto di peer |
| W2 | `npm ls --workspaces --depth=0` | i 4 workspace elencati, nessuna dipendenza `UNMET`/`invalid` |
| W3 | `grep -c 'registry.npmjs.org/@sepoina' package-lock.json` | **0**: i demo non usano più il tarball |
| W4 | `ls -la node_modules/@sepoina/ node_modules/vite-react19-*` | link dei workspace presenti, `@sepoina/vitetranslate -> ..` |
| W5 | `cd demo/Vite_8/llmTranslate && npm run build` | la demo compila **contro la libreria del repo** (link locale, `lib/dist` da `prepare`) |
| W6 | `cd demo/Vite_8/llmTranslate && npm run dev` + `curl` su `/src/App.jsx` | i bin hoistati sono raggiungibili dal membro e i marcatori si compilano |
| W7 | `npm test` (radice) | la suite resta verde: i workspaces non toccano il runtime |
| W8 | `git status --short --untracked-files=all` | solo `package.json`, `package-lock.json` e i file di documentazione previsti |

## 5. Fase 3 — Build

`npm run build` nella radice (già eseguito da `prepare` durante W1) e `npm run build` nella demo
(W5). Atteso: entrambi verdi, con la demo che compila la libreria locale.

## 6. Fase 4 — Revisione

Diventa un `workspaces_demo_vite8.necessaryreview.md` se: compare una copia npm della libreria nel
lock (W3), un peer dep va in conflitto (W2), la demo non compila più contro il link locale (W5), o
la suite di root peggiora (W7). Ogni divergenza va portata come **ask**, non rattoppata.

### Esito: un `necessaryreview` si è aperto e si è chiuso

Nessuna delle quattro condizioni si è verificata. Ne è emersa una quinta, dalla controprova
W5-bis (`npm run build` dentro `demo/Vite_8/minimal`, per provare anche il secondo membro): le
tabelle di `minimal` erano più vecchie del comportamento attuale della libreria, e una sync
qualunque rigenerava due chiavi, lasciando orfane le traduzioni `en-US`/`zh-CN` di quei due testi.

**Risolto, con la scelta (b) dell'utente**, in un commit separato da quello dei workspaces: sync
rifatta, le due traduzioni riportate sui nuovi hash (`App_1u2wczc`, `App_1vgk6pt`), `missing key: 0`
di nuovo per tutte e tre le lingue, build verde e "all ok!". Le chiavi in repo sono ora allineate al
comportamento attuale della libreria.

## 7. Fase 5 — Documentazione

1. `doc/ImplementationPlans/4_2_0.md` — dentro il [!IMPORTANT] di § Punto 6, una riga datata che
   dichiara la nota superata e rimanda a questo piano.
2. `CONTRIBUTING.md` — nel § Development setup: `npm install` copre **tutti** i workspace, demo
   comprese, e si indica come si avvia una demo (`npm run dev -w demo/Vite_8/llmTranslate`).
3. `demo/Vite_8/minimal/README.md` e `demo/Vite_8/llmTranslate/README.md` — una riga nella sezione
   d'uso: la cartella è un workspace del repo, quindi da qui `npm install` installa l'albero intero.
4. Nessun tocco a `README.md` di root, a `doc/structure.md` (la sua raccomandazione sull'artefatto
   registry resta valida come consiglio, ed è il motivo per cui la nota di 4_2_0 non si cancella).

## 8. Fase 6 — Pulizia

- Rimossi: il `workspaces_demo_vite8.necessaryreview.md` (l'ask è chiuso in § 6) e i due backup
  `locale/*.bak-erased-*` lasciati dalla sync di `minimal` (file di lavoro, già ignorati da git).
- Cancellate le cartelle di prova in `/tmp` (`/tmp/wstest`, `/tmp/ws2`, `/tmp/ws3`, `/tmp/wsbin`).
- La `node_modules` della cartella `minimal` (avanzo di un vecchio install standalone) non è
  versionata: si lascia com'è.

## 9. Fase 7 — logDiary

Nota `> [!TIP]` sotto quella per il revisore, con: numero di voci aggiunte al lock, esito di W1-W8
e l'effetto semantico dichiarato (i demo non provano più il tarball).
