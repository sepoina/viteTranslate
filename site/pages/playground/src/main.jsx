import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { TranslateContainer, useTranslateLanguage } from "@sepoina/vitetranslate/react";
import { pickLanguage, RememberLanguage } from "./siteLanguage.js";
import "./index.css";

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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
