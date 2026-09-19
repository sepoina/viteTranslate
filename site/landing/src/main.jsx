import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TranslateContainer, useTranslateLanguage } from "@sepoina/vitetranslate/react";
import App from "./App.jsx";
import { siteUrl } from "./siteLinks.js";
import { pickLanguage, RememberLanguage } from "./siteLanguage.js";
import "./landing.css";

// L'inglese è la lingua d'avvio precaricata; l'ultima scelta sul sito, se c'è tra le tabelle, ha la precedenza.
function Root() {
  const { languages } = useTranslateLanguage();
  return (
    <TranslateContainer initialLanguage={pickLanguage(languages, "en-US")}>
      <RememberLanguage />
      <App />
    </TranslateContainer>
  );
}

// Fino alla riorganizzazione del sito la radice era il playground: i link già in giro
// (README vecchi, npm, articoli) portano qui con un'ancora del playground, o con "?edge".
// La landing non usa ancore sue, quindi QUALUNQUE hash appartiene al playground. `replace`
// e non `assign`: il "torna indietro" non deve rimbalzare di nuovo qui.
const { hash, search } = location;
if (new URLSearchParams(search).has("edge")) {
  location.replace(siteUrl("edge"));
} else if (hash) {
  location.replace(siteUrl("playground") + hash);
} else {
  // Il tema scelto in una visita precedente, applicato prima del primo rendering (senza, il chiaro lampeggia).
  try {
    const theme = localStorage.getItem("vt-theme");
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch {
    /* storage non disponibile: si segue il sistema */
  }
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <Root />
    </StrictMode>
  );
}
