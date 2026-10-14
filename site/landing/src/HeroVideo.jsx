import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { VIDEO_URL } from "./links.js";

// Il video "perché viteTranslate": un poster (public/video/poster.webp, ~95 kB) che apre YouTube in
// una scheda nuova. Niente player incorporato: l'embed a volte chiede "Accedi per confermare di non
// essere un bot" (controllo di YouTube su IP e sessione, non aggirabile da qui), e sulla pagina di
// YouTube il video parte comunque con l'audio.
// Una banda a tutta larghezza in fondo all'hero, data-theme="dark": resta scura anche nel tema
// chiaro, come il poster.
export default function HeroVideo() {
  const trans = useTrans();
  const title = trans("_%_Video: perché viteTranslate e come lavora il suo ecosistema_%_");

  return (
    <figure className="video" data-theme="dark">
      <div className="video-frame" data-reveal>
        <div className="video-screen">
          <a className="video-poster" href={VIDEO_URL} target="_blank" rel="noopener" aria-label={title}>
            <img src={`${import.meta.env.BASE_URL}video/poster.webp`} alt="" width="1280" height="731" decoding="async" />
            <span className="video-play" aria-hidden="true" />
          </a>
        </div>
      </div>

      <figcaption className="video-cap">
        <span className="video-tag">
          <Trans>_%_Il video_%_</Trans>
        </span>
        <span>
          <Trans>_%_Perché viteTranslate, e come lavorano insieme i suoi pezzi._%_</Trans>
        </span>
        <a className="video-yt" href={VIDEO_URL} target="_blank" rel="noopener">
          YouTube <span aria-hidden="true">↗</span>
        </a>
      </figcaption>
    </figure>
  );
}
