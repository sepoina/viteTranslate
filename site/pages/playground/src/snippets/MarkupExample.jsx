import { Translate } from "@sepoina/vitetranslate/react";

export default function MarkupExample() {
  const user = "Mario";

  return (
    <>
      <p>
        <Translate>Testo in <b>grassetto</b>, in <i>corsivo</i> e <code>codice</code>: una frase sola da tradurre.</Translate>
      </p>
      <p>
        <Translate>Accesso eseguito come <a href="#markup">{user}</a></Translate>
      </p>
    </>
  );
}
