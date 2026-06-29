import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveSystem } from '../../../../src/game/core/save-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { GameState } from '../../../../src/game/core/types.js';

/**
 * Tests for the Save System (localStorage persistence, export/import, validation).
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

describe('SaveSystem', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('save/load round-trip', () => {
    it('preserves state through save and load cycle', () => {
      const state = createInitialState('usa');
      SaveSystem.save(state);

      const loaded = SaveSystem.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.country).toBe('usa');
      expect(loaded!.currentEra).toBe('fossil');
      expect(loaded!.version).toBe(1);
      expect(loaded!.resources.currency).toBe(1500);
      expect(loaded!.materials.stockpiles.coal).toBe(80);
      expect(loaded!.energy.maxStorage).toBe(600);
      expect(loaded!.opposition.publicApproval).toBe(70);
    });
  });

  describe('load() edge cases', () => {
    it('returns null when localStorage is empty', () => {
      const result = SaveSystem.load();
      expect(result).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      localStorageMock.setItem('sun_harvester_save', '{not valid json!!!');
      const result = SaveSystem.load();
      expect(result).toBeNull();
    });

    it('returns null for invalid version (0)', () => {
      const state = createInitialState('china');
      const corrupted = { ...state, version: 0 };
      localStorageMock.setItem('sun_harvester_save', JSON.stringify(corrupted));

      const result = SaveSystem.load();
      expect(result).toBeNull();
    });

    it('returns null for invalid era', () => {
      const state = createInitialState('germany');
      const corrupted = { ...state, currentEra: 'invalid_era' };
      localStorageMock.setItem('sun_harvester_save', JSON.stringify(corrupted));

      const result = SaveSystem.load();
      expect(result).toBeNull();
    });

    it('returns null for invalid country', () => {
      const state = createInitialState('japan');
      const corrupted = { ...state, country: 'atlantis' };
      localStorageMock.setItem('sun_harvester_save', JSON.stringify(corrupted));

      const result = SaveSystem.load();
      expect(result).toBeNull();
    });
  });

  describe('exportToJSON', () => {
    it('returns valid JSON string representing the state', () => {
      const state = createInitialState('russia');
      const json = SaveSystem.exportToJSON(state);

      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.country).toBe('russia');
      expect(parsed.currentEra).toBe('fossil');
      expect(parsed.version).toBe(1);
      expect(parsed.resources.currency).toBe(10000);
    });
  });

  describe('importFromJSON', () => {
    it('returns valid GameState from correct JSON', () => {
      const state = createInitialState('india');
      const json = JSON.stringify(state);

      const imported = SaveSystem.importFromJSON(json);
      expect(imported).not.toBeNull();
      expect(imported!.country).toBe('india');
      expect(imported!.currentEra).toBe('fossil');
      expect(imported!.version).toBe(1);
    });

    it('returns null for invalid/corrupted JSON', () => {
      const result = SaveSystem.importFromJSON('this is not json at all');
      expect(result).toBeNull();
    });

    it('returns null for JSON with missing required fields', () => {
      const incomplete = JSON.stringify({ version: 1, country: 'usa' });
      const result = SaveSystem.importFromJSON(incomplete);
      expect(result).toBeNull();
    });
  });

  describe('getLastSaveTimestamp', () => {
    it('returns correct timestamp after a save', () => {
      const state = createInitialState('brazil');
      const before = Date.now();
      SaveSystem.save(state);
      const after = Date.now();

      const timestamp = SaveSystem.getLastSaveTimestamp();
      expect(timestamp).not.toBeNull();
      expect(timestamp!).toBeGreaterThanOrEqual(before);
      expect(timestamp!).toBeLessThanOrEqual(after);
    });

    it('returns null when no save exists', () => {
      const timestamp = SaveSystem.getLastSaveTimestamp();
      expect(timestamp).toBeNull();
    });
  });
});
