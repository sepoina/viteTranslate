import { useTranslateLanguage } from "@sepoina/vitetranslate/react";

function labelFor(tag) {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag);
  } catch {
    return tag;
  }
}

export default function TopLanguageSwitch() {
  const { id, tags, proposeNewLanguage } = useTranslateLanguage();

  return (
    <div className="top-lang-switch">
      <div className="top-lang-switch-buttons" role="group">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="top-lang-switch-btn"
            disabled={id === tag}
            onClick={() => proposeNewLanguage({ lang: tag })}
          >
            {labelFor(tag)}
          </button>
        ))}
      </div>
    </div>
  );
}
