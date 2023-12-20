"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = getVariableProps;
//
// prende la variabile 'variableName' se esiste tra i props o torna false
function getVariableProps(variableName, p) {
  var _node$value, _node$value2, _node$value3;
  // console.log('Carico dalle variabili in linea:', p);
  var node = p.node.attributes.find(function (node) {
    var _node$name;
    return (node === null || node === void 0 || (_node$name = node.name) === null || _node$name === void 0 ? void 0 : _node$name.name) === variableName;
  });
  if (!node) return false;
  // ok è una stringa
  if ((node === null || node === void 0 || (_node$value = node.value) === null || _node$value === void 0 ? void 0 : _node$value.type) === 'StringLiteral') return node.value.value;
  // o è calcolabile come stringa
  if ((node === null || node === void 0 || (_node$value2 = node.value) === null || _node$value2 === void 0 ? void 0 : _node$value2.type) === 'JSXExpressionContainer' && (node === null || node === void 0 || (_node$value3 = node.value) === null || _node$value3 === void 0 || (_node$value3 = _node$value3.expression) === null || _node$value3 === void 0 ? void 0 : _node$value3.type) === 'StringLiteral') return node.value.expression.value;
  return false;
}