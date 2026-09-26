// Il selettore di lingua: un bottone per lingua, con il codice corto (EN, IT, ZH…). È anche la demo
// più diretta della libreria: cambia la lingua di tutta la pagina.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
import { useTranslateLanguage, useTranslateToString } from "@sepoina/vitetranslate/react";

export default function LanguageSwitch() {
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();
  const ts = useTranslateToString();

  return (
    <div className="seg lang-switch" role="group" aria-label={ts("_%_Lingua della pagina_%_")}>
      {languages.map(({ tag, languageName }) => (
        <button
          key={tag}
          type="button"
          title={languageName}
          aria-pressed={id === tag}
          onClick={() => id !== tag && proposeNewLanguage({ lang: tag })}
        >
          {tag.split("-")[0].toUpperCase()}
        </button>
      ))}
    </div>
  );
}
