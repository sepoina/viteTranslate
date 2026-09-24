import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { TranslateContainer, useTranslateLanguage } from "@sepoina/vitetranslate/react";
import { pickLanguage, RememberLanguage } from "./siteLanguage.js";
import "./playground.css";

// Lingua della visualizzazione iniziale: l'ultima scelta sul sito, se c'è tra queste tabelle; altrimenti en-US.
function Root() {
  const { languages } = useTranslateLanguage();
  return (
    <TranslateContainer initialLanguage={pickLanguage(languages, "en-US")} debug>
      <RememberLanguage />
      <App />
    </TranslateContainer>
  );
}

// Il tema scelto sulla landing (stessa origine, stessa chiave), applicato prima del primo
// rendering: senza, il tema del sistema lampeggia per un attimo.
try {
  const theme = localStorage.getItem("vt-theme");
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch {
  /* storage bloccato: vale il tema del sistema */
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
