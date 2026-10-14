// Le versioni di viteTranslate nei package.json delle demo (test/syncDemoDeps.mjs --check).
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "../..");

export const name = "demos";
export const description = "the viteTranslate version in every demo's package.json";

export async function run({ log = () => {} } = {}) {
  log("node test/syncDemoDeps.mjs --check (writes nothing)");
  const r = spawnSync(process.execPath, [join(RADICE, "test/syncDemoDeps.mjs"), "--check"], { cwd: RADICE, encoding: "utf8" });
  if (r.status === 0) return { level: "ok", lines: [] };
  const out = ((r.stdout ?? "") + (r.stderr ?? "")).trim().split("\n");
  return { level: "ko", lines: ["demo dependencies out of date: run npm run sync:demos", ...out] };
}
