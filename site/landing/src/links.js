export const REPO = "https://github.com/sepoina/viteTranslate";
export const NPM = "https://www.npmjs.com/package/@sepoina/vitetranslate";
export const DOCS = `${REPO}#readme`;
export const INSTALL = "npm i @sepoina/vitetranslate";

/** La cartella di un progetto del repo su GitHub (`source` relativa alla radice, es. "site/pages/playground"). */
export const sourceUrl = (source) => `${REPO}/tree/main/${source}`;

// StackBlitz importa una cartella del repo direttamente da GitHub (stackblitz.com/github/…) e la
// installa da npm: legge il ramo main, cioè il sorgente di adesso, non quello dell'ultima
// pubblicazione del sito. `file` è il file aperto nell'editor: ogni progetto ha il suo src/App.jsx.
/** Il progetto di una cartella del repo aperto su StackBlitz. */
export const stackblitzUrl = (source) =>
  `${sourceUrl(source).replace("https://github.com/", "https://stackblitz.com/github/")}?file=src/App.jsx`;
