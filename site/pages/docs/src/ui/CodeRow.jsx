import { createContext, useContext, useState } from "react";
import { useTrans } from "@sepoina/vitetranslate/react";
import CodeBlock from "./CodeBlock.jsx";
import { ICON } from "../layout/Toc.jsx";

const Row = createContext(null);

// A table row whose code opens in a row of its own, right below it, one cell across every column: the
// table's `{code:id}` cell and the ```lang id="id" fence after the table (scripts/compileDocs.mjs). The
// cells come from the page; the one that held `{code:id}` holds the CodeToggle. Each row opens and closes
// by itself. Closed, the code row stays in the page, hidden, so aria-controls always finds it.
export default function CodeRow({ id, span, children, ...code }) {
  const [open, setOpen] = useState(false);
  return (
    <Row.Provider value={{ id, open, toggle: () => setOpen((o) => !o) }}>
      <tr className={open ? "d-row-open" : undefined}>{children}</tr>
      <tr id={id} className="d-row-code" hidden={!open}>
        <td colSpan={span}>
          <div className="d-row-code-box">
            <CodeBlock {...code} />
          </div>
        </td>
      </tr>
    </Row.Provider>
  );
}

// The code icon (Lucide "code-xml", ISC): filled while its row is open, and pressed again it closes it.
export function CodeToggle() {
  const trans = useTrans();
  const { id, open, toggle } = useContext(Row);
  const label = trans("_%_Code_%_");
  return (
    <button type="button" className="d-toggle" aria-expanded={open} aria-controls={id} aria-label={label} title={label} onClick={toggle}>
      <svg {...ICON} width="17" height="17">
        <path d="m18 16 4-4-4-4" />
        <path d="m6 8-4 4 4 4" />
        <path d="m14.5 4-5 16" />
      </svg>
    </button>
  );
}
