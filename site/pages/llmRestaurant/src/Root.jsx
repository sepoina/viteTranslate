import { TransContainer, useTransLanguage } from '@sepoina/vitetranslate/react';
import App from './App';
import { pickLanguage, RememberLanguage } from './siteLanguage';

//
// La prima lingua è l'ultima scelta sul sito (salvata nel browser, vedi siteLanguage.js), se
// esiste fra queste tabelle; altrimenti l'italiano.
// useTransLanguage() funziona anche fuori dal TransContainer: legge l'elenco
// delle lingue dal manifest di build, senza caricare nessuna tabella.
//
export default function Root() {
  const { languages } = useTransLanguage();
  return (
    <TransContainer initialLanguage={pickLanguage(languages, 'it-IT')}>
      <RememberLanguage />
      <App />
    </TransContainer>
  );
}
