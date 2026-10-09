import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { sourceUrl, stackblitzUrl } from "./links.js";
import { SITE_ROOT } from "./siteLinks.js";

// I tre tasti in fondo a ogni card, pagine del sito e demo: il sorgente su GitHub, il progetto su
// StackBlitz (letto da GitHub) e lo zip da scaricare. `source` è la cartella nel repo, `zip` il
// percorso dello zip nel sito pubblicato: lo scrive site/build.mjs in site/dist/zip.
export default function ProjectLinks({ source, zip }) {
  const trans = useTrans();
  return (
    <div className="project-links">
      <a href={sourceUrl(source)}>
        <Trans>_%_Sorgente_%_</Trans>
      </a>
      <a
        href={stackblitzUrl(source)}
        target="_blank"
        rel="noopener"
        title={trans("_%_Il progetto aperto su stackblitz.com: si installa e gira nel browser_%_")}
      >
        StackBlitz
      </a>
      <a href={`${SITE_ROOT}${zip}`} download title={trans("_%_Il progetto da scaricare: npm install, poi npm run dev_%_")}>
        Zip
      </a>
    </div>
  );
}
