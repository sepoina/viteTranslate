// La barra dei comandi, dal lato della pagina: quando la sezione è stretta va a capo, e allora la
// seconda riga (le icone) si centra e si distribuisce (COMMAND_BAR_CSS, la classe `a-capo`). Il
// CSS da solo non sa se una riga è andata a capo, e una soglia fissa sbaglierebbe al variare di
// font, zoom, etichette: lo si misura. Si toglie la classe, si guarda se le icone stanno sotto i
// bottoni, la si rimette se serve: tutto nello stesso frame, niente sfarfallio. Si rimisura quando
// cambia la larghezza della barra o quella dei bottoni (LLM cambia icona). La installano gli
// script delle pagine con la barra (projectWebview.mjs, optionalWebview.mjs). Nessun import di
// `vscode`.

/**
 * Se le icone sono andate sotto i bottoni: il loro alto oltre la metà della riga dei bottoni.
 * @param {{ top: number, height: number }} bottoni - getBoundingClientRect di .bottoni
 * @param {{ top: number }} icone - getBoundingClientRect di .icone
 * @returns {boolean}
 */
export function wrapsBelow(bottoni, icone) {
  return icone.top > bottoni.top + bottoni.height / 2;
}

/** Installa la misura sulla barra della pagina, se ce n'è una. */
export function watchCommandBar(doc = document) {
  const barra = doc.querySelector("footer.actions");
  const bottoni = barra?.querySelector(".bottoni");
  const icone = barra?.querySelector(".icone");
  if (!bottoni || !icone) return;
  const misura = () => {
    barra.classList.remove("a-capo");
    barra.classList.toggle("a-capo", wrapsBelow(bottoni.getBoundingClientRect(), icone.getBoundingClientRect()));
  };
  const osserva = new ResizeObserver(misura);
  osserva.observe(barra);
  osserva.observe(bottoni);
  misura();
}
