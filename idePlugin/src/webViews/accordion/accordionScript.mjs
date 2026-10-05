// Gli accordion (accordion.mjs), dal lato della pagina: si riaprono come l'utente li ha lasciati,
// e in un gruppo (`name`) ne resta aperto uno solo. Il browser lo fa da sé (Chromium 120+); qui un
// ripiego, che non costa niente dove non serve. Lo stato sta in `memoria.aperte` (id -> aperto),
// che la pagina salva con vscode.setState: vive quanto la sezione, anche quando la pagina si
// ricrea. La prima volta sono chiusi. Nessun import di `vscode`.

/**
 * @param {{ aperte?: Record<string, boolean> }} memoria - lo stato della pagina (vscode.getState)
 * @param {() => void} salva - lo rimette (vscode.setState)
 */
export function rememberAccordions(memoria, salva, doc = document) {
  memoria.aperte ??= {};
  const voci = [...doc.querySelectorAll("details.voce[id]")];
  for (const d of voci) {
    d.open = !!memoria.aperte[d.id];
    d.addEventListener("toggle", () => {
      const gruppo = d.getAttribute("name");
      if (d.open && gruppo) for (const altra of voci) if (altra !== d && altra.open && altra.getAttribute("name") === gruppo) altra.open = false;
      if (memoria.aperte[d.id] === d.open) return;
      memoria.aperte[d.id] = d.open;
      salva();
    });
  }
}
