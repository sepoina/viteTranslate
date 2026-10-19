// The top bar of every page that uses the site theme: the logo on the left, the section you are reading
// in the middle, and on the right the places of the site as icons (the one you are in gets the green of a
// chosen control), then language and theme. Hovering or focusing any control on the right drops a second
// bar under it that says what it does.
// One source of truth for the whole site: a page only says where it is (`current`) and what it is showing (`section`).
// It reads ../siteLinks.js: every project of the site has its copy (test/list/site.test.mjs).
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTrans, useTransLanguage } from "@sepoina/vitetranslate/react";
import { siteUrl } from "../siteLinks.js";
import { currentTheme } from "./boot.js";
import LanguageSwitch from "./LanguageSwitch.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import Logo from "./Logo.jsx";

// LINKED-DATA: the same repository address is REPO in site/landing/src/links.js and site/pages/docs/src/layout/router.js.
const REPO = "https://github.com/sepoina/viteTranslate";

// Lucide icons (ISC), drawn with the stroke of ThemeToggle. The manual's right column borrows `docs`
// for the page title (site/pages/docs/src/layout/Rail.jsx).
export const ICONS = {
  home: [
    "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
    "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  ],
  docs: [
    "M12 7v14",
    "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
  ],
  demos: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z", "M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z"],
  github: [
    "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",
    "M9 18c-4.51 2-5-2-7-2",
  ],
};
const PLACES = ["home", "docs", "demos", "github"];

// The "%" of the logo (Logo.jsx), coordinates rounded to one decimal: it marks the languages in the hint.
const PERCENT = "m-55.7,-327.4 c-38.6,-1.6-76,14.7-96.8,42.2-5.8,7.7-14.4,24.7-16.4,32.5-3.7,14.5-4.6,29.2-2.6,42.9 6.3,42.6 40.7,75.6 82.4,79.1 15.9,1.3 36.3,-1.8 48.7,-7.6 l 3.7,-1.7 18.4,-31 c 33.5,-56.4 35.1,-59.2 34.2,-60.6-0.9,-1.4-8.6,-6.8-14.1,-9.8 l-3.6,-2-15,25.1 c-8.3,13.8-19.5,32.7-25.1,42.1-7.7,13.1-10.6,17.4-12.5,18.5-6.3,3.9-27.6,5.7-38.8,3.3-23.3,-5-41.4,-19.3-49.9,-39.5-10.1,-23.9-7.9,-52.6 5.8,-73.4 12.8,-19.5 35.4,-32.9 61.1,-36.2 9.7,-1.2 29.4,-0.5 38.2,1.4 14.7,3.2 30.1,9.4 41.4,17 7.9,5.2 18.7,15.7 23.7,23.1 2.3,3.4 4.5,5.9 4.8,5.6 0.3,-0.3 3.2,-5 6.4,-10.4 4.6,-7.7 5.7,-10 5.1,-11.1-0.4,-0.7-5.1,-5.7-10.4,-11.1-7.2,-7.3-11.8,-11.2-17.7,-15.1-21.4,-14.2-46,-22.2-71.1,-23.3 z m 149.8,18.5 c 0,0-0.1,0-0.1,0-0.6,0.4-36.1,59.4-56.7,94.4-4.8,8.1-23.7,39.8-42.1,70.6 C-74.2,-27.8-84.7,-9.9-84.3,-8.6 c 0.2,0.7 3.9,3.5 8.3,6.2 4.3,2.7 8.5,4.9 9.3,4.9 1.1,0 2.4,-1.7 5.1,-6.4 3.5,-6.1 14.6,-24.9 94.9,-159.4 66.3,-111.1 80,-134.5 79,-135.5-1.7,-1.6-16.9,-10-18.2,-10.1 z m 15.6,132.9 c-9.1,-0.2-18,0.7-26,2.7-8.2,2.1-15,4.8-17.4,6.8-0.6,0.5-2,2.1-3,3.5-1.5,2.1-41.1,67.9-48.5,80.7 l-2,3.4 6.4,3.9 c 3.5,2.2 7.9,4.8 9.8,5.9 l 3.4,2 2.4,-4.2 c 1.3,-2.3 9.2,-15.6 17.5,-29.5 8.3,-13.9 16.7,-28.1 18.6,-31.5 6.2,-10.9 9.5,-15 13.8,-17.1 9.1,-4.4 30.9,-5.4 42.9,-1.9 28.4,8.1 46.2,31 49.2,63.2 3.1,32.1-13.1,62.4-41,76.6-14.5,7.4-26.6,9.9-45.1,9.4 C 53.8,-3.3 22.9,-18.2 2,-44.9 c-2.6,-3.3-5.1,-6-5.6,-6-1.4,0-11.5,17.1-11.5,19.6 0,2 10.3,13.5 17.3,19.4 20.9,17.4 49.9,29.5 78,32.7 3.4,0.4 10.8,0.6 16.4,0.4 53.2,-1.5 94,-35.5 102.6,-85.5 1.5,-8.6 1.4,-25.3 0,-34.2-5.9,-34.9-31,-64.3-62.8,-73.4-8.5,-2.4-17.7,-3.8-26.8,-4 z";

// How long the hint bar waits before closing: time to move the pointer from a control down onto it.
const CLOSE_DELAY = 150;

// "Skip to content": a button and not a link to "#…", because the landing sends any hash to the playground
// (its main.jsx). <main> takes the focus for a moment, so the next Tab goes on from there.
const skipToContent = () => {
  const main = document.querySelector("main");
  if (!main) return;
  main.tabIndex = -1;
  main.focus();
};

/**
 * @param {object} props
 * @param {"home" | "docs" | "demos"} props.current the place this page belongs to: its icon is the green one
 * @param {string} [props.home] the landing's address; default siteUrl(). The landing passes import.meta.env.BASE_URL
 * @param {{ id: string, mark?: import("react").ReactNode, label: import("react").ReactNode }} [props.section] what the page is showing, in the middle of the bar; `mark` in green before it (a "･" between the two), `id` replays the entrance when it changes
 * @param {(place: string, event: import("react").MouseEvent) => void} [props.onNavigate] called on an icon's click, before the browser follows the link (preventDefault() to handle it in the page)
 * @param {import("react").ReactNode} [props.children] page controls next to the logo (the manual's menu button)
 * @param {{ skip?: string, nav?: string, language?: string, theme?: string, home?: string, homeHint?: string, docs?: string, docsHint?: string, demos?: string, demosHint?: string, githubHint?: string, themeName?: string, themeToLight?: string, themeToDark?: string }} [props.labels] the bar's texts, already translated; without them, the Italian ones (the source language of the other projects). A page written in another language passes its own: `trans("_%_…_%_")`
 */
export default function SiteBar({ current, home = siteUrl(), section, onNavigate, children, labels = {} }) {
  const trans = useTrans();
  const { id: language, languages } = useTransLanguage();
  const header = useRef(null);
  const inner = useRef(null);
  const box = useRef(null);
  const row = useRef(null);
  const timer = useRef(0);
  // The control the hint talks about ({ el, slide }). It outlives `open`: the text stays while the bar closes.
  const [hint, setHint] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  // The bar's height as drawn (two rows on phones), on <html> as --bar-real: theme.css keeps anchors and the
  // focus out from under it (scroll-padding-top), the manual's sticky columns start below it.
  useLayoutEffect(() => {
    const bar = header.current;
    const set = () => document.documentElement.style.setProperty("--bar-real", `${bar.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const places = {
    home: { href: home, name: labels.home ?? trans("_%_Home_%_"), hint: labels.homeHint ?? trans("_%_La pagina principale: viteTranslate in un colpo d'occhio._%_") },
    docs: { href: siteUrl("docs"), name: labels.docs ?? trans("_%_Documentazione_%_"), hint: labels.docsHint ?? trans("_%_Il manuale: installazione, API, CLI e traduzione con un LLM._%_") },
    // Not a hash: the landing sends any hash to the playground (see its main.jsx), so it reads ?section= instead.
    demos: { href: `${home}?section=demos`, name: labels.demos ?? trans("_%_Demo_%_"), hint: labels.demosHint ?? trans("_%_Giocaci nel mondo reale: playground, casi limite e un ristorante tradotto da un LLM._%_") },
    github: { href: REPO, name: "GitHub", hint: labels.githubHint ?? trans("_%_Il codice sorgente, le issue e le release._%_") },
  };

  // What the hint says, from the control's data-hint: "place:docs", "lang:it-IT" or "theme".
  // Read at render time: after a click on the theme it already tells the new state. A language says
  // only its own name, after the logo's "%".
  const describe = (key) => {
    const [kind, value] = key.split(":");
    if (kind === "place") return places[value];
    if (kind === "lang") return { name: languages.find((l) => l.tag === value)?.languageName ?? value, mark: true };
    return {
      name: labels.themeName ?? trans("_%_Tema_%_"),
      hint:
        currentTheme() === "dark"
          ? (labels.themeToLight ?? trans("_%_Passa al tema chiaro: la scelta vale per tutto il sito._%_"))
          : (labels.themeToDark ?? trans("_%_Passa al tema scuro: la scelta vale per tutto il sito._%_")),
    };
  };
  const shown = hint && describe(hint.el.dataset.hint);

  const keep = () => clearTimeout(timer.current);
  const close = () => {
    keep();
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };
  const show = (el) => {
    keep();
    if (open && hint?.el === el) return;
    setHint({ el, slide: open });
    setOpen(true);
  };
  const hinted = (e) => e.target.closest?.("[data-hint]");

  // The hint leans on the right: its green name centred under the control (never past the bar's right
  // edge), the description on its left. --r is how far it stays from the right edge (on small screens
  // the CSS ignores it and the hint takes the whole width); --hx is where the control is, for the glow.
  useLayoutEffect(() => {
    if (!hint || !row.current) return;
    const content = inner.current;
    const right = content.getBoundingClientRect().right - parseFloat(getComputedStyle(content).paddingRight);
    const control = hint.el.getBoundingClientRect();
    const middle = control.left + control.width / 2;
    const name = row.current.firstElementChild.offsetWidth;
    row.current.style.setProperty("--r", `${Math.max(0, right - (middle + name / 2))}px`);
    box.current.style.setProperty("--hx", `${middle - box.current.getBoundingClientRect().left}px`);
  }, [hint, language]);

  return (
    <header ref={header} className="bar">
      <button type="button" className="skip-link" onClick={skipToContent}>
        {labels.skip ?? trans("_%_Salta al contenuto_%_")}
      </button>
      <div ref={inner} className="wrap bar-in">
        <div className="bar-start">
          <a className="bar-brand" href={home} aria-label="viteTranslate">
            <Logo />
          </a>
          {children}
        </div>
        {/* It repeats the page's own title: a screen reader gets nothing new from it. */}
        {section && (
          <span key={section.id} className="bar-crumb" aria-hidden="true">
            {section.mark && <span className="bar-crumb-n">{section.mark}</span>}
            <span className="bar-crumb-t">{section.label}</span>
          </span>
        )}
        <div
          className="bar-tools"
          onPointerOver={(e) => {
            const el = hinted(e);
            if (el && e.pointerType !== "touch") show(el);
          }}
          onPointerLeave={close}
          onFocus={(e) => {
            const el = hinted(e);
            if (el?.matches(":focus-visible")) show(el);
          }}
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          // A click on the theme changes nothing this component renders: a new object re-reads the hint.
          onClick={() => setHint((h) => h && { ...h, slide: false })}
        >
          <nav className="bar-nav" aria-label={labels.nav ?? trans("_%_Sezioni del sito_%_")}>
            {PLACES.map((place) => (
              <a
                key={place}
                className="bar-icon"
                href={places[place].href}
                data-hint={`place:${place}`}
                aria-label={places[place].name}
                aria-current={place === current ? "page" : undefined}
                onClick={(e) => {
                  setOpen(false);
                  onNavigate?.(place, e);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICONS[place].map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
              </a>
            ))}
          </nav>
          <span className="bar-sep" aria-hidden="true" />
          <LanguageSwitch label={labels.language} />
          <ThemeToggle label={labels.theme} />
        </div>
      </div>
      {/* The controls carry their name (aria-label, sr-only text): the hint is for the eyes only. */}
      <div
        ref={box}
        className="bar-hint"
        data-open={open ? "" : undefined}
        data-slide={hint?.slide ? "" : undefined}
        aria-hidden="true"
        onPointerEnter={keep}
        onPointerLeave={close}
      >
        <div className="wrap">
          {shown && (
            <p ref={row} className="bar-hint-text">
              {/* A language's name is its own (an endonym): the browser's translator leaves it alone. */}
              <span className="bar-hint-name" translate={shown.mark ? "no" : undefined}>
                {shown.mark && (
                  <svg className="bar-hint-mark" viewBox="-172.5 -327.5 373 349" aria-hidden="true">
                    <path d={PERCENT} />
                  </svg>
                )}
                {shown.name}
              </span>
              {shown.hint && <span className="bar-hint-desc">{shown.hint}</span>}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
