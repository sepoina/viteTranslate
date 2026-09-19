// La pagina degli edge case è un'app Vite a sé (playEdge/), non una route di questa:
// ha la sua localeDir e un errorSolve tutto acceso, e due configurazioni del plugin
// nella stessa build non convivono — il modulo virtuale delle lingue ha un id unico.
//
// In build il suo dist viene copiato dentro dist/edge/ (vedi il workflow di deploy),
// quindi basta appendere "edge/" alla base. In sviluppo sono due dev server distinti:
// il playground sulla 3000, gli edge case sulla 3001 (`npm run edge` dalla radice).
export const EDGE_URL = import.meta.env.DEV
  ? "http://localhost:3001/"
  : `${import.meta.env.BASE_URL}edge/`;
