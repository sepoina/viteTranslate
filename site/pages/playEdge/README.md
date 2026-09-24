# viteTranslate — edge case

Una tabella per categoria, un caso per riga: cosa scrive chi programma, cosa rende `<Translate>`,
cosa dovrebbe rendere. Serve a fissare per iscritto i comportamenti di confine — marcatori
malformati, `%s` senza argomento, markup incrociato, valori che testo non sono — dove la
documentazione a prosa diventa vaga e i test unitari non si guardano.

**Live:** [sepoina.github.io/viteTranslate/edge/](https://sepoina.github.io/viteTranslate/edge/)
(dalla landing [sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/): la card «Edge case», oppure `?edge=true` sull'indirizzo della landing, e dal playground la voce «Edge case» nell'indice)

I casi stanno in [`src/testCases.jsx`](src/testCases.jsx) e [`src/autoWrapCases.jsx`](src/autoWrapCases.jsx):
un oggetto `{ id, title }` apre una categoria, una riga è `[titolo, elemento, atteso, sorgente, stato?]`.
Il formato completo è descritto in testa a [`src/ShowAllRowTests.jsx`](src/ShowAllRowTests.jsx).

- **Stato** — assente per i casi ottimali, `'warn'` se rende ma qualcosa si perde o sorprende,
  `'error'` se esce un mark `‼️`/`🚫` o un errore in console. In pagina ogni categoria mostra
  prima gli ottimali, in fondo gli errori; lo sfondo della riga dice quale dei tre.
- **Sorgente** — il codice mostrato passando sopra `</>`, scritto a mano: quando l'elemento arriva
  alla tabella il transform ha già riscritto i marcatori, e ricostruirlo da lì vorrebbe dire
  raccontare il primo meccanismo fidandosi del secondo.

### Link alle categorie

Ogni categoria ha un'ancora stabile, in inglese e mai tradotta: la documentazione ci punta, quindi
rinominarne una rompe dei link.

| Ancora | Categoria |
| --- | --- |
| `#call-forms` | Forme di chiamata |
| `#markers` | Cosa diventa un marcatore, e cosa no |
| `#percent-s` | Interpolazione `%s` |
| `#icu` | Interpolazione standard ICU |
| `#react-nodes` | Argomenti che sono nodi React |
| `#html` | Dialetto HTML dentro il marcatore |
| `#unmarked` | Testo non marcato e `skipMark` |
| `#not-text` | Valori che testo non sono |
| `#conflicting-props` | Prop incompatibili |
| `#real-text` | Testi veri |
| `#autowrap` | autoWrap: marcatori senza `<Translate>` |

`#note` porta alle note in fondo. Dalla landing, `?edge#icu` arriva allo stesso punto.

## Perché non è una pagina del playground

È una pagina del sito (`site/pages/`, vedi [`site/README.md`](../../README.md)) a sé. Il playground e questa pagina sono due app Vite distinte, e devono restarlo: il modulo
virtuale delle lingue ha un id unico, quindi **due configurazioni di `vitetranslate()` nella
stessa build non convivono**. Qui servono impostazioni che al playground non servono e
viceversa:

| | playground | edge case |
| --- | --- | --- |
| `errorSolve.mark` | i default | tutti e cinque accesi |
| `markOnlyDev` | il default (`true`) | `false`: i mark restano anche in build |
| lingua iniziale | `en-US` | `it-IT`, la sorgente |
| tabelle di lingua | i testi del playground | i casi limite, marcatori rotti compresi |

Se i casi limite finissero nella `localeDir` del playground, le sue tabelle si porterebbero
dietro marcatori deliberatamente malformati e un warning di sync a ogni build.

In pubblicazione le build si ricongiungono: [`site/build.mjs`](../../build.mjs) builda la landing e ogni
pagina con la sua `base` e copia il `dist` di questa cartella in `site/dist/edge/` (vedi
[`.github/workflows/publish.yml`](../../../.github/workflows/publish.yml), job `deploy-pages`).

## Uso

Dalla radice del repo:

```bash
npm install            # una volta sola: la cartella è un workspace, la libreria è il working tree
npm run build          # la libreria
npm run dev -w site/pages/playEdge   # dev server sulla 3001
```

`package.json` dichiara la versione npm (`"^<versione>"`, la riallinea `npm run sync:demos`),
così la cartella resta importabile su StackBlitz così com'è; nel repo il workspace la collega
al working tree. Il link «tutte le demo» in cima porta al sito pubblicato; con `npm run site:preview`
si vede il sito completo in locale.

## Warning attesi

Tutti voluti, e non vanno «sistemati»: sono i casi che la tabella descrive — marcatori annidati o
spezzati, markup incrociato, la `key` marcata, i casi ICU con l'apostrofo o con `%s` e `{0}`
insieme. L'elenco completo: `npx vitetranslate --status` dentro questa cartella.

## Il resto

- **Libreria** — [github.com/sepoina/viteTranslate](https://github.com/sepoina/viteTranslate), con l'[architettura](../doc/structure.md)
- **Tutte le demo** — [sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/)
- **npm** — [@sepoina/vitetranslate](https://www.npmjs.com/package/@sepoina/vitetranslate)
