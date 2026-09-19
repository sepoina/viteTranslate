// Dove sta il resto del sito. site/build.mjs, che riunisce landing e pagine per GitHub Pages,
// passa VITE_SITE_ROOT ('/viteTranslate/'). Senza (npm run dev, una build a sé, la cartella
// scaricata da sola) i link portano al sito pubblicato: non c'è un 'resto del sito' accanto.
// Copia identica in site/landing e in ogni site/pages/*: una pagina deve restare autonoma.
export const SITE_ROOT = import.meta.env.VITE_SITE_ROOT ?? 'https://sepoina.github.io/viteTranslate/';

/** L'indirizzo di una pagina del sito per slug; senza argomento, la landing. */
export const siteUrl = (slug = '') => (slug ? `${SITE_ROOT}${slug}/` : SITE_ROOT);
