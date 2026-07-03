import type { Era } from '../core/types.js';
import type { MaterialRequirement } from '../core/infrastructure.js';

/**
 * Recipe definition for crafting components from raw materials.
 */
export interface Recipe {
  id: string;
  name: string;
  inputs: MaterialRequirement[];
  outputs: MaterialRequirement[];
  craftTime: number; // ticks
  unlockedByEra: Era;
  unlockedByResearch?: string;
  automatable: boolean;
  /** If set, this is a consumable with a special effect (handled in main.ts action handler). */
  effectType?: 'military' | 'defense' | 'influence' | 'energy' | 'instant_build' | 'morale';
  effectDescription?: string;
}

/**
 * All crafting recipes in the game, defined as static data.
 * Recipes are unlocked by era and optionally by a research node.
 */
export const RECIPES: Recipe[] = [
  // ─── TIER 1: Fossil Era ─────────────────────────────────────────────
  {
    id: 'steel_beams',
    name: 'Steel Beams',
    inputs: [
      { material: 'iron_ore', quantity: 3 },
      { material: 'coal', quantity: 1 },
    ],
    outputs: [
      { material: 'steel', quantity: 1 },
    ],
    craftTime: 30,
    unlockedByEra: 'fossil',
    automatable: true,
  },

  // ─── TIER 2: Nuclear Era ────────────────────────────────────────────
  {
    id: 'electronics',
    name: 'Electronics',
    inputs: [
      { material: 'copper', quantity: 2 },
      { material: 'silicon', quantity: 1 },
    ],
    outputs: [
      { material: 'electronics', quantity: 1 },
    ],
    craftTime: 40,
    unlockedByEra: 'nuclear',
    automatable: true,
  },
  {
    id: 'fuel_rods',
    name: 'Fuel Rods',
    inputs: [
      { material: 'uranium', quantity: 2 },
      { material: 'steel', quantity: 1 },
    ],
    outputs: [
      { material: 'fuel_rods', quantity: 1 },
    ],
    craftTime: 60,
    unlockedByEra: 'nuclear',
    automatable: true,
  },
  {
    id: 'rocket_fuel',
    name: 'Rocket Fuel',
    inputs: [
      { material: 'fuel', quantity: 2 },
      { material: 'coal', quantity: 1 },
    ],
    outputs: [
      { material: 'fuel', quantity: 5 },
    ],
    craftTime: 25,
    unlockedByEra: 'nuclear',
    automatable: true,
  },

  // ─── TIER 3: Solar / Orbital Era ────────────────────────────────────
  {
    id: 'solar_cells',
    name: 'Solar Cells',
    inputs: [
      { material: 'silicon', quantity: 2 },
      { material: 'copper', quantity: 1 },
    ],
    outputs: [
      { material: 'solar_cells', quantity: 1 },
    ],
    craftTime: 45,
    unlockedByEra: 'solar',
    automatable: true,
  },
  {
    id: 'advanced_circuits',
    name: 'Advanced Circuits',
    inputs: [
      { material: 'rare_earth', quantity: 2 },
      { material: 'electronics', quantity: 1 },
    ],
    outputs: [
      { material: 'advanced_circuits', quantity: 1 },
    ],
    craftTime: 90,
    unlockedByEra: 'orbital',
    automatable: true,
  },
  {
    id: 'combat_drone',
    name: 'Combat Drone',
    inputs: [
      { material: 'steel', quantity: 2 },
      { material: 'electronics', quantity: 1 },
      { material: 'advanced_circuits', quantity: 1 },
    ],
    outputs: [
      { material: 'advanced_circuits', quantity: 0 }, // marker — effect handled by action
    ],
    craftTime: 80,
    unlockedByEra: 'orbital',
    automatable: false,
    effectType: 'military',
    effectDescription: '+30 military power permanently',
  },
  {
    id: 'propaganda_satellite',
    name: 'Propaganda Satellite',
    inputs: [
      { material: 'solar_cells', quantity: 2 },
      { material: 'electronics', quantity: 1 },
      { material: 'advanced_circuits', quantity: 1 },
    ],
    outputs: [
      { material: 'advanced_circuits', quantity: 0 }, // marker
    ],
    craftTime: 100,
    unlockedByEra: 'orbital',
    automatable: false,
    effectType: 'influence',
    effectDescription: '+15% influence speed for 5 minutes',
  },

  // ─── TIER 4: Space Mining / Dyson Era ───────────────────────────────
  {
    id: 'shield_generator',
    name: 'Shield Generator',
    inputs: [
      { material: 'advanced_circuits', quantity: 3 },
      { material: 'fuel_rods', quantity: 2 },
      { material: 'rare_earth', quantity: 5 },
    ],
    outputs: [
      { material: 'advanced_circuits', quantity: 0 }, // marker
    ],
    craftTime: 120,
    unlockedByEra: 'space_mining',
    automatable: false,
    effectType: 'defense',
    effectDescription: '-20% damage on next attack (stacks to 3)',
  },
  {
    id: 'fusion_cell',
    name: 'Fusion Cell',
    inputs: [
      { material: 'fuel_rods', quantity: 3 },
      { material: 'advanced_circuits', quantity: 2 },
    ],
    outputs: [
      { material: 'advanced_circuits', quantity: 0 }, // marker
    ],
    craftTime: 150,
    unlockedByEra: 'space_mining',
    automatable: false,
    effectType: 'energy',
    effectDescription: '+5000 energy instantly',
  },
  {
    id: 'nanobots',
    name: 'Nanobots',
    inputs: [
      { material: 'advanced_circuits', quantity: 3 },
      { material: 'rare_earth', quantity: 2 },
      { material: 'water', quantity: 1 },
    ],
    outputs: [
      { material: 'advanced_circuits', quantity: 0 }, // marker
    ],
    craftTime: 180,
    unlockedByEra: 'space_mining',
    automatable: false,
    effectType: 'instant_build',
    effectDescription: 'Instantly completes next build in queue',
  },

  // ─── TIER 5: Dyson Ring Era ─────────────────────────────────────────
  {
    id: 'dyson_frame',
    name: 'Dyson Frame Section',
    inputs: [
      { material: 'steel', quantity: 20 },
      { material: 'advanced_circuits', quantity: 5 },
      { material: 'rare_earth', quantity: 10 },
    ],
    outputs: [
      { material: 'steel', quantity: 0 }, // marker — contributes to Dyson Ring
    ],
    craftTime: 200,
    unlockedByEra: 'dyson_ring',
    automatable: true,
    effectType: 'dyson_segment' as any,
    effectDescription: 'Contributes structural materials to the active Dyson segment',
  },
  {
    id: 'dyson_collector',
    name: 'Solar Collector Module',
    inputs: [
      { material: 'solar_cells', quantity: 15 },
      { material: 'electronics', quantity: 8 },
      { material: 'advanced_circuits', quantity: 3 },
    ],
    outputs: [
      { material: 'solar_cells', quantity: 0 }, // marker
    ],
    craftTime: 180,
    unlockedByEra: 'dyson_ring',
    automatable: true,
    effectType: 'dyson_segment' as any,
    effectDescription: 'Contributes solar collection arrays to the active Dyson segment',
  },
  {
    id: 'dyson_power_core',
    name: 'Power Core Unit',
    inputs: [
      { material: 'fuel_rods', quantity: 5 },
      { material: 'advanced_circuits', quantity: 10 },
      { material: 'electronics', quantity: 5 },
    ],
    outputs: [
      { material: 'fuel_rods', quantity: 0 }, // marker
    ],
    craftTime: 220,
    unlockedByEra: 'dyson_ring',
    automatable: true,
    effectType: 'dyson_segment' as any,
    effectDescription: 'Contributes power distribution systems to the active Dyson segment',
  },
];

/**
 * Retrieves a recipe by its ID.
 */
export function getRecipeById(recipeId: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === recipeId);
}
