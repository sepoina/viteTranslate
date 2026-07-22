import { Translate } from "@sepoina/vitetranslate/react";
import CodeBlock from "./CodeBlock.jsx";

export default function DocSection({ id, title, description, code, children }) {
  return (
    <section id={id} className="doc-section">
      <h2><Translate>{title}</Translate></h2>
      {description && (
        <p className="doc-description">
          {typeof description === "string" ? (
            <Translate>{description}</Translate>
          ) : description?.t ? (
            <Translate t={description.t} a={description.a} />
          ) : (
            description
          )}
        </p>
      )}
      <div className="doc-preview">{children}</div>
      <CodeBlock code={code} />
    </section>
  );
}
