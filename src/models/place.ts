import type { LngLat } from '../config/malaysia';

/** A searchable destination: a mall, hospital, street, address, postcode, town... */
export type Place = {
  id: string; // Mapbox ID
  name: string; // e.g. "Mid Valley Megamall"
  address: string; // e.g. "Lingkaran Syed Putra, 59200 Kuala Lumpur, Malaysia"
  kind: string; // poi, address, street, postcode, place, locality, neighborhood...
  category: string | null; // e.g. "shopping mall", "hospital", "petrol station"
  coordinates: LngLat;
  source: 'mapbox' | 'osm' | 'pin'; // where it came from (OpenStreetMap results need a credit line; 'pin' = long-press on the map)
};
