import { useState } from "react";
import { Translate } from "@sepoina/vitetranslate/react";

export default function DynamicExample() {
  const [username, setUsername] = useState("Mario");

  return (
    <div>
      <p>
        <Translate t={["_%_Ciao %s, come stai?_%_", username]} />
      </p>
      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
    </div>
  );
}
