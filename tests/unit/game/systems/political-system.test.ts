import { describe, it, expect } from 'vitest';
import { PoliticalSystem } from '../../../../src/game/systems/political-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { GameState, CountryId } from '../../../../src/game/core/types.js';
import type { PoliticalOperation, InfluenceMethod } from '../../../../src/game/core/opposition.js';

function createTestState(): GameState {
  return createInitialState('usa');
}

describe('PoliticalSystem', () => {
  const system = new PoliticalSystem();

  describe('getInfluenceScores', () => {
    it('should return influence scores for all non-player countries', () => {
      const state = createTestState();
      const scores = system.getInfluenceScores(state);

      // USA is the player, so 9 other countries should have scores
      expect(Object.keys(scores)).toHaveLength(9);
      expect(scores['usa' as CountryId]).toBeUndefined();
      expect(scores['china' as CountryId]).toBe(0);
      expect(scores['russia' as CountryId]).toBe(0);
    });
  });

  describe('investInfluence', () => {
    it('should create a political operation and deduct currency', () => {
      const state = createTestState();
      state.resources.currency = 1000;

      const update = system.investInfluence(state, 'china', 'economic_aid', 100);

      // Should deduct currency
      expect(update.resources?.currency).toBe(900);

      // Should add operation
      const opsMutation = update.mutations?.find((m) => m.path === 'political.activeOperations');
      expect(opsMutation).toBeDefined();
      const ops = opsMutation!.value as PoliticalOperation[];
      expect(ops).toHaveLength(1);
      expect(ops[0].targetCountry).toBe('china');
      expect(ops[0].method).toBe('economic_aid');
      expect(ops[0].investment).toBe(100);
    });

    it('should reject investment in own country', () => {
      const state = createTestState();
      state.resources.currency = 1000;

      const update = system.investInfluence(state, 'usa', 'economic_aid', 100);
      expect(update).toEqual({});
    });

    it('should reject investment when insufficient currency', () => {
      const state = createTestState();
      state.resources.currency = 50;

      const update = system.investInfluence(state, 'china', 'propaganda', 100);
      expect(update).toEqual({});
    });

    it('should reject zero or negative amounts', () => {
      const state = createTestState();
      state.resources.currency = 1000;

      expect(system.investInfluence(state, 'china', 'intelligence', 0)).toEqual({});
      expect(system.investInfluence(state, 'china', 'intelligence', -10)).toEqual({});
    });

    it('should calculate operation duration based on investment (10 currency = 1 tick)', () => {
      const state = createTestState();
      state.resources.currency = 1000;

      const update = system.investInfluence(state, 'germany', 'corporate_infiltration', 50);
      const ops = (update.mutations?.find((m) => m.path === 'political.activeOperations')!.value) as PoliticalOperation[];
      // 50 / 10 = 5 ticks
      expect(ops[0].remainingTicks).toBe(5);
    });
  });

  describe('update - influence growth over ticks', () => {
    it('should increase influence based on method rate per tick', () => {
      const state = createTestState();
      state.political.influence['china' as CountryId] = 10;
      state.political.activeOperations = [{
        id: 'op1',
        targetCountry: 'china',
        method: 'economic_aid',
        investment: 100,
        remainingTicks: 10,
      }];

      const update = system.update(state, 1);

      const influenceMutation = update.mutations?.find((m) => m.path === 'political.influence');
      expect(influenceMutation).toBeDefined();
      const influence = influenceMutation!.value as Record<CountryId, number>;
      // economic_aid rate = 0.5 per tick
      expect(influence['china' as CountryId]).toBe(10.5);
    });

    it('should apply propaganda rate (0.3 per tick)', () => {
      const state = createTestState();
      state.political.influence['india' as CountryId] = 20;
      state.political.activeOperations = [{
        id: 'op1',
        targetCountry: 'india',
        method: 'propaganda',
        investment: 50,
        remainingTicks: 5,
      }];

      const update = system.update(state, 1);
      const influence = (update.mutations?.find((m) => m.path === 'political.influence')!.value) as Record<CountryId, number>;
      expect(influence['india' as CountryId]).toBe(20.3);
    });

    it('should apply corporate_infiltration rate (0.8 per tick)', () => {
      const state = createTestState();
      state.political.influence['germany' as CountryId] = 30;
      state.political.activeOperations = [{
        id: 'op1',
        targetCountry: 'germany',
        method: 'corporate_infiltration',
        investment: 50,
        remainingTicks: 5,
      }];

      const update = system.update(state, 1);
      const influence = (update.mutations?.find((m) => m.path === 'political.influence')!.value) as Record<CountryId, number>;
      expect(influence['germany' as CountryId]).toBe(30.8);
    });

    it('should apply intelligence rate (1.0 per tick)', () => {
      const state = createTestState();
      state.political.influence['russia' as CountryId] = 40;
      state.political.activeOperations = [{
        id: 'op1',
        targetCountry: 'russia',
        method: 'intelligence',
        investment: 50,
        remainingTicks: 5,
      }];

      const update = system.update(state, 1);
      const influence = (update.mutations?.find((m) => m.path === 'political.influence')!.value) as Record<CountryId, number>;
      expect(influence['russia' as CountryId]).toBe(41);
    });

    it('should cap influence at 100', () => {
      const state = createTestState();
      state.political.influence['japan' as CountryId] = 99.5;
      state.political.activeOperations = [{
        id: 'op1',
        targetCountry: 'japan',
        method: 'intelligence',
        investment: 50,
        remainingTicks: 5,
      }];

      const update = system.update(state, 1);
      const influence = (update.mutations?.find((m) => m.path === 'political.influence')!.value) as Record<CountryId, number>;
      expect(influence['japan' as CountryId]).toBe(100);
    });

    it('should remove completed operations', () => {
      const state = createTestState();
      state.political.influence['china' as CountryId] = 10;
      state.political.activeOperations = [{
        id: 'op1',
        targetCountry: 'china',
        method: 'economic_aid',
        investment: 10,
        remainingTicks: 1, // will complete after 1 tick
      }];

      const update = system.update(state, 1);
      const ops = (update.mutations?.find((m) => m.path === 'political.activeOperations')!.value) as PoliticalOperation[];
      expect(ops).toHaveLength(0);
    });

    it('should accumulate influence over multiple ticks', () => {
      const state = createTestState();
      state.political.influence['france' as CountryId] = 0;
      state.political.activeOperations = [{
        id: 'op1',
        targetCountry: 'france',
        method: 'economic_aid',
        investment: 100,
        remainingTicks: 10,
      }];

      const update = system.update(state, 5);
      const influence = (update.mutations?.find((m) => m.path === 'political.influence')!.value) as Record<CountryId, number>;
      // 0.5 * 5 = 2.5
      expect(influence['france' as CountryId]).toBe(2.5);
    });
  });

  describe('politician installation', () => {
    it('should install a politician when influence reaches 75', () => {
      const state = createTestState();
      state.political.influence['china' as CountryId] = 74.5;
      state.political.activeOperations = [{
        id: 'op1',
        targetCountry: 'china',
        method: 'intelligence',
        investment: 50,
        remainingTicks: 10,
      }];

      const update = system.update(state, 1);

      // Influence: 74.5 + 1.0 = 75.5 >= 75
      const politicians = (update.mutations?.find((m) => m.path === 'political.installedPoliticians')!.value) as CountryId[];
      expect(politicians).toContain('china');
    });

    it('should emit politician_installed event', () => {
      const state = createTestState();
      state.political.influence['china' as CountryId] = 74.5;
      state.political.activeOperations = [{
        id: 'op1',
        targetCountry: 'china',
        method: 'intelligence',
        investment: 50,
        remainingTicks: 10,
      }];

      const update = system.update(state, 1);
      const installedEvent = update.events?.find((e) => e.type === 'politician_installed');
      expect(installedEvent).toBeDefined();
      expect(installedEvent!.payload.country).toBe('china');
    });

    it('should not re-install an already installed politician', () => {
      const state = createTestState();
      state.political.influence['china' as CountryId] = 80;
      state.political.installedPoliticians = ['china'];
      state.political.activeOperations = [];

      const update = system.update(state, 1);
      const politicians = (update.mutations?.find((m) => m.path === 'political.installedPoliticians')!.value) as CountryId[];
      // Should still just have one entry for china
      expect(politicians.filter((c) => c === 'china')).toHaveLength(1);
      // No installation event
      expect(update.events).toBeUndefined();
    });
  });

  describe('coup mechanic', () => {
    it('should remove politician via coup when influence drops below 50', () => {
      const state = createTestState();
      state.political.influence['china' as CountryId] = 49;
      state.political.installedPoliticians = ['china'];
      state.political.activeOperations = [];

      const update = system.update(state, 1);
      const politicians = (update.mutations?.find((m) => m.path === 'political.installedPoliticians')!.value) as CountryId[];
      expect(politicians).not.toContain('china');
    });

    it('should emit coup event when politician is removed', () => {
      const state = createTestState();
      state.political.influence['china' as CountryId] = 30;
      state.political.installedPoliticians = ['china'];
      state.political.activeOperations = [];

      const update = system.update(state, 1);
      const coupEvent = update.events?.find((e) => e.type === 'coup');
      expect(coupEvent).toBeDefined();
      expect(coupEvent!.payload.country).toBe('china');
    });

    it('should not trigger coup if influence is exactly 50', () => {
      const state = createTestState();
      state.political.influence['china' as CountryId] = 50;
      state.political.installedPoliticians = ['china'];
      state.political.activeOperations = [];

      const update = system.update(state, 1);
      const politicians = (update.mutations?.find((m) => m.path === 'political.installedPoliticians')!.value) as CountryId[];
      expect(politicians).toContain('china');
      expect(update.events).toBeUndefined();
    });
  });

  describe('checkWorldDomination', () => {
    it('should return true when 5 or more countries are controlled', () => {
      const state = createTestState();
      state.political.installedPoliticians = ['china', 'russia', 'india', 'germany', 'japan'];

      expect(system.checkWorldDomination(state)).toBe(true);
    });

    it('should return false when fewer than 5 countries are controlled', () => {
      const state = createTestState();
      state.political.installedPoliticians = ['china', 'russia', 'india', 'germany'];

      expect(system.checkWorldDomination(state)).toBe(false);
    });

    it('should return true with more than 5 countries', () => {
      const state = createTestState();
      state.political.installedPoliticians = ['china', 'russia', 'india', 'germany', 'japan', 'uk'];

      expect(system.checkWorldDomination(state)).toBe(true);
    });
  });

  describe('World Domination status in update', () => {
    it('should set worldDominationAchieved when 5 politicians installed', () => {
      const state = createTestState();
      state.political.influence = {
        china: 80, russia: 80, india: 80, germany: 80, japan: 80,
        uk: 0, france: 0, south_korea: 0, brazil: 0,
      } as Record<CountryId, number>;
      state.political.installedPoliticians = ['china', 'russia', 'india', 'germany', 'japan'];
      state.political.worldDominationAchieved = false;
      state.political.activeOperations = [];

      const update = system.update(state, 1);
      const domination = update.mutations?.find((m) => m.path === 'political.worldDominationAchieved');
      expect(domination!.value).toBe(true);
    });

    it('should revoke worldDominationAchieved when control drops below 5', () => {
      const state = createTestState();
      state.political.influence = {
        china: 80, russia: 80, india: 80, germany: 80, japan: 30,
        uk: 0, france: 0, south_korea: 0, brazil: 0,
      } as Record<CountryId, number>;
      state.political.installedPoliticians = ['china', 'russia', 'india', 'germany', 'japan'];
      state.political.worldDominationAchieved = true;
      state.political.activeOperations = [];

      // Japan at 30 should trigger coup, dropping to 4 controlled
      const update = system.update(state, 1);
      const domination = update.mutations?.find((m) => m.path === 'political.worldDominationAchieved');
      expect(domination!.value).toBe(false);
    });
  });

  describe('global resource pooling', () => {
    it('should return 0 when world domination is not achieved', () => {
      const state = createTestState();
      state.political.worldDominationAchieved = false;
      state.political.installedPoliticians = ['china', 'russia'];

      expect(system.getGlobalResourcePooling(state)).toBe(0);
    });

    it('should calculate pooled resources with efficiency factor', () => {
      const state = createTestState();
      state.political.worldDominationAchieved = true;
      state.political.installedPoliticians = ['china', 'russia', 'india', 'germany', 'japan'];

      // 5 countries * 50 base * 0.6 efficiency = 150
      expect(system.getGlobalResourcePooling(state)).toBe(150);
    });

    it('should add pooled currency during update when world domination is active', () => {
      const state = createTestState();
      state.resources.currency = 500;
      state.political.influence = {
        china: 80, russia: 80, india: 80, germany: 80, japan: 80,
        uk: 0, france: 0, south_korea: 0, brazil: 0,
      } as Record<CountryId, number>;
      state.political.installedPoliticians = ['china', 'russia', 'india', 'germany', 'japan'];
      state.political.worldDominationAchieved = true;
      state.political.activeOperations = [];

      const update = system.update(state, 1);

      // Pooled: 5 * 50 * 0.6 = 150 per tick
      expect(update.resources?.currency).toBe(500 + 150);
    });
  });

  describe('getControlledCountries', () => {
    it('should return list of installed politician countries', () => {
      const state = createTestState();
      state.political.installedPoliticians = ['china', 'russia'];

      const controlled = system.getControlledCountries(state);
      expect(controlled).toEqual(['china', 'russia']);
    });

    it('should return empty array when no countries controlled', () => {
      const state = createTestState();
      expect(system.getControlledCountries(state)).toEqual([]);
    });
  });

  describe('canPerform', () => {
    it('should return true for valid invest_influence action', () => {
      const state = createTestState();
      state.resources.currency = 1000;

      expect(system.canPerform(state, {
        type: 'invest_influence',
        payload: { country: 'china', method: 'economic_aid', amount: 100 },
      })).toBe(true);
    });

    it('should return false for own country', () => {
      const state = createTestState();
      state.resources.currency = 1000;

      expect(system.canPerform(state, {
        type: 'invest_influence',
        payload: { country: 'usa', method: 'economic_aid', amount: 100 },
      })).toBe(false);
    });

    it('should return false for insufficient currency', () => {
      const state = createTestState();
      state.resources.currency = 50;

      expect(system.canPerform(state, {
        type: 'invest_influence',
        payload: { country: 'china', method: 'economic_aid', amount: 100 },
      })).toBe(false);
    });

    it('should return false for unknown action type', () => {
      const state = createTestState();

      expect(system.canPerform(state, {
        type: 'unknown_action',
        payload: {},
      })).toBe(false);
    });
  });

  describe('perform', () => {
    it('should execute invest_influence action', () => {
      const state = createTestState();
      state.resources.currency = 1000;

      const update = system.perform(state, {
        type: 'invest_influence',
        payload: { country: 'china', method: 'propaganda', amount: 200 },
      });

      expect(update.resources?.currency).toBe(800);
      const ops = (update.mutations?.find((m) => m.path === 'political.activeOperations')!.value) as PoliticalOperation[];
      expect(ops).toHaveLength(1);
      expect(ops[0].method).toBe('propaganda');
    });

    it('should return empty for unknown action', () => {
      const state = createTestState();

      const update = system.perform(state, {
        type: 'unknown',
        payload: {},
      });

      expect(update).toEqual({});
    });
  });

  describe('activeEras', () => {
    it('should be active from Nuclear Era onwards', () => {
      expect(system.activeEras).toContain('nuclear');
      expect(system.activeEras).toContain('solar');
      expect(system.activeEras).toContain('orbital');
      expect(system.activeEras).toContain('mars_colonization');
      expect(system.activeEras).toContain('space_mining');
      expect(system.activeEras).toContain('dyson_ring');
      expect(system.activeEras).not.toContain('fossil');
    });
  });
});
