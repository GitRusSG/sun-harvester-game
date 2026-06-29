import { describe, it, expect } from 'vitest';
import { DysonSystem } from '../../../../src/game/systems/dyson-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { GameState } from '../../../../src/game/core/types.js';
import type { DysonSegment } from '../../../../src/game/core/space.js';

function createDysonEraState(): GameState {
  const state = createInitialState('usa');
  state.currentEra = 'dyson_ring';
  return state;
}

function createUnlockedDysonState(): GameState {
  const state = createDysonEraState();
  state.dyson.unlocked = true;
  state.dyson.totalSegments = 5;
  state.dyson.completedSegments = 0;
  state.dyson.energyMultiplier = 1.0;
  state.dyson.victoryAchieved = false;
  state.dyson.segments = [
    {
      id: 'dyson_segment_1',
      name: 'Foundation Arc',
      requirements: [
        { material: 'steel', quantity: 100 },
        { material: 'advanced_circuits', quantity: 50 },
      ],
      progress: 0,
      completed: false,
    },
    {
      id: 'dyson_segment_2',
      name: 'Energy Collector Array',
      requirements: [
        { material: 'solar_cells', quantity: 150 },
        { material: 'electronics', quantity: 80 },
      ],
      progress: 0,
      completed: false,
    },
    {
      id: 'dyson_segment_3',
      name: 'Structural Ring',
      requirements: [
        { material: 'steel', quantity: 200 },
        { material: 'rare_earth', quantity: 100 },
      ],
      progress: 0,
      completed: false,
    },
    {
      id: 'dyson_segment_4',
      name: 'Power Distribution Grid',
      requirements: [
        { material: 'advanced_circuits', quantity: 120 },
        { material: 'electronics', quantity: 80 },
        { material: 'fuel_rods', quantity: 60 },
      ],
      progress: 0,
      completed: false,
    },
    {
      id: 'dyson_segment_5',
      name: 'Solar Harvester Crown',
      requirements: [
        { material: 'steel', quantity: 250 },
        { material: 'advanced_circuits', quantity: 150 },
        { material: 'solar_cells', quantity: 100 },
      ],
      progress: 0,
      completed: false,
    },
  ];
  return state;
}

describe('DysonSystem', () => {
  const system = new DysonSystem();

  describe('activeEras', () => {
    it('should be active only in Dyson Ring Era', () => {
      expect(system.activeEras).toContain('dyson_ring');
      expect(system.activeEras).toHaveLength(1);
    });

    it('should not be active in earlier eras', () => {
      expect(system.activeEras).not.toContain('fossil');
      expect(system.activeEras).not.toContain('nuclear');
      expect(system.activeEras).not.toContain('solar');
      expect(system.activeEras).not.toContain('orbital');
      expect(system.activeEras).not.toContain('mars_colonization');
      expect(system.activeEras).not.toContain('space_mining');
    });
  });

  describe('update - initialization', () => {
    it('should initialize 5 segments on first update when not unlocked', () => {
      const state = createDysonEraState();

      const update = system.update(state, 1);

      const unlockedMutation = update.mutations?.find((m) => m.path === 'dyson.unlocked');
      expect(unlockedMutation!.value).toBe(true);

      const segmentsMutation = update.mutations?.find((m) => m.path === 'dyson.segments');
      const segments = segmentsMutation!.value as DysonSegment[];
      expect(segments).toHaveLength(5);
    });

    it('should set correct segment names', () => {
      const state = createDysonEraState();

      const update = system.update(state, 1);
      const segmentsMutation = update.mutations?.find((m) => m.path === 'dyson.segments');
      const segments = segmentsMutation!.value as DysonSegment[];

      expect(segments[0].name).toBe('Foundation Arc');
      expect(segments[1].name).toBe('Energy Collector Array');
      expect(segments[2].name).toBe('Structural Ring');
      expect(segments[3].name).toBe('Power Distribution Grid');
      expect(segments[4].name).toBe('Solar Harvester Crown');
    });

    it('should set correct material requirements for each segment', () => {
      const state = createDysonEraState();

      const update = system.update(state, 1);
      const segmentsMutation = update.mutations?.find((m) => m.path === 'dyson.segments');
      const segments = segmentsMutation!.value as DysonSegment[];

      // Foundation Arc: 100 steel + 50 advanced_circuits
      expect(segments[0].requirements).toEqual([
        { material: 'steel', quantity: 100 },
        { material: 'advanced_circuits', quantity: 50 },
      ]);

      // Energy Collector Array: 150 solar_cells + 80 electronics
      expect(segments[1].requirements).toEqual([
        { material: 'solar_cells', quantity: 150 },
        { material: 'electronics', quantity: 80 },
      ]);

      // Structural Ring: 200 steel + 100 rare_earth
      expect(segments[2].requirements).toEqual([
        { material: 'steel', quantity: 200 },
        { material: 'rare_earth', quantity: 100 },
      ]);

      // Power Distribution Grid: 120 advanced_circuits + 80 electronics + 60 fuel_rods
      expect(segments[3].requirements).toEqual([
        { material: 'advanced_circuits', quantity: 120 },
        { material: 'electronics', quantity: 80 },
        { material: 'fuel_rods', quantity: 60 },
      ]);

      // Solar Harvester Crown: 250 steel + 150 advanced_circuits + 100 solar_cells
      expect(segments[4].requirements).toEqual([
        { material: 'steel', quantity: 250 },
        { material: 'advanced_circuits', quantity: 150 },
        { material: 'solar_cells', quantity: 100 },
      ]);
    });

    it('should initialize all segments with 0 progress and not completed', () => {
      const state = createDysonEraState();

      const update = system.update(state, 1);
      const segmentsMutation = update.mutations?.find((m) => m.path === 'dyson.segments');
      const segments = segmentsMutation!.value as DysonSegment[];

      for (const segment of segments) {
        expect(segment.progress).toBe(0);
        expect(segment.completed).toBe(false);
      }
    });

    it('should set totalSegments to 5', () => {
      const state = createDysonEraState();

      const update = system.update(state, 1);
      const totalMutation = update.mutations?.find((m) => m.path === 'dyson.totalSegments');
      expect(totalMutation!.value).toBe(5);
    });

    it('should set initial energyMultiplier to 1.0', () => {
      const state = createDysonEraState();

      const update = system.update(state, 1);
      const multiplierMutation = update.mutations?.find((m) => m.path === 'dyson.energyMultiplier');
      expect(multiplierMutation!.value).toBe(1.0);
    });
  });

  describe('update - energy multiplier recalculation', () => {
    it('should recalculate energyMultiplier when completedSegments changes', () => {
      const state = createUnlockedDysonState();
      state.dyson.completedSegments = 2;
      state.dyson.energyMultiplier = 1.0; // Out of sync

      const update = system.update(state, 1);
      const multiplierMutation = update.mutations?.find((m) => m.path === 'dyson.energyMultiplier');
      expect(multiplierMutation!.value).toBe(2.0); // 1.0 + 2 * 0.5
    });

    it('should not emit mutations when energyMultiplier is already correct', () => {
      const state = createUnlockedDysonState();
      state.dyson.completedSegments = 0;
      state.dyson.energyMultiplier = 1.0; // Already correct

      const update = system.update(state, 1);
      expect(update.mutations).toBeUndefined();
    });
  });

  describe('perform - contribute_to_segment', () => {
    it('should deduct materials from player stockpiles', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;
      state.materials.stockpiles.advanced_circuits = 100;

      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 50, advanced_circuits: 25 } },
      });

      expect(update.materials?.stockpiles?.steel).toBe(150); // 200 - 50
      expect(update.materials?.stockpiles?.advanced_circuits).toBe(75); // 100 - 25
    });

    it('should increase segment progress proportionally', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;
      state.materials.stockpiles.advanced_circuits = 100;

      // Segment 1 requires 100 steel + 50 advanced_circuits (total value = 150)
      // Contributing 50 steel + 25 advanced_circuits = 75 value
      // Progress increase = (75 / 150) * 100 = 50%
      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 50, advanced_circuits: 25 } },
      });

      const segmentsMutation = update.mutations?.find((m) => m.path === 'dyson.segments');
      const segments = segmentsMutation!.value as DysonSegment[];
      expect(segments[0].progress).toBe(50);
    });

    it('should mark segment as completed when progress reaches 100%', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;
      state.materials.stockpiles.advanced_circuits = 100;

      // Contribute exactly full requirement: 100 steel + 50 advanced_circuits
      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 100, advanced_circuits: 50 } },
      });

      const segmentsMutation = update.mutations?.find((m) => m.path === 'dyson.segments');
      const segments = segmentsMutation!.value as DysonSegment[];
      expect(segments[0].progress).toBe(100);
      expect(segments[0].completed).toBe(true);
    });

    it('should increment completedSegments when a segment is completed', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;
      state.materials.stockpiles.advanced_circuits = 100;

      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 100, advanced_circuits: 50 } },
      });

      const completedMutation = update.mutations?.find((m) => m.path === 'dyson.completedSegments');
      expect(completedMutation!.value).toBe(1);
    });

    it('should update energyMultiplier when a segment is completed', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;
      state.materials.stockpiles.advanced_circuits = 100;

      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 100, advanced_circuits: 50 } },
      });

      const multiplierMutation = update.mutations?.find((m) => m.path === 'dyson.energyMultiplier');
      expect(multiplierMutation!.value).toBe(1.5); // 1.0 + 1 * 0.5
    });

    it('should emit dyson_segment_complete event on completion', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;
      state.materials.stockpiles.advanced_circuits = 100;

      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 100, advanced_circuits: 50 } },
      });

      expect(update.events).toBeDefined();
      const segmentEvent = update.events!.find((e) => e.type === 'dyson_segment_complete');
      expect(segmentEvent).toBeDefined();
      expect(segmentEvent!.payload.segmentId).toBe('dyson_segment_1');
      expect(segmentEvent!.payload.segmentName).toBe('Foundation Arc');
      expect(segmentEvent!.payload.completedSegments).toBe(1);
    });

    it('should cap progress at 100%', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 500;
      state.materials.stockpiles.advanced_circuits = 200;

      // Contribute more than needed
      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 200, advanced_circuits: 100 } },
      });

      const segmentsMutation = update.mutations?.find((m) => m.path === 'dyson.segments');
      const segments = segmentsMutation!.value as DysonSegment[];
      expect(segments[0].progress).toBe(100);
      expect(segments[0].completed).toBe(true);
    });

    it('should accumulate progress over multiple contributions', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;
      state.materials.stockpiles.advanced_circuits = 100;

      // First contribution: 50 steel (50/150 of total = 33.33%)
      state.dyson.segments[0].progress = 0;

      const update1 = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 50 } },
      });

      const segments1 = (update1.mutations?.find((m) => m.path === 'dyson.segments')!.value as DysonSegment[]);
      const progress1 = segments1[0].progress;
      // 50 steel out of total 150 requirement value = 33.33%
      expect(progress1).toBeCloseTo(33.33, 1);

      // Second contribution on updated state
      const state2 = createUnlockedDysonState();
      state2.materials.stockpiles.steel = 150;
      state2.materials.stockpiles.advanced_circuits = 100;
      state2.dyson.segments[0].progress = progress1;

      const update2 = system.perform(state2, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 50, advanced_circuits: 50 } },
      });

      const segments2 = (update2.mutations?.find((m) => m.path === 'dyson.segments')!.value as DysonSegment[]);
      // Remaining steel needed: 100 - (33.33% * 100) = 66.67, contributed 50 so effective = 50
      // Remaining advanced_circuits needed: 50 - (33.33% * 50) = 33.33, contributed 50 so effective = 33.33
      // Total contributed value = 50 + 33.33 = 83.33
      // Progress increase = (83.33 / 150) * 100 = 55.56%
      // New progress = 33.33 + 55.56 = 88.89%
      expect(segments2[0].progress).toBeCloseTo(88.89, 1);
    });

    it('should not allow contribution to a completed segment', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;
      state.materials.stockpiles.advanced_circuits = 100;
      state.dyson.segments[0].completed = true;
      state.dyson.segments[0].progress = 100;

      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 50 } },
      });

      expect(update.mutations).toBeUndefined();
      expect(update.materials).toBeUndefined();
    });

    it('should not allow contribution with insufficient materials', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 10; // Not enough

      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 50 } },
      });

      expect(update.mutations).toBeUndefined();
      expect(update.materials).toBeUndefined();
    });

    it('should not allow contribution with irrelevant materials', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.coal = 500;

      // Segment 1 needs steel + advanced_circuits, not coal
      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { coal: 50 } },
      });

      expect(update.mutations).toBeUndefined();
      expect(update.materials).toBeUndefined();
    });
  });

  describe('victory condition', () => {
    it('should trigger victory event when all segments are completed', () => {
      const state = createUnlockedDysonState();
      state.dyson.completedSegments = 4;
      // Mark first 4 segments as completed
      state.dyson.segments[0].completed = true;
      state.dyson.segments[0].progress = 100;
      state.dyson.segments[1].completed = true;
      state.dyson.segments[1].progress = 100;
      state.dyson.segments[2].completed = true;
      state.dyson.segments[2].progress = 100;
      state.dyson.segments[3].completed = true;
      state.dyson.segments[3].progress = 100;

      // Complete the last segment
      state.materials.stockpiles.steel = 500;
      state.materials.stockpiles.advanced_circuits = 300;
      state.materials.stockpiles.solar_cells = 200;

      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: {
          segmentId: 'dyson_segment_5',
          materials: { steel: 250, advanced_circuits: 150, solar_cells: 100 },
        },
      });

      // Should have victory event
      expect(update.events).toBeDefined();
      const victoryEvent = update.events!.find((e) => e.type === 'victory');
      expect(victoryEvent).toBeDefined();
      expect(victoryEvent!.payload.totalSegments).toBe(5);

      // Should set victoryAchieved to true
      const victoryMutation = update.mutations?.find((m) => m.path === 'dyson.victoryAchieved');
      expect(victoryMutation!.value).toBe(true);
    });

    it('should set energyMultiplier to 3.5 when all 5 segments are complete', () => {
      const state = createUnlockedDysonState();
      state.dyson.completedSegments = 4;
      state.dyson.segments[0].completed = true;
      state.dyson.segments[0].progress = 100;
      state.dyson.segments[1].completed = true;
      state.dyson.segments[1].progress = 100;
      state.dyson.segments[2].completed = true;
      state.dyson.segments[2].progress = 100;
      state.dyson.segments[3].completed = true;
      state.dyson.segments[3].progress = 100;

      state.materials.stockpiles.steel = 500;
      state.materials.stockpiles.advanced_circuits = 300;
      state.materials.stockpiles.solar_cells = 200;

      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: {
          segmentId: 'dyson_segment_5',
          materials: { steel: 250, advanced_circuits: 150, solar_cells: 100 },
        },
      });

      const multiplierMutation = update.mutations?.find((m) => m.path === 'dyson.energyMultiplier');
      expect(multiplierMutation!.value).toBe(3.5); // 1.0 + 5 * 0.5
    });

    it('should not trigger victory when not all segments are complete', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;
      state.materials.stockpiles.advanced_circuits = 100;

      const update = system.perform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 100, advanced_circuits: 50 } },
      });

      const victoryEvent = update.events?.find((e) => e.type === 'victory');
      expect(victoryEvent).toBeUndefined();

      const victoryMutation = update.mutations?.find((m) => m.path === 'dyson.victoryAchieved');
      expect(victoryMutation).toBeUndefined();
    });
  });

  describe('canPerform', () => {
    it('should return true for valid contribution with sufficient materials', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;

      expect(system.canPerform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 50 } },
      })).toBe(true);
    });

    it('should return false when dyson is not unlocked', () => {
      const state = createDysonEraState();
      state.materials.stockpiles.steel = 200;

      expect(system.canPerform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 50 } },
      })).toBe(false);
    });

    it('should return false for invalid segment id', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;

      expect(system.canPerform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'nonexistent', materials: { steel: 50 } },
      })).toBe(false);
    });

    it('should return false for completed segment', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;
      state.dyson.segments[0].completed = true;

      expect(system.canPerform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 50 } },
      })).toBe(false);
    });

    it('should return false for insufficient materials', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 10;

      expect(system.canPerform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1', materials: { steel: 50 } },
      })).toBe(false);
    });

    it('should return false for unknown action type', () => {
      const state = createUnlockedDysonState();

      expect(system.canPerform(state, {
        type: 'unknown_action',
        payload: {},
      })).toBe(false);
    });

    it('should return false when materials payload is missing', () => {
      const state = createUnlockedDysonState();

      expect(system.canPerform(state, {
        type: 'contribute_to_segment',
        payload: { segmentId: 'dyson_segment_1' },
      })).toBe(false);
    });

    it('should return false when segmentId is missing', () => {
      const state = createUnlockedDysonState();
      state.materials.stockpiles.steel = 200;

      expect(system.canPerform(state, {
        type: 'contribute_to_segment',
        payload: { materials: { steel: 50 } },
      })).toBe(false);
    });
  });

  describe('energy multiplier scaling', () => {
    it('should be 1.0 with 0 segments completed', () => {
      const state = createUnlockedDysonState();
      state.dyson.completedSegments = 0;
      state.dyson.energyMultiplier = 0; // Force recalculation

      const update = system.update(state, 1);
      const multiplierMutation = update.mutations?.find((m) => m.path === 'dyson.energyMultiplier');
      expect(multiplierMutation!.value).toBe(1.0);
    });

    it('should be 1.5 with 1 segment completed', () => {
      const state = createUnlockedDysonState();
      state.dyson.completedSegments = 1;
      state.dyson.energyMultiplier = 0;

      const update = system.update(state, 1);
      const multiplierMutation = update.mutations?.find((m) => m.path === 'dyson.energyMultiplier');
      expect(multiplierMutation!.value).toBe(1.5);
    });

    it('should be 2.0 with 2 segments completed', () => {
      const state = createUnlockedDysonState();
      state.dyson.completedSegments = 2;
      state.dyson.energyMultiplier = 0;

      const update = system.update(state, 1);
      const multiplierMutation = update.mutations?.find((m) => m.path === 'dyson.energyMultiplier');
      expect(multiplierMutation!.value).toBe(2.0);
    });

    it('should be 2.5 with 3 segments completed', () => {
      const state = createUnlockedDysonState();
      state.dyson.completedSegments = 3;
      state.dyson.energyMultiplier = 0;

      const update = system.update(state, 1);
      const multiplierMutation = update.mutations?.find((m) => m.path === 'dyson.energyMultiplier');
      expect(multiplierMutation!.value).toBe(2.5);
    });

    it('should be 3.5 with 5 segments completed (max)', () => {
      const state = createUnlockedDysonState();
      state.dyson.completedSegments = 5;
      state.dyson.energyMultiplier = 0;

      const update = system.update(state, 1);
      const multiplierMutation = update.mutations?.find((m) => m.path === 'dyson.energyMultiplier');
      expect(multiplierMutation!.value).toBe(3.5);
    });
  });
});
