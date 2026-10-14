// Il tema scelto in una visita precedente, applicato prima del primo rendering: senza, il tema del
// sistema lampeggia per un attimo. La chiave è la stessa in tutto il sito (stessa origine, stesso
// localStorage): il tema scelto sulla landing vale anche nelle pagine, e viceversa.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
export const THEME_KEY = "vt-theme";

/** Da chiamare in main.jsx, prima di createRoot(). localStorage può mancare o lanciare: vale il sistema. */
export function applySavedTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch {
    /* storage bloccato: vale il tema del sistema */
  }
}
