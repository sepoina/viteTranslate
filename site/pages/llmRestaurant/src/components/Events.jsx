import { Translate } from '@sepoina/vitetranslate/react';
import Photo from './Photo';
import { PHOTOS } from '../photos';

const ROOMS = [
  {
    icon: 'ph-users-three',
    name: '_%_La Sala delle Reti_%_',
    text: "_%_Fino a 24 ospiti seduti, con il camino acceso d'inverno e una porta che scende dritta in cantina._%_",
  },
  {
    icon: 'ph-sun-horizon',
    name: '_%_La Terrazza_%_',
    text: '_%_Fino a 60 ospiti in piedi, per aperitivi, anniversari e cerimonie con il sole che cala sul golfo._%_',
  },
  {
    icon: 'ph-fire',
    name: '_%_Il bancone dello chef_%_',
    text: '_%_Sei posti in prima fila davanti ai fornelli, per una cena che sembra una lezione privata._%_',
  },
];

export default function Events() {
  return (
    <section className="section" id="eventi">
      <div className="wrap split">
        <div className="reveal">
          <Photo photo={PHOTOS.events} w={1100} className="wide" />
        </div>
        <div className="prose reveal">
          <p className="eyebrow"><Translate>_%_Eventi privati_%_</Translate></p>
          <h2 className="title">
            <Translate t="_%_Una tavola lunga <i>per i giorni importanti</i>_%_" />
          </h2>
          <p>
            <Translate>
              _%_Compleanni, cene aziendali, matrimoni intimi: costruiamo il menù insieme a voi,
              partendo dal pescato della settimana e da quello che vi piace. Pensiamo noi anche ai
              fiori, alla musica e alla torta._%_
            </Translate>
          </p>
          <ul className="rooms">
            {ROOMS.map((r) => (
              <li key={r.icon}>
                <i className={`ph ${r.icon}`} aria-hidden="true" />
                <div>
                  <strong><Translate t={r.name} /></strong>
                  <span><Translate t={r.text} /></span>
                </div>
              </li>
            ))}
          </ul>
          <a href="mailto:eventi@vitetranslate.example" role="button" className="outline">
            <i className="ph ph-envelope-simple" aria-hidden="true" /> <Translate>_%_Richiedi un preventivo_%_</Translate>
          </a>
        </div>
      </div>
    </section>
  );
}
