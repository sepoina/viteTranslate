import { Translate, useTranslateLanguage } from "@sepoina/vitetranslate/react";
import playgroundString from "../App-playgroundString-from-js.js";

export default function BadgeRotateLanguage() {
  const { id, tags, proposeNewLanguage } = useTranslateLanguage();

  const rotateLanguage = () => {
    const currentIndex = tags.indexOf(id);
    const nextTag = tags[(currentIndex + 1) % tags.length];
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
