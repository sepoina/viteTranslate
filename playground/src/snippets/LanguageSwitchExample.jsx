import { useState } from "react";
import { useTranslateLanguage } from "@sepoina/vitetranslate/react";

function labelFor(tag) {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag);
  } catch {
    return tag;
  }
}

export default function LanguageSwitchExample() {
  const { id, debug, tags, proposeNewLanguage } = useTranslateLanguage();
  const [loading, setLoading] = useState(false);

  const switchTo = (tag) => {
    proposeNewLanguage({
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
              checked={id === tag}
              onChange={() => switchTo(tag)}
            />
            {" "}{labelFor(tag)}
          </label>
        ))}
      </div>
      {/* readout tecnico (id/debug dall'hook), non testo utente: niente marcatore di traduzione */}
      <p className="lang-switch-status">
        {loading ? "…" : `id: ${id ?? "—"} · debug: ${String(debug)}`}
      </p>
    </div>
  );
}
