// Il tema del sito: ogni progetto ha la sua copia identica di site/theme (npm run site:theme la riallinea),
// e la favicon in site/theme è quella che danno tokens.css e il glifo (npm run site:favicon la rigenera).
import { checkTheme } from "../../site/cli/syncTheme.mjs";
import { checkFavicon } from "../../site/cli/favicon.mjs";

export const name = "theme";
export const description = "every project has an identical copy of site/theme, favicon up to date";

export async function run({ log = () => {} } = {}) {
  log("comparing site/theme with the copy in each project (src/theme)");
  const diffs = checkTheme();
  log("redrawing the favicon from tokens.css");
  const stale = await checkFavicon();
  const lines = [
    ...(stale.length ? ["favicon out of date: run npm run site:favicon", ...stale] : []),
    ...(diffs.length ? ["theme copies out of date: run npm run site:theme", ...diffs] : []),
  ];
  return { level: lines.length ? "ko" : "ok", lines };
}
