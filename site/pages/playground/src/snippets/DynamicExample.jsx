import { useState } from "react";
import { Trans } from "@sepoina/vitetranslate/react";

export default function DynamicExample() {
  const [username, setUsername] = useState("Mario");

  return (
    <>
      <p>
        <Trans>Ciao {username}, come stai?</Trans>
      </p>
      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
    </>
  );
}
