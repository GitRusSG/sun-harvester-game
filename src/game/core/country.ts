import type { CountryId } from './types.js';
import type { MaterialType } from './resources.js';

export interface CountryProfile {
  id: CountryId;
  name: string;
  description: string;
  buffs: CountryBuff[];
  startingResources: {
    currency: number;
    materials: Partial<Record<MaterialType, number>>;
    energyCapacity: number;
  };
  startingMilitary: number;
}

export interface CountryBuff {
  type: BuffType;
  value: number; // multiplier or flat bonus
  description: string;
}

export type BuffType =
  | 'military_power'
  | 'manufacturing_speed'
  | 'engineering_efficiency'
  | 'energy_reserves'
  | 'fuel_efficiency'
  | 'research_speed'
  | 'trade_bonus'
  | 'diplomatic_influence'
  | 'space_technology'
  | 'space_experience'
  | 'material_extraction'
  | 'solar_efficiency';
