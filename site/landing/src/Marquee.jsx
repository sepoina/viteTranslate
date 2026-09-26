import { Translate } from "@sepoina/vitetranslate/react";

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

export default function Marquee() {
  const row = LANGUAGES.map((name) => <span key={name}>{name}</span>);

  return (
    <section className="marquee-sec" data-reveal>
      <div className="wrap marquee-in">
        <p className="marquee-cap">
          <Translate>_%_Una sola sorgente. Tutte le lingue che vuoi._%_</Translate>
        </p>
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            <div className="marquee-row">{row}</div>
            <div className="marquee-row">{row}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
