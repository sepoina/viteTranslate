import { useEffect, useRef } from 'react';
import { useTransLanguage, useTrans } from '@sepoina/vitetranslate/react';

// "italiano (Italia)" -> "Italiano (Italia)": l'autonimo arriva minuscolo in molte lingue
const capitalize = (s) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

//
// Selettore di lingua a tendina: <details class="dropdown"> di Pico CSS, nessuna libreria in più.
// Si chiude scegliendo, cliccando fuori o con Esc (and Esc gives the focus back to the summary).
// Each language is a <button>: choosing one is an action, not a link somewhere. translate="no": the
// names are the languages' own (endonyms), the browser's translator leaves them alone.
// <html lang> follows the language on screen: RememberLanguage (siteLanguage.js) sees to it.
//
export default function LanguageMenu() {
  const { id, languages, proposeNewLanguage } = useTransLanguage();
  const trans = useTrans();
  const ref = useRef(null);

  useEffect(() => {
    const close = () => ref.current && (ref.current.open = false);
    const onClick = (e) => !ref.current?.contains(e.target) && close();
    const onKey = (e) => {
      if (e.key !== 'Escape' || !ref.current?.open) return;
      close();
      ref.current.querySelector('summary').focus();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const choose = (tag) => {
    ref.current.open = false;
    ref.current.querySelector('summary').focus();
    // la lingua la ricorda RememberLanguage, quando arriva davvero sullo schermo
    if (tag !== id) proposeNewLanguage({ lang: tag });
  };

  const code = (id ?? '').split('-')[0].toUpperCase();

  return (
    <details className="dropdown lang-menu" ref={ref} translate="no">
      {/* The name starts with what is written on it (the code), then says what it does. */}
      <summary aria-label={`${code} · ${trans('_%_Scegli la lingua_%_')}`}>
        <i className="ph ph-globe-hemisphere-west" aria-hidden="true" />
        <span>{code}</span>
      </summary>
      <ul>
        {languages.map((l) => (
          <li key={l.tag}>
            <button type="button" lang={l.tag} aria-current={l.tag === id ? 'true' : undefined} onClick={() => choose(l.tag)}>
              <span>{capitalize(l.languageName)}</span>
              <small>{l.tag}</small>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
