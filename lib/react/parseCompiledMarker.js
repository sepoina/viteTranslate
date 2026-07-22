/**
 * Estrae { key, fallback } da un marcatore compilato "_<_key_/_fallback_>_"
 * (dev, con fallback embeddato) oppure "_<_key_>_" (build, id soltanto —
 * il comando prepare-translation-table garantisce la lingua base completa
 * prima della build, quindi il fallback in bundle è ridondante).
 *
 * Va chiamata solo dopo aver verificato startsWith("_<_") && endsWith("_>_").
 * Usa indexOf/slice invece di una regex: stesso costo cognitivo, meno lavoro
 * a ogni render rispetto a un match con gruppi di cattura.
 *
 * @param {string} text
 * @returns {{ key: string, fallback: string | undefined }}
 */
export function parseCompiledMarker(text) {
  const sep = text.indexOf("_/_", 3);
  if (sep === -1) return { key: text.slice(3, -3), fallback: undefined };
  return { key: text.slice(3, sep), fallback: text.slice(sep + 3, -3) };
}
