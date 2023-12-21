//
// restituisce il testo di un children
// o false se non è un testo recuperabile
//
export default function getChildrenText(p) {
  // console.log('Carico dai children:', p);
  if (p?.container?.children?.length === 1) {
    const child = p.container.children[0];
    // se è un testo ok
    if (child.type === "JSXText") return child.value;
    // se è un calcolo ok se calcolabile subito
    else if (
      child.type === "JSXExpressionContainer" &&
      child?.expression?.value
    )
      return child.expression.value;
    else return false;
  }
  // altrimenti è un errore
  return false;
}
