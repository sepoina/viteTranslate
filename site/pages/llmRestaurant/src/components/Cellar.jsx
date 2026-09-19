import { Translate } from '@sepoina/vitetranslate/react';
import Photo from './Photo';
import { PHOTOS } from '../photos';

const POINTS = [
  '_%_Oltre sessanta vini al calice, che ruotano ogni settimana_%_',
  '_%_Una selezione dedicata a vini naturali e biodinamici_%_',
  '_%_Champagne di piccoli vignaioli, scelti uno per uno in Francia_%_',
  '_%_Amari, grappe e distillati della costa, per chiudere la serata_%_',
];

export default function Cellar() {
  return (
    <section className="section" id="cantina">
      <div className="wrap split split--reverse">
        <div className="prose reveal">
          <p className="eyebrow"><Translate>_%_La cantina_%_</Translate></p>
          <h2 className="title">
            <Translate t="_%_420 etichette, <i>scavate nella roccia</i>_%_" />
          </h2>
          <p className="lead">
            <Translate>
              _%_La nostra cantina era la grotta dove i pescatori riparavano le reti, scavata nel
              tufo proprio sotto la sala: quattordici gradi tutto l'anno, senza bisogno di
              impianti._%_
            </Translate>
          </p>
          <p>
            <Translate>
              _%_Custodisce 420 etichette, con una predilezione dichiarata per i bianchi di mare e i
              piccoli produttori della costa. Irene, la nostra sommelier, vi guiderà tra vermentini
              di scogliera, bollicine rifermentate in bottiglia e qualche rarità da tenere da parte
              per le occasioni che se lo meritano._%_
            </Translate>
          </p>
          <ul className="checklist">
            {POINTS.map((p) => (
              <li key={p}><i className="ph ph-check" aria-hidden="true" /> <Translate t={p} /></li>
            ))}
          </ul>
        </div>
        <div className="reveal">
          <Photo photo={PHOTOS.wine} w={1000} className="tall" />
        </div>
      </div>
    </section>
  );
}
