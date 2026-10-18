import { Trans } from "@sepoina/vitetranslate/react";
import { siteUrl } from "../siteLinks.js";

// I nomi delle pagine del sito: nomi propri, non si traducono.
const NAMES = { playground: "Playground", edge: "Edge cases", llmrestaurant: "LLM restaurant" };

// Una scheda che porta a una pagina viva del sito (opzionalmente a un'ancora).
export default function Demo({ page, anchor }) {
  return (
    <a className="card d-demo" href={`${siteUrl(page)}${anchor ? `#${anchor}` : ""}`}>
      <span className="d-demo-name" translate="no">
        {NAMES[page] ?? page}
      </span>
      <span className="d-demo-go">
        <Trans>_%_Open live_%_</Trans> <span aria-hidden="true">↗</span>
      </span>
    </a>
  );
}
