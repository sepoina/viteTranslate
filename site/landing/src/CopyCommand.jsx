import { useRef, useState } from "react";
import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { INSTALL } from "./links.js";

/**
 * Il comando di installazione, da copiare con un clic.
 * `tone`: "accent" è il bottone verde dell'hero, "ink" quello scuro sulla banda verde finale.
 */
export default function CopyCommand({ command = INSTALL, tone = "accent" }) {
  const trans = useTrans();
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
    timer.current = setTimeout(() => setDone(false), 1600);
  };

  // The button's name is its aria-label, so "Copiato" on it is for the eyes: the live region next to it
  // says it aloud (outside the button, whose content a screen reader does not read).
  return (
    <>
      <button type="button" className={`copy copy-${tone}`} onClick={copy} aria-label={trans("_%_Copia il comando_%_")}>
        <span className="copy-prompt">$</span>
        <code translate="no">{command}</code>
        <span className="copy-state">{done ? <Trans>_%_Copiato_%_</Trans> : <Trans>_%_Copia_%_</Trans>}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {done && <Trans>_%_Copiato_%_</Trans>}
      </span>
    </>
  );
}
