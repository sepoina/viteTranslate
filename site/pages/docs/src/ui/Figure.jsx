import { useTrans } from "@sepoina/vitetranslate/react";
import { BASE } from "../layout/router.js";

// `alt` arriva già marcata (_%_…_%_) dalla pagina generata, o vuota per un'immagine decorativa.
// `width` e `height` sono quelli del file (li legge il compilatore): il browser riserva lo spazio prima del
// caricamento e la pagina non salta; il CSS (max-width, height: auto) li adatta alla colonna.
export default function Figure({ src, alt, width, height }) {
  const trans = useTrans();
  return (
    <figure className="d-figure">
      <img src={`${BASE}${src}`} alt={alt ? trans(alt) : ""} width={width} height={height} loading="lazy" />
    </figure>
  );
}
