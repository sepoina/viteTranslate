import { useContext } from "react";
import { Translate, TranslateContext, useAvailableLanguages } from "@sepoina/vitetranslate/react";
import playgroundString from "../App-playgroundString-from-js.js";

export default function BadgeRotateLanguage() {
  const lang = useContext(TranslateContext);
  const { tags } = useAvailableLanguages();

  const rotateLanguage = () => {
    if (!lang) return;
    const currentIndex = tags.indexOf(lang.id);
    const nextTag = tags[(currentIndex + 1) % tags.length];
    lang.proposeNewLanguage({ lang: nextTag });
  };

  return (
    <div
      className="js-badge"
      role="button"
      tabIndex={0}
      onClick={rotateLanguage}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && rotateLanguage()}
    >
      <Translate>{playgroundString}</Translate>
    </div>
  );
}
