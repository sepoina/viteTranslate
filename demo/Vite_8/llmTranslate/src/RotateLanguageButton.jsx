import { useTransLanguage } from '@sepoina/vitetranslate/react';

export default function RotateLanguageButton() {
  //
  // hook che legge lo stato del sistema di traduzione, e fornisce la lingua corrente
  // l'elenco delle lingue disponibili e la funzione per cambiare lingua.
  //
  const { id, languages, proposeNewLanguage } = useTransLanguage();
  //
  // lingua corrente o "sconosciuta"
  const corrente =
    languages.find((l) => l.tag === id)?.languageName ?? '[lingua sconosciuta]';
  //
  // prossima lingua in sistema carosello
  const next =
    languages[
      (languages.findIndex((l) => l.tag === id) + 1) % languages.length
    ];
  //
  //
  return (
    <button
      onClick={() => next.tag && proposeNewLanguage({ lang: next.tag })}
      style={{ marginTop: '4vh' }}
    >
      {corrente}
      <span
        style={{ fontSize: '1.5em', verticalAlign: 'middle', opacity: 0.4 }}
      >
        &nbsp;🠊&nbsp;
      </span>
      {next.languageName}
    </button>
  );
}
