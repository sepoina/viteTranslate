import { useTrans } from "@sepoina/vitetranslate/react";

// Le note del manuale. `aside` è la citazione senza etichetta (le righe "live").
// `title`, when the page names the box (`> [!NOTE] Notes`), arrives marked (_%_…_%_) and replaces the label.
export default function Callout({ kind, title, children }) {
  const trans = useTrans();
  const label = {
    note: trans("_%_Note_%_"),
    tip: trans("_%_Tip_%_"),
    important: trans("_%_Important_%_"),
    warning: trans("_%_Warning_%_"),
    caution: trans("_%_Caution_%_"),
  }[kind];
  const name = title ? trans(title) : label;
  return (
    <aside className={`d-callout d-callout-${kind}`} role="note">
      {name && <p className="d-callout-label">{name}</p>}
      <div className="d-callout-body">{children}</div>
    </aside>
  );
}
