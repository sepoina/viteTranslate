import { Translate } from "@sepoina/vitetranslate/react";
import SiteBar from "../theme/SiteBar.jsx";
import { siteUrl } from "../siteLinks.js";

// La barra del sito (src/theme/SiteBar.jsx) con il ritorno alla landing.
export default function TopBar() {
  return (
    <SiteBar home={siteUrl()}>
      <a className="bar-back" href={siteUrl()}>
        ← <Translate>_%_Tutte le demo_%_</Translate>
      </a>
    </SiteBar>
  );
}
