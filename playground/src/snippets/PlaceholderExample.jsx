import { useTranslateString } from "@sepoina/vitetranslate/react";

export default function PlaceholderExample() {
  const ts = useTranslateString();

  return (
    <input
      type="text"
      placeholder={ts("_%_Inserisci il tuo nome_%_")}
      aria-label={ts("_%_Nome utente_%_")}
      title={ts("_%_Il nome verrà usato nel saluto_%_")}
    />
  );
}
