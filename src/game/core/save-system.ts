import type { GameState, Era, CountryId } from './types.js';

const STORAGE_KEY = 'sun_harvester_save';

const VALID_ERAS: Era[] = [
  'fossil',
  'nuclear',
  'solar',
  'orbital',
  'mars_colonization',
  'space_mining',
  'dyson_ring',
];

const VALID_COUNTRIES: CountryId[] = [
  'usa', 'china', 'russia', 'india', 'germany',
  'japan', 'uk', 'france', 'south_korea', 'brazil',
];

/**
 * Save System implementing localStorage persistence for the Sun Harvester game.
 * Handles automatic saving, loading, validation, and manual export/import.
 */
export const SaveSystem = {
  /**
   * Saves the current game state to localStorage as JSON.
   * Updates the lastSaveTimestamp before persisting.
   */
  save(state: GameState): void {
    try {
      const stateToSave: GameState = {
        ...state,
        lastSaveTimestamp: Date.now(),
      };
      const json = JSON.stringify(stateToSave);
      localStorage.setItem(STORAGE_KEY, json);
    } catch (error) {
      console.warn('[SaveSystem] Failed to save game state:', error);
    }
  },

  /**
   * Loads and parses the game state from localStorage.
   * Returns null if no save exists, data is corrupted, or version is incompatible.
   */
  load(): GameState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);

      if (SaveSystem.validateState(parsed)) {
        return parsed;
      }

      console.warn('[SaveSystem] Saved data failed validation. Starting fresh.');
      return null;
    } catch (error) {
      console.warn('[SaveSystem] Failed to load game state:', error);
      return null;
    }
  },

  /**
   * Validates that unknown data conforms to the GameState interface.
   * Checks version compatibility, required fields, and basic type correctness.
   */
  validateState(data: unknown): data is GameState {
    if (data === null || data === undefined || typeof data !== 'object') {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Check version
    if (typeof obj.version !== 'number' || obj.version < 1) {
      console.warn('[SaveSystem] Incompatible save version:', obj.version);
      return false;
    }

    // Check lastSaveTimestamp
    if (typeof obj.lastSaveTimestamp !== 'number') {
      return false;
    }

    // Check currentEra
    if (typeof obj.currentEra !== 'string' || !VALID_ERAS.includes(obj.currentEra as Era)) {
      console.warn('[SaveSystem] Invalid era in save data:', obj.currentEra);
      return false;
    }

    // Check country
    if (typeof obj.country !== 'string' || !VALID_COUNTRIES.includes(obj.country as CountryId)) {
      console.warn('[SaveSystem] Invalid country in save data:', obj.country);
      return false;
    }

    // Check required top-level objects exist
    const requiredObjects = [
      'eraProgress', 'countryProfile', 'resources', 'materials',
      'energy', 'infrastructure', 'research', 'supplyChain',
      'weather', 'opposition', 'political', 'weapons',
      'mars', 'space', 'dyson', 'education', 'statistics',
    ];

    for (const key of requiredObjects) {
      if (typeof obj[key] !== 'object' || obj[key] === null) {
        console.warn(`[SaveSystem] Missing or invalid field: ${key}`);
        return false;
      }
    }

    return true;
  },

  /**
   * Exports the given game state as a JSON string for manual backup.
   */
  exportToJSON(state: GameState): string {
    return JSON.stringify(state);
  },

  /**
   * Imports a game state from a JSON string.
   * Returns null if the JSON is invalid or the state fails validation.
   */
  importFromJSON(json: string): GameState | null {
    try {
      const parsed: unknown = JSON.parse(json);

      if (SaveSystem.validateState(parsed)) {
        return parsed;
      }

      console.warn('[SaveSystem] Imported data failed validation.');
      return null;
    } catch (error) {
      console.warn('[SaveSystem] Failed to parse imported JSON:', error);
      return null;
    }
  },

  /**
   * Returns the timestamp of the last save, or null if no save exists.
   * Used for offline earnings calculation.
   */
  getLastSaveTimestamp(): number | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'lastSaveTimestamp' in parsed &&
        typeof (parsed as Record<string, unknown>).lastSaveTimestamp === 'number'
      ) {
        return (parsed as Record<string, unknown>).lastSaveTimestamp as number;
      }

      return null;
    } catch {
      return null;
    }
  },
};
