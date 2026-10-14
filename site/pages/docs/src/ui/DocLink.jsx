import { navigate, resolveTo } from "../layout/router.js";

// Un link del dialetto. Le pagine del manuale e le ancore si aprono con il router (nessun
// ricaricamento); le altre pagine del sito si aprono qui; GitHub e i siti esterni in una scheda nuova.
export default function DocLink({ to, children }) {
  const { kind, href } = resolveTo(to);
  const inApp = kind === "route" || kind === "hash";
  const outside = kind === "repo" || kind === "https";
  const onClick = inApp
    ? (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(href);
      }
    : undefined;
  return (
    <a href={href} onClick={onClick} {...(outside ? { target: "_blank", rel: "noopener" } : {})}>
      {children}
      {outside && <span aria-hidden="true"> ↗</span>}
    </a>
  );
}
