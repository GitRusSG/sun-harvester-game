import type { MaterialType } from './resources.js';
import type { MaterialRequirement } from './infrastructure.js';

export interface MarsState {
  unlocked: boolean;
  baseLevel: number;
  resources: Record<MaterialType, number>;
  productionRates: Record<MaterialType, number>;
  launchCostReduction: number; // multiplier from low gravity
  rooms: MarsRoom[];
  population: number;
  maxPopulation: number;
}

export interface MarsRoom {
  id: string;
  type: MarsRoomType;
  level: number;
  floor: number;
  slot: number;
}

export type MarsRoomType =
  | 'power_gen'
  | 'water_extract'
  | 'mine'
  | 'greenhouse'
  | 'fuel_refinery'
  | 'habitat'
  | 'storage'
  | 'lab';

export interface SpaceState {
  unlocked: boolean;
  orbitalPlatforms: OrbitalPlatform[];
  territories: AsteroidTerritory[];
  fleet: FleetState;
  maxTerritories: number;
}

export interface OrbitalPlatform {
  id: string;
  type: 'solar_collector' | 'station' | 'launch_platform';
  level: number;
  output: number;
}

export interface AsteroidTerritory {
  id: string;
  name: string;
  resourceProfile: Record<MaterialType, number>;
  depositQuality: number;
  surveyed: boolean;
  miningLevel: number;
  productionRate: number;
}

export interface FleetState {
  size: number;
  fuelCapacity: number;
  currentFuel: number;
}

export interface DysonState {
  unlocked: boolean;
  segments: DysonSegment[];
  totalSegments: number;
  completedSegments: number;
  energyMultiplier: number;
  victoryAchieved: boolean;
}

export interface DysonSegment {
  id: string;
  name: string;
  requirements: MaterialRequirement[];
  progress: number; // 0-100
  completed: boolean;
}
