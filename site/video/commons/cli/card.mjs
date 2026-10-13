// Le card senza girare: una scena com'è nello YAML, un prototipo con una sua variante, o la galleria
// di tutte le varianti di tutti i prototipi. Da site/video:
//
//   node commons/cli/card.mjs <progetto> <scena> [--at 0.5,1,2.4]   una scena com'è nello YAML
//   node commons/cli/card.mjs <prototipo> [<variante>] [--at …]     un prototipo, con una sua variante
//   node commons/cli/card.mjs --gallery [--open]                    tutte le varianti di tutti i prototipi
//
// Le foto si fanno fermando la timeline a un istante (card.seek): ripetibili, niente orologio.
// Senza --at, una ogni 0,5 s fino alla fine della timeline; poi un foglio contact.jpg.
// La galleria esce con 1 se una variante non dà l'esito che dichiara (`expect`).
// LINKED-DATA: le varianti sono commons/components/<nome>/variants.yaml (README.md § "Cards",
// commons/layout/darkStyle.md § "Forging"); urlCard() è in director.mjs.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { load as yamlLoad } from "js-yaml";
import { chromium } from "playwright-core";
import { urlCard } from "./director.mjs";
import { ffmpeg } from "./ffmpeg.mjs";
import { CACHE_DIR, COMMONS_DIR, PROJECTS_DIR, VIDEO_DIR, loadProject } from "./storyboard.mjs";

export const COMPONENTS_DIR = join(COMMONS_DIR, "components");
// Un "progetto" per i prototipi da soli: niente musica, niente look in testa.
const NESSUNO = { paths: { dir: VIDEO_DIR }, look: {}, music: null };
const USO = "usage: node commons/cli/card.mjs <project> <scene> | <prototype> [<variant>] [--at 0.5,1,2] | --gallery [--open]";

/** Chrome come Director.launch(), e una pagina come Director.apri(): 1920×1080, tema scuro. */
export async function apriChrome() {
  const browser = await chromium.launch({
    channel: process.env.VT_VIDEO_CHROME ? undefined : "chrome",
    executablePath: process.env.VT_VIDEO_CHROME || undefined,
    headless: true,
    args: ["--hide-scrollbars", "--force-color-profile=srgb", "--disable-features=Translate"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: "en-US", colorScheme: "dark" });
  return { browser, page: await ctx.newPage() };
}

/** Carica una card e aspetta che sia costruita: i suoi errori e la durata della timeline. */
export async function carica(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.card?.ready, null, { timeout: 15_000 });
  return page.evaluate(() => ({ errors: [...window.card.errors], duration: window.card.tl.duration() }));
}

/** La card ferma all'istante `t`, fotografata. */
export async function foto(page, t, path) {
  await page.evaluate((t) => window.card.seek(t), t);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.screenshot({ path, type: path.endsWith(".png") ? "png" : "jpeg", quality: path.endsWith(".png") ? undefined : 85 });
}

/** I prototipi di commons/components, con le loro varianti. */
export function prototipi() {
  return readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(COMPONENTS_DIR, d.name, `${d.name}.js`)))
    .map((d) => {
      const file = join(COMPONENTS_DIR, d.name, "variants.yaml");
      const varianti = existsSync(file) ? (yamlLoad(readFileSync(file, "utf8")) ?? []) : [];
      return { nome: d.name, varianti };
    });
}

/** La scena di una variante, come la vedrebbe urlCard(). */
export const scenaDi = (nome, v = {}) => ({ card: `@commons/components/${nome}/${nome}.js`, params: v.params, look: v.look, anim: v.anim });

async function istanti(page, url, at, dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const { errors, duration } = await carica(page, url);
  for (const e of errors) console.warn(`  ! ${e}`);
  const tempi = at ?? Array.from({ length: Math.floor((duration + 0.5) / 0.5) + 1 }, (_, i) => i * 0.5);
  for (const [i, t] of [...tempi].sort((a, b) => a - b).entries()) await foto(page, t, join(dir, `${String(i).padStart(3, "0")}.png`));
  const righe = Math.ceil(tempi.length / 4);
  await ffmpeg(["-framerate", "1", "-i", join(dir, "%03d.png"), "-vf", `scale=480:-2,tile=4x${righe}`, "-frames:v", "1", "-q:v", "4", join(dir, "contact.jpg")]);
  console.log(`  ${tempi.length} frames (${tempi.join(", ")} s) · ${relative(VIDEO_DIR, join(dir, "contact.jpg"))}`);
  return errors;
}

async function galleria(page, { open }) {
  const dir = join(CACHE_DIR, "gallery");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let ko = 0;
  const sezioni = [];
  for (const { nome, varianti } of prototipi()) {
    const voci = [];
    for (const v of varianti.length ? varianti : [{ name: "default" }]) {
      const scena = scenaDi(nome, v);
      const { errors, duration } = await carica(page, urlCard(NESSUNO, scena));
      const file = `${nome}-${v.name}.jpg`;
      await foto(page, duration, join(dir, file));
      const atteso = v.expect ?? "fits";
      const esito = errors.length ? "error" : "fits";
      const bene = esito === atteso;
      if (!bene) ko++;
      console.log(`  ${bene ? "✓" : "✖"} ${nome} ${v.name}${bene ? "" : `: expected ${atteso}, got ${esito}`}${errors.length ? ` · ${errors.join("; ")}` : ""}`);
      voci.push({ v, file, errors, bene, live: urlCard(NESSUNO, scena, { take: false }) });
    }
    sezioni.push({ nome, voci });
  }
  writeFileSync(join(dir, "index.html"), paginaGalleria(sezioni));
  const indice = join(dir, "index.html");
  console.log(`  ${ko ? `${ko} variant(s) off their expect` : "every variant as expected"} · ${relative(VIDEO_DIR, indice)}`);
  if (open) spawn("cmd", ["/c", "start", "", indice], { detached: true, stdio: "ignore" }).unref();
  return ko;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function paginaGalleria(sezioni) {
  const css = pathToFileURL(join(COMMONS_DIR, "layout", "card.css")).href;
  const sezione = ({ nome, voci }) => `
    <section>
      <h2>${esc(nome)} <a href="${pathToFileURL(join(COMPONENTS_DIR, nome, `${nome}.md`)).href}">sheet</a></h2>
      <div class="voci">${voci
        .map(
          ({ v, file, errors, bene, live }) => `
        <figure class="${bene ? "" : "ko"}">
          <a href="${esc(live)}"><img src="${esc(file)}" alt="${esc(`${nome} ${v.name}`)}" loading="lazy" /></a>
          <figcaption><b>${esc(v.name)}</b>${v.expect === "error" ? " · <i>expect: error</i>" : ""}${v.note ? ` — ${esc(v.note)}` : ""}
            ${errors.map((e) => `<div class="err">${esc(e)}</div>`).join("")}</figcaption>
        </figure>`,
        )
        .join("")}
      </div>
    </section>`;
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <title>Card gallery</title>
  <link rel="stylesheet" href="${css}" />
  <style>
    body { overflow: auto; height: auto; padding: var(--space-2xl); font-size: 18px; }
    h1 { margin: 0 0 var(--space-xl); color: var(--text-hi); }
    h2 { color: var(--accent); margin: var(--space-2xl) 0 var(--space-m); }
    h2 a { font-size: 14px; color: var(--faint); }
    .voci { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: var(--space-xl); }
    figure { margin: 0; }
    img { width: 100%; border: 1px solid var(--line); border-radius: 8px; display: block; }
    figure.ko img { border: 3px solid var(--error); }
    figcaption { margin-top: var(--space-xs); color: var(--lead); }
    .err { color: var(--error); font-size: 15px; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>Card gallery</h1>
  <p>Every variant of every prototype, at the end of its timeline. Click one to see it live. Written by <code>node commons/cli/card.mjs --gallery</code>.</p>
  ${sezioni.map(sezione).join("")}
</body>
</html>
`;
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--at");
  const at = i >= 0 ? String(args.splice(i, 2)[1] ?? "").split(",").map(Number).filter((n) => Number.isFinite(n)) : null;
  const gallery = args.includes("--gallery");
  const open = args.includes("--open");
  const [a, b] = args.filter((x) => !x.startsWith("--"));
  if (!gallery && !a) throw new Error(USO);

  const { browser, page } = await apriChrome();
  try {
    if (gallery) return (await galleria(page, { open })) ? 1 : 0;
    if (existsSync(join(PROJECTS_DIR, a, "storyboard.yaml"))) {
      const project = loadProject(a);
      const scena = project.scenes.find((s) => s.id === b);
      if (!scena) throw new Error(`${a}: no scene "${b}"`);
      if (scena.stage !== "card") throw new Error(`${a}/${b}: stage is ${scena.stage}, not card`);
      console.log(`▶ ${a} ${b}: ${scena.card}`);
      await istanti(page, urlCard(project, scena), at, join(project.paths.preview, "cards", b));
      return 0;
    }
    const proto = prototipi().find((p) => p.nome === a);
    if (!proto) throw new Error(`"${a}" is neither a project nor a prototype (${prototipi().map((p) => p.nome).join(", ")})\n${USO}`);
    const v = b ? proto.varianti.find((x) => x.name === b) : { name: "default" };
    if (!v) throw new Error(`${a}: no variant "${b}" (${proto.varianti.map((x) => x.name).join(", ")})`);
    console.log(`▶ ${a} ${v.name}`);
    const errori = await istanti(page, urlCard(NESSUNO, scenaDi(a, v)), at, join(CACHE_DIR, "cards", a, v.name));
    return (errori.length ? "error" : "fits") === (v.expect ?? "fits") ? 0 : 1;
  } finally {
    await browser.close();
  }
}

// Lanciato da riga di comando, non importato (i test usano apriChrome, carica, foto).
if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1]).toLowerCase())
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`✖ ${e.message}`);
      process.exit(1);
    },
  );
