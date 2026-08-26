# viteTranslate — edge case

Una tabella sola, un caso per riga: cosa scrive chi programma, cosa rende `<Translate>`,
cosa dovrebbe rendere. Serve a fissare per iscritto i comportamenti di confine — marcatori
malformati, `%s` senza argomento, markup incrociato, valori che testo non sono — dove la
documentazione a prosa diventa vaga e i test unitari non si guardano.

**Live:** [sepoina.github.io/viteTranslate/edge/](https://sepoina.github.io/viteTranslate/edge/)
(dal playground: voce «Edge case» nell'indice, oppure `?edge=true` sull'indirizzo del playground)

I casi stanno tutti in [`src/testCases.jsx`](src/testCases.jsx), come quaterne
`[titolo, elemento, atteso, sorgente]`. Il quarto elemento — il sorgente mostrato passando
sopra l'icona `</>` — è scritto a mano e non ricavato dall'elemento: quando l'elemento arriva
alla tabella il transform ha già riscritto i marcatori, e ricostruirlo da lì vorrebbe dire
raccontare il primo meccanismo fidandosi del secondo.

## Perché non è una pagina del playground

Il playground e questa pagina sono due app Vite distinte, e devono restarlo: il modulo
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

In pubblicazione le due build si ricongiungono: il `dist` di questa cartella viene copiato in
`dist/edge/` del playground (vedi
[`.github/workflows/deploy-playground.yml`](../.github/workflows/deploy-playground.yml)).

## Uso

Dalla radice del repo:

```bash
npm run build          # la libreria
npm run edge:install   # dipendenze + working tree della libreria al posto di quella npm
npm run edge           # dev server sulla 3001
npm run edge:build     # build di produzione
```

`npm run edge:install` fa due cose: `npm install` normale, poi
`npm install .. --install-links --no-save`, che mette il working tree della libreria in
`node_modules` **senza toccare `package.json`**. Il file continua a dichiarare la versione
npm, così la cartella resta importabile su StackBlitz così com'è, ed è la stessa coppia di
comandi che gira in CI.

Con entrambi i dev server accesi (`npm run playground` sulla 3000, `npm run edge` sulla 3001)
i link fra le due pagine funzionano.

## Warning attesi

Due, e non vanno «sistemati»: sono i casi che la tabella descrive.

```text
[vitetranslate] nested markers in "src/testCases.jsx": "uno_%_ e _%_due" was read as a single text.
[vitetranslate] mis-nested markup: </b> closes across <i> in "<b>x <i>y</b> z</i>".
```

## Il resto

- **Libreria** — [github.com/sepoina/viteTranslate](https://github.com/sepoina/viteTranslate), con l'[architettura](../doc/structure.md)
- **Playground** — [sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/)
- **npm** — [@sepoina/vitetranslate](https://www.npmjs.com/package/@sepoina/vitetranslate)
