import { Translate, useTranslateLanguage } from "@sepoina/vitetranslate/react";
import playgroundString from "../App-playgroundString-from-js.js";

export default function BadgeRotateLanguage() {
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();

  const rotateLanguage = () => {
    const currentIndex = languages.findIndex(({ tag }) => tag === id);
    const nextTag = languages[(currentIndex + 1) % languages.length].tag;
    proposeNewLanguage({ lang: nextTag });
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
