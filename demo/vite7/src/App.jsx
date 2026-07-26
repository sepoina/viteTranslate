import { Translate, useTranslateLanguage } from "@sepoina/vitetranslate/react";

export default function App() {
  const { id, tags, proposeNewLanguage } = useTranslateLanguage();

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>viteTranslate — Vite 7</h1>
      <p><Translate>_%_Piccolo esempio minimale con cambio lingua a runtime._%_</Translate></p>
      <div>
        {tags.map((tag) => (
          <button
            key={tag}
            disabled={id === tag}
            onClick={() => proposeNewLanguage({ lang: tag })}
          >
            {tag}
          </button>
        ))}
      </div>
    </main>
  );
}
