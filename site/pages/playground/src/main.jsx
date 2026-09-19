import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { TranslateContainer } from "@sepoina/vitetranslate/react";
import { EDGE_URL } from "./edgeUrl.js";
import "./index.css";

// Scorciatoia: "?edge" (o "?edge=true") porta alla pagina degli edge case, che vive
// al suo indirizzo /edge/. `replace` e non `assign`: la scorciatoia non deve lasciare
// una tappa in più nella history, o il "torna indietro" da lì rimbalzerebbe qui e poi
// di nuovo là. Il redirect sta qui e non dentro App perché la navigazione deve partire
// prima del primo render, senza far comparire il playground per un istante.
if (typeof location !== "undefined" && new URLSearchParams(location.search).has("edge")) {
  location.replace(EDGE_URL);
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <TranslateContainer initialLanguage="en-US" debug> {/* lingua della visualizzazione iniziale */}
        <App />
      </TranslateContainer>
    </React.StrictMode>
  );
}
