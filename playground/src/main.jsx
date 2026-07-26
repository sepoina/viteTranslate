import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { TranslateContainer } from "@sepoina/vitetranslate/react";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TranslateContainer initialLanguage="en-US" debug> {/* lingua della visualizzazione iniziale */}
      <App />
    </TranslateContainer>
  </React.StrictMode>
);
