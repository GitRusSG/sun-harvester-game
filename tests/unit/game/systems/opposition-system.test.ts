import { describe, it, expect, vi } from 'vitest';
import { OppositionSystem } from '../../../../src/game/systems/opposition-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { GameState, CountryId } from '../../../../src/game/core/types.js';
import type { Sanction } from '../../../../src/game/core/opposition.js';

function createTestState(): GameState {
  return createInitialState('usa');
}

describe('OppositionSystem', () => {
  const system = new OppositionSystem();

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

  describe('getPublicApproval', () => {
    it('should return the current public approval', () => {
      const state = createTestState();
      expect(system.getPublicApproval(state)).toBe(70);
    });

    it('should reflect updated approval', () => {
      const state = createTestState();
      state.opposition.publicApproval = 45;
      expect(system.getPublicApproval(state)).toBe(45);
    });
  });

  describe('getUNThreatLevel', () => {
    it('should return average of hostility and power level', () => {
      const state = createTestState();
      state.opposition.unHostility = 60;
      state.opposition.unPowerLevel = 80;
      expect(system.getUNThreatLevel(state)).toBe(70);
    });

    it('should be capped at 100', () => {
      const state = createTestState();
      state.opposition.unHostility = 100;
      state.opposition.unPowerLevel = 100;
      expect(system.getUNThreatLevel(state)).toBe(100);
    });
  });

  describe('isConstructionBlocked', () => {
    it('should block construction when approval drops below 30%', () => {
      const state = createTestState();
      state.opposition.publicApproval = 29;
      expect(system.isConstructionBlocked(state)).toBe(true);
    });

    it('should not block construction at 30% approval', () => {
      const state = createTestState();
      state.opposition.publicApproval = 30;
      expect(system.isConstructionBlocked(state)).toBe(false);
    });

    it('should not block construction above 30%', () => {
      const state = createTestState();
      state.opposition.publicApproval = 70;
      expect(system.isConstructionBlocked(state)).toBe(false);
    });
  });

  describe('update - approval decay with nuclear plants', () => {
    it('should decrease approval by 0.1 per nuclear plant per tick', () => {
      const state = createTestState();
      state.opposition.publicApproval = 70;
      state.energy.powerPlants = [
        { id: 'nuc1', type: 'nuclear', level: 1, fuelType: 'uranium', consumptionRate: 1, outputRate: 100, active: true },
        { id: 'nuc2', type: 'nuclear', level: 1, fuelType: 'uranium', consumptionRate: 1, outputRate: 100, active: true },
      ];

      const update = system.update(state, 1);
      const approvalMutation = update.mutations?.find((m) => m.path === 'opposition.publicApproval');
      // 70 - (0.1 * 2 * 1) = 69.8
      expect(approvalMutation!.value).toBeCloseTo(69.8, 5);
    });

    it('should accumulate decay over multiple ticks', () => {
      const state = createTestState();
      state.opposition.publicApproval = 70;
      state.energy.powerPlants = [
        { id: 'nuc1', type: 'nuclear', level: 1, fuelType: 'uranium', consumptionRate: 1, outputRate: 100, active: true },
      ];

      const update = system.update(state, 10);
      const approvalMutation = update.mutations?.find((m) => m.path === 'opposition.publicApproval');
      // 70 - (0.1 * 1 * 10) = 69.0
      expect(approvalMutation!.value).toBeCloseTo(69.0, 5);
    });

    it('should not decrease approval below 0', () => {
      const state = createTestState();
      state.opposition.publicApproval = 0.5;
      state.energy.powerPlants = [
        { id: 'nuc1', type: 'nuclear', level: 1, fuelType: 'uranium', consumptionRate: 1, outputRate: 100, active: true },
      ];

      const update = system.update(state, 10);
      const approvalMutation = update.mutations?.find((m) => m.path === 'opposition.publicApproval');
      expect(approvalMutation!.value).toBe(0);
    });

    it('should not decrease approval when no nuclear plants exist', () => {
      const state = createTestState();
      state.opposition.publicApproval = 70;
      state.energy.powerPlants = [
        { id: 'coal1', type: 'coal', level: 1, fuelType: 'coal', consumptionRate: 1, outputRate: 50, active: true },
      ];

      const update = system.update(state, 10);
      const approvalMutation = update.mutations?.find((m) => m.path === 'opposition.publicApproval');
      expect(approvalMutation!.value).toBe(70);
    });
  });

  describe('update - protest generation', () => {
    it('should generate protests proportional to nuclear plant count', () => {
      const state = createTestState();
      state.energy.powerPlants = [
        { id: 'nuc1', type: 'nuclear', level: 1, fuelType: 'uranium', consumptionRate: 1, outputRate: 100, active: true },
        { id: 'nuc2', type: 'nuclear', level: 1, fuelType: 'uranium', consumptionRate: 1, outputRate: 100, active: true },
        { id: 'nuc3', type: 'nuclear', level: 1, fuelType: 'uranium', consumptionRate: 1, outputRate: 100, active: true },
      ];

      // Run many ticks to get a statistical chance of generating protests
      // With 3 nuclear plants, chance per tick = 3 * 0.02 = 0.06
      vi.spyOn(Math, 'random').mockReturnValue(0.01); // Always triggers (< 0.06)

      const update = system.update(state, 1);
      const protestsMutation = update.mutations?.find((m) => m.path === 'opposition.activeProtests');
      const protests = protestsMutation!.value as typeof state.opposition.activeProtests;
      expect(protests.length).toBeGreaterThan(0);
      expect(protests[0].cause).toBe('anti_nuclear');
      expect(protests[0].severity).toBeCloseTo(0.3, 5); // 3 * 0.1

      vi.restoreAllMocks();
    });

    it('should not generate protests without nuclear plants', () => {
      const state = createTestState();
      state.energy.powerPlants = [];

      vi.spyOn(Math, 'random').mockReturnValue(0.01);

      const update = system.update(state, 5);
      const protestsMutation = update.mutations?.find((m) => m.path === 'opposition.activeProtests');
      const protests = protestsMutation!.value as typeof state.opposition.activeProtests;
      expect(protests).toHaveLength(0);

      vi.restoreAllMocks();
    });

    it('should cap protest severity at 1.0', () => {
      const state = createTestState();
      // 15 nuclear plants -> severity would be 15 * 0.1 = 1.5, capped to 1.0
      state.energy.powerPlants = Array.from({ length: 15 }, (_, i) => ({
        id: `nuc${i}`, type: 'nuclear' as const, level: 1, fuelType: 'uranium' as const,
        consumptionRate: 1, outputRate: 100, active: true,
      }));

      vi.spyOn(Math, 'random').mockReturnValue(0.001);

      const update = system.update(state, 1);
      const protestsMutation = update.mutations?.find((m) => m.path === 'opposition.activeProtests');
      const protests = protestsMutation!.value as typeof state.opposition.activeProtests;
      expect(protests[0].severity).toBe(1.0);

      vi.restoreAllMocks();
    });
  });

  describe('update - protest decay', () => {
    it('should decrease protest remainingTicks and remove expired protests', () => {
      const state = createTestState();
      state.opposition.activeProtests = [
        { id: 'p1', cause: 'anti_nuclear', severity: 0.5, remainingTicks: 5, affectedArea: 'construction' },
        { id: 'p2', cause: 'anti_nuclear', severity: 0.3, remainingTicks: 20, affectedArea: 'construction' },
      ];

      const update = system.update(state, 10);
      const protestsMutation = update.mutations?.find((m) => m.path === 'opposition.activeProtests');
      const protests = protestsMutation!.value as typeof state.opposition.activeProtests;

      // p1 had 5 ticks remaining, 5 - 10 = -5 -> removed
      // p2 had 20 ticks remaining, 20 - 10 = 10 -> kept
      expect(protests).toHaveLength(1);
      expect(protests[0].id).toBe('p2');
      expect(protests[0].remainingTicks).toBe(10);
    });
  });

  describe('update - UN hostility', () => {
    it('should increase hostility when energy stored > 1000', () => {
      const state = createTestState();
      state.opposition.unHostility = 20;
      state.energy.stored = 1500;

      const update = system.update(state, 10);
      const hostilityMutation = update.mutations?.find((m) => m.path === 'opposition.unHostility');
      // 20 + 0.1 * 10 = 21
      expect(hostilityMutation!.value).toBeCloseTo(21, 5);
    });

    it('should not increase hostility when energy stored <= 1000', () => {
      const state = createTestState();
      state.opposition.unHostility = 20;
      state.energy.stored = 500;

      const update = system.update(state, 10);
      const hostilityMutation = update.mutations?.find((m) => m.path === 'opposition.unHostility');
      expect(hostilityMutation!.value).toBe(20);
    });

    it('should increase hostility based on orbital platforms and territories', () => {
      const state = createTestState();
      state.opposition.unHostility = 20;
      state.energy.stored = 0;
      state.space.orbitalPlatforms = [
        { id: 'op1', type: 'solar_collector', level: 1, output: 10 },
        { id: 'op2', type: 'station', level: 1, output: 5 },
      ];
      state.space.territories = [
        { id: 't1', name: 'Asteroid A', resourceProfile: {} as any, depositQuality: 0.8, surveyed: true, miningLevel: 1, productionRate: 10 },
      ];

      const update = system.update(state, 10);
      const hostilityMutation = update.mutations?.find((m) => m.path === 'opposition.unHostility');
      // (2 platforms + 1 territory) * 0.05 * 10 = 1.5
      expect(hostilityMutation!.value).toBeCloseTo(21.5, 5);
    });

    it('should cap hostility at 100', () => {
      const state = createTestState();
      state.opposition.unHostility = 99.5;
      state.energy.stored = 5000;

      const update = system.update(state, 100);
      const hostilityMutation = update.mutations?.find((m) => m.path === 'opposition.unHostility');
      expect(hostilityMutation!.value).toBe(100);
    });
  });

  describe('update - UN attacks', () => {
    it('should generate sanctions when hostility > 50 and cooldown elapsed', () => {
      const state = createTestState();
      state.opposition.unHostility = 55;
      state.opposition.lastUNAttackTick = 0;
      state.statistics.playTimeTicks = 200;
      state.energy.stored = 0; // prevent further hostility increase

      const update = system.update(state, 1);
      const sanctionsMutation = update.mutations?.find((m) => m.path === 'opposition.activeSanctions');
      const sanctions = sanctionsMutation!.value as Sanction[];
      expect(sanctions.length).toBeGreaterThan(0);

      const attackEvent = update.events?.find((e) => e.type === 'un_attack');
      expect(attackEvent).toBeDefined();
      expect(attackEvent!.payload.attackType).toBe('sanctions');
    });

    it('should generate embargo when hostility between 70-90', () => {
      const state = createTestState();
      state.opposition.unHostility = 75;
      state.opposition.lastUNAttackTick = 0;
      state.statistics.playTimeTicks = 200;
      state.energy.stored = 0;

      const update = system.update(state, 1);
      const attackEvent = update.events?.find((e) => e.type === 'un_attack');
      expect(attackEvent).toBeDefined();
      expect(attackEvent!.payload.attackType).toBe('embargo');
    });

    it('should generate military intervention when hostility >= 90', () => {
      const state = createTestState();
      state.opposition.unHostility = 95;
      state.opposition.lastUNAttackTick = 0;
      state.statistics.playTimeTicks = 200;
      state.energy.stored = 0;

      const update = system.update(state, 1);
      const attackEvent = update.events?.find((e) => e.type === 'un_attack');
      expect(attackEvent).toBeDefined();
      expect(attackEvent!.payload.attackType).toBe('military_intervention');
    });

    it('should not attack if cooldown has not elapsed', () => {
      const state = createTestState();
      state.opposition.unHostility = 80;
      state.opposition.lastUNAttackTick = 150;
      state.statistics.playTimeTicks = 200; // 200 - 150 = 50, < 100 cooldown
      state.energy.stored = 0;

      const update = system.update(state, 1);
      const attackEvents = update.events?.filter((e) => e.type === 'un_attack') ?? [];
      expect(attackEvents).toHaveLength(0);
    });

    it('should reduce attack severity by 50% when player military > UN power', () => {
      const state = createTestState();
      state.opposition.unHostility = 60;
      state.opposition.unPowerLevel = 30;
      state.weapons.militaryPower = 50; // > 30
      state.opposition.lastUNAttackTick = 0;
      state.statistics.playTimeTicks = 200;
      state.energy.stored = 0;

      const update = system.update(state, 1);
      const attackEvent = update.events?.find((e) => e.type === 'un_attack');
      expect(attackEvent).toBeDefined();
      // Normal severity: 60/100 = 0.6, reduced by 50% = 0.3
      expect(attackEvent!.payload.severity).toBeCloseTo(0.3, 5);
    });

    it('should reduce UN power level when player defeats military intervention', () => {
      const state = createTestState();
      state.opposition.unHostility = 95;
      state.opposition.unPowerLevel = 40;
      state.weapons.militaryPower = 50; // > 40
      state.opposition.lastUNAttackTick = 0;
      state.statistics.playTimeTicks = 200;
      state.energy.stored = 0;

      const update = system.update(state, 1);
      const powerMutation = update.mutations?.find((m) => m.path === 'opposition.unPowerLevel');
      // 40 - 10 = 30
      expect(powerMutation!.value).toBe(30);
    });
  });

  describe('update - sanctions increase trade costs', () => {
    it('should add sanctions with severity proportional to hostility', () => {
      const state = createTestState();
      state.opposition.unHostility = 60;
      state.opposition.lastUNAttackTick = 0;
      state.statistics.playTimeTicks = 200;
      state.energy.stored = 0;

      const update = system.update(state, 1);
      const sanctionsMutation = update.mutations?.find((m) => m.path === 'opposition.activeSanctions');
      const sanctions = sanctionsMutation!.value as Sanction[];
      expect(sanctions.length).toBeGreaterThan(0);
      // Severity: (60/100) * 50 = 30% trade cost increase
      expect(sanctions[0].severity).toBeCloseTo(30, 0);
    });
  });

  describe('update - final UN confrontation', () => {
    it('should trigger final confrontation when global influence > 70%', () => {
      const state = createTestState();
      state.opposition.unHostility = 50;
      state.energy.stored = 0;
      // Set high influence for all countries
      const countries = Object.keys(state.political.influence) as CountryId[];
      for (const c of countries) {
        state.political.influence[c] = 80;
      }

      const update = system.update(state, 1);
      const hostilityMutation = update.mutations?.find((m) => m.path === 'opposition.unHostility');
      expect(hostilityMutation!.value).toBe(100);

      const confrontationEvent = update.events?.find(
        (e) => e.type === 'un_attack' && e.payload.attackType === 'final_confrontation'
      );
      expect(confrontationEvent).toBeDefined();
    });

    it('should not trigger final confrontation when already at max hostility', () => {
      const state = createTestState();
      state.opposition.unHostility = 100;
      state.energy.stored = 0;
      const countries = Object.keys(state.political.influence) as CountryId[];
      for (const c of countries) {
        state.political.influence[c] = 80;
      }

      const update = system.update(state, 1);
      // Should not produce final_confrontation event since hostility is already 100
      const confrontationEvent = update.events?.find(
        (e) => e.type === 'un_attack' && e.payload.attackType === 'final_confrontation'
      );
      expect(confrontationEvent).toBeUndefined();
    });
  });

  describe('applyCountermeasure - education_campaign', () => {
    it('should increase approval by investment / 100', () => {
      const state = createTestState();
      state.opposition.publicApproval = 50;

      const update = system.applyCountermeasure(state, { type: 'education_campaign', investment: 500 });
      const approvalMutation = update.mutations?.find((m) => m.path === 'opposition.publicApproval');
      // 50 + 500/100 = 55
      expect(approvalMutation!.value).toBe(55);
    });

    it('should cap approval at 100', () => {
      const state = createTestState();
      state.opposition.publicApproval = 95;

      const update = system.applyCountermeasure(state, { type: 'education_campaign', investment: 1000 });
      const approvalMutation = update.mutations?.find((m) => m.path === 'opposition.publicApproval');
      expect(approvalMutation!.value).toBe(100);
    });
  });

  describe('applyCountermeasure - military_defense', () => {
    it('should reduce UN power level by 5 when player military > UN', () => {
      const state = createTestState();
      state.opposition.unPowerLevel = 50;
      state.weapons.militaryPower = 60;

      const update = system.applyCountermeasure(state, { type: 'military_defense' });
      const powerMutation = update.mutations?.find((m) => m.path === 'opposition.unPowerLevel');
      expect(powerMutation!.value).toBe(45);
    });

    it('should not reduce UN power level when player military <= UN', () => {
      const state = createTestState();
      state.opposition.unPowerLevel = 50;
      state.weapons.militaryPower = 40;

      const update = system.applyCountermeasure(state, { type: 'military_defense' });
      const powerMutation = update.mutations?.find((m) => m.path === 'opposition.unPowerLevel');
      expect(powerMutation).toBeUndefined();
    });
  });

  describe('applyCountermeasure - diplomatic_deception', () => {
    it('should reduce UN hostility by 10', () => {
      const state = createTestState();
      state.opposition.unHostility = 60;

      const update = system.applyCountermeasure(state, { type: 'diplomatic_deception' });
      const hostilityMutation = update.mutations?.find((m) => m.path === 'opposition.unHostility');
      expect(hostilityMutation!.value).toBe(50);
    });

    it('should not reduce hostility below 0', () => {
      const state = createTestState();
      state.opposition.unHostility = 5;

      const update = system.applyCountermeasure(state, { type: 'diplomatic_deception' });
      const hostilityMutation = update.mutations?.find((m) => m.path === 'opposition.unHostility');
      expect(hostilityMutation!.value).toBe(0);
    });
  });

  describe('applyCountermeasure - economic_leverage', () => {
    it('should reduce sanction severity by 25%', () => {
      const state = createTestState();
      state.opposition.activeSanctions = [
        { id: 's1', severity: 40, remainingTicks: 30 },
        { id: 's2', severity: 20, remainingTicks: 50 },
      ];

      const update = system.applyCountermeasure(state, { type: 'economic_leverage' });
      const sanctionsMutation = update.mutations?.find((m) => m.path === 'opposition.activeSanctions');
      const sanctions = sanctionsMutation!.value as Sanction[];
      expect(sanctions[0].severity).toBe(30); // 40 * 0.75
      expect(sanctions[1].severity).toBe(15); // 20 * 0.75
    });
  });

  describe('applyCountermeasure - tech_superiority', () => {
    it('should reduce UN hostility by 20 when player has 10+ completed research nodes', () => {
      const state = createTestState();
      state.opposition.unHostility = 60;
      // Add 10 completed research nodes
      state.research.trees.energy.nodes = {};
      for (let i = 0; i < 10; i++) {
        (state.research.trees.energy.nodes as any)[`node_${i}`] = { status: 'completed', progress: 100 };
      }

      const update = system.applyCountermeasure(state, { type: 'tech_superiority' });
      const hostilityMutation = update.mutations?.find((m) => m.path === 'opposition.unHostility');
      expect(hostilityMutation!.value).toBe(40);
    });

    it('should not reduce hostility when fewer than 10 research nodes completed', () => {
      const state = createTestState();
      state.opposition.unHostility = 60;
      state.research.trees.energy.nodes = {};
      for (let i = 0; i < 5; i++) {
        (state.research.trees.energy.nodes as any)[`node_${i}`] = { status: 'completed', progress: 100 };
      }

      const update = system.applyCountermeasure(state, { type: 'tech_superiority' });
      const hostilityMutation = update.mutations?.find((m) => m.path === 'opposition.unHostility');
      expect(hostilityMutation).toBeUndefined();
    });
  });

  describe('canPerform', () => {
    it('should return true for valid countermeasure action', () => {
      const state = createTestState();
      expect(system.canPerform(state, {
        type: 'countermeasure',
        payload: { type: 'education_campaign', investment: 100 } as any,
      })).toBe(true);
    });

    it('should return false for military_defense when player military <= UN', () => {
      const state = createTestState();
      state.weapons.militaryPower = 10;
      state.opposition.unPowerLevel = 100;

      expect(system.canPerform(state, {
        type: 'countermeasure',
        payload: { type: 'military_defense' } as any,
      })).toBe(false);
    });

    it('should return false for unknown action type', () => {
      const state = createTestState();
      expect(system.canPerform(state, {
        type: 'unknown',
        payload: {},
      })).toBe(false);
    });
  });

  describe('perform', () => {
    it('should execute countermeasure action', () => {
      const state = createTestState();
      state.opposition.unHostility = 50;

      const update = system.perform(state, {
        type: 'countermeasure',
        payload: { type: 'diplomatic_deception' } as any,
      });

      const hostilityMutation = update.mutations?.find((m) => m.path === 'opposition.unHostility');
      expect(hostilityMutation!.value).toBe(40);
    });

    it('should return empty for unknown action type', () => {
      const state = createTestState();
      const update = system.perform(state, { type: 'unknown', payload: {} });
      expect(update).toEqual({});
    });
  });
});
