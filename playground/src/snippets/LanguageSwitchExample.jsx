import { useState } from "react";
import { useTranslateLanguage, Translate } from "@sepoina/vitetranslate/react";

export default function LanguageSwitchExample() {
  const { id, debug, languages, proposeNewLanguage } = useTranslateLanguage();
  const [loading, setLoading] = useState(false);
  const actual = loading ? "…" : `id: ${id ?? "—"} // debug: ${String(debug)}`;

  const switchTo = (tag) => {
    proposeNewLanguage({
      lang: tag,
      onStart: () => setLoading(true),
      onDone: () => setLoading(false),
    });
  };

  return (
    <div>
      <p className="lang-switch-status">
        <Translate t="_%_<b>Scegli la tua lingua </b> (%s)_%_" a={actual} />
      </p>
      <div className="lang-switch-group" role="group">
        {languages.map(entry => (
          <button key={entry.tag} type="button" className="lang-switch-chip"
            disabled={id === entry.tag}
            onClick={() => switchTo(entry.tag)}
          >{entry.languageName}</button>
        ))}
      </div>
    </div>
  );
}
