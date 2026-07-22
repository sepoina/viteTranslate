import React from "react";
// --- HELPERS ---

const ALLOWED_TAGS = new Set(["br", "b", "hr", "strong", "i", "em", "u", "small", "code", "wbr"]);
const VOID_TAGS = new Set(["br", "wbr", "hr"]);
const HAS_HTML_RE = /<\/?(br|hr|b|strong|i|em|u|small|code|wbr)\b|&[a-z]+;|&#\d+;/i;

function interpolate(template, args) {
  if (!args?.length) return template;
  const list = [].concat(args);
  let i = 0;
  return template.replace(/%s/g, () => String(list[i++] ?? ""));
}

function domToReact(node, key) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tag = node.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tag)) {
    // unwrap: processa i figli anche se il tag non è permesso
    return Array.from(node.childNodes).map((ch, i) =>
      domToReact(ch, `${key}.${i}`)
    );
  }

  // Tag void: niente figli
  if (VOID_TAGS.has(tag)) return React.createElement(tag, { key });

  const children = Array.from(node.childNodes).map((ch, i) =>
    domToReact(ch, `${key}.${i}`)
  );
  return React.createElement(tag, { key }, children);
}

export default function emitNodes(args, inputString) {
  const html = args?.length ? interpolate(inputString, args) : inputString;

  if (!HAS_HTML_RE.test(html)) return html; // text node puro

  try {
    const { body } = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const nodes = Array.from(body.childNodes)
      .map((n, i) => domToReact(n, `n.${i}`))
      .flat(Infinity)
      .filter(Boolean);
    if (nodes.length === 1) return nodes[0];
    return <>{nodes}</>;
  } catch (e) {
    console.error("emitNodes: HTML parsing error", e);
    return html;
  }
}
