import { useState } from 'react';
import { Translate, useTranslateToString } from '@sepoina/vitetranslate/react';
import { useMoney } from '../format';

const TAGS = {
  signature: { icon: 'ph-star', label: '_%_Piatto firma_%_' },
  veg: { icon: 'ph-leaf', label: '_%_Vegetariano_%_' },
  gf: { icon: 'ph-grains-slash', label: '_%_Senza glutine_%_' },
};

//
// La carta di settembre. `unit`, quando c'è, è la frase intorno al prezzo ("%s all'etto"):
// il numero lo formatta il browser, la frase la traduce la tabella.
//
const MENU = [
  {
    id: 'antipasti',
    label: '_%_Antipasti_%_',
    items: [
      { name: '_%_Crudo della casa_%_', desc: "_%_Gambero rosso, scampo, ricciola e ostrica del golfo, con olio agli agrumi e sale affumicato._%_", price: 28, tags: ['signature', 'gf'] },
      { name: '_%_Acciughe di nonna Ada_%_', desc: '_%_Fritte in una pastella leggera alla birra e servite nel cartoccio, con maionese al limone bruciato._%_', price: 14 },
      { name: '_%_Polpo alla brace_%_', desc: '_%_Arrostito sul carbone di leccio, con crema di patate viola, olive taggiasche e salsa verde._%_', price: 19, tags: ['gf'] },
      { name: '_%_Fiori di zucca ripieni_%_', desc: "_%_Ricotta di pecora, maggiorana dell'orto e scorza di limone, su una vellutata di pomodoro giallo._%_", price: 13, tags: ['veg'] },
      { name: '_%_Tartare di tonno rosso_%_', desc: '_%_Tagliata al coltello, con capperi di Pantelleria, pesca bianca e gocce di aceto di lamponi._%_', price: 22, tags: ['gf'] },
    ],
  },
  {
    id: 'primi',
    label: '_%_Primi_%_',
    items: [
      { name: '_%_Spaghettone ai gamberi rossi_%_', desc: '_%_Pasta di grano duro mantecata con la bisque dei loro carapaci, pomodorini confit e basilico appena colto._%_', price: 26, tags: ['signature'] },
      { name: '_%_Tagliolini al nero di seppia_%_', desc: '_%_Tirati a mano ogni pomeriggio, con seppioline scottate, piselli novelli e una grattugiata di bottarga di muggine._%_', price: 22 },
      { name: '_%_Risotto al limone e scampi crudi_%_', desc: "_%_Carnaroli mantecato al limone e burro d'alga, completato al tavolo con scampi appena marinati._%_", price: 27, tags: ['gf'] },
      { name: '_%_Pansoti di borragine_%_', desc: '_%_Ravioli ripieni di erbe selvatiche e formaggio fresco, con la salsa di noci della tradizione di famiglia._%_', price: 18, tags: ['veg'] },
    ],
  },
  {
    id: 'secondi',
    label: '_%_Secondi_%_',
    items: [
      { name: '_%_Pescato del giorno al sale_%_', desc: '_%_Cotto intero in crosta di sale grosso e sfilettato al tavolo. Chiedete al personale di sala cosa è arrivato stamattina._%_', price: 8, unit: "_%_%s all'etto_%_", tags: ['gf'] },
      { name: '_%_Trancio di ricciola_%_', desc: '_%_Scottata sulla pelle, con asparagi di mare, cipolla rossa in agrodolce e chicchi di melagrana._%_', price: 32, tags: ['signature', 'gf'] },
      { name: '_%_Frittura del Molo_%_', desc: "_%_Calamari, gamberi, triglie e verdure dell'orto, fritti in olio extravergine e serviti con sale al rosmarino._%_", price: 24 },
      { name: '_%_Cacciucco della domenica_%_', desc: "_%_Solo la domenica e solo per due: la zuppa di pesce della casa, con crostoni di pane all'aglio._%_", price: 48, unit: '_%_%s per due persone_%_' },
    ],
  },
  {
    id: 'dolci',
    label: '_%_Dolci_%_',
    items: [
      { name: '_%_Tiramisù al caffè di moka_%_', desc: '_%_Savoiardi fatti in casa, mascarpone montato al momento e caffè preparato nella moka di famiglia._%_', price: 9, tags: ['veg'] },
      { name: '_%_Sorbetto al limone e basilico_%_', desc: "_%_Limoni dell'orto e basilico genovese, mantecati ogni mattina. Il modo migliore per chiudere una cena di mare._%_", price: 7, tags: ['veg', 'gf'] },
      { name: '_%_Crostata di fichi e mandorle_%_', desc: '_%_Frolla al burro salato, fichi neri caramellati e una quenelle di gelato alla crema._%_', price: 10, tags: ['veg'] },
      { name: '_%_Cioccolato, olio e sale_%_', desc: '_%_Ganache di cioccolato fondente, olio extravergine della collina e qualche fiocco di sale marino._%_', price: 11, tags: ['veg', 'gf'] },
    ],
  },
];

export default function Menu() {
  const [active, setActive] = useState(MENU[0].id);
  const money = useMoney();
  const ts = useTranslateToString();
  const course = MENU.find((c) => c.id === active);

  return (
    <section className="section" id="menu">
      <div className="wrap">
        <header className="section-head section-head--center reveal">
          <p className="eyebrow"><Translate>_%_Alla carta_%_</Translate></p>
          <h2 className="title">
            <Translate t="_%_Il menù <i>di stagione</i>_%_" />
          </h2>
          <p className="lead">
            <Translate>
              _%_La carta cambia con le stagioni e, qualche volta, con il meteo. Quella che leggete
              qui è la carta di settembre: chiedete sempre il pescato fuori menù, che arriva
              scritto a mano sulla lavagna._%_
            </Translate>
          </p>
        </header>

        <div className="tabs" role="tablist">
          {MENU.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === active}
              className={c.id === active ? 'is-active' : ''}
              onClick={() => setActive(c.id)}
            >
              <Translate t={c.label} />
            </button>
          ))}
        </div>

        <ul className="menu-list" role="tabpanel" key={active}>
          {course.items.map((item) => (
            <li key={item.name}>
              <div className="menu-item__head">
                <h3>
                  <Translate t={item.name} />
                  {item.tags?.map((t) => (
                    <i key={t} className={`ph ${TAGS[t].icon} menu-tag`} title={ts(TAGS[t].label)} aria-label={ts(TAGS[t].label)} />
                  ))}
                </h3>
                <span className="menu-item__dots" aria-hidden="true" />
                <span className="menu-item__price">
                  {item.unit ? <Translate t={item.unit} a={[money(item.price)]} /> : money(item.price)}
                </span>
              </div>
              <p><Translate t={item.desc} /></p>
            </li>
          ))}
        </ul>

        <footer className="menu-note">
          <ul className="menu-legend">
            {Object.entries(TAGS).map(([key, t]) => (
              <li key={key}><i className={`ph ${t.icon}`} aria-hidden="true" /> <Translate t={t.label} /></li>
            ))}
          </ul>
          <p>
            <Translate
              t="_%_Coperto %s · pane, focaccia e grissini fatti in casa. <b>Segnalate sempre allergie e intolleranze</b>: la cucina adatta ogni piatto quando è possibile._%_"
              a={[money(4)]}
            />
          </p>
        </footer>
      </div>
    </section>
  );
}
