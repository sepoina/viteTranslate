import { useTrans } from "@sepoina/vitetranslate/react";
import { go } from "../layout/router.js";

// h2 e h3 delle pagine: l'id è l'ancora pubblicata, il "#" al passaggio ne copia l'indirizzo.
// go(): the router, unless a modifier asks for a new tab or window.
export default function Heading({ depth, id, children }) {
  const trans = useTrans();
  const Tag = depth === 2 ? "h2" : "h3";
  return (
    <Tag id={id} className="d-heading">
      {children}
      <a className="d-anchor" href={`#${id}`} aria-label={trans("_%_Link to this section_%_")} onClick={go(`#${id}`)}>
        #
      </a>
    </Tag>
  );
}
