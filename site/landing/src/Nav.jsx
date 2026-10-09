import { Trans } from "@sepoina/vitetranslate/react";
import { Icon } from "./icons.jsx";
import { scrollToSection } from "./motion.js";
import { REPO } from "./links.js";
import SiteBar from "./theme/SiteBar.jsx";

// La barra del sito (src/theme/SiteBar.jsx) con il menu delle sezioni e il link a GitHub.
export default function Nav() {
  return (
    <SiteBar
      home={import.meta.env.BASE_URL}
      tools={
        <a className="icon-btn" href={REPO} aria-label="GitHub">
          <Icon name="github" size={16} />
        </a>
      }
    >
      <nav className="bar-nav">
        <button type="button" onClick={() => scrollToSection("features")}>
          <Trans>_%_Funzioni_%_</Trans>
        </button>
        <button type="button" onClick={() => scrollToSection("how")}>
          <Trans>_%_Come funziona_%_</Trans>
        </button>
        <button type="button" onClick={() => scrollToSection("compare")}>
          <Trans>_%_Confronto_%_</Trans>
        </button>
        <button type="button" onClick={() => scrollToSection("demos")}>
          <Trans>_%_Demo_%_</Trans>
        </button>
      </nav>
    </SiteBar>
  );
}
