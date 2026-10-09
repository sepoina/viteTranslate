import { useTrans } from "@sepoina/vitetranslate/react";

export default function PlaceholderExample() {
  const trans = useTrans();
  const n = 3;

  return (
    <input
      type="text"
      placeholder={trans`Il placeholder necessita di una stringa, non un JSX, ne sono un esempio`}
      aria-label={trans`Nome utente`}
      title={trans`Anche il tooltip di sistema, per ${n} campi`}
    />
  );
}
