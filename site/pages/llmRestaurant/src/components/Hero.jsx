import { Translate } from '@sepoina/vitetranslate/react';
import Photo from './Photo';
import { PHOTOS } from '../photos';

const FACTS = [
  { icon: 'ph-clock', label: '_%_Stasera_%_', value: '_%_Cena dalle 19:30 alle 23:30_%_' },
  { icon: 'ph-map-pin', label: '_%_Dove_%_', value: '_%_Via del Molo Vecchio 14, sul porto_%_' },
  { icon: 'ph-sun-horizon', label: '_%_In terrazza_%_', value: '_%_32 coperti vista mare, solo su prenotazione_%_' },
];

export default function Hero() {
  return (
    <section className="hero" id="top">
      <Photo photo={PHOTOS.terrace} w={2000} className="hero__bg" eager />
      <div className="hero__shade" aria-hidden="true" />
      <div className="wrap hero__content">
        <p className="eyebrow eyebrow--light">
          <Translate>Cucina di mare · Cala dei Gabbiani</Translate>
        </p>
        <h1 className="hero__title">
          <Translate>Il mare arriva in tavola<br /><i>prima del tramonto</i></Translate>
        </h1>
        <p className="hero__lead">
          <Translate>
            Ogni mattina alle sei le barche di Cala dei Gabbiani rientrano in porto. Alle sette
            il nostro chef è già sul molo a scegliere il pescato: quello che trovate nel piatto la
            sera, la notte prima nuotava ancora a due miglia dalla costa.
          </Translate>
        </p>
        <div className="hero__cta">
          <a href="#prenota" role="button">
            <Translate>Prenota un tavolo</Translate> <i className="ph ph-arrow-right" aria-hidden="true" />
          </a>
          <a href="#menu" role="button" className="outline contrast">
            <Translate>Sfoglia il menù</Translate>
          </a>
        </div>
        <dl className="hero__facts">
          {FACTS.map((f) => (
            <div key={f.icon}>
              <dt><i className={`ph ${f.icon}`} aria-hidden="true" /> <Translate t={f.label} /></dt>
              <dd><Translate t={f.value} /></dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
