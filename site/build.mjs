// Riunisce il sito pubblicato su GitHub Pages: la landing alla radice, ogni pagina di
// site/pages/* nella sottocartella del suo slug. Ogni progetto si builda nella sua cartella,
// da solo, con la sua `base`; qui si copiano i dist uno dentro l'altro.
// Prima di buildare copia il tema in ogni progetto (site/syncTheme.mjs).
//
//   node site/build.mjs                          # site/dist per /viteTranslate/
//   node site/build.mjs --root=/altroNome/       # un fork: la CI passa il nome del repo
//   node site/build.mjs --preview                # dopo la build, vite preview su site/dist
//
// In site/dist/zip ci sono anche gli zip delle pagine, per StackBlitz (vedi site/zip.mjs).
//
// Due configurazioni di vitetranslate() nella stessa build non convivono (il modulo virtuale
// delle lingue ha un id unico): per questo sono build separate e non un'app sola con le route.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { zipPages } from "./zip.mjs";
import { syncTheme } from "./syncTheme.mjs";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_DEFAULT = "/viteTranslate/";
// Cartelle che la landing usa per i suoi asset: uno slug uguale ne coprirebbe il contenuto.
const SLUG_RISERVATI = ["assets"];

/**
 * Le pagine del sito: ogni site/pages/* il cui package.json ha "vitetranslateSite.slug".
 * @param {string} [radice] la radice del repo (nei test, una cartella finta)
 * @returns {{ dir: string, slug: string }[]} ordinate per slug; `dir` è relativa alla radice
 */
export function sitePages(radice = RADICE) {
  const base = join(radice, "site/pages");
  const cartelle = existsSync(base) ? readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
  const pagine = [];
  for (const { name } of cartelle) {
    const file = join(base, name, "package.json");
    if (!existsSync(file)) continue;
    const slug = JSON.parse(readFileSync(file, "utf8")).vitetranslateSite?.slug;
    if (slug === undefined) continue;
    if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
      throw new Error(`site/pages/${name}: slug "${slug}" non valido (solo a-z, 0-9 e "-")`);
    }
    if (SLUG_RISERVATI.includes(slug)) throw new Error(`site/pages/${name}: lo slug "${slug}" è riservato agli asset della landing`);
    const doppia = pagine.find((p) => p.slug === slug);
    if (doppia) throw new Error(`lo slug "${slug}" è usato da ${doppia.dir} e da site/pages/${name}`);
    pagine.push({ dir: `site/pages/${name}`, slug });
  }
  return pagine.sort((a, b) => a.slug.localeCompare(b.slug));
}

// Lo stesso npm che ha lanciato questo script (npm_execpath), non il primo "npm" del PATH: sotto
// `npm run` il PATH comincia con i node_modules/.bin di tutte le cartelle sopra il repo, e un npm
// vecchio lì dentro passerebbe avanti a quello vero (npm 6 non ha `exec` e non conosce i workspace).
function npm(args, opzioni) {
  const eseguibile = process.env.npm_execpath;
  return eseguibile?.includes("npm")
    ? spawnSync(process.execPath, [eseguibile, ...args], opzioni)
    : spawnSync("npm", args, { ...opzioni, shell: process.platform === "win32" });
}

function buildProgetto(dir, base, root) {
  console.log(`\n== ${dir} (base ${base})`);
  const r = npm(["run", "build", "--", `--base=${base}`], {
    cwd: join(RADICE, dir),
    stdio: "inherit",
    env: { ...process.env, VITE_SITE_ROOT: root },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function main() {
  const args = process.argv.slice(2);
  const root = args.find((a) => a.startsWith("--root="))?.slice("--root=".length) ?? ROOT_DEFAULT;
  if (!root.startsWith("/") || !root.endsWith("/")) {
    console.error(`--root deve iniziare e finire con "/" (ricevuto "${root}")`);
    process.exit(1);
  }

  // Il tema per primo: ogni progetto builda la sua copia in src/theme/ (vedi site/syncTheme.mjs).
  console.log(`tema copiato in ${syncTheme().join(", ")}`);

  const pagine = sitePages();
  const dist = join(RADICE, "site/dist");
  rmSync(dist, { recursive: true, force: true });

  buildProgetto("site/landing", root, root);
  for (const { dir, slug } of pagine) buildProgetto(dir, `${root}${slug}/`, root);

  cpSync(join(RADICE, "site/landing/dist"), dist, { recursive: true });
  for (const { dir, slug } of pagine) cpSync(join(RADICE, dir, "dist"), join(dist, slug), { recursive: true });
  // Un zip per pagina, da caricare su StackBlitz: site/dist/zip/<slug>.zip, linkato dalle card della landing.
  for (const z of zipPages(pagine, dist)) console.log(`zip/${z.slug}.zip (${z.files} file, ${(z.bytes / 1024).toFixed(1)} kB)`);
  // Su Pages un URL sbagliato mostra la landing, che lo rimanda altrove se porta un'ancora.
  cpSync(join(dist, "index.html"), join(dist, "404.html"));
  console.log(`\nsito pronto in site/dist (${pagine.length + 1} progetti, root ${root})`);

  if (args.includes("--preview")) {
    console.log(`\nAnteprima: http://localhost:4173${root}\n`);
    const r = npm(["exec", "--", "vite", "preview", "--outDir", "../dist", `--base=${root}`], {
      cwd: join(RADICE, "site/landing"),
      stdio: "inherit",
    });
    process.exit(r.status ?? 0);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
