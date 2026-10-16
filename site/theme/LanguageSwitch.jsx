// Il selettore di lingua: un bottone per lingua, con il codice corto (EN, IT, ZH…). È anche la demo
// più diretta della libreria: cambia la lingua di tutta la pagina.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
import { useTransLanguage, useTrans } from "@sepoina/vitetranslate/react";

// `label`: l’etichetta accessibile, già tradotta; senza, quella italiana (la lingua sorgente degli altri progetti).
export default function LanguageSwitch({ label }) {
  const { id, languages, proposeNewLanguage } = useTransLanguage();
  const trans = useTrans();

  return (
    <div className="seg lang-switch" role="group" aria-label={label ?? trans("_%_Lingua della pagina_%_")}>
      {languages.map(({ tag, languageName }) => (
        // No title: the site bar shows the language's name in its hint (data-hint), a native tooltip would cover it.
        <button
          key={tag}
          type="button"
          data-hint={`lang:${tag}`}
          aria-pressed={id === tag}
          onClick={() => id !== tag && proposeNewLanguage({ lang: tag })}
        >
          <span aria-hidden="true">{tag.split("-")[0].toUpperCase()}</span>
          <span className="sr-only">{languageName}</span>
        </button>
      ))}
    </div>
  );
}
