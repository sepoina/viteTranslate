import { Translate } from "@sepoina/vitetranslate/react";

export default function MarkupExample() {
  const user = <a href="#markup">Mario</a>;

  return (
    <>
      <p>
        <Translate t="_%_Testo in <b>grassetto</b>, in <i>corsivo</i> e <code>codice</code>: una frase sola da tradurre._%_" />
      </p>
      <p>
        <Translate t={["_%_Accesso eseguito come <b>%s</b>_%_", user]} />
      </p>
    </>
  );
}
