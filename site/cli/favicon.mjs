// The site's favicon: the "%" of the logo on a tile, in the colours of tokens.css (--bg and --accent).
// It writes three files into site/theme/, which then travel to every project like the rest of the
// theme (site/cli/syncTheme.mjs):
//
//   favicon.svg           the browser tab: dark tile, light one when the system is light (as in tokens.css)
//   favicon-32.png        the dark tile, for browsers without SVG favicons (Safari before 26)
//   apple-touch-icon.png  180 px, square and opaque: iOS rounds the corners itself
//
// The files are committed and the site build doesn't run this: rerun it after touching GLYPH or the
// two tokens. The site test and testRelease ("theme") fail while the files are out of date.
//
//   node site/cli/favicon.mjs           # rewrites the three files and the theme copies (npm run site:favicon)
//   node site/cli/favicon.mjs --check   # writes nothing: lists the stale files, exits with 1 if any
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { syncTheme } from "./syncTheme.mjs";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LIGHT = ':root[data-theme="light"]';

// The glyph on a 64×64 tile, stroked with round caps: [path, stroke width].
const GLYPH = [
  ["M25 54 L39 10", 8], // the slash
  ["M28.7 30.7 A11 11 0 1 1 28.7 15.3", 7], // the upper ring, open towards the slash
  ["M35.3 33.3 A11 11 0 1 1 35.3 48.7", 7], // the lower ring
];

/**
 * The tile and glyph colours of the two themes, read from tokens.css.
 * @param {string} tokens the text of site/theme/tokens.css
 * @returns {{ dark: { bg: string, fg: string }, light: { bg: string, fg: string } }} lowercase #rrggbb
 */
export function themeColors(tokens) {
  const token = (selector, name) => {
    const start = tokens.indexOf(selector);
    if (start < 0) throw new Error(`site/theme/tokens.css: no "${selector}" block`);
    const open = tokens.indexOf("{", start);
    const block = tokens.slice(open + 1, tokens.indexOf("}", open));
    const value = new RegExp(`(?:^|[\\s;])--${name}:\\s*([^;]+);`).exec(block)?.[1].trim();
    if (!/^#[0-9a-f]{6}$/i.test(value ?? "")) throw new Error(`site/theme/tokens.css: --${name} in "${selector}" is "${value}", not a #rrggbb colour`);
    return value.toLowerCase();
  };
  return {
    dark: { bg: token(":root {", "bg"), fg: token(":root {", "accent") },
    light: { bg: token(LIGHT, "bg"), fg: token(LIGHT, "accent") },
  };
}

/**
 * One tile as SVG text.
 * @param {{ rect: string, glyph: string }} paint the attributes that colour the tile and the glyph
 * @param {{ rounded?: boolean, inset?: number, style?: string }} [options] `inset` shrinks the glyph around the centre;
 *   `style` goes first inside the svg
 */
function tile(paint, { rounded = true, inset = 1, style = "" } = {}) {
  const corners = rounded ? ' rx="14"' : "";
  const shrink = inset === 1 ? "" : ` transform="translate(32 32) scale(${inset}) translate(-32 -32)"`;
  const paths = GLYPH.map(([d, width]) => `<path stroke-width="${width}" d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${style}<rect width="64" height="64"${corners} ${paint.rect}/><g fill="none" stroke-linecap="round" ${paint.glyph}${shrink}>${paths}</g></svg>\n`;
}

// resvg as WebAssembly: no native binary, and the same bytes on every platform (the check compares them).
let wasm;
async function png(svg, size) {
  wasm ??= initWasm(readFileSync(createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm")));
  await wasm;
  const image = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render();
  const bytes = Buffer.from(image.asPng());
  image.free();
  return bytes;
}

/**
 * The three files, as they should be.
 * @param {string} [radice] the repo root (in tests, a fake folder with site/theme/tokens.css)
 * @returns {Promise<{ name: string, data: Buffer }[]>} `name` inside site/theme/
 */
export async function faviconFiles(radice = RADICE) {
  const { dark, light } = themeColors(readFileSync(join(radice, "site/theme/tokens.css"), "utf8"));
  const solid = ({ bg, fg }) => ({ rect: `fill="${bg}"`, glyph: `stroke="${fg}"` });
  const adaptive = `<style>.t{fill:${dark.bg}}.g{stroke:${dark.fg}}@media (prefers-color-scheme:light){.t{fill:${light.bg}}.g{stroke:${light.fg}}}</style>`;
  return [
    { name: "favicon.svg", data: Buffer.from(tile({ rect: 'class="t"', glyph: 'class="g"' }, { style: adaptive })) },
    { name: "favicon-32.png", data: await png(tile(solid(dark)), 32) },
    { name: "apple-touch-icon.png", data: await png(tile(solid(dark), { rounded: false, inset: 0.82 }), 180) },
  ];
}

/**
 * The favicon files that are missing or differ from what tokens.css and GLYPH give.
 * @param {string} [radice]
 * @returns {Promise<string[]>} one line per file, empty if all is up to date
 */
export async function checkFavicon(radice = RADICE) {
  const stale = [];
  for (const { name, data } of await faviconFiles(radice)) {
    const file = join(radice, "site/theme", name);
    if (!existsSync(file)) stale.push(`site/theme/${name}: missing`);
    else if (!readFileSync(file).equals(data)) stale.push(`site/theme/${name}: out of date`);
  }
  return stale;
}

/**
 * Rewrites the favicon files in site/theme/ (not the copies: syncTheme does those).
 * @param {string} [radice]
 * @returns {Promise<{ name: string, bytes: number }[]>}
 */
export async function writeFavicon(radice = RADICE) {
  const files = await faviconFiles(radice);
  for (const { name, data } of files) writeFileSync(join(radice, "site/theme", name), data);
  return files.map(({ name, data }) => ({ name, bytes: data.length }));
}

async function main() {
  if (process.argv.includes("--check")) {
    const stale = await checkFavicon();
    for (const line of stale) console.log(line);
    if (stale.length) console.log("run npm run site:favicon");
    process.exit(stale.length ? 1 : 0);
  }
  for (const { name, bytes } of await writeFavicon()) console.log(`site/theme/${name} (${bytes} B)`);
  console.log(`theme copied to ${syncTheme().join(", ")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
