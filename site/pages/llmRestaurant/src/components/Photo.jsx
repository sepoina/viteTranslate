import { useState } from 'react';
import { useTranslateToString } from '@sepoina/vitetranslate/react';
import { photoUrl } from '../photos';

//
// Foto con segnaposto: finché l'immagine non arriva (o se non arriva mai) resta
// un fondo sabbia con l'icona. L'alt è tradotto come ogni altro testo della pagina.
//
export default function Photo({ photo, w = 1200, h, className = '', eager = false }) {
  const ts = useTranslateToString();
  const [state, setState] = useState('loading');
  return (
    <figure className={`photo is-${state} ${className}`}>
      <i className="ph ph-image photo__placeholder" aria-hidden="true" />
      {state !== 'error' && (
        <img
          src={photoUrl(photo.id, w, h)}
          srcSet={`${photoUrl(photo.id, Math.round(w / 2), h && Math.round(h / 2))} ${Math.round(w / 2)}w, ${photoUrl(photo.id, w, h)} ${w}w`}
          sizes={`(max-width: 900px) 100vw, ${Math.round(w / 2)}px`}
          alt={ts(photo.alt)}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
        />
      )}
    </figure>
  );
}
