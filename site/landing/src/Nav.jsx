import { Translate } from "@sepoina/vitetranslate/react";
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
          <Translate>_%_Funzioni_%_</Translate>
        </button>
        <button type="button" onClick={() => scrollToSection("how")}>
          <Translate>_%_Come funziona_%_</Translate>
        </button>
        <button type="button" onClick={() => scrollToSection("compare")}>
          <Translate>_%_Confronto_%_</Translate>
        </button>
        <button type="button" onClick={() => scrollToSection("demos")}>
          <Translate>_%_Demo_%_</Translate>
        </button>
      </nav>
    </SiteBar>
  );
}
