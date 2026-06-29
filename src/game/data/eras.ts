import type { Era, GameState } from '../core/types.js';
import { TECH_TREE_NODES } from './tech-trees.js';

/**
 * Condition that must be met to unlock an era.
 */
export interface EraUnlockCondition {
  type: 'research' | 'energy' | 'currency' | 'military' | 'political';
  description: string;
  check: (state: GameState) => boolean;
}

/**
 * Definition for a game era with unlock conditions and available mechanics.
 */
export interface EraDefinition {
  id: Era;
  name: string;
  description: string;
  order: number;
  unlockConditions: EraUnlockCondition[];
  availableMechanics: string[];
}

/**
 * Helper to check if a specific research node is completed in the game state.
 */
function isResearchCompleted(state: GameState, nodeId: string): boolean {
  for (const treeId of Object.keys(state.research.trees)) {
    const tree = state.research.trees[treeId as keyof typeof state.research.trees];
    const node = tree.nodes[nodeId];
    if (node && node.status === 'completed') {
      return true;
    }
  }
  return false;
}

/**
 * Helper to check if all nodes in the space tech tree are completed.
 */
function areAllSpaceNodesCompleted(state: GameState): boolean {
  const spaceNodes = TECH_TREE_NODES.filter((n) => n.tree === 'space');
  return spaceNodes.every((node) => isResearchCompleted(state, node.id));
}

/**
 * The seven progression eras defined with unlock conditions and available mechanics.
 *
 * Validates: Requirements 6.1, 6.2
 */
export const ERA_DEFINITIONS: EraDefinition[] = [
  {
    id: 'fossil',
    name: 'Fossil Era',
    description: 'The age of coal and conventional power. Build your foundation with mining and basic manufacturing.',
    order: 0,
    unlockConditions: [], // Always unlocked — starting era
    availableMechanics: [
      'coal_power',
      'basic_mining',
      'basic_crafting',
      'conventional_weapons',
      'public_approval',
    ],
  },
  {
    id: 'nuclear',
    name: 'Nuclear Era',
    description: 'Harness the atom for massive base-load energy. Unlock nuclear power and advanced weapon systems.',
    order: 1,
    unlockConditions: [
      {
        type: 'energy',
        description: 'Produce over 5,000 total energy',
        check: (state) => state.statistics.totalEnergyProduced > 5000,
      },
      {
        type: 'research',
        description: 'Complete Nuclear Fission research',
        check: (state) => isResearchCompleted(state, 'energy_nuclear_1'),
      },
    ],
    availableMechanics: [
      'nuclear_power',
      'advanced_weapons',
      'missile_systems',
      'political_influence',
      'un_opposition',
    ],
  },
  {
    id: 'solar',
    name: 'Solar Era',
    description: 'Transition to renewable energy. Solar panels become your primary power source, affected by weather and location.',
    order: 2,
    unlockConditions: [
      {
        type: 'research',
        description: 'Complete Improved Solar Cells research',
        check: (state) => isResearchCompleted(state, 'energy_efficiency_1'),
      },
      {
        type: 'research',
        description: 'Complete Advanced Batteries research',
        check: (state) => isResearchCompleted(state, 'energy_storage_1'),
      },
    ],
    availableMechanics: [
      'solar_panels',
      'weather_effects',
      'location_placement',
      'energy_storage',
      'distribution_networks',
    ],
  },
  {
    id: 'orbital',
    name: 'Orbital Era',
    description: 'Reach for the stars. Construct orbital platforms and space-based solar collectors beyond the atmosphere.',
    order: 3,
    unlockConditions: [
      {
        type: 'currency',
        description: 'Earn over 50,000 total currency',
        check: (state) => state.statistics.totalCurrencyEarned > 50000,
      },
      {
        type: 'research',
        description: 'Complete Orbital Mechanics research',
        check: (state) => isResearchCompleted(state, 'space_orbital_1'),
      },
    ],
    availableMechanics: [
      'orbital_platforms',
      'space_solar_collectors',
      'launch_logistics',
      'reduced_weather_penalty',
    ],
  },
  {
    id: 'mars_colonization',
    name: 'Mars Colonization Era',
    description: 'Establish a colony on Mars. Access unique Martian resources and benefit from reduced launch costs.',
    order: 4,
    unlockConditions: [
      {
        type: 'research',
        description: 'Complete Space-Based Solar research',
        check: (state) => isResearchCompleted(state, 'space_solar_collectors_1'),
      },
      {
        type: 'currency',
        description: 'Earn over 100,000 total currency',
        check: (state) => state.statistics.totalCurrencyEarned > 100000,
      },
    ],
    availableMechanics: [
      'mars_base',
      'martian_resources',
      'low_gravity_launches',
      'earth_mars_logistics',
    ],
  },
  {
    id: 'space_mining',
    name: 'Space Mining Era',
    description: 'Claim asteroid territories and mine the belt. Encounter alien signals during deep-space operations.',
    order: 5,
    unlockConditions: [
      {
        type: 'research',
        description: 'Complete Asteroid Mining research',
        check: (state) => isResearchCompleted(state, 'space_mining_1'),
      },
    ],
    availableMechanics: [
      'asteroid_territories',
      'territory_mining',
      'alien_encounters',
      'fleet_management',
      'rare_earth_extraction',
    ],
  },
  {
    id: 'dyson_ring',
    name: 'Dyson Ring Era',
    description: 'The final frontier. Construct a megastructure around the Sun to harvest stellar energy and achieve victory.',
    order: 6,
    unlockConditions: [
      {
        type: 'energy',
        description: 'Produce over 1,000,000 total energy',
        check: (state) => state.statistics.totalEnergyProduced > 1000000,
      },
      {
        type: 'research',
        description: 'Complete all Space tech tree nodes',
        check: (state) => areAllSpaceNodesCompleted(state),
      },
    ],
    availableMechanics: [
      'dyson_construction',
      'segment_assembly',
      'energy_multiplier',
      'victory_condition',
    ],
  },
];

/**
 * Get an era definition by its ID.
 */
export function getEraDefinition(era: Era): EraDefinition | undefined {
  return ERA_DEFINITIONS.find((e) => e.id === era);
}

/**
 * Get era definitions sorted by progression order.
 */
export function getErasInOrder(): EraDefinition[] {
  return [...ERA_DEFINITIONS].sort((a, b) => a.order - b.order);
}

/**
 * Check whether all unlock conditions for a given era are met.
 * The Nuclear era uses OR logic (either condition unlocks it).
 * All other eras use AND logic (all conditions must be met).
 */
export function areEraConditionsMet(era: Era, state: GameState): boolean {
  const definition = getEraDefinition(era);
  if (!definition) return false;

  // Fossil era is always unlocked
  if (definition.unlockConditions.length === 0) return true;

  // Nuclear era: either condition is sufficient (OR logic)
  if (era === 'nuclear') {
    return definition.unlockConditions.some((cond) => cond.check(state));
  }

  // All other eras: all conditions must be met (AND logic)
  return definition.unlockConditions.every((cond) => cond.check(state));
}
