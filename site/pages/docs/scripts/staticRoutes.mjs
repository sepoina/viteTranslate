// Le copie statiche del manuale per GitHub Pages: ogni pagina ha il suo indirizzo (…/docs/llm/price/),
// ma il sito è una pagina sola. Qui, a build finita, si scrive dist/<route>/index.html per ogni route
// (la stessa pagina, con <title> e description giusti) e una pagina di rimando per ogni vecchio
// indirizzo (`aliases:` nel frontmatter). Il contenuto si disegna comunque nel browser (niente
// prerender nella v1): le copie danno indirizzi che funzionano, titoli e descrizioni.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** La pagina `html` con <title> e <meta name="description"> della route. */
export function withMeta(html, title, description) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)} · viteTranslate docs</title>`);
  const meta = `<meta name="description" content="${esc(description)}" />`;
  out = /<meta name="description"[^>]*>/.test(out) ? out.replace(/<meta name="description"[^>]*>/, () => meta) : out.replace("</title>", () => `</title>\n    ${meta}`);
  return out;
}

/**
 * La pagina di rimando di un vecchio indirizzo: porta alla nuova route tenendo l'ancora (#id).
 * `moved` is where the old route's sections went, `{ oldId: "route#newId" }` (the `aliases:` with an anchor):
 * a renamed page can hand one section to another page, and its address must still find it.
 */
export function redirectPage(base, to, moved = {}) {
  const url = `${base}${to}/`;
  const targets = Object.fromEntries(Object.entries(moved).map(([id, target]) => {
    const [route, newId] = target.split("#");
    return [id, `${base}${route}/#${newId}`];
  }));
  const go = Object.keys(targets).length
    ? `const moved = ${JSON.stringify(targets)};
      let id = location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch {}
      location.replace(moved[id] ?? ${JSON.stringify(url)} + location.hash);`
    : `location.replace(${JSON.stringify(url)} + location.hash);`;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Redirecting… · viteTranslate docs</title>
    <script>${go}</script>
    <noscript><meta http-equiv="refresh" content="0; url=${esc(url)}" /></noscript>
  </head>
  <body>
    <p>This page moved to <a href="${esc(url)}">${esc(url)}</a>.</p>
  </body>
</html>
`;
}

/**
 * Scrive le copie statiche dentro `outDir`.
 * @param {{ outDir: string, base: string, routes: { route: string, title: string, description: string, aliases: string[] }[] }} opzioni
 *   `base`: la base della build ("/viteTranslate/docs/"); `routes`: src/generated/routes.json
 * @returns {{ pages: number, redirects: number }}
 */
export function writeStaticRoutes({ outDir, base, routes }) {
  const index = join(outDir, "index.html");
  if (!existsSync(index)) throw new Error(`${index}: build the page first`);
  const html = readFileSync(index, "utf8");
  const put = (route, content) => {
    const file = join(outDir, route, "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  let redirects = 0;
  const real = new Set(routes.map((r) => r.route)); // sopra una pagina vera non si scrive mai un rimando
  // Every old route's sections and where they went ("old#id -> new" on any page): a redirect knows them all.
  const movedFrom = new Map();
  for (const r of routes) {
    for (const a of r.aliases) {
      const m = /^([^#\s]+)#(\S+)\s*->\s*(\S+)$/.exec(a);
      if (!m) continue;
      if (!movedFrom.has(m[1])) movedFrom.set(m[1], {});
      movedFrom.get(m[1])[m[2]] = `${r.route}#${m[3]}`;
    }
  }
  // The old routes some page took over whole: their redirect is that page's, never another's.
  const pageAliases = new Set(routes.flatMap((r) => r.aliases.filter((x) => !x.includes("#"))));
  for (const r of routes) {
    put(r.route, withMeta(html, r.title, r.description));
    // un alias di route (senza #) è un vecchio indirizzo della pagina
    for (const a of r.aliases.filter((x) => !x.includes("#") && !real.has(x))) {
      put(a, redirectPage(base, r.route, movedFrom.get(a)));
      redirects++;
    }
    // un alias con ancora che vive su un'altra route vecchia ha bisogno della sua pagina di rimando
    for (const a of r.aliases.filter((x) => x.includes("#"))) {
      const old = a.split("#")[0];
      if (old !== r.route && !real.has(old) && !pageAliases.has(old)) {
        put(old, redirectPage(base, r.route, movedFrom.get(old)));
        redirects++;
      }
    }
  }
  return { pages: routes.length, redirects };
}
