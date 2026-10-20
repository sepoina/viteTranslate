import { Trans, useTransLanguage } from "@sepoina/vitetranslate/react";

export default function App({ name }) {
  const { proposeNewLanguage } = useTransLanguage();
  return (
    <>
      <p>
        <Trans>Welcome back, <b>{name}</b>!</Trans>
      </p>
      <button onClick={() => proposeNewLanguage({ lang: "en-US" })}>English</button>
      <button onClick={() => proposeNewLanguage({ lang: "fr-FR" })}>Français</button>
    </>
  );
}
