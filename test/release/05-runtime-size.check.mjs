// Il peso del runtime (npm run estimateSize): riscrive site/cli/runtimeSize.json — è voluto, AGENTS.md
// lo chiede a ogni chiusura — e confronta il README. Senza "README: OK" nell'uscita il README è indietro.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "../..");

export const name = "runtime-size";
export const description = "runtime weight (rewrites site/cli/runtimeSize.json) and the figures in README.md";

export async function run({ log = () => {} } = {}) {
  log("node test/estimateSize.mjs: bundles the React runtime and the ICU helpers, minifies, gzips");
  const r = spawnSync(process.execPath, [join(RADICE, "test/estimateSize.mjs")], { cwd: RADICE, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const righe = ((r.stdout ?? "") + (r.stderr ?? "")).trim().split("\n");
  if (r.status === 0 && righe.some((l) => l.trim() === "README: OK")) {
    return { level: "ok", lines: [righe.find((l) => l.includes("total"))?.trim() ?? "README: OK"] };
  }
  const da = righe.findIndex((l) => l.startsWith("README:"));
  return { level: "ko", lines: ["the README does not match the measured runtime size", ...(da >= 0 ? righe.slice(da) : righe.slice(-8))] };
}
