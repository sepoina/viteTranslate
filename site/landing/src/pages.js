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
