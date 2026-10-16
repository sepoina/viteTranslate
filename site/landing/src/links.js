// LINKED-DATA: the same address is REPO in site/theme/SiteBar.jsx (the GitHub icon of the bar).
export const REPO = "https://github.com/sepoina/viteTranslate";
export const NPM = "https://www.npmjs.com/package/@sepoina/vitetranslate";
// Il manuale è un'altra pagina del sito: il suo indirizzo è siteUrl("docs") (siteLinks.js, che non si importa da qui:
// questo file lo legge anche il test in node, e siteLinks.js usa import.meta.env di Vite).
export const INSTALL = "npm i @sepoina/vitetranslate";

// LINKED-DATA: lo stesso video (stesso id) è linkato da README.md, idePlugin/README.md,
// launcher/README.md e dai README delle demo. Video nuovo: si cambia l'id in tutti.
/** Il video "perché viteTranslate": l'id su YouTube e la sua pagina. */
export const VIDEO_ID = "gYj1z3XMv9M";
export const VIDEO_URL = `https://youtu.be/${VIDEO_ID}`;

/** La cartella di un progetto del repo su GitHub (`source` relativa alla radice, es. "site/pages/playground"). */
export const sourceUrl = (source) => `${REPO}/tree/main/${source}`;

// StackBlitz importa una cartella del repo direttamente da GitHub (stackblitz.com/github/…) e la
// installa da npm: legge il ramo main, cioè il sorgente di adesso, non quello dell'ultima
// pubblicazione del sito. `file` è il file aperto nell'editor: ogni progetto ha il suo src/App.jsx.
/** Il progetto di una cartella del repo aperto su StackBlitz. */
export const stackblitzUrl = (source) =>
  `${sourceUrl(source).replace("https://github.com/", "https://stackblitz.com/github/")}?file=src/App.jsx`;
