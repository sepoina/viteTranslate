# Sotto-piano 4.6.0 — forma della risposta LLM: prompt esplicito e parser collegato

> [!NOTE]
> **Per il revisore umano**
> - La trace `260918204954` mostra la traduzione del modello **buttata**: DeepSeek ha risposto
>   `{"items":[{"k","t","where"}]}` — la forma del payload, ricopiata — e il run ha riempito 0 chiavi.
> - `readReply.js` (nuovo in rc2) sa leggere quella forma, ma **nessuno lo importa**: `translatePass.js`
>   itera ancora `r.translations` a mano. È codice morto, ed è la ragione per cui il fix non ha effetto.
> - Due difese, entrambe necessarie: **(1)** il prompt `SYSTEM_TRANSLATE` dice esplicitamente la forma
>   piatta d'uscita, con un esempio; **(2)** `readReply` viene collegato in `applyResult`/`applyRepair`.
> - Nuovo test diretto `llmReadReply.test.mjs` (oggi zero copertura) + asserzione d'integrazione nel pass.
> - Nessun impatto sul bundle React: `lib/dev/llm/` è dev-only (guardato da `reactBundleSize.test.mjs`).
> - Chiude il debito dichiarato nella `[!IMPORTANT]` di `llm_tty_panel.md` («prompt e parsing non sono
>   stati toccati»).

> [!TIP]
> **Log delle sette fasi**
> - Nessun ask: il piano in chat è stato approvato così com'era.
> - Implementazione: `readReply` collegato in `applyResult`/`applyRepair` (era codice morto);
>   prima regola di `SYSTEM_TRANSLATE` riscritta con forma piatta ed esempio.
> - Test: nuovo `llmReadReply.test.mjs` (15 asserzioni) + `T84` d'integrazione in
>   `llmTranslatePass.test.mjs` (driver che risponde `{ items: […] }` → riempita).
>   Suite: **55/55 · 1890 → 56/56 · 1909 asserzioni**, tutte verdi.
> - Riprodotta la trace `260918204954`: il payload reale di DeepSeek ora riempie la chiave.
> - Bundle e `estimateSize` invariati: `lib/dev/llm/` è dev-only; nessuna build necessaria.

---

## La richiesta (2026-09-18)

> L'utente osserva la trace `demo/Vite_8/llmTranslate/locale/.llm/260918204954`: «la risposta dall'llm è
> scorretta, il parser non la recepisce, immagino vadano rivisti i prompt della lib per renderli più
> solidi. cosa ne pensi».

## Diagnosi (verificata sui sorgenti)

1. **La risposta del modello non è sbagliata.** Ha tradotto bene, ma ha risposto nella forma del
   payload `{"items":[{"k":"App_7dfaq2","t":"…","where":"App"}]}` invece che piatta
   `{"App_7dfaq2":"…"}`.
2. **`readReply.js` è orfano.** `grep -rn readReply lib/ test/` trova solo la sua definizione:
   `translatePass.js` non lo importa. `applyResult`/`applyRepair` leggono `r.translations` come mappa
   piatta, quindi la chiave `items` finisce fra le `unknown-key` e la traduzione si perde.
3. **Il prompt è ambiguo.** «the same keys you received» — le chiavi che il modello riceve sono
   `items`/`k`/`t`/`where`, non le chiavi di traduzione (che stanno *dentro* `k`). Il modello ha fatto
   ciò che c'era scritto.

## Decisioni

| Tema | Decisione |
| :- | :- |
| Dove si legge la risposta | in un posto solo, `readReply.js`, chiamato da `translatePass` (che ha `batchKeys`); `fetchDriver` resta com'è (parsa già a oggetto per il ramo `translate`) |
| Prompt | regola esplicita: oggetto **piatto**, chiavi = valori di `k`, valori = traduzioni di `t`, con esempio; vietato ricopiare `items`/`k`/`t`/`where` |
| `unknown` | resta contato come prima: `read.unknownKeys` include il nome dell'involucro (es. `items`) fra le sconosciute |
| `conflicts` | una chiave con due valori diversi non si sceglie: `readReply` la scarta, quindi resta `null` (nessun nuovo esito) |
| Scope | niente refactor di `fetchDriver`/`callModel`: non serve a questa trace e romperebbe `T56` |

## File

- `lib/dev/llm/translatePass.js` — import di `readReply`; `applyResult` e `applyRepair` leggono
  `read.translations` / `read.unknownKeys` invece di iterare `r.translations`.
- `lib/dev/llm/prompts.js` — prima regola di `SYSTEM_TRANSLATE` riscritta.
- `test/list/llmReadReply.test.mjs` — nuovo: le forme che `readReply` riconosce.
- `test/list/llmTranslatePass.test.mjs` — `T69`: driver che risponde con `{ items: […] }` → riempita.
- Doc: `doc/structure.md` § Phase 5; `doc/llm.md` se nomina il contratto d'uscita.

---

## Istruzioni per chi implementa

Le sette fasi, in ordine e senza saltarne nessuna. Ogni ambiguità è un **ask**, non una scelta.

### Fase 1 — Implementazione

**1.1 `lib/dev/llm/translatePass.js` — import.**
Dopo `import validateTranslation from "./validateTranslation.js";` aggiungere:

```js
import readReply from "./readReply.js";
```

**1.2 `applyResult`.** Sostituire il ciclo `for (const responseKey of Object.keys(r.translations ?? {}))`
con la lettura via `readReply`, e usare `read.translations[item.key]` come candidato:

```js
const read = readReply(r.translations, batchKeys);
for (const responseKey of read.unknownKeys) {
  outcomes.push({ tag: r.tag, key: responseKey, status: "unknown-key" });
  counts.unknown++;
}
```

…e nel ciclo sulle voci: `const candidate = read.translations[item.key];`.

**1.3 `applyRepair`.** Stessa lettura; `unknown: read.unknownKeys.length` e
`const candidate = read.translations[item.key];`.

**1.4 `lib/dev/llm/prompts.js`.** Prima regola di `SYSTEM_TRANSLATE`: dire che la risposta è **un
oggetto piatto**, che le chiavi sono i valori di `k` e i valori la traduzione di `t`, con un esempio
mini `{"items":[{"k":"App_1a2b3c","t":"Ciao","where":"App"}]}` → `{"App_1a2b3c":"Hello"}`, e il divieto
esplicito di ricopiare `items`/`k`/`t`/`where`. Niente prosa, niente markdown, niente fence.

Test necessari → `llm_reply_shape.necessarytest.md`. Doc → `llm_reply_shape.necessarydoc.md`.

### Fase 2 — Test

Implementare `llm_reply_shape.necessarytest.md`. Verifica rapida, senza build:

```bash
node test/list/llmReadReply.test.mjs
node test/list/llmTranslatePass.test.mjs
```

Poi la suite LLM intera: `node test/run.mjs llm`.

### Fase 3 — Build

Niente build: `lib/dev/llm/` non entra in nessun bundle. Controllo sintattico:
`node --check lib/dev/llm/translatePass.js && node --check lib/dev/llm/prompts.js`.

### Fase 4 — Review

Se il collegamento di `readReply` cambia un comportamento atteso (es. conteggio `unknown`), è un ask,
non una scelta. Annotare in `llm_reply_shape.necessaryreview.md`.

### Fase 5 — Documentazione

Eseguire `llm_reply_shape.necessarydoc.md`.

### Fase 6 — Pulizia

Rimuovere i `llm_reply_shape.necessary*.md` non più necessari.

### Fase 7 — logDiary

Compilare la nota `[!TIP]` in testa a questo file (max ~10 righe).

**Regole di stile**: commenti in italiano, messaggi all'utente in inglese, ogni file di `lib/dev/llm/`
apre col rimando a `doc/structure.md § "Phase 5 — LLM auto-translation"`.
