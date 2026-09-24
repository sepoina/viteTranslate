import { useState } from "react";
import { Translate, useTranslateLanguage, useTranslateToString } from "@sepoina/vitetranslate/react";
import { siteUrl } from "../siteLinks.js";

// Il selettore di lingua della landing: una pillola, un bottone per lingua. È anche la demo
// più diretta della libreria: cambia la lingua di tutta la pagina, esempi compresi.
function LanguageSwitch() {
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();
  const ts = useTranslateToString();
  return (
    <div className="lang-switch" role="group" aria-label={ts("_%_Lingua della pagina_%_")}>
      {languages.map(({ tag, languageName }) => (
        <button
          key={tag}
          type="button"
          title={languageName}
          aria-pressed={id === tag}
          onClick={() => id !== tag && proposeNewLanguage({ lang: tag })}
        >
          {tag.split("-")[0].toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Stessa chiave della landing ("vt-theme"): il tema scelto là vale anche qui, e viceversa.
function ThemeToggle() {
  const ts = useTranslateToString();
  const [theme, setTheme] = useState(
    () =>
      document.documentElement.dataset.theme ??
      (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
  );
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("vt-theme", next);
    } catch {
      /* navigazione privata o storage bloccato: il tema vale per questa visita */
    }
    setTheme(next);
  };
  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={ts("_%_Cambia tema_%_")}>
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

export default function TopBar() {
  return (
    <header className="top">
      <div className="wrap top-in">
        <a className="back" href={siteUrl()}>
          ← <Translate>_%_Tutte le demo_%_</Translate>
        </a>
        <div className="top-tools">
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
