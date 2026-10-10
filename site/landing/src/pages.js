// Una card per pagina del sito. Lo slug deve coincidere con "vitetranslateSite.slug" nel
// package.json della pagina (site/pages/*): lo controlla test/list/site.test.mjs.
// `preview` è uno screenshot in public/previews/, catturato dalla pagina buildata (1280x800 o simili, poi 960x600).
export const PAGES = [
  {
    slug: "playground",
    preview: "previews/playground.webp",
    title: "_%_Playground_%_",
    text: "_%_Il giro completo, dal vivo: variabili e markup, plurali e date ICU, autoWrap, fino alla traduzione con un LLM._%_",
    source: "site/pages/playground",
  },
  {
    slug: "edge",
    preview: "previews/edge.webp",
    title: "_%_Edge case_%_",
    text: "_%_Ogni forma di chiamata e ogni diagnostica, accanto a ciò che dovrebbe rendere._%_",
    source: "site/pages/playEdge",
  },
  {
    slug: "llmrestaurant",
    preview: "previews/llmrestaurant.webp",
    title: "_%_Il ristorante tradotto da un LLM_%_",
    text: "_%_Una landing intera, 228 frasi, quattro lingue riempite da <code>vitetranslate --llm-translate</code>._%_",
    source: "site/pages/llmRestaurant",
  },
];

// Una card per demo di demo/: progetti minimi senza una pagina nel sito, quindi la card li apre su
// StackBlitz. `source` è la cartella della demo (ognuna deve avere la sua card: lo controlla
// test/list/site.test.mjs); `slug` dà il nome allo zip, che site/build.mjs scrive in zip/demo/<slug>.zip.
// `stack` e `glyph` sono dati, non si traducono: `glyph` è il simbolo Unicode (mai un emoji) che fa
// da fondale alla card e dice il contenuto della demo. La versione di Vite, che colora il fondo,
// Starters.jsx la legge dalla cartella (demo/Vite_N).
// LINKED-DATA: README.md, passo 6 del Quick start, linka zip e StackBlitz di vite8-quick-app.
export const DEMOS = [
  {
    slug: "vite8-quick-app",
    stack: "Vite 8 · React 19",
    glyph: "↯",
    title: "_%_Il quick start, finito_%_",
    text: "_%_Il risultato dei sei passi del README: una frase, l'inglese come sorgente, il francese tradotto a mano._%_",
    source: "demo/Vite_8/quickApp",
  },
  {
    slug: "vite8-minimal",
    stack: "Vite 8 · React 19",
    glyph: "¶",
    title: "_%_Minimale_%_",
    text: "_%_Il setup più piccolo: tre lingue, niente TypeScript e il cambio lingua con <code>useTransLanguage()</code>._%_",
    source: "demo/Vite_8/minimal",
  },
  {
    slug: "vite8-custom-markers",
    stack: "Vite 8 · React 19",
    glyph: "≼",
    title: "_%_Delimitatori tuoi_%_",
    text: "_%_La stessa app con le frasi marcate <code>≼così≽</code>: autoWrap fa il resto, senza un <code>Trans</code> attorno._%_",
    source: "demo/Vite_8/customMarkers",
  },
  {
    slug: "vite8-llm-translate",
    stack: "Vite 8 · React 19",
    glyph: "✦",
    title: "_%_Tradotta da un LLM_%_",
    text: "_%_L'italiano scritto nel codice, le altre quattro lingue riempite da un modello con <code>--llm-translate</code>._%_",
    source: "demo/Vite_8/llmTranslate",
  },
  {
    slug: "vite7-minimal",
    stack: "Vite 7 · React 18",
    glyph: "¶",
    title: "_%_Minimale su Vite 7_%_",
    text: "_%_La stessa app minimale sulla coppia più diffusa nei progetti esistenti: il minimo che la libreria supporta._%_",
    source: "demo/Vite_7/minimal",
  },
];
