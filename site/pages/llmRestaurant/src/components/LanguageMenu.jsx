import { useEffect, useRef } from 'react';
import { useTranslateLanguage, useTranslateToString } from '@sepoina/vitetranslate/react';

// "italiano (Italia)" -> "Italiano (Italia)": l'autonimo arriva minuscolo in molte lingue
const capitalize = (s) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

//
// Selettore di lingua a tendina: <details class="dropdown"> di Pico CSS, nessuna libreria in più.
// Si chiude scegliendo, cliccando fuori o con Esc.
//
export default function LanguageMenu() {
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();
  const ts = useTranslateToString();
  const ref = useRef(null);

  useEffect(() => {
    const close = () => ref.current && (ref.current.open = false);
    const onClick = (e) => !ref.current?.contains(e.target) && close();
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // la lingua sullo schermo è anche quella del documento: sillabazione, lettori di schermo, font
  useEffect(() => {
    if (id) document.documentElement.lang = id;
  }, [id]);

  const choose = (e, tag) => {
    e.preventDefault();
    ref.current.open = false;
    // la lingua la ricorda RememberLanguage, quando arriva davvero sullo schermo
    if (tag !== id) proposeNewLanguage({ lang: tag });
  };

  return (
    <details className="dropdown lang-menu" ref={ref}>
      <summary aria-label={ts('_%_Scegli la lingua_%_')}>
        <i className="ph ph-globe-hemisphere-west" aria-hidden="true" />
        <span>{(id ?? '').split('-')[0].toUpperCase()}</span>
      </summary>
      <ul>
        {languages.map((l) => (
          <li key={l.tag}>
            <a href="#" lang={l.tag} aria-current={l.tag === id ? 'true' : undefined} onClick={(e) => choose(e, l.tag)}>
              <span>{capitalize(l.languageName)}</span>
              <small>{l.tag}</small>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
