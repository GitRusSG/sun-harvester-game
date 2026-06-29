import type { WeatherCondition } from './weather.js';

export interface ResourceState {
  currency: number;
  knowledgePoints: number;
  incomeRate: number;
  expenseRate: number;
}

export interface MaterialState {
  stockpiles: Record<MaterialType, number>;
  productionRates: Record<MaterialType, number>;
  refineries: RefineryState[];
}

export type MaterialType =
  | 'coal'
  | 'iron_ore' | 'steel'
  | 'silicon' | 'solar_cells'
  | 'copper' | 'electronics'
  | 'uranium' | 'fuel_rods'
  | 'rare_earth' | 'advanced_circuits'
  | 'water' | 'fuel'
  | 'regolith_iron' | 'martian_ice' | 'co2';

export interface RefineryState {
  id: string;
  recipeId: string;
  level: number;
  active: boolean;
}

export interface EnergyState {
  generated: number; // per second
  stored: number;
  maxStorage: number;
  distributionRate: number;
  solarPanels: SolarPanel[];
  powerPlants: PowerPlant[];
}

export interface SolarPanel {
  id: string;
  locationId: string;
  efficiency: number;
  baseOutput: number;
}

export interface PowerPlant {
  id: string;
  type: 'coal' | 'nuclear' | 'fusion';
  level: number;
  fuelType: MaterialType;
  consumptionRate: number;
  outputRate: number;
  active: boolean;
}

export interface Location {
  id: string;
  name: string;
  irradiance: number; // 0.0 - 1.0 relative solar irradiance rating
  weatherBias: Partial<Record<WeatherCondition, number>>;
}
