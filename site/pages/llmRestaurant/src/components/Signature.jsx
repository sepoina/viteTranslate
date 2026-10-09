import { Trans } from '@sepoina/vitetranslate/react';
import Photo from './Photo';
import { PHOTOS } from '../photos';

const DISHES = [
  {
    photo: PHOTOS.shrimp,
    name: '_%_Spaghettone ai gamberi rossi_%_',
    text: '_%_Il piatto con cui Tommaso si è presentato alla famiglia, al ritorno da Tokyo. La bisque cuoce sei ore; la pasta, undici minuti esatti._%_',
    err: '_%_Il piantto con cui Tommaso si è presentato alla famiglia, al ritorno da Tokyo. La bisque cuoce sei ore; la pasta, undici minuti esatti._%_',
  },
  {
    photo: PHOTOS.amberjack,
    name: '_%_Trancio di ricciola_%_',
    text: "_%_Pelle croccante come una cialda, cuore appena rosato. L'agrodolce della cipolla e la melagrana lo rendono il secondo più ordinato dell'estate._%_",
  },
  {
    photo: PHOTOS.bream,
    name: "_%_Orata all'acqua pazza_%_",
    text: "_%_La ricetta di nonna Ada, rimasta identica dal 1987: pomodorini, capperi, un filo d'olio e l'acqua di mare che dà il nome al piatto._%_",
  },
];

export default function Signature() {
  return (
    <section className="section section--ink">
      <div className="wrap">
        <header className="section-head section-head--row reveal">
          <div>
            <p className="eyebrow eyebrow--light"><Trans>I piatti firma</Trans></p>
            <h2 className="title">
              <Trans>Tre piatti che <i>non togliamo mai</i> dalla carta</Trans>
            </h2>
          </div>
          <p>
            <Trans>
              Li abbiamo provati a togliere, una volta. Per tre settimane gli ospiti li hanno
              chiesti lo stesso, e sono tornati al loro posto.
            </Trans>
          </p>
        </header>
        <div className="dishes">
          {DISHES.map((d, i) => (
            <article key={d.name} className="dish reveal">
              <Photo photo={d.photo} w={900} h={1100} className="dish__photo" />
              <span className="dish__num">0{i + 1}</span>
              <h3><Trans t={d.name} /></h3>
              <p><Trans t={d.text} /></p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
