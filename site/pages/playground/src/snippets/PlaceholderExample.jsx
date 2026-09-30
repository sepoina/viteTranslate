import { useTranslateToString } from "@sepoina/vitetranslate/react";

export default function PlaceholderExample() {
  const ts = useTranslateToString();
  const n = 3;

  return (
    <input
      type="text"
      placeholder={ts`Il placeholder necessita di una stringa, non un JSX, ne sono un esempio`}
      aria-label={ts`Nome utente`}
      title={ts`Anche il tooltip di sistema, per ${n} campi`}
    />
  );
}
