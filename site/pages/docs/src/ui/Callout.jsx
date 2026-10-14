import { useTrans } from "@sepoina/vitetranslate/react";

// Le note del manuale. `aside` è la citazione senza etichetta (le righe "live").
export default function Callout({ kind, children }) {
  const trans = useTrans();
  const label = {
    note: trans("_%_Note_%_"),
    tip: trans("_%_Tip_%_"),
    important: trans("_%_Important_%_"),
    warning: trans("_%_Warning_%_"),
    caution: trans("_%_Caution_%_"),
  }[kind];
  return (
    <aside className={`d-callout d-callout-${kind}`} role="note">
      {label && <p className="d-callout-label">{label}</p>}
      <div className="d-callout-body">{children}</div>
    </aside>
  );
}
