import React, { useContext, useMemo } from "react";
import { TranslateContext } from "./TranslateContext";
import emitNodes from "./emitNode";
import { parseCompiledMarker } from "./parseCompiledMarker";


// --- COMPONENTE PRINCIPALE ---

export default function Translate({ "data-translate": dataTranslate = false, t = false, a = false, children = false }) {
  const lang = useContext(TranslateContext);

  return useMemo(() => {
    try {
      //
      // errore mancata scalta
      if (t && children) throw new Error("Translate: non puoi usare entrambi t e children");
      //
      // errore testo assente
      const source = t !== false ? t : children;
      if (!source && !dataTranslate) return ""; // throw new Error(`Translate: manca il testo da tradurre ${JSON.stringify({ dataTranslate, t, a, children })}`);
      //
      // Traduzione via data-translate (iniettato da vitetranslate)
      if (dataTranslate) {
        const resolved = lang?.table?.[dataTranslate] ?? source;
        return emitNodes(a, resolved);
      }
      //
      // formato t=[text, arg1, arg2, ...]
      let text, args;
      if (Array.isArray(source)) {
        if (a !== false) throw new Error(`Translate: "a" non può essere definito se usi formato t:${JSON.stringify(t)}`);
        [text, ...args] = source;
      }
      //
      // formato classico t="..." a=[arg1, arg2, ...]
      else {
        if (t && typeof t === "object") throw new Error(`Translate: "t" non puo' essere un oggetto se usi formato t:${JSON.stringify(t)}`);
        text = source;
        args = a ?? [];
      }
      //
      // dovrebbe essere testo ora
      if (!(typeof text === "string" || text instanceof String)) throw new Error(`Translate: "t" o "children" devono essere stringhe non ${typeof text}`);
      const hasReactElements = Array.isArray(args) ? args.some(React.isValidElement) : React.isValidElement(args);
      if (hasReactElements) throw new Error("Non sono accettati subelementi html nel translate");
      //
      // Ora la stringa dovrebbe essere frutto di vitetranslate, con sintassi _<_codice_/_fallback_>_
      if (text?.startsWith("_<_") && text.endsWith("_>_")) {
        const { key, fallback } = parseCompiledMarker(text);
        // fallback assente (build di produzione): la lingua base è garantita
        // completa dal comando prepare-translation-table eseguito prima della
        // build, quindi in pratica lang.table[key] esiste sempre; la chiave
        // grezza resta come ultima rete di sicurezza, visibile e non silenziosa.
        return emitNodes(args, lang?.table?.[key] ?? fallback ?? key);
      }
      //
      // Stringa non ancora formattata per la traduzione (marcatore _%_..._%_
      // dimenticato, o file non processato da vitetranslate). In sviluppo è
      // un errore esplicito, stesso trattamento degli altri usi scorretti sopra
      // (catturato dal try/catch qui sotto -> console.error + placeholder "[...]").
      // In produzione degrada mostrando il testo così com'è, senza rompere l'app.
      if (import.meta.env?.DEV) {
        throw new Error(`Translate: testo non marcato con _%_..._%_ (dimenticato?): "${text}"`);
      }
      return emitNodes(args, text); // infine emetti lo stesso
      //
      //
    } catch (error) {
      console.error("Translate: error", error.message, error);
      return emitNodes(null, "[...]");
    }
  }, [lang, t, a, children]);
}
