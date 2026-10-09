import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { TransContainer, useTransLanguage } from "@sepoina/vitetranslate/react";
import { pickLanguage, RememberLanguage } from "./siteLanguage.js";
import { applySavedTheme } from "./theme/boot.js";
import "./theme/theme.css";
import "./playground.css";

// Lingua della visualizzazione iniziale: l'ultima scelta sul sito, se c'è tra queste tabelle; altrimenti en-US.
function Root() {
  const { languages } = useTransLanguage();
  return (
    <TransContainer initialLanguage={pickLanguage(languages, "en-US")} debug>
      <RememberLanguage />
      <App />
    </TransContainer>
  );
}

// Il tema scelto sul sito (src/theme/boot.js), prima del primo rendering.
applySavedTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
