// L'ultima lingua scelta, ricordata nel browser e condivisa da tutto il sito: landing e pagine
// stanno sulla stessa origine, quindi sullo stesso localStorage, e leggono la stessa chiave.
// Copia identica in site/landing e in ogni site/pages/*: una pagina deve restare autonoma.
// localStorage può mancare o lanciare (navigazione privata, dati del sito bloccati): in quel
// caso si parte come alla prima visita, senza errori.
import { useEffect, useRef } from "react";
import { useTranslateLanguage } from "@sepoina/vitetranslate/react";

const KEY = "viteTranslate.site.language";

function load() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function save(tag) {
  try {
    localStorage.setItem(KEY, tag);
  } catch {
    /* la scelta vale solo per questa visita */
  }
}

/**
 * La lingua da cui partire: quella ricordata, se questa pagina ce l'ha fra le sue tabelle
 * (ogni pagina ha un insieme di lingue suo, e una lingua tolta da locale/ non deve rompere
 * l'avvio); altrimenti `fallback`.
 * @param {{ tag: string }[]} languages l'elenco di useTranslateLanguage(), valido anche fuori dal container
 * @param {string} fallback
 */
export function pickLanguage(languages, fallback) {
  const saved = load();
  return languages.some((l) => l.tag === saved) ? saved : fallback;
}

/**
 * Da mettere dentro il TranslateContainer: ricorda ogni lingua che arriva davvero sullo schermo
 * (se il chunk non carica, `id` non cambia e non si salva niente). La lingua d'avvio non si salva:
 * chi non ha mai scelto non ha una preferenza.
 */
export function RememberLanguage() {
  const { id } = useTranslateLanguage();
  const seen = useRef(id);
  useEffect(() => {
    if (id && id !== seen.current) {
      seen.current = id;
      save(id);
    }
  }, [id]);
  return null;
}
