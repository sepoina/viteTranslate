// Il manuale (site/pages/docs): lo compila e lancia le verifiche di site/cli/docsSources.mjs (pagine "stale",
// puntatori DOCS-PAGE, copertura dell'API pubblica, ancore pubblicate, link, TODO(links), traduzione).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileDocs } from "../../site/pages/docs/scripts/compileDocs.mjs";
import { checks } from "../../site/cli/docsSources.mjs";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "../..");

export const name = "docs";
export const description = "the manual compiles, and its eight checks (sources, pointers, coverage, anchors, links)";

export async function run({ log = () => {} } = {}) {
  log("compiling the manual (site/pages/docs/content -> src/generated)");
  try {
    compileDocs();
  } catch {
    // compileDocs ha già stampato gli errori (file:riga): qui basta dire che il manuale non compila.
    return { level: "ko", lines: ["the manual does not compile: node site/pages/docs/scripts/compileDocs.mjs shows why"] };
  }
  log("running the manual's checks");
  const voci = checks(RADICE);
  for (const v of voci) log(`${v.level.toUpperCase().padEnd(4)} ${v.name}`);
  const peggiore = voci.some((v) => v.level === "ko") ? "ko" : voci.some((v) => v.level === "warn") ? "warn" : "ok";
  const nonOk = voci.filter((v) => v.level !== "ok");
  if (!nonOk.length) return { level: "ok", lines: [] };
  // La prima riga va nella tabella (cosa non va, in una riga); sotto, una sezione per verifica non ok.
  const sommario = nonOk.map((v) => `${v.name} (${v.level})`).join(", ");
  return { level: peggiore, lines: [sommario, ...nonOk.flatMap((v) => [`${v.level.toUpperCase()} ${v.name}`, ...v.lines])] };
}
