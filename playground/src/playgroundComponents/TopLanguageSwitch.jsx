import { useContext } from "react";
import { TranslateContext, useAvailableLanguages } from "@sepoina/vitetranslate/react";

function labelFor(tag) {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag);
  } catch {
    return tag;
  }
}

export default function TopLanguageSwitch() {
  const lang = useContext(TranslateContext);
  const { tags } = useAvailableLanguages();

  return (
    <div className="top-lang-switch">
      <div className="top-lang-switch-buttons" role="group">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="top-lang-switch-btn"
            disabled={lang?.id === tag}
            onClick={() => lang?.proposeNewLanguage({ lang: tag })}
          >
            {labelFor(tag)}
          </button>
        ))}
      </div>
    </div>
  );
}
