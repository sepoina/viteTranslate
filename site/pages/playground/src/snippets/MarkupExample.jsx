import { Trans } from "@sepoina/vitetranslate/react";

export default function MarkupExample() {
  const user = "Mario";

  return (
    <>
      <p>
        <Trans>Testo in <b>grassetto</b>, in <i>corsivo</i> e <code>codice</code>: una frase sola da tradurre.</Trans>
      </p>
      <p>
        <Trans>Accesso eseguito come <a href="#markup">{user}</a></Trans>
      </p>
    </>
  );
}
