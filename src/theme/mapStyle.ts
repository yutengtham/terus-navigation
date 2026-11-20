import { colors } from './colors';

// We use Mapbox's official "Standard" style (real Malaysian map data, 3D buildings,
// 3D trees and landmarks) and recolour it to match the Terus reference images.
export const MAP_STYLE_URL = 'mapbox://styles/mapbox/standard';

/** Settings applied to the "basemap" of the Standard style. */
export const novaNavBasemapConfig = {
  lightPreset: 'day',
  theme: 'default',

  // Real 3D content from Mapbox
  show3dObjects: true,
  show3dBuildings: true,
  show3dTrees: true,
  show3dLandmarks: true,

  // Minimalist: hide clutter, keep roads and place names
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  showPedestrianRoads: false,
  showAdminBoundaries: false,
  showRoadLabels: false,
  showPlaceLabels: true,
  showLandmarkIconLabels: false,

  // Reference-image palette
  colorLand: colors.background,
  colorWater: colors.water,
  colorGreenspace: colors.park,
  colorBuildings: colors.building,
  // Main roads dark navy, small streets soft grey-blue so the map stays calm
  colorMotorways: colors.roadNavy,
  colorTrunks: colors.roadNavy,
  colorRoads: '#9AA8BA',
  // Remove the beige commercial / school / hospital areas
  colorCommercial: '#EEF2F6',
  colorEducation: '#EEF2F6',
  colorMedical: '#EEF2F6',
  colorIndustrial: '#EEF2F6',
  colorPlaceLabels: colors.text,
  colorRoadLabels: '#FFFFFF',
} as const;
