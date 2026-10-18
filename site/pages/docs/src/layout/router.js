// Il router del manuale: tre funzioni e un hook, niente libreria. L'indirizzo di una pagina è
// <base>/<sezione>/<pagina>/ e la sezione è l'ancora (#id). La lingua non sta nell'indirizzo:
// viene dalla lingua scelta sul sito (siteLanguage.js).
import { useSyncExternalStore } from "react";
import { siteUrl } from "../siteLinks.js";
import ALIASES from "../generated/aliases.json";

/** La base della pagina: "/" in dev, "/viteTranslate/docs/" nel sito pubblicato. */
export const BASE = import.meta.env.BASE_URL;
// LINKED-DATA: the same address is REPO in site/theme/SiteBar.jsx (the GitHub icon of the bar).
export const REPO = "https://github.com/sepoina/viteTranslate";
/** La pagina che si apre alla radice del manuale. */
export const DEFAULT_ROUTE = "getting-started/overview";

// Il ripristino dello scroll del browser vale per le pagine vere: qui lo decide scrollToTarget().
try {
  history.scrollRestoration = "manual";
} catch {
  /* ambiente senza History API completa */
}

let tick = 0;
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb) {
  listeners.add(cb);
  addEventListener("popstate", cb);
  addEventListener("hashchange", cb);
  return () => {
    listeners.delete(cb);
    removeEventListener("popstate", cb);
    removeEventListener("hashchange", cb);
  };
}

// Una stringa e non un oggetto: useSyncExternalStore confronta con ===. Il contatore fa ripartire
// lo scroll anche quando si clicca due volte lo stesso indirizzo.
const snapshot = () => `${location.pathname}${location.hash}|${tick}`;

/** La route di un pathname: senza base, senza barra finale. "" (la radice) vale DEFAULT_ROUTE. */
export function routeOf(pathname) {
  let p = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, "");
  p = p.replace(/index\.html$/, "").replace(/\/+$/, "");
  return p === "" ? DEFAULT_ROUTE : p;
}

/** La route corrente, per esempio "llm/price". */
export const currentRoute = () => routeOf(location.pathname);

/**
 * Va a un indirizzo del manuale (assoluto, o solo "#id" per la pagina corrente) senza ricaricare.
 * `from`: the page the reader jumps away from ("On the same topic"); the new history entry keeps it, so
 * "Previous" can lead back there. A jump inside the same page keeps the entry's `from` and counts itself
 * (`steps`), so going back skips the sections read in between.
 */
export function navigate(href, from) {
  const url = new URL(href, location.href);
  const samePage = url.pathname === location.pathname;
  const state = samePage ? (history.state?.from ? { ...history.state, steps: (history.state.steps ?? 0) + 1 } : null) : from ? { from, steps: 0 } : null;
  history.pushState(state, "", url.pathname + url.search + url.hash);
  tick++;
  notify();
}

/** Il click di un link interno: va col router, salvo clic con tasto modificatore (scheda nuova). `from`: see navigate(). */
export const go = (href, from) => (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(href, from);
};

/** The page the reader came from through "On the same topic", if this history entry has one. */
export const cameFrom = () => history.state?.from ?? null;

/** Back to that page: as many entries back as the jumps made inside this one, plus one. */
export const goBack = () => history.go(-((history.state?.steps ?? 0) + 1));

/**
 * La sezione che ha preso il posto di `route#hash` (una sezione spostata in un'altra pagina, `aliases:` nel
 * frontmatter), come "nuova/route#id"; undefined se `hash` non è un vecchio indirizzo.
 */
export const movedTo = (route, hash) => ALIASES[`${route}#${hash}`];

/** Sostituisce l'indirizzo corrente con `target` ("route#id") senza aggiungere una voce alla cronologia. */
export function replaceTo(target) {
  const [route, id] = target.split("#");
  history.replaceState(history.state, "", `${BASE}${route}/${id ? `#${id}` : ""}`);
  tick++;
  notify();
}

/** { route, hash, tick }: cambia a ogni navigazione, anche verso lo stesso indirizzo. */
export function useRoute() {
  const s = useSyncExternalStore(subscribe, snapshot, () => `${BASE}|0`);
  const [loc, t] = s.split("|");
  const i = loc.indexOf("#");
  let hash = "";
  try {
    hash = i < 0 ? "" : decodeURIComponent(loc.slice(i + 1));
  } catch {
    hash = loc.slice(i + 1);
  }
  return { route: routeOf(i < 0 ? loc : loc.slice(0, i)), hash, tick: t };
}

/** Porta alla sezione `hash`, o in cima se non c'è. Chiamare a pagina disegnata. */
export function scrollToTarget(hash) {
  const el = hash ? document.getElementById(hash) : null;
  if (el) el.scrollIntoView();
  else if (!hash) scrollTo(0, 0);
}

/**
 * Cosa significa il `to` di un DocLink (la sintassi dei link del dialetto).
 * @param {string} to "/sezione/pagina#id", "#id", "site:slug#id", "repo:percorso#id" o "https://…"
 * @returns {{ kind: "route" | "hash" | "site" | "repo" | "https", href: string }}
 */
export function resolveTo(to) {
  if (to.startsWith("#")) return { kind: "hash", href: to };
  if (to.startsWith("/")) {
    const [route, id] = to.slice(1).split("#");
    return { kind: "route", href: `${BASE}${route}/${id ? `#${id}` : ""}` };
  }
  if (to.startsWith("site:")) {
    const [slug, id] = to.slice(5).split("#");
    return { kind: "site", href: `${siteUrl(slug)}${id ? `#${id}` : ""}` };
  }
  if (to.startsWith("repo:")) return { kind: "repo", href: `${REPO}/blob/main/${to.slice(5)}` };
  return { kind: "https", href: to };
}
