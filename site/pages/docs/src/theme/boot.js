// Il tema scelto in una visita precedente, applicato prima del primo rendering: senza, il tema del
// sistema lampeggia per un attimo. La chiave è la stessa in tutto il sito (stessa origine, stesso
// localStorage): il tema scelto sulla landing vale anche nelle pagine, e viceversa.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
export const THEME_KEY = "vt-theme";

/** Da chiamare in main.jsx, prima di createRoot(). localStorage può mancare o lanciare: vale il sistema. */
export function applySavedTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
      syncThemeColor();
    }
  } catch {
    /* storage bloccato: vale il tema del sistema */
  }
}

/**
 * The browser's own bar (mobile, installed apps) takes the page's background, --bg. index.html has a
 * <meta name="theme-color"> per system theme; a theme chosen on the site sets both to its own.
 */
export function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (bg) for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.content = bg;
}

/** The theme in use: the one chosen on the site, or the system's. */
export function currentTheme() {
  return document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
}
