import { Trans } from "@sepoina/vitetranslate/react";

// Gli endonimi delle lingue: un elenco mostrato, non frasi da tradurre.
const LANGUAGES = [
  "Italiano",
  "English",
  "中文",
  "Français",
  "Deutsch",
  "Português",
  "日本語",
  "Español",
  "한국어",
  "Nederlands",
  "Polski",
  "Türkçe",
  "Русский",
  "हिन्दी",
  "Ελληνικά",
  "Svenska",
];

// La striscia delle lingue, in fondo alla sezione "Come si vede". Due righe uguali che scorrono di
// metà: il giro si chiude senza salti. Con il movimento ridotto resta una riga sola, che va a capo.
export default function Marquee() {
  const row = LANGUAGES.map((name) => <span key={name}>{name}</span>);

  return (
    <div className="marquee-sec" data-reveal>
      <p className="marquee-cap">
        <Trans>_%_Una sola sorgente. Tutte le lingue che vuoi._%_</Trans>
      </p>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          <div className="marquee-row">{row}</div>
          <div className="marquee-row">{row}</div>
        </div>
      </div>
    </div>
  );
}
