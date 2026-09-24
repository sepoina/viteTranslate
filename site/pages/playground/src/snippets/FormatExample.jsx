import { useState } from "react";
import { Translate } from "@sepoina/vitetranslate/react";

export default function FormatExample() {
  // l'istante del primo render: basta per vedere data e ora nel formato della lingua
  const [now] = useState(() => new Date());

  return (
    <ul>
      <li><Translate t="_%_Sconto: {0, number, percent}_%_" a={0.25} /></li>
      <li><Translate t="_%_Totale: {0, number, ::currency/EUR}_%_" a={1234.5} /></li>
      <li><Translate t="_%_Oggi è {0, date, full}_%_" a={now} /></li>
      <li><Translate t="_%_Sono le {0, time, short}_%_" a={now} /></li>
    </ul>
  );
}
