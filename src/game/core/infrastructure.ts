import type { MaterialType } from './resources.js';

export interface MaterialRequirement {
  material: MaterialType;
  quantity: number;
}

export interface InfrastructureState {
  mines: Mine[];
  factories: Factory[];
  distributionNetworks: DistributionNetwork[];
}

export interface Mine {
  id: string;
  materialType: MaterialType;
  level: number;
  depositQuality: number; // 0.0 - 1.0
  productionRate: number;
}

export interface Factory {
  id: string;
  type: 'crafting' | 'weapons';
  level: number;
  currentOrders: CraftOrder[];
  automatedRecipes: string[];
}

export interface CraftOrder {
  recipeId: string;
  quantity: number;
  progress: number;
  totalTime: number;
}

export interface DistributionNetwork {
  id: string;
  level: number;
  conversionBonus: number; // multiplier on energy → currency
}
