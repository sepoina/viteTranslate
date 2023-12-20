"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = getChildrenText;
//
// restituisce il testo di un children
// o false se non è un testo recuperabile
//
function getChildrenText(p) {
  var _p$container;
  // console.log('Carico dai children:', p);
  if ((p === null || p === void 0 || (_p$container = p.container) === null || _p$container === void 0 || (_p$container = _p$container.children) === null || _p$container === void 0 ? void 0 : _p$container.length) === 1) {
    var _child$expression;
    var child = p.container.children[0];
    // se è un testo ok
    if (child.type === 'JSXText') return child.value;
    // se è un calcolo ok se calcolabile subito
    else if (child.type === 'JSXExpressionContainer' && child !== null && child !== void 0 && (_child$expression = child.expression) !== null && _child$expression !== void 0 && _child$expression.value) return child.expression.value;else return false;
  }
  // altrimenti è un errore
  return false;
}