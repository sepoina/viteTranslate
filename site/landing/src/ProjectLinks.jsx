import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { sourceUrl, stackblitzUrl } from "./links.js";
import { docsUrl, SITE_ROOT } from "./siteLinks.js";

// I tasti in fondo a ogni card, pagine del sito e demo: il sorgente su GitHub, il progetto su
// StackBlitz (letto da GitHub) e lo zip da scaricare. `source` è la cartella nel repo, `zip` il
// percorso dello zip nel sito pubblicato: lo scrive site/build.mjs in site/dist/zip.
// `manual` ("route#id", pages.js) adds a fourth one, first: the manual's page that explains the project.
export default function ProjectLinks({ source, zip, manual }) {
  const trans = useTrans();
  return (
    <div className="project-links">
      {manual && (
        <a href={docsUrl(manual)} title={trans("_%_La pagina del manuale che lo spiega_%_")}>
          <Trans>_%_Manuale_%_</Trans>
        </a>
      )}
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
