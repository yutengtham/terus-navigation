/**
 * Quick search buttons ("Petrol", "Hospital", ...) shown on the search screen.
 *
 * Each button asks two free sources and merges the answers, nearest first:
 *  - OpenStreetMap places via Geoapify (`osm`, Geoapify category names) - best Malaysian coverage
 *  - Mapbox Search Box categories (`mapbox`), each ID checked against live KL results (Nov 2026).
 *    Left out (null) where Mapbox's Malaysian results were poor, e.g. "hospital" returned an
 *    LRT shaft and a clinic near KLCC.
 */
export type QuickCategoryId =
  | 'fuel'
  | 'parking'
  | 'restaurant'
  | 'coffee'
  | 'hospital'
  | 'pharmacy'
  | 'clinic'
  | 'atm'
  | 'groceries'
  | 'ev'
  | 'mosque'
  | 'toilet'
  | 'shopping'
  | 'hotel'
  | 'police';

export type QuickCategory = {
  id: QuickCategoryId;
  label: string;
  /** Heading above the results, e.g. "Petrol stations near you" */
  plural: string;
  /** Name for places with no name in the map data, e.g. a car park */
  fallbackName: string;
  osm: string;
  mapbox: string | null;
  /** Circle colour, grouped by theme (vehicle blue, food orange, health red...) */
  color: string;
};

export const QUICK_CATEGORIES: QuickCategory[] = [
  { id: 'fuel', label: 'Petrol', plural: 'Petrol stations', fallbackName: 'Petrol station', osm: 'service.vehicle.fuel', mapbox: 'gas_station', color: '#2F7FD1' },
  { id: 'parking', label: 'Parking', plural: 'Parking', fallbackName: 'Car park', osm: 'parking.cars', mapbox: 'parking_lot', color: '#2F7FD1' },
  { id: 'restaurant', label: 'Restaurant', plural: 'Restaurants', fallbackName: 'Restaurant', osm: 'catering.restaurant,catering.food_court,catering.fast_food', mapbox: 'restaurant', color: '#D9822B' },
  { id: 'coffee', label: 'Coffee', plural: 'Cafés', fallbackName: 'Café', osm: 'catering.cafe', mapbox: 'cafe', color: '#B5703A' },
  { id: 'hospital', label: 'Hospital', plural: 'Hospitals', fallbackName: 'Hospital', osm: 'healthcare.hospital', mapbox: null, color: '#D6404B' },
  { id: 'pharmacy', label: 'Pharmacy', plural: 'Pharmacies', fallbackName: 'Pharmacy', osm: 'healthcare.pharmacy', mapbox: 'pharmacy', color: '#D6404B' },
  { id: 'clinic', label: 'Clinic', plural: 'Clinics', fallbackName: 'Clinic', osm: 'healthcare.clinic_or_praxis', mapbox: 'clinic', color: '#D6404B' },
  { id: 'atm', label: 'ATM', plural: 'ATMs', fallbackName: 'ATM', osm: 'service.financial.atm', mapbox: 'atm', color: '#64748B' },
  { id: 'groceries', label: 'Groceries', plural: 'Groceries & convenience stores', fallbackName: 'Shop', osm: 'commercial.supermarket,commercial.convenience', mapbox: 'supermarket', color: '#B0479A' },
  { id: 'ev', label: 'Charging', plural: 'EV chargers', fallbackName: 'EV charger', osm: 'service.vehicle.charging_station', mapbox: 'charging_station', color: '#16A37F' },
  { id: 'mosque', label: 'Mosque', plural: 'Mosques & surau', fallbackName: 'Surau / mosque', osm: 'religion.place_of_worship.islam', mapbox: 'mosque', color: '#138A72' },
  { id: 'toilet', label: 'Toilet', plural: 'Public toilets', fallbackName: 'Toilet', osm: 'amenity.toilet', mapbox: null, color: '#5B7083' },
  { id: 'shopping', label: 'Shopping', plural: 'Shopping malls', fallbackName: 'Shopping mall', osm: 'commercial.shopping_mall', mapbox: 'shopping_mall', color: '#B0479A' },
  { id: 'hotel', label: 'Hotel', plural: 'Hotels', fallbackName: 'Hotel', osm: 'accommodation.hotel', mapbox: 'hotel', color: '#6E56CF' },
  { id: 'police', label: 'Police', plural: 'Police stations', fallbackName: 'Police', osm: 'service.police', mapbox: 'police_station', color: '#334A6B' },
];
