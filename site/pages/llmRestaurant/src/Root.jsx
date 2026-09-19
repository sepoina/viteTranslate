import { TranslateContainer, useTranslateLanguage } from '@sepoina/vitetranslate/react';
import App from './App';
import { pickLanguage, RememberLanguage } from './siteLanguage';

//
// La prima lingua è l'ultima scelta sul sito (salvata nel browser, vedi siteLanguage.js), se
// esiste fra queste tabelle; altrimenti l'italiano.
// useTranslateLanguage() funziona anche fuori dal TranslateContainer: legge l'elenco
// delle lingue dal manifest di build, senza caricare nessuna tabella.
//
export default function Root() {
  const { languages } = useTranslateLanguage();
  return (
    <TranslateContainer initialLanguage={pickLanguage(languages, 'it-IT')}>
      <RememberLanguage />
      <App />
    </TranslateContainer>
  );
}
