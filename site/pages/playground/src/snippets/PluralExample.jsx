import { useState } from "react";
import { Trans, useTrans } from "@sepoina/vitetranslate/react";

export default function PluralExample() {
  const trans = useTrans();
  const [n, setN] = useState(1);

  return (
    <>
      <div className="stepper">
        <button type="button" onClick={() => setN(Math.max(0, n - 1))} aria-label={trans("_%_Uno in meno_%_")}>−</button>
        <output>{n}</output>
        <button type="button" onClick={() => setN(n + 1)} aria-label={trans("_%_Uno in più_%_")}>+</button>
      </div>
      <p>
        <Trans t="_%_{0, plural, =0 {Nessun messaggio nuovo} one {Hai # messaggio nuovo} many {Hai # messaggi nuovi} other {Hai # messaggi nuovi}}_%_" a={n} />
      </p>
      <p>
        <Trans t="_%_Sei {0, selectordinal, many {l’#º} other {il #º}} in coda_%_" a={n} />
      </p>
    </>
  );
}
