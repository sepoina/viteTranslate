import { Trans } from "@sepoina/vitetranslate/react";
import SiteBar from "../theme/SiteBar.jsx";

// The site bar (src/theme/SiteBar.jsx): this page is one of the demos.
export default function TopBar() {
  return <SiteBar current="demos" section={{ id: "playground", label: <Trans>_%_Playground_%_</Trans> }} />;
}
