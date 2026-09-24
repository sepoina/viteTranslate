// Nessun import dalla libreria: con autoWrap acceso (vite.config.js) il plugin aggiunge
// da solo la chiamata attorno a ogni testo e attributo marcato.
export default function AutoWrapExample() {
  return (
    <>
      <p>_%_Nessun Translate intorno a questa frase: lo aggiunge il plugin._%_</p>
      <input type="text" placeholder="_%_Anche un attributo, senza ts()_%_" />
    </>
  );
}
