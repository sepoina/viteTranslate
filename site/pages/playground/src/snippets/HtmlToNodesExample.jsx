import { basicHtmlToNodes } from "@sepoina/vitetranslate/react";

// Un testo che arriva da fuori (un server, un CMS): non è da tradurre, ma ha dentro dell'HTML.
const fromServer =
  'Order <b>#%s</b> shipped — <i>arriving tomorrow</i>.<img src="x" onerror="alert(1)">';

export default function HtmlToNodesExample() {
  return <p>{basicHtmlToNodes(fromServer, 4217)}</p>;
}
