import type { Location } from '../core/resources.js';

/**
 * Solar panel deployment locations with real-world-inspired irradiance ratings
 * and weather condition biases.
 *
 * Irradiance ranges from 0.0 to 1.0, representing relative solar energy potential.
 * Weather bias values represent relative probabilities for each weather condition
 * at that location (higher values = more likely).
 *
 * Validates: Requirements 2.1, 6.1
 */
export const LOCATIONS: Location[] = [
  {
    id: 'sahara_desert',
    name: 'Sahara Desert',
    irradiance: 0.95,
    weatherBias: {
      sunny: 0.75,
      partly_cloudy: 0.15,
      overcast: 0.07,
      rainy: 0.03,
    },
  },
  {
    id: 'arizona',
    name: 'Arizona',
    irradiance: 0.90,
    weatherBias: {
      sunny: 0.60,
      partly_cloudy: 0.25,
      overcast: 0.10,
      rainy: 0.05,
    },
  },
  {
    id: 'southern_spain',
    name: 'Southern Spain',
    irradiance: 0.82,
    weatherBias: {
      sunny: 0.40,
      partly_cloudy: 0.35,
      overcast: 0.15,
      rainy: 0.10,
    },
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    irradiance: 0.65,
    weatherBias: {
      sunny: 0.20,
      partly_cloudy: 0.25,
      overcast: 0.35,
      rainy: 0.20,
    },
  },
  {
    id: 'london',
    name: 'London',
    irradiance: 0.50,
    weatherBias: {
      sunny: 0.10,
      partly_cloudy: 0.20,
      overcast: 0.40,
      rainy: 0.30,
    },
  },
  {
    id: 'arctic',
    name: 'Arctic',
    irradiance: 0.30,
    weatherBias: {
      sunny: 0.05,
      partly_cloudy: 0.15,
      overcast: 0.45,
      rainy: 0.35,
    },
  },
];

/**
 * Get a location by its ID.
 */
export function getLocationById(locationId: string): Location | undefined {
  return LOCATIONS.find((loc) => loc.id === locationId);
}

/**
 * Get all available locations sorted by irradiance (highest first).
 */
export function getLocationsByIrradiance(): Location[] {
  return [...LOCATIONS].sort((a, b) => b.irradiance - a.irradiance);
}
