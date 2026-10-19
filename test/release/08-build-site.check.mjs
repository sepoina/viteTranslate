// La build del sito (npm run site:build), come il job "deploy-pages" di publish.yml. Root di default
// (/viteTranslate/): è quella che la CI passa con il nome del repo. Scrive site/dist, che git ignora.
import { npm } from "./spawnNpm.mjs";

export const name = "build-site";
export const description = "the site builds (npm run site:build, as publish.yml does)";

export async function run({ log = () => {} } = {}) {
  log("npm run site:build: the landing and every site/pages/* project, then the zips");
  const { status, coda } = await npm(["run", "site:build"]);
  if (status === 0) return { level: "ok", lines: [] };
  return { level: "ko", lines: ["npm run site:build failed", ...coda] };
}
