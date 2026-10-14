import { useEffect, useState } from "react";
import { useTrans } from "@sepoina/vitetranslate/react";
import { Code } from "../theme/Code.jsx";

// Code.jsx colora jsx, yaml e sh: gli altri linguaggi del dialetto si appoggiano a questi o restano semplici.
const LANG = { ts: "jsx", tsx: "jsx", json: "text" };

// Un blocco di codice con il pulsante "Copia". Il testo non si traduce.
export default function CodeBlock({ lang, title, code }) {
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

  return (
    <div className="d-code">
      <Code code={code} lang={LANG[lang] ?? lang} title={title} />
      <button type="button" className="d-copy" onClick={copy}>
        {copied ? trans("_%_Copied_%_") : trans("_%_Copy_%_")}
      </button>
    </div>
  );
}
