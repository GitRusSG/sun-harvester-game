import type { CountryId } from './types.js';

export interface OppositionState {
  publicApproval: number; // 0-100
  unPowerLevel: number; // 0-100
  unHostility: number; // 0-100
  activeProtests: Protest[];
  activeSanctions: Sanction[];
  lastUNAttackTick: number;
}

export interface Protest {
  id: string;
  cause: string;
  severity: number; // reduction multiplier
  remainingTicks: number;
  affectedArea: string;
}

export interface Sanction {
  id: string;
  severity: number; // cost increase percentage
  remainingTicks: number;
}

export interface PoliticalState {
  influence: Record<CountryId, number>; // 0-100 per country
  installedPoliticians: CountryId[];
  worldDominationAchieved: boolean;
  activeOperations: PoliticalOperation[];
}

export interface PoliticalOperation {
  id: string;
  targetCountry: CountryId;
  method: InfluenceMethod;
  investment: number;
  remainingTicks: number;
}

export type InfluenceMethod = 'economic_aid' | 'propaganda' | 'corporate_infiltration' | 'intelligence';
