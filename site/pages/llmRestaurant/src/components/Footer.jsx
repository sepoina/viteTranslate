import { useState } from 'react';
import { Translate, useTranslateToString, version } from '@sepoina/vitetranslate/react';
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
  const ts = useTranslateToString();
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="site-footer">
      <div className="wrap visit">
        <div className="map" aria-label={ts('_%_Mappa segnaposto del porto di Cala dei Gabbiani_%_')}>
          <span className="map__sea" />
          <span className="map__pier" />
          <span className="map__pin"><i className="ph-fill ph-map-pin" aria-hidden="true" /> <RestaurantName /></span>
          <small className="map__note"><Translate>_%_Mappa segnaposto_%_</Translate></small>
        </div>
        <div>
          <p className="eyebrow eyebrow--light"><Translate>_%_Come arrivare_%_</Translate></p>
          <h2 className="title"><Translate t="_%_In fondo al molo, <i>dove finisce la strada</i>_%_" /></h2>
          <p>
            <Translate>
              _%_Siamo a cinque minuti a piedi dalla stazione, seguendo il lungomare verso il faro.
              In auto, il parcheggio convenzionato di Piazza del Mercato è gratuito per tre ore
              ai nostri ospiti. D'estate si arriva anche dal mare: abbiamo due posti barca
              riservati sul pontile._%_
            </Translate>
          </p>
        </div>
      </div>

      <div className="wrap footer__grid">
        <div>
          <div className="brand brand--footer">
            <i className="ph ph-wind" aria-hidden="true" />
            <RestaurantName className="brand__name" />
          </div>
          <p><Translate>_%_Cucina di mare sul porto di Cala dei Gabbiani, dal 1987. Tre generazioni, una regola sola._%_</Translate></p>
          <ul className="social">
            {SOCIAL.map((s) => (
              <li key={s.icon}><a href="#top" aria-label={s.label}><i className={`ph ${s.icon}`} aria-hidden="true" /></a></li>
            ))}
          </ul>
        </div>
        <div>
          <h3><Translate>_%_Esplora_%_</Translate></h3>
          <ul className="footer__links">
            <li><a href="#storia"><Translate>_%_La storia_%_</Translate></a></li>
            <li><a href="#menu"><Translate>_%_Il menù di stagione_%_</Translate></a></li>
            <li><a href="#degustazione"><Translate>_%_Menù degustazione_%_</Translate></a></li>
            <li><a href="#eventi"><Translate>_%_Eventi privati_%_</Translate></a></li>
          </ul>
        </div>
        <div>
          <h3><Translate>_%_Contatti_%_</Translate></h3>
          <ul className="footer__links">
            <li><Translate>_%_Via del Molo Vecchio 14, Cala dei Gabbiani_%_</Translate></li>
            <li><a href="tel:+390100000000">+39 010 000 0000</a></li>
            <li><a href="mailto:tavoli@vitetranslate.example">tavoli@vitetranslate.example</a></li>
          </ul>
        </div>
        <div>
          <h3><Translate>_%_Il pescato della settimana_%_</Translate></h3>
          {subscribed ? (
            <p><Translate>_%_Fatto! Ogni giovedì vi scriviamo cosa è arrivato dal mare._%_</Translate></p>
          ) : (
            <form className="newsletter" onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }}>
              <p><Translate>_%_Ogni giovedì, una mail con i piatti fuori carta del fine settimana._%_</Translate></p>
              <fieldset role="group">
                <input type="email" required placeholder={ts('_%_La vostra email_%_')} aria-label={ts('_%_La vostra email_%_')} />
                <button type="submit" aria-label={ts('_%_Iscriviti_%_')}><i className="ph ph-arrow-right" aria-hidden="true" /></button>
              </fieldset>
            </form>
          )}
        </div>
      </div>

      <div className="wrap credits">
        <h3><Translate>_%_Fonti e crediti_%_</Translate></h3>
        <p>
          <Translate
            t="_%_<b>%s è un ristorante immaginario</b>, e il nome non è un caso: è la libreria che traduce questa pagina (versione %s). Nomi, indirizzi, recensioni e prezzi sono inventati. Le foto vengono da Unsplash, con licenza %s: uso libero, anche commerciale._%_"
            a={[<RestaurantName key="name" />, version, <a key="lic" href={UNSPLASH_LICENSE} target="_blank" rel="noreferrer">Unsplash License</a>]}
          />
        </p>
        <div className="credits__cols">
          <ul>
            {Object.values(PHOTOS).map((p) => (
              <li key={p.id}>
                <a href={photoUrl(p.id, 2400)} target="_blank" rel="noreferrer">{ts(p.alt)}</a>
                <span> · Unsplash · photo-{p.id}</span>
              </li>
            ))}
          </ul>
          <ul>
            {RESOURCES.map((r) => (
              <li key={r.name}>
                <a href={r.url} target="_blank" rel="noreferrer">{r.name}</a>
                <span> · <Translate t={r.role} /> · {r.license}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="credits__copy">© 2026 <RestaurantName /> · <Translate>_%_Tutti i diritti riservati_%_</Translate> · <a href={siteUrl()}><Translate>_%_Le altre demo di viteTranslate_%_</Translate></a></p>
      </div>
    </footer>
  );
}
