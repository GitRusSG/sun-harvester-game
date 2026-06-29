export interface ResearchState {
  trees: Record<TechTreeId, TechTreeState>;
  currentResearch: ActiveResearch | null;
}

export type TechTreeId = 'energy' | 'materials' | 'weapons' | 'political' | 'space';

export interface TechTreeState {
  nodes: Record<string, TechNodeState>;
}

export interface TechNodeState {
  status: 'locked' | 'available' | 'researching' | 'completed';
  progress: number; // 0 to researchTime
}

export interface TechNode {
  id: string;
  tree: TechTreeId;
  name: string;
  description: string;
  educationalContent: string;
  tier: number;
  cost: { currency: number; knowledge: number };
  researchTime: number; // ticks
  prerequisites: string[];
  bonus: TechBonus;
  status: 'locked' | 'available' | 'researching' | 'completed';
}

export interface TechBonus {
  type: string;
  value: number;
  description: string;
}

export interface SynergyBonus {
  sourceTree: TechTreeId;
  targetTree: TechTreeId;
  costReduction: number; // multiplier (e.g., 0.9 = 10% reduction)
  description: string;
}

export interface ActiveResearch {
  nodeId: string;
  treeId: TechTreeId;
  startTick: number;
  remainingTicks: number;
}
