import { Translate } from '@sepoina/vitetranslate/react';
import Photo from './Photo';
import { PHOTOS } from '../photos';

const STATS = [
  { value: '38', label: '_%_anni sul porto_%_' },
  { value: '7', label: '_%_barche di pescatori amici_%_' },
  { value: '420', label: '_%_etichette in cantina_%_' },
  { value: '3', label: '_%_generazioni in cucina_%_' },
];

const PROMISES = [
  {
    icon: 'ph-fish',
    title: '_%_Pescato del giorno_%_',
    text: '_%_Lavoriamo con sette barche della piccola pesca locale. Niente allevamenti, niente surgelati: se il mare è grosso il menù si accorcia, e ve lo diciamo con onestà._%_',
  },
  {
    icon: 'ph-plant',
    title: "_%_L'orto sulla collina_%_",
    text: "_%_Erbe aromatiche, pomodori, carciofi e agrumi arrivano dal nostro orto terrazzato a quattro chilometri dal porto, coltivato senza chimica da Luca e Marta._%_",
  },
  {
    icon: 'ph-hourglass-medium',
    title: '_%_Il tempo giusto_%_',
    text: '_%_Paste tirate a mano ogni pomeriggio, fondi che cuociono per dodici ore, pane a lievitazione naturale sfornato due volte al giorno. Certe cose non si possono accelerare._%_',
  },
];

export default function Story() {
  return (
    <>
      <section className="stats">
        <div className="wrap stats__grid">
          {STATS.map((s) => (
            <div key={s.value} className="reveal">
              <strong>{s.value}</strong>
              <span><Translate t={s.label} /></span>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="storia">
        <div className="wrap split">
          <div className="collage reveal">
            <Photo photo={PHOTOS.plating} w={900} className="collage__main" />
            <Photo photo={PHOTOS.knife} w={600} className="collage__side" />
            <span className="collage__badge">
              <strong>1987</strong>
              <Translate>_%_il primo chiosco sul molo_%_</Translate>
            </span>
          </div>
          <div className="prose reveal">
            <p className="eyebrow"><Translate>_%_La nostra storia_%_</Translate></p>
            <h2 className="title">
              <Translate t="_%_Da un chiosco di fritture a <i>una tavola sul mare</i>_%_" />
            </h2>
            <p className="lead">
              <Translate>
                _%_Nel 1987 nonna Ada friggeva acciughe in un chiosco di legno a dieci metri
                dall'acqua. Aveva quattro tavoli, una lavagna scritta col gesso e una regola sola:
                si cucina soltanto quello che il mare ha portato oggi._%_
              </Translate>
            </p>
            <p>
              <Translate>
                _%_Trentotto anni dopo i tavoli sono diventati sessantaquattro, la lavagna è ancora
                appesa accanto alla porta della cucina e la regola non è cambiata di una virgola.
                Ai fornelli c'è Tommaso, il nipote, tornato a casa dopo dieci anni tra Parigi,
                San Sebastián e Tokyo con una valigia di tecniche e la stessa fame di semplicità._%_
              </Translate>
            </p>
            <p>
              <Translate>
                _%_La nostra è una cucina di sottrazione: pochi ingredienti, cotture precise, sapori
                che si riconoscono a occhi chiusi. Un piatto è finito quando non c'è più niente da
                togliere._%_
              </Translate>
            </p>
            <blockquote className="signature">
              <Translate>
                _%_«Il pesce buono non ha bisogno di essere convinto. Ha solo bisogno che nessuno
                lo rovini.»_%_
              </Translate>
              <footer>
                <cite>Tommaso Ferrando</cite> · <Translate>_%_chef e patron_%_</Translate>
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="section section--sand">
        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow"><Translate>_%_Quello che non cambia_%_</Translate></p>
            <h2 className="title">
              <Translate t="_%_Tre promesse, <i>ogni sera</i>_%_" />
            </h2>
          </header>
          <div className="promises">
            {PROMISES.map((p) => (
              <article key={p.icon} className="promise reveal">
                <span className="promise__icon"><i className={`ph ${p.icon}`} aria-hidden="true" /></span>
                <h3><Translate t={p.title} /></h3>
                <p><Translate t={p.text} /></p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
