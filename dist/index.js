"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "BabelTranslate", {
  enumerable: true,
  get: function get() {
    return _BabelTranslate["default"];
  }
});
Object.defineProperty(exports, "RollupTranslate", {
  enumerable: true,
  get: function get() {
    return _RollupTranslate["default"];
  }
});
var _BabelTranslate = _interopRequireDefault(require("./babel/BabelTranslate"));
var _RollupTranslate = _interopRequireDefault(require("./rollup/RollupTranslate"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }