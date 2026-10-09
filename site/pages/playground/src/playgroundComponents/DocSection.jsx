import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { Code } from "../theme/Code.jsx";

/** Il titolo di una sezione con l'ancora da condividere: `#` porta a `…/playground/#id`. */
export function AnchorTitle({ id, children }) {
  const trans = useTrans();
  return (
    <h3>
      <a className="anchor" href={`#${id}`} aria-label={trans("_%_Link a questa sezione_%_")}>
        #
      </a>
      {children}
    </h3>
  );
}

/** La descrizione di un esempio: una stringa marcata, o `{ t, a }` quando serve un argomento. */
function Description({ value }) {
  if (typeof value === "string") return <Trans t={value} />;
  return <Trans t={value.t} a={value.a} />;
}

/** Un esempio: descrizione, il componente che gira dal vivo e il suo sorgente, affiancati. */
export default function DocSection({ id, title, description, code, file, children }) {
  return (
    <section id={id} className="doc">
      <AnchorTitle id={id}>
        <Trans t={title} />
      </AnchorTitle>
      {description && (
        <p className="doc-text">
          <Description value={description} />
        </p>
      )}
      <div className="doc-body">
        <div className="demo">
          <span className="demo-label">
            <Trans>_%_dal vivo_%_</Trans>
          </span>
          {children}
        </div>
        <Code code={code} title={file} />
      </div>
    </section>
  );
}
