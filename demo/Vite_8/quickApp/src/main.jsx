import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TransContainer } from "@sepoina/vitetranslate/react";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TransContainer initialLanguage="en-US">
      <App name="Ada" />
    </TransContainer>
  </StrictMode>,
);
