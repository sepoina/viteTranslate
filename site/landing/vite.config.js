import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

// Le pagine del sito sono build a sé (vedi site/build.mjs), con la loro `base` scritta negli asset.
// In dev la landing le serve dalle copie già buildate in site/dist, alla stessa radice della
// pubblicazione, così le card portano a ciò che c'è sul disco e non al sito online. Se site/dist
// non c'è (nessun `npm run site:build` fatto) non cambia niente: i link restano quelli pubblicati.
const ROOT = process.env.VITE_SITE_ROOT ?? "/viteTranslate/";
const DIST = resolve(fileURLToPath(new URL(".", import.meta.url)), "../dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".zip": "application/zip",
};

const builtPagesDev = () => ({
  name: "site-built-pages",
  apply: "serve",
  config: () =>
    existsSync(DIST) ? { define: { "import.meta.env.VITE_SITE_ROOT": JSON.stringify(ROOT) } } : {},
  configureServer(server) {
    if (!existsSync(DIST)) return;
    server.middlewares.use((req, res, next) => {
      const url = decodeURIComponent((req.url ?? "").split("?")[0]);
      if (!url.startsWith(ROOT)) return next();
      const rel = url.slice(ROOT.length);
      // I link "torna al sito" delle pagine puntano alla radice pubblicata: in dev la landing sta su "/".
      if (rel === "") {
        res.writeHead(302, { Location: "/" }).end();
        return;
      }
      let file = normalize(join(DIST, rel));
      if (file !== DIST && !file.startsWith(DIST + sep)) return next(); // niente uscite da site/dist
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!existsSync(file)) return next();
      res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
      res.end(readFileSync(file));
    });
  },
});

export default defineConfig({
  plugins: [
    react(),
    builtPagesDev(),
    vitetranslate({
      localeDir: "locale",
      sourceLanguage: "it-IT",
      preloadedLanguages: ["en-US"],
    }),
  ],
  // Stesso inciampo di site/pages/playground/vite.config.js: la libreria è un link al
  // repo e, senza dedupe, nel bundle possono finire due React.
  resolve: { dedupe: ["react", "react-dom"] },
  server: { port: 3002 },
});
