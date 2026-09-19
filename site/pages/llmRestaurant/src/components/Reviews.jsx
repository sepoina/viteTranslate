import { Translate } from '@sepoina/vitetranslate/react';

// Ospiti inventati come il resto del ristorante: lo dice anche il piè di pagina.
const REVIEWS = [
  {
    quote: '_%_Siamo arrivati per il tramonto e ce ne siamo andati a mezzanotte senza accorgercene. Il crudo è il migliore che abbia mangiato fuori dal Giappone._%_',
    who: 'Hélène M.',
    where: '_%_Lione_%_',
  },
  {
    quote: '_%_Servizio caldo e mai invadente. Irene ci ha consigliato un vermentino che sogno ancora adesso. Torneremo per provare il bancone dello chef._%_',
    who: 'Marco & Giulia',
    where: '_%_Torino_%_',
  },
  {
    quote: "_%_Abbiamo festeggiato qui i settant'anni di mio padre: sala privata, menù su misura e un personale che ci ha fatto sentire a casa dal primo minuto._%_",
    who: 'Stefan K.',
    where: '_%_Monaco di Baviera_%_',
  },
];

export default function Reviews() {
  return (
    <section className="section section--sand">
      <div className="wrap">
        <header className="section-head section-head--center reveal">
          <p className="eyebrow"><Translate>_%_Dicono di noi_%_</Translate></p>
          <h2 className="title">
            <Translate t="_%_Le parole <i>dei nostri ospiti</i>_%_" />
          </h2>
        </header>
        <div className="reviews">
          {REVIEWS.map((r) => (
            <figure key={r.who} className="review reveal">
              <div className="review__stars" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => <i key={n} className="ph-fill ph-star" />)}
              </div>
              <blockquote><Translate t={r.quote} /></blockquote>
              <figcaption>
                <strong>{r.who}</strong>
                <span><Translate t={r.where} /></span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
