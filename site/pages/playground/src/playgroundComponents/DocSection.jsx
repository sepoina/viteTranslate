import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";
import Code from "./Code.jsx";

/** Il titolo di una sezione con l'ancora da condividere: `#` porta a `…/playground/#id`. */
export function AnchorTitle({ id, children }) {
  const ts = useTranslateToString();
  return (
    <h3>
      <a className="anchor" href={`#${id}`} aria-label={ts("_%_Link a questa sezione_%_")}>
        #
      </a>
      {children}
    </h3>
  );
}

/** La descrizione di un esempio: una stringa marcata, o `{ t, a }` quando serve un argomento. */
function Description({ value }) {
  if (typeof value === "string") return <Translate t={value} />;
  return <Translate t={value.t} a={value.a} />;
}

/** Un esempio: descrizione, il componente che gira dal vivo e il suo sorgente, affiancati. */
export default function DocSection({ id, title, description, code, file, children }) {
  return (
    <section id={id} className="doc">
      <AnchorTitle id={id}>
        <Translate t={title} />
      </AnchorTitle>
      {description && (
        <p className="doc-text">
          <Description value={description} />
        </p>
      )}
      <div className="doc-body">
        <div className="demo">
          <span className="demo-label">
            <Translate>_%_dal vivo_%_</Translate>
          </span>
          {children}
        </div>
        <Code code={code} title={file} />
      </div>
    </section>
  );
}
