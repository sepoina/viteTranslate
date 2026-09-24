import { useState } from "react";
import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";

export default function SelectExample() {
  const ts = useTranslateToString();
  const [name, setName] = useState("Giulia");
  const [gender, setGender] = useState("f");

  return (
    <>
      <div className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label={ts("_%_Nome_%_")} />
        <select value={gender} onChange={(e) => setGender(e.target.value)} aria-label={ts("_%_Genere_%_")}>
          <option value="f">{ts("_%_femminile_%_")}</option>
          <option value="m">{ts("_%_maschile_%_")}</option>
          <option value="other">{ts("_%_altro_%_")}</option>
        </select>
      </div>
      <p>
        <Translate
          t="_%_{gender, select, f {<b>{name}</b> è arrivata: il tavolo è pronto.} m {<b>{name}</b> è arrivato: il tavolo è pronto.} other {<b>{name}</b> è qui: il tavolo è pronto.}}_%_"
          a={{ name, gender }}
        />
      </p>
    </>
  );
}
