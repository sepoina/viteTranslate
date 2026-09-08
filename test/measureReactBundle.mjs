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
