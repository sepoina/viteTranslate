import { useRef, useState } from "react";
import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";
import { Icon } from "./icons.jsx";
import { INSTALL } from "./links.js";

/** Il comando di installazione, da copiare con un clic. */
export default function CopyCommand({ command = INSTALL }) {
  const ts = useTranslateToString();
  const [done, setDone] = useState(false);
  const timer = useRef(0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return; // contesto non sicuro o permesso negato: niente finto "Copiato"
    }
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1800);
  };

  return (
    <button type="button" className="copy" onClick={copy} aria-label={ts("_%_Copia il comando_%_")}>
      <span className="copy-prompt">$</span>
      <code>{command}</code>
      <span className={`copy-state${done ? " is-done" : ""}`}>
        <Icon name={done ? "check" : "copy"} size={16} />
        <span>{done ? <Translate>_%_Copiato_%_</Translate> : <Translate>_%_Copia_%_</Translate>}</span>
      </span>
    </button>
  );
}
