//
// Il nome del ristorante, che è anche il nome della libreria: porta al progetto su GitHub
// senza cambiare nulla della tipografia intorno (colore, corsivo, peso: tutto ereditato).
// Nei testi tradotti entra come argomento di un %s, così resta un elemento e non una stringa.
//
export default function RestaurantName({ className = '' }) {
  return (
    <a className={`name-link ${className}`} href="https://github.com/sepoina/viteTranslate" target="_blank" rel="noreferrer">
      viteTranslate
    </a>
  );
}
