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

/** La pagina di rimando di un vecchio indirizzo: porta alla nuova route tenendo l'ancora (#id). */
export function redirectPage(base, to) {
  const url = `${base}${to}/`;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Redirecting… · viteTranslate docs</title>
    <script>location.replace(${JSON.stringify(url)} + location.hash);</script>
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
  for (const r of routes) {
    put(r.route, withMeta(html, r.title, r.description));
    // un alias di route (senza #) è un vecchio indirizzo della pagina
    for (const a of r.aliases.filter((x) => !x.includes("#") && !real.has(x))) {
      put(a, redirectPage(base, r.route));
      redirects++;
    }
    // un alias con ancora che vive su un'altra route vecchia ha bisogno della sua pagina di rimando
    for (const a of r.aliases.filter((x) => x.includes("#"))) {
      const old = a.split("#")[0];
      if (old !== r.route && !real.has(old) && !r.aliases.includes(old)) {
        put(old, redirectPage(base, r.route));
        redirects++;
      }
    }
  }
  return { pages: routes.length, redirects };
}
