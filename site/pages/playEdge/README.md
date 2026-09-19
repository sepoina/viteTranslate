# viteTranslate — edge case

Una tabella sola, un caso per riga: cosa scrive chi programma, cosa rende `<Translate>`,
cosa dovrebbe rendere. Serve a fissare per iscritto i comportamenti di confine — marcatori
malformati, `%s` senza argomento, markup incrociato, valori che testo non sono — dove la
documentazione a prosa diventa vaga e i test unitari non si guardano.

**Live:** [sepoina.github.io/viteTranslate/edge/](https://sepoina.github.io/viteTranslate/edge/)
(dalla landing [sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/): la card «Edge case», oppure `?edge=true` sull'indirizzo della landing, e dal playground la voce «Edge case» nell'indice)

I casi stanno tutti in [`src/testCases.jsx`](src/testCases.jsx), come quaterne
`[titolo, elemento, atteso, sorgente]`. Il quarto elemento — il sorgente mostrato passando
sopra l'icona `</>` — è scritto a mano e non ricavato dall'elemento: quando l'elemento arriva
alla tabella il transform ha già riscritto i marcatori, e ricostruirlo da lì vorrebbe dire
raccontare il primo meccanismo fidandosi del secondo.

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

Due, e non vanno «sistemati»: sono i casi che la tabella descrive.

```text
[vitetranslate] nested markers in "src/testCases.jsx": "uno_%_ e _%_due" was read as a single text.
[vitetranslate] mis-nested markup: </b> closes across <i> in "<b>x <i>y</b> z</i>".
```

## Il resto

- **Libreria** — [github.com/sepoina/viteTranslate](https://github.com/sepoina/viteTranslate), con l'[architettura](../doc/structure.md)
- **Tutte le demo** — [sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/)
- **npm** — [@sepoina/vitetranslate](https://www.npmjs.com/package/@sepoina/vitetranslate)
