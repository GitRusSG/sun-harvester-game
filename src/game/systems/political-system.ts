import type { GameState, GameAction, StateUpdate, Era, CountryId, StateMutation, GameEvent } from '../core/types.js';
import type { PoliticalOperation, InfluenceMethod } from '../core/opposition.js';

/**
 * Influence growth rates per tick per method.
 * Higher-risk methods provide faster influence gain.
 */
const INFLUENCE_RATES: Record<InfluenceMethod, number> = {
  economic_aid: 0.2,
  propaganda: 0.12,
  corporate_infiltration: 0.35,
  intelligence: 0.5,
};

/** Threshold above which a politician gets installed */
const INSTALL_THRESHOLD = 75;

/** Threshold below which an installed politician is removed via coup */
const COUP_THRESHOLD = 50;

/** Number of countries that must be controlled for World Domination */
const WORLD_DOMINATION_COUNT = 5;

/** Efficiency factor for global resource pooling under World Domination */
const RESOURCE_POOLING_EFFICIENCY = 0.6;

/** Base production value per controlled country (abstract unit for resource pooling) */
const BASE_COUNTRY_PRODUCTION = 50;

/**
 * All country IDs in the game. Used to determine non-player countries.
 */
const ALL_COUNTRIES: CountryId[] = [
  'usa', 'china', 'russia', 'india', 'germany',
  'japan', 'uk', 'france', 'south_korea', 'brazil',
];

/**
 * PoliticalSystem manages political influence, politician installation,
 * coup mechanics, and World Domination status.
 *
 * Responsibilities:
 * - Track influence levels for each non-player country (0-100)
 * - Process active political operations each tick (increase influence)
 * - Install politicians when influence >= 75%
 * - Remove politicians via coup when influence < 50%
 * - Check World Domination (5+ countries controlled)
 * - Calculate global resource pooling under World Domination
 *
 * Active from Nuclear Era onwards.
 *
 * Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 24.1, 24.2, 24.3
 */
export class PoliticalSystem {
  readonly id = 'political';

  readonly activeEras: Era[] = [
    'fossil',
    'nuclear',
    'solar',
    'orbital',
    'mars_colonization',
    'space_mining',
    'dyson_ring',
  ];

  /**
   * Returns the current influence scores for all non-player countries.
   */
  getInfluenceScores(state: GameState): Record<CountryId, number> {
    return { ...state.political.influence };
  }

  /**
   * Creates a new political operation to invest influence in a target country.
   * The operation runs for a duration based on investment amount and increases
   * influence per tick based on method rate.
   */
  investInfluence(
    state: GameState,
    country: CountryId,
    method: InfluenceMethod,
    amount: number,
  ): StateUpdate {
    // Cannot invest in own country
    if (country === state.country) return {};

    // Cannot invest negative or zero amounts
    if (amount <= 0) return {};

    // Check if the player can afford it
    if (state.resources.currency < amount) return {};

    // Duration based on investment: each 10 currency = 1 tick of operation
    const durationTicks = Math.max(1, Math.ceil(amount / 10));

    const operation: PoliticalOperation = {
      id: `pol_op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      targetCountry: country,
      method,
      investment: amount,
      remainingTicks: durationTicks,
    };

    const updatedOperations = [...state.political.activeOperations, operation];

    return {
      resources: {
        currency: state.resources.currency - amount,
      },
      mutations: [
        { path: 'political.activeOperations', value: updatedOperations },
      ],
    };
  }

  /**
   * Checks whether World Domination has been achieved (5+ countries controlled).
   */
  checkWorldDomination(state: GameState): boolean {
    return state.political.installedPoliticians.length >= WORLD_DOMINATION_COUNT;
  }

  /**
   * Returns the list of countries where the player has installed politicians.
   */
  getControlledCountries(state: GameState): CountryId[] {
    return [...state.political.installedPoliticians];
  }

  /**
   * Calculates the global resource pooling value when World Domination is achieved.
   * Returns the sum of controlled country production multiplied by efficiency factor.
   */
  getGlobalResourcePooling(state: GameState): number {
    if (!state.political.worldDominationAchieved) return 0;

    const controlledCount = state.political.installedPoliticians.length;
    return controlledCount * BASE_COUNTRY_PRODUCTION * RESOURCE_POOLING_EFFICIENCY;
  }

  /**
   * Main update loop: process active operations, check installations and coups.
   */
  update(state: GameState, deltaTicks: number): StateUpdate {
    const events: GameEvent[] = [];
    const mutations: StateMutation[] = [];

    // Clone mutable state
    const influence = { ...state.political.influence };
    let installedPoliticians = [...state.political.installedPoliticians];
    let activeOperations = [...state.political.activeOperations];
    let worldDominationAchieved = state.political.worldDominationAchieved;

    // Process active operations
    const remainingOperations: PoliticalOperation[] = [];
    for (const op of activeOperations) {
      const ticksToProcess = Math.min(op.remainingTicks, deltaTicks);
      const rate = INFLUENCE_RATES[op.method];
      const influenceGain = rate * ticksToProcess;

      // Increase influence (capped at 100)
      const currentInfluence = influence[op.targetCountry] ?? 0;
      influence[op.targetCountry] = Math.min(100, currentInfluence + influenceGain);

      const newRemainingTicks = op.remainingTicks - deltaTicks;
      if (newRemainingTicks > 0) {
        remainingOperations.push({ ...op, remainingTicks: newRemainingTicks });
      }
      // else operation is complete, don't keep it
    }
    activeOperations = remainingOperations;

    // Check for politician installations
    const nonPlayerCountries = ALL_COUNTRIES.filter((c) => c !== state.country);
    for (const country of nonPlayerCountries) {
      const countryInfluence = influence[country] ?? 0;

      if (countryInfluence >= INSTALL_THRESHOLD && !installedPoliticians.includes(country)) {
        // Install politician
        installedPoliticians.push(country);
        events.push({
          id: `politician_installed_${country}_${Date.now()}`,
          type: 'politician_installed',
          payload: { country },
          timestamp: Date.now(),
        });
      }
    }

    // Check for coups (influence dropped below 50% for installed politicians)
    const coupedCountries: CountryId[] = [];
    for (const country of installedPoliticians) {
      const countryInfluence = influence[country] ?? 0;
      if (countryInfluence < COUP_THRESHOLD) {
        coupedCountries.push(country);
        events.push({
          id: `coup_${country}_${Date.now()}`,
          type: 'coup',
          payload: { country },
          timestamp: Date.now(),
        });
      }
    }

    if (coupedCountries.length > 0) {
      installedPoliticians = installedPoliticians.filter((c) => !coupedCountries.includes(c));
    }

    // Check World Domination status
    if (!worldDominationAchieved && installedPoliticians.length >= WORLD_DOMINATION_COUNT) {
      worldDominationAchieved = true;
    } else if (worldDominationAchieved && installedPoliticians.length < WORLD_DOMINATION_COUNT) {
      // Lost world domination
      worldDominationAchieved = false;
    }

    // Build mutations
    mutations.push({ path: 'political.influence', value: influence });
    mutations.push({ path: 'political.installedPoliticians', value: installedPoliticians });
    mutations.push({ path: 'political.activeOperations', value: activeOperations });
    mutations.push({ path: 'political.worldDominationAchieved', value: worldDominationAchieved });

    // Apply global resource pooling bonus as income if world domination achieved
    const update: StateUpdate = {
      mutations,
      events: events.length > 0 ? events : undefined,
    };

    if (worldDominationAchieved) {
      const pooledResources = installedPoliticians.length * BASE_COUNTRY_PRODUCTION * RESOURCE_POOLING_EFFICIENCY;
      update.resources = {
        currency: state.resources.currency + pooledResources * deltaTicks,
      };
    }

    return update;
  }

  /**
   * Checks if a specific action is valid.
   * Supports 'invest_influence' action.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    if (action.type === 'invest_influence') {
      const country = action.payload.country as CountryId;
      const amount = action.payload.amount as number;

      if (!country || !amount || amount <= 0) return false;
      if (country === state.country) return false;
      if (state.resources.currency < amount) return false;

      return true;
    }

    return false;
  }

  /**
   * Executes a player action.
   * - 'invest_influence': starts a political operation targeting a country
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    if (action.type === 'invest_influence') {
      const country = action.payload.country as CountryId;
      const method = action.payload.method as InfluenceMethod;
      const amount = action.payload.amount as number;

      return this.investInfluence(state, country, method, amount);
    }

    return {};
  }
}
