import { useEffect, useState } from 'react';
import { Translate } from '@sepoina/vitetranslate/react';
import LanguageMenu from './LanguageMenu';
import RestaurantName from './RestaurantName';

const LINKS = [
  { href: '#storia', label: '_%_La storia_%_' },
  { href: '#menu', label: '_%_Menù_%_' },
  { href: '#degustazione', label: '_%_Degustazione_%_' },
  { href: '#cantina', label: '_%_Cantina_%_' },
  { href: '#eventi', label: '_%_Eventi_%_' },
];

export default function Header() {
  //
  // trasparente sopra la foto di apertura, pieno appena si scende
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header${solid ? ' is-solid' : ''}`}>
      <nav className="wrap">
        <ul>
          <li>
            <div className="brand">
              <i className="ph ph-wind" aria-hidden="true" />
              <RestaurantName className="brand__name" />
              <span className="brand__since"><Translate>_%_dal 1987_%_</Translate></span>
            </div>
          </li>
        </ul>
        <ul className="site-nav">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href}><Translate t={l.label} /></a>
            </li>
          ))}
        </ul>
        <ul className="site-actions">
          <li>
            <a href="#prenota" role="button" className="btn-small">
              <Translate>_%_Prenota_%_</Translate>
            </a>
          </li>
          <li>
            <LanguageMenu />
          </li>
        </ul>
      </nav>
    </header>
  );
}
