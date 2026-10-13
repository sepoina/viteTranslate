import { Trans, useTransLanguage } from "@sepoina/vitetranslate/react";

export default function App({ name }) {
  const { proposeNewLanguage } = useTransLanguage();
  return (
    <>
      <button onClick={() => proposeNewLanguage({ lang: "en-US" })}>English</button>
      <button onClick={() => proposeNewLanguage({ lang: "fr-FR" })}>Français</button>
      <p>
        <Trans>Welcome back, <b>{name}</b>!</Trans>
      </p>
      <p><Trans>Your messages stay here for 30 days.</Trans></p>
      <p><Trans>Need a hand? We reply within a day.</Trans></p>
    </>
  );
}
