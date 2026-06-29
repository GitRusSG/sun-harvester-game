export interface WeaponsState {
  militaryPower: number;
  factories: WeaponsFactory[];
  arsenal: Record<WeaponCategoryId, number>;
}

export interface WeaponsFactory {
  id: string;
  level: number;
  producing: WeaponCategoryId;
  productionRate: number;
}

export type WeaponCategoryId = 'conventional' | 'missile' | 'cyber' | 'energy' | 'orbital';

export interface AlienState {
  encountered: boolean;
  relationsScore: number; // -100 to 100
  signals: AlienSignal[];
  ignoredSignals: number;
  activeThreat: AlienThreat | null;
  tradesCompleted: string[];
}

export interface AlienSignal {
  id: string;
  detectedTick: number;
  investigated: boolean;
  outcome?: 'cooperative' | 'hostile' | 'ignored';
}

export interface AlienThreat {
  severity: number;
  defenseRequired: number;
  remainingTicks: number;
}
