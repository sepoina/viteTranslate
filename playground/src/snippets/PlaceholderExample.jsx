import { useTranslateToString } from "@sepoina/vitetranslate/react";

export default function PlaceholderExample() {
  const ts = useTranslateToString();

  return (
    <input
      style={{ minWidth: "100%" }}
      type="text"
      placeholder={ts("_%_Il placeholder necessita di una stringa, non un JSX, ne sono un esempio_%_")}
      aria-label={ts("_%_Nome utente_%_")}
      title={ts("_%_Anche il tooltip di sistema_%_")}
    />
  );
}
