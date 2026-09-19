import { useEffect, useState } from "react";
import { Translate, useTranslateLanguage, useTranslateToString } from "@sepoina/vitetranslate/react";
import { Icon } from "./icons.jsx";
import { scrollToSection } from "./motion.js";
import { REPO } from "./links.js";

// Il selettore di lingua è il prodotto stesso: cambia davvero la lingua di tutta la pagina.
function LanguageSwitch() {
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();
  const ts = useTranslateToString();

  return (
    <div className="lang-switch" role="group" aria-label={ts("_%_Lingua della pagina_%_")}>
      <Icon name="globe" size={16} />
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

// Segue il sistema finché l'utente non sceglie; la scelta resta in localStorage (che può mancare).
function ThemeToggle() {
  const ts = useTranslateToString();
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
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
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}

export default function Nav() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav${stuck ? " nav-stuck" : ""}`}>
      <div className="wrap nav-in">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="viteTranslate">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="viteTranslate" height="26" />
        </a>

        <nav className="nav-links">
          <button type="button" onClick={() => scrollToSection("features")}>
            <Translate>_%_Funzioni_%_</Translate>
          </button>
          <button type="button" onClick={() => scrollToSection("how")}>
            <Translate>_%_Come funziona_%_</Translate>
          </button>
          <button type="button" onClick={() => scrollToSection("compare")}>
            <Translate>_%_Confronto_%_</Translate>
          </button>
          <button type="button" onClick={() => scrollToSection("demos")}>
            <Translate>_%_Demo_%_</Translate>
          </button>
        </nav>

        <div className="nav-tools">
          <LanguageSwitch />
          <ThemeToggle />
          <a className="icon-btn" href={REPO} aria-label="GitHub">
            <Icon name="github" size={18} />
          </a>
        </div>
      </div>
    </header>
  );
}
