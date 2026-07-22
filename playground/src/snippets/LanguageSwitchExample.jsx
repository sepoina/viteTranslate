import { useContext, useState } from "react";
import { TranslateContext, useAvailableLanguages } from "@sepoina/vitetranslate/react";

function labelFor(tag) {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag);
  } catch {
    return tag;
  }
}

export default function LanguageSwitchExample() {
  const lang = useContext(TranslateContext);
  const { tags } = useAvailableLanguages();
  const [loading, setLoading] = useState(false);

  const switchTo = (tag) => {
    lang?.proposeNewLanguage({
      lang: tag,
      onStart: () => setLoading(true),
      onDone: () => setLoading(false),
      onError: ({ error }) => {
        setLoading(false);
        console.error(error);
      },
    });
  };

  return (
    <div>
      <div className="lang-switch-group" role="radiogroup">
        {tags.map((tag) => (
          <label key={tag} className="lang-switch">
            <input
              type="radio"
              name="language"
              value={tag}
              checked={lang?.id === tag}
              onChange={() => switchTo(tag)}
            />
            {" "}{labelFor(tag)}
          </label>
        ))}
      </div>
      {/* readout tecnico (id/debug dal context), non testo utente: niente marcatore di traduzione */}
      <p className="lang-switch-status">
        {loading ? "…" : `id: ${lang?.id ?? "—"} · debug: ${String(!!lang?.debug)}`}
      </p>
    </div>
  );
}
