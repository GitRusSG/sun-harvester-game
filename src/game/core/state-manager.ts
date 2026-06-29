import type {
  GameState,
  Era,
  CountryId,
  StateUpdate,
  StateMutation,
  SupplyChainState,
  GameStatistics,
} from './types.js';
import type { ResourceState, MaterialState, MaterialType, EnergyState } from './resources.js';
import type { ResearchState, TechTreeId } from './research.js';
import type { InfrastructureState } from './infrastructure.js';
import type { OppositionState, PoliticalState } from './opposition.js';
import type { MarsState, SpaceState, DysonState } from './space.js';
import type { WeaponsState, AlienState } from './combat.js';
import type { EducationState } from './education.js';
import type { WeatherState } from './weather.js';
import { getCountryProfile } from '../data/countries.js';

/**
 * The ordered list of eras for progression detection.
 */
export const ERA_ORDER: Era[] = [
  'fossil',
  'nuclear',
  'solar',
  'orbital',
  'mars_colonization',
  'space_mining',
  'dyson_ring',
];

/**
 * Creates a valid initial game state for a given country.
 * Uses real country profiles from the data module.
 */
export function createInitialState(country: CountryId): GameState {
  const profile = getCountryProfile(country);

  const allMaterials: MaterialType[] = [
    'coal', 'iron_ore', 'steel', 'silicon', 'solar_cells',
    'copper', 'electronics', 'uranium', 'fuel_rods',
    'rare_earth', 'advanced_circuits', 'water', 'fuel',
    'regolith_iron', 'martian_ice', 'co2',
  ];

  const stockpiles = {} as Record<MaterialType, number>;
  const productionRates = {} as Record<MaterialType, number>;
  for (const mat of allMaterials) {
    stockpiles[mat] = profile.startingResources.materials[mat] ?? 0;
    productionRates[mat] = 0;
  }

  const resources: ResourceState = {
    currency: profile.startingResources.currency,
    knowledgePoints: 0,
    incomeRate: 0,
    expenseRate: 0,
  };

  const materials: MaterialState = {
    stockpiles,
    productionRates,
    refineries: [],
  };

  const energy: EnergyState = {
    generated: 0,
    stored: 0,
    maxStorage: profile.startingResources.energyCapacity,
    distributionRate: 1,
    solarPanels: [],
    powerPlants: [],
  };

  const infrastructure: InfrastructureState = {
    mines: [],
    factories: [],
    distributionNetworks: [],
  };

  const techTreeIds: TechTreeId[] = ['energy', 'materials', 'weapons', 'political', 'space'];
  const research: ResearchState = {
    trees: Object.fromEntries(techTreeIds.map((id) => [id, { nodes: {} }])) as Record<TechTreeId, { nodes: Record<string, never> }>,
    currentResearch: null,
  };

  const supplyChain: SupplyChainState = {
    recipes: [],
    automatedRecipes: [],
  };

  const weather: WeatherState = {
    current: 'sunny',
    ticksUntilChange: 60,
    changeInterval: 60,
    history: [],
  };

  const opposition: OppositionState = {
    publicApproval: 70,
    unPowerLevel: 100,
    unHostility: 0,
    activeProtests: [],
    activeSanctions: [],
    lastUNAttackTick: 0,
  };

  const political: PoliticalState = {
    influence: {} as Record<CountryId, number>,
    installedPoliticians: [],
    worldDominationAchieved: false,
    activeOperations: [],
  };

  // Initialize influence for all countries except the player's own
  const allCountries: CountryId[] = [
    'usa', 'china', 'russia', 'india', 'germany',
    'japan', 'uk', 'france', 'south_korea', 'brazil',
  ];
  for (const c of allCountries) {
    if (c !== country) {
      political.influence[c] = 0;
    }
  }

  const weapons: WeaponsState = {
    militaryPower: profile.startingMilitary,
    factories: [],
    arsenal: {
      conventional: 10,
      missile: 2,
      cyber: 0,
      energy: 0,
      orbital: 0,
    },
  };

  const mars: MarsState = {
    unlocked: false,
    baseLevel: 0,
    resources: {} as Record<MaterialType, number>,
    productionRates: {} as Record<MaterialType, number>,
    launchCostReduction: 1.0,
  };
  for (const mat of allMaterials) {
    mars.resources[mat] = 0;
    mars.productionRates[mat] = 0;
  }

  const alien: AlienState = {
    encountered: false,
    relationsScore: 0,
    signals: [],
    ignoredSignals: 0,
    activeThreat: null,
    tradesCompleted: [],
  };

  const space: SpaceState = {
    unlocked: false,
    orbitalPlatforms: [],
    territories: [],
    fleet: { size: 0, fuelCapacity: 0, currentFuel: 0 },
    maxTerritories: 0,
  };

  const dyson: DysonState = {
    unlocked: false,
    segments: [],
    totalSegments: 5,
    completedSegments: 0,
    energyMultiplier: 1.0,
    victoryAchieved: false,
  };

  const education: EducationState = {
    factsPresented: [],
    quizzesCompleted: 0,
    quizzesCorrect: 0,
    pendingQuiz: null,
  };

  const eraProgress = {} as Record<Era, number>;
  for (const era of ERA_ORDER) {
    eraProgress[era] = era === 'fossil' ? 0 : 0;
  }

  const statistics: GameStatistics = {
    totalEnergyProduced: 0,
    totalCurrencyEarned: 0,
    totalResearchCompleted: 0,
    totalMaterialsCrafted: 0,
    playTimeTicks: 0,
  };

  return {
    version: 1,
    lastSaveTimestamp: Date.now(),
    currentEra: 'fossil',
    eraProgress,
    country,
    countryProfile: profile,
    resources,
    materials,
    energy,
    infrastructure,
    research,
    supplyChain,
    weather,
    opposition,
    political,
    weapons,
    alien,
    mars,
    space,
    dyson,
    education,
    statistics,
  };
}

/**
 * Creates a new game state using real country profiles from the data module.
 * This is the production entry point for starting a new game with country selection.
 */
export function createNewGame(country: CountryId): GameState {
  const profile = getCountryProfile(country);

  const allMaterials: MaterialType[] = [
    'coal', 'iron_ore', 'steel', 'silicon', 'solar_cells',
    'copper', 'electronics', 'uranium', 'fuel_rods',
    'rare_earth', 'advanced_circuits', 'water', 'fuel',
    'regolith_iron', 'martian_ice', 'co2',
  ];

  const stockpiles = {} as Record<MaterialType, number>;
  const productionRates = {} as Record<MaterialType, number>;
  for (const mat of allMaterials) {
    stockpiles[mat] = profile.startingResources.materials[mat] ?? 0;
    productionRates[mat] = 0;
  }

  const resources: ResourceState = {
    currency: profile.startingResources.currency,
    knowledgePoints: 0,
    incomeRate: 0,
    expenseRate: 0,
  };

  const materials: MaterialState = {
    stockpiles,
    productionRates,
    refineries: [],
  };

  const energy: EnergyState = {
    generated: 0,
    stored: 0,
    maxStorage: profile.startingResources.energyCapacity,
    distributionRate: 1,
    solarPanels: [],
    powerPlants: [],
  };

  const infrastructure: InfrastructureState = {
    mines: [],
    factories: [],
    distributionNetworks: [],
  };

  const techTreeIds: TechTreeId[] = ['energy', 'materials', 'weapons', 'political', 'space'];
  const research: ResearchState = {
    trees: Object.fromEntries(techTreeIds.map((id) => [id, { nodes: {} }])) as Record<TechTreeId, { nodes: Record<string, never> }>,
    currentResearch: null,
  };

  const supplyChain: SupplyChainState = {
    recipes: [],
    automatedRecipes: [],
  };

  const weather: WeatherState = {
    current: 'sunny',
    ticksUntilChange: 60,
    changeInterval: 60,
    history: [],
  };

  const opposition: OppositionState = {
    publicApproval: 70,
    unPowerLevel: 100,
    unHostility: 0,
    activeProtests: [],
    activeSanctions: [],
    lastUNAttackTick: 0,
  };

  const political: PoliticalState = {
    influence: {} as Record<CountryId, number>,
    installedPoliticians: [],
    worldDominationAchieved: false,
    activeOperations: [],
  };

  const allCountries: CountryId[] = [
    'usa', 'china', 'russia', 'india', 'germany',
    'japan', 'uk', 'france', 'south_korea', 'brazil',
  ];
  for (const c of allCountries) {
    if (c !== country) {
      political.influence[c] = 0;
    }
  }

  const weapons: WeaponsState = {
    militaryPower: profile.startingMilitary,
    factories: [],
    arsenal: {
      conventional: 10,
      missile: 2,
      cyber: 0,
      energy: 0,
      orbital: 0,
    },
  };

  const mars: MarsState = {
    unlocked: false,
    baseLevel: 0,
    resources: {} as Record<MaterialType, number>,
    productionRates: {} as Record<MaterialType, number>,
    launchCostReduction: 1.0,
  };
  for (const mat of allMaterials) {
    mars.resources[mat] = 0;
    mars.productionRates[mat] = 0;
  }

  const alien: AlienState = {
    encountered: false,
    relationsScore: 0,
    signals: [],
    ignoredSignals: 0,
    activeThreat: null,
    tradesCompleted: [],
  };

  const space: SpaceState = {
    unlocked: false,
    orbitalPlatforms: [],
    territories: [],
    fleet: { size: 0, fuelCapacity: 0, currentFuel: 0 },
    maxTerritories: 0,
  };

  const dyson: DysonState = {
    unlocked: false,
    segments: [],
    totalSegments: 5,
    completedSegments: 0,
    energyMultiplier: 1.0,
    victoryAchieved: false,
  };

  const education: EducationState = {
    factsPresented: [],
    quizzesCompleted: 0,
    quizzesCorrect: 0,
    pendingQuiz: null,
  };

  const eraProgress = {} as Record<Era, number>;
  for (const era of ERA_ORDER) {
    eraProgress[era] = 0;
  }

  const statistics: GameStatistics = {
    totalEnergyProduced: 0,
    totalCurrencyEarned: 0,
    totalResearchCompleted: 0,
    totalMaterialsCrafted: 0,
    playTimeTicks: 0,
  };

  return {
    version: 1,
    lastSaveTimestamp: Date.now(),
    currentEra: 'fossil',
    eraProgress,
    country,
    countryProfile: profile,
    resources,
    materials,
    energy,
    infrastructure,
    research,
    supplyChain,
    weather,
    opposition,
    political,
    weapons,
    alien,
    mars,
    space,
    dyson,
    education,
    statistics,
  };
}

/**
 * Immutably applies a StateUpdate to the current GameState.
 * Merges resources, materials, unlocks, events, and path-based mutations.
 */
export function applyUpdate(state: GameState, update: StateUpdate): GameState {
  let newState = { ...state };

  // Merge partial resource updates
  if (update.resources) {
    newState = {
      ...newState,
      resources: { ...newState.resources, ...update.resources },
    };
  }

  // Merge partial material updates
  if (update.materials) {
    const mergedMaterials = { ...newState.materials };

    if (update.materials.stockpiles) {
      mergedMaterials.stockpiles = {
        ...mergedMaterials.stockpiles,
        ...update.materials.stockpiles,
      };
    }
    if (update.materials.productionRates) {
      mergedMaterials.productionRates = {
        ...mergedMaterials.productionRates,
        ...update.materials.productionRates,
      };
    }
    if (update.materials.refineries) {
      mergedMaterials.refineries = update.materials.refineries;
    }

    newState = { ...newState, materials: mergedMaterials };
  }

  // Append unlocks (deduplicated)
  if (update.unlocks && update.unlocks.length > 0) {
    // unlocks are stored in supplyChain.recipes for now — this represents unlocked recipe IDs
    const existingRecipes = new Set(newState.supplyChain.recipes);
    const newRecipes = update.unlocks.filter((u) => !existingRecipes.has(u));
    if (newRecipes.length > 0) {
      newState = {
        ...newState,
        supplyChain: {
          ...newState.supplyChain,
          recipes: [...newState.supplyChain.recipes, ...newRecipes],
        },
      };
    }
  }

  // Apply path-based mutations
  if (update.mutations && update.mutations.length > 0) {
    for (const mutation of update.mutations) {
      newState = applyMutation(newState, mutation);
    }
  }

  return newState;
}

/**
 * Applies a single path-based mutation immutably.
 * Path uses dot notation, e.g. "energy.stored" or "weapons.arsenal.missile".
 */
function applyMutation(state: GameState, mutation: StateMutation): GameState {
  const parts = mutation.path.split('.');
  if (parts.length === 0) return state;

  return deepSet(state, parts, mutation.value) as GameState;
}

/**
 * Immutably sets a value at a nested path within an object.
 */
function deepSet(obj: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value;

  const [head, ...rest] = path;
  const current = obj as Record<string, unknown>;

  return {
    ...current,
    [head]: deepSet(current[head], rest, value),
  };
}

/**
 * Detects whether the current era should advance and returns the next era if conditions are met.
 * Era progression is based on eraProgress reaching 100 for the current era.
 */
export function detectEraProgression(state: GameState): Era | null {
  const currentIndex = ERA_ORDER.indexOf(state.currentEra);

  // Already at the final era
  if (currentIndex >= ERA_ORDER.length - 1) return null;

  // Check if current era progress is at 100%
  if (state.eraProgress[state.currentEra] >= 100) {
    return ERA_ORDER[currentIndex + 1];
  }

  return null;
}

/**
 * Advances the game state to the next era if conditions are met.
 * Returns the updated state, or the same state if no progression occurred.
 */
export function advanceEra(state: GameState): GameState {
  const nextEra = detectEraProgression(state);
  if (!nextEra) return state;

  return {
    ...state,
    currentEra: nextEra,
  };
}
