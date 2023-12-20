"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _getChildrenText = _interopRequireDefault(require("./getChildrenText"));
var _getVariableProps = _interopRequireDefault(require("./getVariableProps"));
var _path = _interopRequireDefault(require("path"));
var _fnv1a = _interopRequireDefault(require("fnv1a"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
//
// se in input trova un _%_testo_%_ 
// aggiunge "testo" alla tabella di traduzioni
// e trasforma "_%_testo_%_" in "_<_id_#_testo_>_"
//
function ifStaticAddTable(p, state) {
  var _p$node, _exec;
  if (!(p !== null && p !== void 0 && (_p$node = p.node) !== null && _p$node !== void 0 && _p$node.value)) return; // non trova l'oggetto
  if (!/_%_(.*?)_%_/.test(p.node.value)) return; // non trova il riconoscitore
  var strToAdd = (_exec = /_%_(.*?)_%_/.exec(p.node.value)) === null || _exec === void 0 ? void 0 : _exec[1];
  if (!strToAdd) return; // è vuota o nulla
  //  console.log("trovato da rimpiazzare:", p.node.value);
  var data_translate = addToTable(strToAdd, state);
  p.node.value = getReplacedForTranslate(p.node.value, data_translate, strToAdd);
  if (p.node.extra.rawValue) p.node.extra.rawValue = getReplacedForTranslate(p.node.extra.rawValue, data_translate, strToAdd);
  if (p.node.extra.raw) p.node.extra.raw = getReplacedForTranslate(p.node.extra.raw, data_translate, strToAdd);
  // console.log("rimpiazzo:", p.node.value);
}

// getta il testo da value e trasforma "_%_testo_%_" in "_<_id_/_testo_>_"
function getReplacedForTranslate(value, data_translate, text) {
  var newString = "_<_".concat(data_translate, "_/_").concat(text, "_>_");
  return value.replace(/_%_(.*?)_%_/, newString);
}
function addToTable(strToAdd, state) {
  //
  //
  // recupera il nome del file su cui si trova il translate
  var nameFile = _path["default"].parse(state.filename).name;
  //
  //
  // calcola l'hash
  var hex = (0, _fnv1a["default"])(strToAdd).toString(36);
  //
  // va iniettato
  // console.log(path);
  var data_translate = "".concat(nameFile, "_").concat(hex);
  // console.log(`add to table:${data_translate} value:${strToAdd}`);
  // assegna 
  globalThis['TranslateService']['baseLng'][data_translate] = strToAdd;
  return data_translate; // id  
}
var _default = exports["default"] = function _default(api) {
  var t = api.types;
  return {
    visitor: {
      // Aggiungi il tuo visitor per le stringhe costanti
      StringLiteral: ifStaticAddTable,
      JSXText: ifStaticAddTable,
      TemplateElement: ifStaticAddTable,
      JSXOpeningElement: function JSXOpeningElement(path, state) {
        //
        // prova ad aprirlo... è translate? se no torna
        if (path.node.name.name !== 'Translate') return;
        //
        // ha giù la props data-translate? torna
        var existingProp = path.node.attributes.find(function (node) {
          var _node$name;
          return (node === null || node === void 0 || (_node$name = node.name) === null || _node$name === void 0 ? void 0 : _node$name.name) === 'data-translate';
        });
        if (existingProp) return;
        //
        // se contiene c come props la traduzione è differita, ritorna
        //
        if (path.node.attributes.find(function (n) {
          return (n === null || n === void 0 ? void 0 : n.name.name) === 'c';
        })) return;
        //
        // se ha un props chiamato 't' lo carica altrimenti carica il contenuto
        // dei children, se nessuno dei due ha un text mostra un errore
        var textInternal = path.node.attributes.find(function (node) {
          var _node$name2;
          return (node === null || node === void 0 || (_node$name2 = node.name) === null || _node$name2 === void 0 ? void 0 : _node$name2.name) === 't';
        });
        var text = textInternal ? (0, _getVariableProps["default"])('t', path) : (0, _getChildrenText["default"])(path);
        if (text === false) throw 'Errore, Translate deve contenere solo stringhe';
        //
        // aggiunge alla tabella 
        var data_translate = addToTable(text, state);
        var newProp = t.jSXAttribute(t.jSXIdentifier('data-translate'), t.stringLiteral(data_translate));
        path.node.attributes.push(newProp);
      }
    }
  };
};