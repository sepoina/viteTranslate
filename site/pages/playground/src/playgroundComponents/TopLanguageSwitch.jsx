import { useTranslateLanguage } from "@sepoina/vitetranslate/react";

export default function TopLanguageSwitch() {
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();

  return (
    <div className="top-lang-switch">
      <div className="top-lang-switch-buttons" role="group">
        {languages.map(({ tag, languageName }) => (
          <button
            key={tag}
            type="button"
            className="top-lang-switch-btn"
            disabled={id === tag}
            onClick={() => proposeNewLanguage({ lang: tag })}
          >
            {languageName}
          </button>
        ))}
      </div>
    </div>
  );
}
