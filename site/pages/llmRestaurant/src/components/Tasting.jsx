import { Trans } from '@sepoina/vitetranslate/react';
import { useMoney } from '../format';

const MENUS = [
  {
    name: '_%_Sottocosta_%_',
    courses: 5,
    price: 75,
    pairing: 40,
    text: '_%_Un primo assaggio della nostra cucina: il crudo, un antipasto caldo, un primo, un secondo e il dolce. Perfetto per chi ci viene a trovare per la prima volta._%_',
  },
  {
    name: '_%_Mare aperto_%_',
    courses: 8,
    price: 110,
    pairing: 60,
    featured: true,
    text: '_%_Il percorso completo della stagione, con due piatti fuori carta inventati ogni settimana sul pescato. È il menù che Tommaso ordinerebbe per sé._%_',
  },
  {
    name: '_%_Carta bianca_%_',
    courses: 11,
    price: 140,
    pairing: 80,
    text: '_%_Solo al bancone dello chef, al massimo sei ospiti a sera. Si cucina davanti a voi quello che il mare ha deciso quel giorno, senza un menù scritto._%_',
  },
];

export default function Tasting() {
  const money = useMoney();
  return (
    <section className="section section--sand" id="degustazione">
      <div className="wrap">
        <header className="section-head section-head--center reveal">
          <p className="eyebrow"><Trans>Menù degustazione</Trans></p>
          <h2 className="title">
            <Trans>Lasciatevi <i>portare al largo</i></Trans>
          </h2>
          <p className="lead">
            <Trans>
              Tre rotte diverse, un'unica regola: vi fidate di noi e noi non vi facciamo mai
              mangiare due volte la stessa cosa. Ogni percorso si chiude con la piccola
              pasticceria e il caffè.
            </Trans>
          </p>
        </header>
        <div className="tasting">
          {MENUS.map((m) => (
            <article key={m.name} className={`tasting__card reveal${m.featured ? ' is-featured' : ''}`}>
              {m.featured && (
                <span className="tasting__badge"><Trans>Il più scelto</Trans></span>
              )}
              <p className="tasting__courses"><Trans t="_%_%s portate_%_" a={[m.courses]} /></p>
              <h3><Trans t={m.name} /></h3>
              <p className="tasting__price">
                {money(m.price)}
                <small><Trans>a persona</Trans></small>
              </p>
              <p><Trans t={m.text} /></p>
              <p className="tasting__pairing">
                <i className="ph ph-wine" aria-hidden="true" /> <Trans t="_%_Abbinamento vini: + {0, number, ::currency/EUR precision-integer}_%_" a={[m.pairing]} />
              </p>
              <a href="#prenota" role="button" className={m.featured ? '' : 'outline'}>
                <Trans>Prenota questo percorso</Trans>
              </a>
            </article>
          ))}
        </div>
        <p className="fine-print">
          <Trans>
            I menù degustazione sono serviti all'intero tavolo e si possono ordinare fino alle
            21:30. Varianti vegetariane su richiesta, con un giorno di preavviso.
          </Trans>
        </p>
      </div>
    </section>
  );
}
