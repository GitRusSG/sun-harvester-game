import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyUpdate,
  detectEraProgression,
  advanceEra,
  ERA_ORDER,
} from '../../../../src/game/core/state-manager.js';
import type { StateUpdate } from '../../../../src/game/core/types.js';
import type { CountryId } from '../../../../src/game/core/types.js';

describe('createInitialState', () => {
  it('produces a valid state with correct country', () => {
    const state = createInitialState('usa');
    expect(state.country).toBe('usa');
    expect(state.countryProfile.id).toBe('usa');
  });

  it('starts in the fossil era', () => {
    const state = createInitialState('china');
    expect(state.currentEra).toBe('fossil');
  });

  it('initializes all era progress entries to 0', () => {
    const state = createInitialState('germany');
    for (const era of ERA_ORDER) {
      expect(state.eraProgress[era]).toBe(0);
    }
  });

  it('provides starting resources from country profile', () => {
    const state = createInitialState('japan');
    // Japan has currency: 1300, electronics: 80, silicon: 50, copper: 40, rare_earth: 20
    expect(state.resources.currency).toBe(1300);
    expect(state.materials.stockpiles.electronics).toBe(80);
    expect(state.materials.stockpiles.silicon).toBe(50);
    expect(state.materials.stockpiles.copper).toBe(40);
  });

  it('initializes energy state with correct max storage', () => {
    const state = createInitialState('india');
    // India has energyCapacity: 550
    expect(state.energy.maxStorage).toBe(550);
    expect(state.energy.stored).toBe(0);
    expect(state.energy.generated).toBe(0);
  });

  it('sets public approval to 70', () => {
    const state = createInitialState('brazil');
    expect(state.opposition.publicApproval).toBe(70);
  });

  it('initializes political influence for all other countries at 0', () => {
    const state = createInitialState('usa');
    expect(state.political.influence['china']).toBe(0);
    expect(state.political.influence['russia']).toBe(0);
    // Player's own country should not be in the influence map
    expect(state.political.influence['usa']).toBeUndefined();
  });

  it('sets version to 1', () => {
    const state = createInitialState('uk');
    expect(state.version).toBe(1);
  });

  it('sets space and mars as locked', () => {
    const state = createInitialState('france');
    expect(state.mars.unlocked).toBe(false);
    expect(state.space.unlocked).toBe(false);
    expect(state.dyson.unlocked).toBe(false);
  });

  it('works for all 10 countries', () => {
    const countries: CountryId[] = [
      'usa', 'china', 'russia', 'india', 'germany',
      'japan', 'uk', 'france', 'south_korea', 'brazil',
    ];
    for (const c of countries) {
      const state = createInitialState(c);
      expect(state.country).toBe(c);
      expect(state.countryProfile.id).toBe(c);
    }
  });
});

describe('applyUpdate', () => {
  it('merges partial resource updates immutably', () => {
    const state = createInitialState('usa');
    const update: StateUpdate = {
      resources: { currency: 2000 },
    };
    const newState = applyUpdate(state, update);

    expect(newState.resources.currency).toBe(2000);
    expect(newState.resources.knowledgePoints).toBe(0); // unchanged
    // Original state unchanged
    expect(state.resources.currency).toBe(1500);
  });

  it('merges partial material stockpile updates', () => {
    const state = createInitialState('china');
    const update: StateUpdate = {
      materials: { stockpiles: { ...state.materials.stockpiles, coal: 200, steel: 50 } },
    };
    const newState = applyUpdate(state, update);

    expect(newState.materials.stockpiles.coal).toBe(200);
    expect(newState.materials.stockpiles.steel).toBe(50);
    expect(newState.materials.stockpiles.iron_ore).toBe(150); // unchanged
    // Original unchanged
    expect(state.materials.stockpiles.coal).toBe(200);
  });

  it('appends unlocks without duplicates', () => {
    const state = createInitialState('germany');
    const update1: StateUpdate = { unlocks: ['recipe_steel', 'recipe_solar_cells'] };
    const state2 = applyUpdate(state, update1);

    expect(state2.supplyChain.recipes).toContain('recipe_steel');
    expect(state2.supplyChain.recipes).toContain('recipe_solar_cells');

    // Applying the same unlock again should not duplicate
    const update2: StateUpdate = { unlocks: ['recipe_steel', 'recipe_electronics'] };
    const state3 = applyUpdate(state2, update2);

    const steelCount = state3.supplyChain.recipes.filter((r) => r === 'recipe_steel').length;
    expect(steelCount).toBe(1);
    expect(state3.supplyChain.recipes).toContain('recipe_electronics');
  });

  it('applies path-based mutations', () => {
    const state = createInitialState('japan');
    const update: StateUpdate = {
      mutations: [
        { path: 'energy.stored', value: 250 },
        { path: 'weapons.militaryPower', value: 50 },
      ],
    };
    const newState = applyUpdate(state, update);

    expect(newState.energy.stored).toBe(250);
    expect(newState.weapons.militaryPower).toBe(50);
    // Original unchanged
    expect(state.energy.stored).toBe(0);
    expect(state.weapons.militaryPower).toBe(10);
  });

  it('applies deep path mutations', () => {
    const state = createInitialState('india');
    const update: StateUpdate = {
      mutations: [
        { path: 'weapons.arsenal.missile', value: 5 },
      ],
    };
    const newState = applyUpdate(state, update);
    expect(newState.weapons.arsenal.missile).toBe(5);
    expect(newState.weapons.arsenal.conventional).toBe(0); // unchanged
  });

  it('returns unchanged state for empty update', () => {
    const state = createInitialState('brazil');
    const newState = applyUpdate(state, {});
    expect(newState).toEqual(state);
  });
});

describe('detectEraProgression', () => {
  it('returns null when current era progress is below 100', () => {
    const state = createInitialState('usa');
    state.eraProgress.fossil = 50;
    expect(detectEraProgression(state)).toBeNull();
  });

  it('returns next era when current era progress reaches 100', () => {
    const state = createInitialState('usa');
    state.eraProgress.fossil = 100;
    expect(detectEraProgression(state)).toBe('nuclear');
  });

  it('returns null when already at dyson_ring era', () => {
    const state = createInitialState('usa');
    state.currentEra = 'dyson_ring';
    state.eraProgress.dyson_ring = 100;
    expect(detectEraProgression(state)).toBeNull();
  });

  it('correctly identifies progression through all eras', () => {
    const state = createInitialState('china');
    for (let i = 0; i < ERA_ORDER.length - 1; i++) {
      state.currentEra = ERA_ORDER[i];
      state.eraProgress[ERA_ORDER[i]] = 100;
      expect(detectEraProgression(state)).toBe(ERA_ORDER[i + 1]);
    }
  });
});

describe('advanceEra', () => {
  it('advances to next era when conditions are met', () => {
    const state = createInitialState('russia');
    state.eraProgress.fossil = 100;
    const newState = advanceEra(state);

    expect(newState.currentEra).toBe('nuclear');
    // Original unchanged
    expect(state.currentEra).toBe('fossil');
  });

  it('returns same state when conditions are not met', () => {
    const state = createInitialState('russia');
    state.eraProgress.fossil = 50;
    const newState = advanceEra(state);

    expect(newState.currentEra).toBe('fossil');
  });

  it('returns same state when already at final era', () => {
    const state = createInitialState('russia');
    state.currentEra = 'dyson_ring';
    state.eraProgress.dyson_ring = 100;
    const newState = advanceEra(state);

    expect(newState.currentEra).toBe('dyson_ring');
  });
});
