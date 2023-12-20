//
// prende la variabile 'variableName' se esiste tra i props o torna false
export default function getVariableProps(variableName, p) {
  // console.log('Carico dalle variabili in linea:', p);
  const node = p.node.attributes.find(
    (node) => node?.name?.name === variableName
  );
  if (!node) return false;
  // ok è una stringa
  if (node?.value?.type === 'StringLiteral') return node.value.value;
  // o è calcolabile come stringa
  if (
    node?.value?.type === 'JSXExpressionContainer' &&
    node?.value?.expression?.type === 'StringLiteral'
  )
    return node.value.expression.value;
  return false;
}
