import { useState } from "react";
import { Translate } from "@sepoina/vitetranslate/react";

export default function DynamicExample() {
  const [username, setUsername] = useState("Mario");

  return (
    <>
      <p>
        <Translate>Ciao {username}, come stai?</Translate>
      </p>
      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
    </>
  );
}
