// Il peso "al massimo" del runtime client: solo la parte React (lib/react/index.js), bundlata
// e minificata esattamente come lo farebbe l'app di chi usa la libreria — stesso bundler
// (rolldown), stessi external (react/react-dom restano fuori, sono peerDependencies), stesso
// passaggio Babel sui file .jsx di rolldown.config.js — poi compressa con gzip.
//
// "Al massimo" perché qui non c'è nessun'app reale a fare tree-shaking incrociato sulle
// esportazioni che quell'app non usa: un consumer che importa solo <Translate> vede un bundle
// più piccolo di questo. Isolare il chunk dentro un bundle vero (con manualChunks) misura
// invece il caso opposto — un limite ANCORA più alto, perché forzare un confine di chunk
// impedisce quello stesso tree-shaking sulle esportazioni che l'app userebbe comunque.
//
// Due chiamanti: test/list/reactBundleSize.test.mjs (lo verifica) e test/estimateSize.mjs
// (lo stampa per `npm run estimateSize`) — la stessa misura, non due copie che possono divergere.

import { rolldown } from "rolldown";
import { transformSync } from "@babel/core";
import { gzipSync } from "node:zlib";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { componentExternal } from "../rolldown.config.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Stesso identico plugin di rolldown.config.js: i file .jsx passano da Babel prima del bundle,
// non c'è altro modo per rolldown di leggerli.
function babelJsx() {
  return {
    name: "babel-jsx",
    transform(code, id) {
      if (!/\.jsx$/.test(id)) return null;
      const result = transformSync(code, {
        filename: id,
        presets: [["@babel/preset-react", { runtime: "automatic", development: false }]],
        babelrc: false,
        configFile: false,
      });
      return result?.code ? { code: result.code } : null;
    },
  };
}

// Le dipendenze esterne del bundle vero, prese da rolldown.config.js e non ricopiate: quello
// che un'app vera fornisce da sé (React) o risolve a build-time (il modulo virtuale), quindi
// non deve mai finire nel conteggio. reactBundleSize.test.mjs le usa anche come lista di ciò
// che al bundle runtime è lecito importare, e su una copia quel controllo varrebbe poco.
export const EXTERNAL = componentExternal;

/**
 * @returns {Promise<{ fileName: string, code: string, raw: number, gzip: number }>}
 */
export default async function measureReactBundle() {
  const bundle = await rolldown({
    input: join(ROOT, "lib/react/index.js"),
    external: EXTERNAL,
    plugins: [babelJsx()],
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  await bundle.close();

  const chunks = output.filter((o) => o.type === "chunk");
  if (chunks.length !== 1) {
    throw new Error(`expected exactly one chunk, got ${chunks.length}`);
  }
  const [chunk] = chunks;
  const raw = Buffer.byteLength(chunk.code, "utf8");
  const gzip = gzipSync(Buffer.from(chunk.code, "utf8")).length;
  return { fileName: chunk.fileName, code: chunk.code, raw, gzip };
}

// Gli helper ICU (lib/icu/runtime.js) arrivano all'app in un chunk a parte, e solo se una tabella
// usa l'ICU. Si misurano tutti e quattro, con i rami di sviluppo, come il runtime React qui
// sopra: è lo stesso criterio "al massimo".
export async function measureIcuRuntime() {
  const bundle = await rolldown({ input: join(ROOT, "lib/icu/runtime.js") });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  await bundle.close();
  const chunks = output.filter((o) => o.type === "chunk");
  if (chunks.length !== 1) {
    throw new Error(`expected exactly one chunk, got ${chunks.length}`);
  }
  const code = chunks[0].code;
  return { raw: Buffer.byteLength(code, "utf8"), gzip: gzipSync(Buffer.from(code, "utf8")).length };
}

/** Il peso reale del runtime che un'app può ricevere: React + helper ICU, in byte gzip. */
export async function measureRuntime() {
  const react = await measureReactBundle();
  const icu = await measureIcuRuntime();
  return { react, icu, gzip: react.gzip + icu.gzip };
}

// Come si scrive il peso nei documenti (regola dell'utente, piano 4.6.3): il peso reale si
// arrotonda per difetto al kB (5,4 kB -> "5 kB"); nei confronti vale il kB superiore con "<"
// (5,4 kB -> "<6 kB"; 5,0 kB esatti -> "<6 kB", perché "<5 kB" sarebbe falso). kB = 1024 B.
export function sizeLabels(gzip) {
  const kB = Math.floor(gzip / 1024);
  return { real: `${kB} kB`, compare: `<${kB + 1} kB` };
}

// Ciò che README.md deve contenere per dire il vero (vedi il piano 4.6.3, Fase 5 § 2b). `rounded`
// cambia solo quando si passa un kB; `exact` a ogni release. `forbidden` trova le formule vecchie.
export function expectedReadme(gzip) {
  const { real, compare } = sizeLabels(gzip);
  return {
    rounded: [
      `runtime-${encodeURIComponent(real)}%20gzip-4c1`,
      `weighs ${real} gzip`,
      `Tiny runtime (${compare} gzip)`,
    ],
    exact: `\`${gzip} bytes\``,
    forbidden: /\b(?:under|less than|below)\s+\d+\s*kB|≤\s*\d+\s*kB|%3C%20\d/i,
  };
}
