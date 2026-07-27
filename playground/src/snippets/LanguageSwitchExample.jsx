import { useState } from "react";
import { useTranslateLanguage, Translate } from "@sepoina/vitetranslate/react";

export default function LanguageSwitchExample() {
  const { id, debug, languages, proposeNewLanguage } = useTranslateLanguage();
  const [loading, setLoading] = useState(false);

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
        <Translate t="_%_<b>Scegli la tua lingua </b>_%_"/>
        {loading ? "…" : `(id: ${id ?? "—"} · debug: ${String(debug)})`}
      </p>
      <div className="lang-switch-group" role="group">
        {languages.map(({ tag, languageName }) => (
          <button
            key={tag}
            type="button"
            className="lang-switch-chip"
            disabled={id === tag}
            onClick={() => switchTo(tag)}
          >
            {languageName}
          </button>
        ))}
      </div>
      {/* readout tecnico (id/debug dall'hook), non testo utente: niente marcatore di traduzione */}

    </div>
  );
}
