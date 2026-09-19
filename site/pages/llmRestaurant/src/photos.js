//
// Tutte le foto della pagina, in un posto solo: servono anche ai crediti in fondo.
// Sono foto Unsplash (licenza Unsplash: uso libero, anche commerciale, senza obbligo
// di attribuzione — la diamo comunque). Se un'immagine non arriva, <Photo> mostra un segnaposto.
//
const BASE = 'https://images.unsplash.com/photo-';

export const UNSPLASH_LICENSE = 'https://unsplash.com/license';

// url ritagliato alla larghezza richiesta (e all'altezza, se serve un formato fisso)
export const photoUrl = (id, w = 1200, h) =>
  `${BASE}${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=75`;

export const PHOTOS = {
  terrace: { id: '1559339352-11d035aa65de', alt: '_%_La terrazza del ristorante affacciata sul mare_%_' },
  plating: { id: '1577219491135-ce391730fb2c', alt: "_%_Lo chef impiatta con le pinzette sotto le lampade calde_%_" },
  knife: { id: '1551218808-94e220e084d2', alt: '_%_Mani che tagliano erbe fresche sul tagliere_%_' },
  shrimp: { id: '1563379926898-05f4575a45d8', alt: '_%_Spaghettone ai gamberi rossi in padella_%_' },
  amberjack: { id: '1560717845-968823efbee1', alt: '_%_Trancio di pesce scottato con melagrana e cipolla rossa_%_' },
  bream: { id: '1467003909585-2f8a72700288', alt: '_%_Filetto di pesce in guazzetto con verdure croccanti_%_' },
  wine: { id: '1510812431401-41d2bd2722f3', alt: '_%_Un brindisi con calici di vino rosso_%_' },
  table: { id: '1414235077428-338989a2e8c0', alt: '_%_Tavola apparecchiata a lume di candela_%_' },
  hall: { id: '1517248135467-4c7edcad34c4', alt: '_%_La sala interna, legno scuro e luci basse_%_' },
  guest: { id: '1533777857889-4be7c70b33f7', alt: '_%_Una ospite assaggia un piatto alla luce calda della sera_%_' },
  flames: { id: '1600565193348-f74bd3c7ccdf', alt: '_%_Un cuoco fiammeggia la padella in cucina_%_' },
  friends: { id: '1592861956120-e524fc739696', alt: '_%_Amici a tavola che condividono i piatti_%_' },
  loft: { id: '1555396273-367ea4eb4db5', alt: '_%_La sala luminosa del piano superiore_%_' },
  events: { id: '1528605248644-14dd04022da1', alt: '_%_Una lunga tavolata per una festa privata_%_' },
};
