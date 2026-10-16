import { useEffect, useState } from "react";
import { Trans, useTrans, useTransLanguage } from "@sepoina/vitetranslate/react";
import SiteBar from "./theme/SiteBar.jsx";
import { ROUTES } from "./generated/routes.js";
import routes from "./generated/routes.json";
import { BASE, DEFAULT_ROUTE, REPO, movedTo, replaceTo, scrollToTarget, useRoute } from "./layout/router.js";
import Sidebar, { go, groupOf } from "./layout/Sidebar.jsx";
import Toc, { useActiveHeading } from "./layout/Toc.jsx";
import PageNav from "./layout/PageNav.jsx";
import Rail from "./layout/Rail.jsx";
import Related from "./layout/Related.jsx";

const PLAIN_TITLE = Object.fromEntries(routes.map((r) => [r.route, r.title]));

// Il manuale: la barra del sito, poi tre colonne (pagine, testo, "In questa pagina").
export default function App() {
  const { route, hash, tick } = useRoute();
  const { id: language } = useTransLanguage();
  const trans = useTrans();
  const [drawer, setDrawer] = useState(false);
  const page = ROUTES[route];
  const headings = page ? page.meta.headings : [];
  const active = useActiveHeading(
    headings.map((h) => h.id),
    route
  );

  // L'altezza della barra (a capo sui telefoni): titoli e colonne fisse la tengono fuori dal testo.
  useEffect(() => {
    const bar = document.querySelector("header.bar");
    if (!bar) return;
    const set = () => document.documentElement.style.setProperty("--d-bar", `${bar.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  // Dopo ogni navigazione: titolo della scheda, cassetto chiuso, sezione (o cima) a schermo. Un vecchio
  // indirizzo di una sezione spostata in un'altra pagina viene sostituito dal nuovo, e si riparte da lì.
  useEffect(() => {
    const moved = page && hash && !headings.some((h) => h.id === hash) ? movedTo(route, hash) : undefined;
    if (moved) {
      replaceTo(moved);
      return;
    }
    document.title = `${PLAIN_TITLE[route] ?? "Page not found"} · viteTranslate docs`;
    setDrawer(false);
    scrollToTarget(hash);
  }, [route, hash, tick]);

  useEffect(() => {
    if (language) document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e) => e.key === "Escape" && setDrawer(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [drawer]);

  const Page = page?.default;
  const group = groupOf(route);

  return (
    <>
      <SiteBar
        current="docs"
        section={page && { id: route, mark: group && <Trans t={group.label} />, label: <Trans t={page.meta.title} /> }}
        labels={{
          nav: trans("_%_Site sections_%_"),
          language: trans("_%_Page language_%_"),
          theme: trans("_%_Switch theme_%_"),
          home: trans("_%_Home_%_"),
          homeHint: trans("_%_The home page: viteTranslate at a glance._%_"),
          docs: trans("_%_Docs_%_"),
          docsHint: trans("_%_The manual: setup, API, CLI and LLM translation._%_"),
          demos: trans("_%_Demos_%_"),
          demosHint: trans("_%_Play in the real world: playground, edge cases and a restaurant translated by an LLM._%_"),
          githubHint: trans("_%_Source code, issues and releases._%_"),
          themeName: trans("_%_Theme_%_"),
          themeToLight: trans("_%_Switch to the light theme: the choice holds across the site._%_"),
          themeToDark: trans("_%_Switch to the dark theme: the choice holds across the site._%_"),
        }}
      >
        <button type="button" className="d-menu-btn" aria-expanded={drawer} aria-controls="d-sidebar" onClick={() => setDrawer((o) => !o)}>
          <span aria-hidden="true">☰</span> <Trans>_%_Menu_%_</Trans>
        </button>
      </SiteBar>

      <div className="wrap d-shell">
        <Sidebar route={route} open={drawer} onClose={() => setDrawer(false)} />

        <main className="d-main">
          {Page ? (
            <article className="d-article">
              {group && (
                <p className="eyebrow">
                  <Trans t={group.label} />
                </p>
              )}
              <h1 className="d-title">
                <Trans t={page.meta.title} />
              </h1>
              <p className="lead">
                <Trans t={page.meta.description} />
              </p>
              <Toc headings={headings} active={active} variant="inline" />
              <div className="d-prose">
                <Page />
              </div>
              <Related route={route} variant="inline" />
              <footer className="d-foot">
                <a href={`${REPO}/blob/main/${page.meta.source}`} target="_blank" rel="noopener">
                  <Trans>_%_Edit this page on GitHub_%_</Trans> <span aria-hidden="true">↗</span>
                </a>
              </footer>
              <PageNav route={route} />
            </article>
          ) : (
            <article className="d-article d-missing">
              <h1 className="d-title">
                <Trans>_%_Page not found_%_</Trans>
              </h1>
              <p className="lead">
                <Trans>_%_This address is not in the manual._%_</Trans>
              </p>
              <p>
                <a className="btn btn-outline" href={`${BASE}${DEFAULT_ROUTE}/`} onClick={go(`${BASE}${DEFAULT_ROUTE}/`)}>
                  <Trans>_%_Back to the overview_%_</Trans>
                </a>
              </p>
            </article>
          )}
        </main>

        {page && (
          <aside className="d-toc">
            <Rail route={route} title={page.meta.title} headings={headings} active={active} editHref={`${REPO}/blob/main/${page.meta.source}`} />
          </aside>
        )}
      </div>
    </>
  );
}
