// Il peso del README.md secondo AGENTS.md ("REGOLE DI DOCUMENTAZIONE"): conta il testo che si legge,
// non i <details>, i commenti HTML e gli indirizzi dei link. Fino a 10 kB ok; fino al 10 % oltre è
// trascurato (warn); oltre, KO (si comprime: "REGOLE DI COMPRESSIONE").
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "../..");
const LIMITE = 10 * 1024;
const TOLLERANZA = Math.round(LIMITE * 1.1);

export const name = "readme";
export const description = "README.md weight, by the AGENTS.md rule (10 kB, 10 % tolerance)";

/** I byte che contano di un README (la stessa formula dello snippet di AGENTS.md). */
export function readmeBytes(testo) {
  const s = testo
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<details[\s\S]*?<\/details>/gi, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/\s(?:href|src)="[^"]*"/gi, "");
  return Buffer.byteLength(s);
}

export async function run({ log = () => {} } = {}) {
  log("counting the text that reads: no <details>, no HTML comments, no link addresses");
  const bytes = readmeBytes(readFileSync(join(RADICE, "README.md"), "utf8"));
  const riga = `README.md: ${bytes} B of ${LIMITE} B`;
  if (bytes <= LIMITE) return { level: "ok", lines: [riga] };
  if (bytes <= TOLLERANZA) return { level: "warn", lines: [`${riga} (over the limit, within the 10 % tolerance)`] };
  return { level: "ko", lines: [`${riga}: compress it (AGENTS.md, REGOLE DI COMPRESSIONE DELLA DOCUMENTAZIONE)`] };
}
