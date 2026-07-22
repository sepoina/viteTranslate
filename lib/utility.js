// Estratto da private/viteScripts/utility.js: unica funzione (+ helper) usata dal plugin di traduzione.

export function fit(s, length) {
    if (!Number.isFinite(length) || length < 0) return "";
    if (length === 0) return "";
    if (length === 1) return "…"; // non c’è spazio per altro
    const seg = (globalThis).Intl?.Segmenter
        ? new Intl.Segmenter("it", { granularity: "grapheme" })
        : null;
    const units = seg
        ? Array.from(seg.segment(s), (x) => x.segment)
        : Array.from(s); // fallback: codepoint
    if (units.length > length) {
        return units.slice(0, length - 1).join("") + "…";
    }
    return units.join("") + " ".repeat(length - units.length);
}

export function logEchoColored(msg, text) {
    console.log(`\x1b[32m:::\x1b[0m\x1b[2m ${fit(msg, 20)} ║  \x1b[0m${text}`);
}
