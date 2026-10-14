// Il tema del sito: ogni progetto ha la sua copia identica di site/theme (npm run site:theme la riallinea).
import { checkTheme } from "../../site/syncTheme.mjs";

export const name = "theme";
export const description = "every project has an identical copy of site/theme";

export async function run({ log = () => {} } = {}) {
  log("comparing site/theme with the copy in each project (src/theme)");
  const diffs = checkTheme();
  return diffs.length ? { level: "ko", lines: ["theme copies out of date: run npm run site:theme", ...diffs] } : { level: "ok", lines: [] };
}
