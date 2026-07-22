import { useContext } from "react";
import { Translate, TranslateContext, useAvailableLanguages } from "@sepoina/vitetranslate/react";

export default function App() {
  const lang = useContext(TranslateContext);
  const { tags } = useAvailableLanguages();

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>viteTranslate — Vite 8</h1>
      <p><Translate>_%_Piccolo esempio minimale con cambio lingua a runtime._%_</Translate></p>
      <div>
        {tags.map((tag) => (
          <button
            key={tag}
            disabled={lang?.id === tag}
            onClick={() => lang?.proposeNewLanguage({ lang: tag })}
          >
            {tag}
          </button>
        ))}
      </div>
    </main>
  );
}
