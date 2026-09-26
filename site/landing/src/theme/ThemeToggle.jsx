// Il pulsante del tema: segue il sistema finché l'utente non sceglie, poi ricorda la scelta per
// tutto il sito (THEME_KEY, vedi boot.js).
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
import { useState } from "react";
import { useTranslateToString } from "@sepoina/vitetranslate/react";
import { THEME_KEY } from "./boot.js";

const SUN = [
  "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  "M12 2v2",
  "M12 20v2",
  "m4.93 4.93 1.41 1.41",
  "m17.66 17.66 1.41 1.41",
  "M2 12h2",
  "M20 12h2",
  "m6.34 17.66-1.41 1.41",
  "m19.07 4.93-1.41 1.41",
];
const MOON = ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"];

export default function ThemeToggle() {
  const ts = useTranslateToString();
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
  );

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* navigazione privata o storage bloccato: il tema vale per questa visita */
    }
    setTheme(next);
  };

  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={ts("_%_Cambia tema_%_")}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {(theme === "dark" ? SUN : MOON).map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </button>
  );
}
