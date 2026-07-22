import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { TranslateContainer } from "@sepoina/vitetranslate/react";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TranslateContainer predefined="it-IT">
      <App />
    </TranslateContainer>
  </React.StrictMode>
);
