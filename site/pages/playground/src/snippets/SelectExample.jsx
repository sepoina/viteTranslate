import { useState } from "react";
import { Trans, useTrans } from "@sepoina/vitetranslate/react";

export default function SelectExample() {
  const trans = useTrans();
  const [name, setName] = useState("Giulia");
  const [gender, setGender] = useState("f");

  return (
    <>
      <div className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label={trans("_%_Nome_%_")} />
        <select value={gender} onChange={(e) => setGender(e.target.value)} aria-label={trans("_%_Genere_%_")}>
          <option value="f">{trans("_%_femminile_%_")}</option>
          <option value="m">{trans("_%_maschile_%_")}</option>
          <option value="other">{trans("_%_altro_%_")}</option>
        </select>
      </div>
      <p>
        <Trans
          t="_%_{gender, select, f {<b>{name}</b> è arrivata: il tavolo è pronto.} m {<b>{name}</b> è arrivato: il tavolo è pronto.} other {<b>{name}</b> è qui: il tavolo è pronto.}}_%_"
          a={{ name, gender }}
        />
      </p>
    </>
  );
}
