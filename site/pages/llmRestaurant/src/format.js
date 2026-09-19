import { useMemo } from 'react';
import { useTranslateLanguage } from '@sepoina/vitetranslate/react';

//
// I prezzi li formatta il browser, nella lingua sullo schermo: "28 €" in tedesco, "€28" in inglese.
// Il numero non passa mai dalle tabelle di traduzione, solo le parole intorno.
//
export function useMoney() {
  const { id } = useTranslateLanguage();
  return useMemo(() => {
    const f = new Intl.NumberFormat(id || 'it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    return (n) => f.format(n);
  }, [id]);
}
