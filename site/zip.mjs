// Gli zip delle pagine del sito, da caricare su StackBlitz: ogni site/pages/* è un progetto Vite
// che si installa da npm (il suo package.json dichiara la versione pubblicata della libreria), quindi
// basta la cartella, senza node_modules né build. Nessuna dipendenza: lo zip si scrive a mano
// con node:zlib.
//
// Lo chiama site/build.mjs dopo aver riunito il sito: scrive site/dist/zip/<slug>.zip per ogni pagina.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Cosa non entra mai in uno zip: ciò che si rigenera (node_modules, dist, cache) e ciò che è
// locale o segreto. Un ".env" con la chiave dell'LLM non deve finire in un file da pubblicare:
// come nel .gitignore della radice, resta fuori tutto ".env*" tranne l'esempio.
const CARTELLE_ESCLUSE = new Set(["node_modules", "dist", ".vite", ".git"]);
const FILE_ESCLUSI = [/^package-lock\.json$/, /^\.env(\..*)?$/, /\.log$/, /^\.DS_Store$/, /^Thumbs\.db$/, /\.timestamp-/, /\.bak-/];
const FILE_AMMESSI = [/^\.env\.example$/];

const escluso = (nome) => !FILE_AMMESSI.some((re) => re.test(nome)) && FILE_ESCLUSI.some((re) => re.test(nome));

/**
 * I file di una cartella che entrano nello zip.
 * @param {string} dir
 * @returns {{ name: string, data: Buffer }[]} `name` con "/" come separatore, ordinati (lo zip esce sempre uguale)
 */
export function collectFiles(dir) {
  const out = [];
  const visita = (cartella) => {
    for (const voce of readdirSync(cartella, { withFileTypes: true })) {
      const percorso = join(cartella, voce.name);
      if (voce.isDirectory()) {
        if (!CARTELLE_ESCLUSE.has(voce.name)) visita(percorso);
      } else if (voce.isFile() && !escluso(voce.name)) {
        out.push({ name: relative(dir, percorso).split(sep).join("/"), data: readFileSync(percorso) });
      }
    }
  };
  visita(dir);
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

const TABELLA_CRC = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** CRC-32 di un buffer, quello che lo zip scrive per ogni file. */
export function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = TABELLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Data e ora fisse (1 gennaio 2020): due build dello stesso contenuto danno lo stesso zip byte per byte.
const DOS_DATA = ((2020 - 1980) << 9) | (1 << 5) | 1;
const DOS_ORA = 0;

/**
 * Uno zip in memoria: file compressi con deflate, nomi UTF-8, permessi 644.
 * @param {{ name: string, data: Buffer }[]} files
 * @returns {Buffer}
 */
export function makeZip(files) {
  const locali = [];
  const centrali = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nome = Buffer.from(name, "utf8");
    const compresso = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const locale = Buffer.alloc(30);
    locale.writeUInt32LE(0x04034b50, 0);
    locale.writeUInt16LE(20, 4); // versione necessaria
    locale.writeUInt16LE(0x0800, 6); // nomi in UTF-8
    locale.writeUInt16LE(8, 8); // deflate
    locale.writeUInt16LE(DOS_ORA, 10);
    locale.writeUInt16LE(DOS_DATA, 12);
    locale.writeUInt32LE(crc, 14);
    locale.writeUInt32LE(compresso.length, 18);
    locale.writeUInt32LE(data.length, 22);
    locale.writeUInt16LE(nome.length, 26);
    locale.writeUInt16LE(0, 28); // nessun campo extra
    locali.push(locale, nome, compresso);

    const centrale = Buffer.alloc(46);
    centrale.writeUInt32LE(0x02014b50, 0);
    centrale.writeUInt16LE((3 << 8) | 20, 4); // creato su Unix: gli attributi esterni sono permessi
    centrale.writeUInt16LE(20, 6);
    centrale.writeUInt16LE(0x0800, 8);
    centrale.writeUInt16LE(8, 10);
    centrale.writeUInt16LE(DOS_ORA, 12);
    centrale.writeUInt16LE(DOS_DATA, 14);
    centrale.writeUInt32LE(crc, 16);
    centrale.writeUInt32LE(compresso.length, 20);
    centrale.writeUInt32LE(data.length, 24);
    centrale.writeUInt16LE(nome.length, 28);
    centrale.writeUInt32LE(((0o100644 << 16) >>> 0), 38);
    centrale.writeUInt32LE(offset, 42);
    centrali.push(centrale, nome);

    offset += locale.length + nome.length + compresso.length;
  }

  const dimensioneCentrale = centrali.reduce((n, b) => n + b.length, 0);
  const fine = Buffer.alloc(22);
  fine.writeUInt32LE(0x06054b50, 0);
  fine.writeUInt16LE(files.length, 8);
  fine.writeUInt16LE(files.length, 10);
  fine.writeUInt32LE(dimensioneCentrale, 12);
  fine.writeUInt32LE(offset, 16);
  return Buffer.concat([...locali, ...centrali, fine]);
}

/**
 * Scrive uno zip per pagina in `<dist>/zip/<slug>.zip`.
 * @param {{ dir: string, slug: string }[]} pagine come da sitePages(): `dir` è relativa alla radice del repo
 * @param {string} dist la cartella del sito pubblicato
 * @param {string} [radice] la radice del repo
 * @returns {{ slug: string, file: string, files: number, bytes: number }[]}
 */
export function zipPages(pagine, dist, radice = RADICE) {
  const cartella = join(dist, "zip");
  mkdirSync(cartella, { recursive: true });
  return pagine.map(({ dir, slug }) => {
    const files = collectFiles(join(radice, dir));
    if (!files.some((f) => f.name === "package.json")) throw new Error(`${dir}: senza package.json non è un progetto da caricare`);
    const zip = makeZip(files);
    const file = join(cartella, `${slug}.zip`);
    writeFileSync(file, zip);
    return { slug, file, files: files.length, bytes: zip.length };
  });
}
