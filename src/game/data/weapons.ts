import type { WeaponCategoryId } from '../core/combat.js';
import type { MaterialType } from '../core/resources.js';

/**
 * Material requirement for weapon production.
 */
export interface WeaponMaterialRequirement {
  material: MaterialType;
  quantity: number;
}

/**
 * Weapon category definition: power value, material costs, and unlock condition.
 */
export interface WeaponCategoryDefinition {
  id: WeaponCategoryId;
  name: string;
  powerPerUnit: number;
  materials: WeaponMaterialRequirement[];
  /** Tech node ID that unlocks this category; null means always available. */
  unlockedByTech: string | null;
}

/**
 * All weapon category definitions.
 *
 * Power values per unit:
 * - conventional: 1
 * - missile: 5
 * - cyber: 3
 * - energy: 10
 * - orbital: 20
 *
 * Validates: Requirements 22.1, 22.3, 22.4
 */
export const WEAPON_CATEGORIES: WeaponCategoryDefinition[] = [
  {
    id: 'conventional',
    name: 'Conventional Arms',
    powerPerUnit: 1,
    materials: [{ material: 'steel', quantity: 1 }],
    unlockedByTech: null, // always available
  },
  {
    id: 'missile',
    name: 'Missile Systems',
    powerPerUnit: 5,
    materials: [
      { material: 'steel', quantity: 2 },
      { material: 'electronics', quantity: 1 },
      { material: 'fuel', quantity: 1 },
    ],
    unlockedByTech: 'weapons_missile_1',
  },
  {
    id: 'cyber',
    name: 'Cyber Weapons',
    powerPerUnit: 3,
    materials: [
      { material: 'electronics', quantity: 2 },
      { material: 'advanced_circuits', quantity: 1 },
    ],
    unlockedByTech: 'weapons_cyber_1',
  },
  {
    id: 'energy',
    name: 'Energy Weapons',
    powerPerUnit: 10,
    materials: [
      { material: 'rare_earth', quantity: 3 },
      { material: 'advanced_circuits', quantity: 2 },
    ],
    unlockedByTech: 'weapons_energy_1',
  },
  {
    id: 'orbital',
    name: 'Orbital Weapons',
    powerPerUnit: 20,
    materials: [
      { material: 'steel', quantity: 5 },
      { material: 'electronics', quantity: 3 },
      { material: 'fuel_rods', quantity: 2 },
    ],
    unlockedByTech: 'weapons_orbital_1',
  },
];

/**
 * Look up a weapon category definition by ID.
 */
export function getWeaponCategory(id: WeaponCategoryId): WeaponCategoryDefinition | undefined {
  return WEAPON_CATEGORIES.find((c) => c.id === id);
}

/**
 * Get the power value per unit for a category.
 */
export function getPowerPerUnit(id: WeaponCategoryId): number {
  const category = getWeaponCategory(id);
  return category?.powerPerUnit ?? 0;
}
