import { useEffect, useState } from "react";
import { useTrans } from "@sepoina/vitetranslate/react";
import "../theme/code.css";

// Un blocco di codice con il pulsante "Copia". Il testo non si traduce.
// `html` is the code already coloured when the manual compiled (scripts/compileDocs.mjs, Shiki): finished
// markup, the manual's own code, never user input. Without it ("text") the code shows as it is.
// The colours come from the shared theme: code.css and codeScheme.css (a base16 scheme, Materia). A dark
// scheme: the block carries data-theme="dark" and stays dark on the light page, bar and Copy included.
export default function CodeBlock({ lang, title, code, html }) {
  const trans = useTrans();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* appunti non disponibili (pagina non sicura, permesso negato): il codice si può selezionare */
    }
  };

  // translate="no" on the code: the browser's translator would rewrite it. The live region says "Copied"
  // aloud: a screen reader does not read the new text of the button it is on.
  return (
    <div className="d-code" data-theme="dark">
      <div className="code hl" data-lang={lang} translate="no">
        {title && (
          <div className="code-bar">
            <span>{title}</span>
          </div>
        )}
        <pre>{html == null ? <code>{code.trim()}</code> : <code dangerouslySetInnerHTML={{ __html: html }} />}</pre>
      </div>
      <button type="button" className="d-copy" onClick={copy}>
        {copied ? trans("_%_Copied_%_") : trans("_%_Copy_%_")}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? trans("_%_Copied_%_") : ""}
      </span>
    </div>
  );
}
