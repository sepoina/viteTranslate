import { useState } from 'react';
import { Trans, useTrans, version } from '@sepoina/vitetranslate/react';
import { PHOTOS, UNSPLASH_LICENSE, photoUrl } from '../photos';
import RestaurantName from './RestaurantName';
import { siteUrl } from '../siteLinks';

// Tutto quello che la pagina prende da fuori, con la sua licenza.
const RESOURCES = [
  { name: 'Pico CSS', url: 'https://picocss.com', license: 'MIT', role: '_%_framework CSS, moduli e tendine_%_' },
  { name: 'Phosphor Icons', url: 'https://phosphoricons.com', license: 'MIT', role: '_%_icone_%_' },
  { name: 'Cormorant Garamond · Manrope · Noto JP', url: 'https://fonts.google.com', license: 'SIL OFL 1.1', role: '_%_caratteri tipografici, da Google Fonts_%_' },
  { name: 'jsDelivr', url: 'https://www.jsdelivr.com', license: 'CDN', role: '_%_distribuzione di CSS e icone_%_' },
];

const SOCIAL = [
  { icon: 'ph-instagram-logo', label: 'Instagram' },
  { icon: 'ph-facebook-logo', label: 'Facebook' },
  { icon: 'ph-tiktok-logo', label: 'TikTok' },
];

export default function Footer() {
  const trans = useTrans();
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="site-footer">
      <div className="wrap visit">
        <div className="map" aria-label={trans('_%_Mappa segnaposto del porto di Cala dei Gabbiani_%_')}>
          <span className="map__sea" />
          <span className="map__pier" />
          <span className="map__pin"><i className="ph-fill ph-map-pin" aria-hidden="true" /> <RestaurantName /></span>
          <small className="map__note"><Trans>Mappa segnaposto</Trans></small>
        </div>
        <div>
          <p className="eyebrow eyebrow--light"><Trans>Come arrivare</Trans></p>
          <h2 className="title"><Trans>In fondo al molo, <i>dove finisce la strada</i></Trans></h2>
          <p>
            <Trans>
              Siamo a cinque minuti a piedi dalla stazione, seguendo il lungomare verso il faro.
              In auto, il parcheggio convenzionato di Piazza del Mercato è gratuito per tre ore
              ai nostri ospiti. D'estate si arriva anche dal mare: abbiamo due posti barca
              riservati sul pontile.
            </Trans>
          </p>
        </div>
      </div>

      <div className="wrap footer__grid">
        <div>
          <div className="brand brand--footer">
            <i className="ph ph-wind" aria-hidden="true" />
            <RestaurantName className="brand__name" />
          </div>
          <p><Trans>Cucina di mare sul porto di Cala dei Gabbiani, dal 1987. Tre generazioni, una regola sola.</Trans></p>
          <ul className="social">
            {SOCIAL.map((s) => (
              <li key={s.icon}><a href="#top" aria-label={s.label}><i className={`ph ${s.icon}`} aria-hidden="true" /></a></li>
            ))}
          </ul>
        </div>
        <div>
          <h3><Trans>Esplora</Trans></h3>
          <ul className="footer__links">
            <li><a href="#storia"><Trans>La storia</Trans></a></li>
            <li><a href="#menu"><Trans>Il menù di stagione</Trans></a></li>
            <li><a href="#degustazione"><Trans>Menù degustazione</Trans></a></li>
            <li><a href="#eventi"><Trans>Eventi privati</Trans></a></li>
          </ul>
        </div>
        <div>
          <h3><Trans>Contatti</Trans></h3>
          <ul className="footer__links">
            <li><Trans>Via del Molo Vecchio 14, Cala dei Gabbiani</Trans></li>
            <li><a href="tel:+390100000000">+39 010 000 0000</a></li>
            <li><a href="mailto:tavoli@vitetranslate.example">tavoli@vitetranslate.example</a></li>
          </ul>
        </div>
        <div>
          <h3><Trans>Il pescato della settimana</Trans></h3>
          {subscribed ? (
            <p><Trans>Fatto! Ogni giovedì vi scriviamo cosa è arrivato dal mare.</Trans></p>
          ) : (
            <form className="newsletter" onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }}>
              <p><Trans>Ogni giovedì, una mail con i piatti fuori carta del fine settimana.</Trans></p>
              <fieldset role="group">
                <input type="email" required placeholder={trans('_%_La vostra email_%_')} aria-label={trans('_%_La vostra email_%_')} />
                <button type="submit" aria-label={trans('_%_Iscriviti_%_')}><i className="ph ph-arrow-right" aria-hidden="true" /></button>
              </fieldset>
            </form>
          )}
        </div>
      </div>

      <div className="wrap credits">
        <h3><Trans>Fonti e crediti</Trans></h3>
        <p>
          <Trans>
            <b><RestaurantName /> è un ristorante immaginario</b>, e il nome non è un caso: è la libreria che traduce
            questa pagina (versione {version}). Nomi, indirizzi, recensioni e prezzi sono inventati. Le foto vengono da
            Unsplash, con licenza{' '}
            <a href={UNSPLASH_LICENSE} target="_blank" rel="noreferrer">Unsplash License</a>: uso libero, anche commerciale.
          </Trans>
        </p>
        <div className="credits__cols">
          <ul>
            {Object.values(PHOTOS).map((p) => (
              <li key={p.id}>
                <a href={photoUrl(p.id, 2400)} target="_blank" rel="noreferrer">{trans(p.alt)}</a>
                <span> · Unsplash · photo-{p.id}</span>
              </li>
            ))}
          </ul>
          <ul>
            {RESOURCES.map((r) => (
              <li key={r.name}>
                <a href={r.url} target="_blank" rel="noreferrer">{r.name}</a>
                <span> · <Trans t={r.role} /> · {r.license}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="credits__copy">© 2026 <RestaurantName /> · <Trans>Tutti i diritti riservati</Trans> · <a href={siteUrl()}><Trans>Le altre demo di viteTranslate</Trans></a></p>
      </div>
    </footer>
  );
}
