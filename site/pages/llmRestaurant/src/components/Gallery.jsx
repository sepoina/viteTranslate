import { Trans } from '@sepoina/vitetranslate/react';
import Photo from './Photo';
import RestaurantName from './RestaurantName';
import { PHOTOS } from '../photos';

const SHOTS = [
  { photo: PHOTOS.table, className: 'g-wide g-tall' },
  { photo: PHOTOS.hall },
  { photo: PHOTOS.guest },
  { photo: PHOTOS.flames, className: 'g-tall' },
  { photo: PHOTOS.friends, className: 'g-wide' },
  { photo: PHOTOS.loft },
];

export default function Gallery() {
  return (
    <section className="section section--tight">
      <div className="wrap">
        <header className="section-head section-head--row reveal">
          <div>
            <p className="eyebrow"><Trans>Atmosfera</Trans></p>
            <h2 className="title">
              <Trans>Una sera <i>da <RestaurantName /></i></Trans>
            </h2>
          </div>
          <p>
            <Trans>
              Due sale, una terrazza e una cucina a vista dove il fuoco non si spegne mai prima
              di mezzanotte. Venite presto: il tramonto, da qui, dura più a lungo.
            </Trans>
          </p>
        </header>
        <div className="gallery">
          {SHOTS.map((s) => (
            <Photo key={s.photo.id} photo={s.photo} w={1000} className={`reveal ${s.className ?? ''}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
