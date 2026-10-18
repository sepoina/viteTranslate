import { useState } from 'react';
import { useTrans } from '@sepoina/vitetranslate/react';
import { photoUrl } from '../photos';

//
// Foto con segnaposto: finché l'immagine non arriva (o se non arriva mai) resta
// un fondo sabbia con l'icona. L'alt è tradotto come ogni altro testo della pagina.
// The figure's aspect-ratio (restaurant.css) holds the room before the image arrives: nothing jumps.
// `eager` is the opening photo, the first thing on screen: it also goes first in the queue (fetchPriority).
//
export default function Photo({ photo, w = 1200, h, className = '', eager = false }) {
  const trans = useTrans();
  const [state, setState] = useState('loading');
  return (
    <figure className={`photo is-${state} ${className}`}>
      <i className="ph ph-image photo__placeholder" aria-hidden="true" />
      {state !== 'error' && (
        <img
          src={photoUrl(photo.id, w, h)}
          srcSet={`${photoUrl(photo.id, Math.round(w / 2), h && Math.round(h / 2))} ${Math.round(w / 2)}w, ${photoUrl(photo.id, w, h)} ${w}w`}
          sizes={`(max-width: 900px) 100vw, ${Math.round(w / 2)}px`}
          alt={trans(photo.alt)}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
        />
      )}
    </figure>
  );
}
