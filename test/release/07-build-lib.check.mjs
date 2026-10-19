// La build della libreria (npm run build), come il job "build" di publish.yml: senza, npm non pubblica.
import { npm } from "./spawnNpm.mjs";

export const name = "build-lib";
export const description = "the library builds (npm run build, as publish.yml does)";

export async function run({ log = () => {} } = {}) {
  log("npm run build: vendors the ICU parser, then rolldown -c into lib/dist");
  const { status, coda } = await npm(["run", "build"]);
  if (status === 0) return { level: "ok", lines: [] };
  return { level: "ko", lines: ["npm run build failed", ...coda] };
}
