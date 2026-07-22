import { useEffect, useRef } from "react";

export default function CodeBlock({ code, language = "jsx" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && window.Prism) window.Prism.highlightElement(ref.current);
  }, [code, language]);

  return (
    <pre className="doc-code">
      <code ref={ref} className={`language-${language}`}>
        {code.trim()}
      </code>
    </pre>
  );
}
