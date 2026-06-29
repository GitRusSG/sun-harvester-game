import type { ResourceState } from './resources.js';
import type { MaterialState, EnergyState } from './resources.js';
import type { ResearchState } from './research.js';
import type { InfrastructureState } from './infrastructure.js';
import type { OppositionState, PoliticalState } from './opposition.js';
import type { MarsState, SpaceState, DysonState } from './space.js';
import type { WeaponsState, AlienState } from './combat.js';
import type { CountryProfile } from './country.js';
import type { EducationState } from './education.js';
import type { WeatherState } from './weather.js';

export interface GameState {
  version: number;
  lastSaveTimestamp: number;
  currentEra: Era;
  eraProgress: Record<Era, number>; // 0-100 completion percentage

  country: CountryId;
  countryProfile: CountryProfile;

  resources: ResourceState;
  materials: MaterialState;
  energy: EnergyState;
  infrastructure: InfrastructureState;
  research: ResearchState;
  supplyChain: SupplyChainState;
  weather: WeatherState;
  opposition: OppositionState;
  political: PoliticalState;
  weapons: WeaponsState;
  alien: AlienState;
  mars: MarsState;
  space: SpaceState;
  dyson: DysonState;
  education: EducationState;

  statistics: GameStatistics;
}

export interface SupplyChainState {
  recipes: string[];
  automatedRecipes: string[];
}

export interface GameStatistics {
  totalEnergyProduced: number;
  totalCurrencyEarned: number;
  totalResearchCompleted: number;
  totalMaterialsCrafted: number;
  playTimeTicks: number;
}

export type Era =
  | 'fossil'
  | 'nuclear'
  | 'solar'
  | 'orbital'
  | 'mars_colonization'
  | 'space_mining'
  | 'dyson_ring';

export type CountryId =
  | 'usa' | 'china' | 'russia' | 'india' | 'germany'
  | 'japan' | 'uk' | 'france' | 'south_korea' | 'brazil';

export interface GameSystem {
  id: string;
  /** Eras in which this system is active */
  activeEras: Era[];
  /** Process one or more ticks */
  update(state: GameState, deltaTicks: number): StateUpdate;
  /** Check if a specific action is valid */
  canPerform(state: GameState, action: GameAction): boolean;
  /** Execute a player action */
  perform(state: GameState, action: GameAction): StateUpdate;
}

export interface GameAction {
  type: string;
  payload: Record<string, unknown>;
}

export interface StateUpdate {
  resources?: Partial<ResourceState>;
  materials?: Partial<MaterialState>;
  unlocks?: string[];
  events?: GameEvent[];
  mutations?: StateMutation[];
}

export interface StateMutation {
  path: string;
  value: unknown;
}

export interface GameEvent {
  id: string;
  type: EventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

export type EventType =
  | 'era_unlock'
  | 'research_complete'
  | 'weather_change'
  | 'protest'
  | 'un_attack'
  | 'alien_signal'
  | 'alien_encounter'
  | 'crafting_complete'
  | 'dyson_segment_complete'
  | 'victory'
  | 'quiz'
  | 'coup'
  | 'politician_installed';
