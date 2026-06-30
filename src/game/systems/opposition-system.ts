import type { GameState, GameAction, StateUpdate, Era, StateMutation, GameEvent } from '../core/types.js';
import type { Protest, Sanction } from '../core/opposition.js';
import type { TechTreeId } from '../core/research.js';
import { generateId } from '../utils/id.js';

/**
 * Countermeasure actions the player can take to oppose the UN and protests.
 */
export type CountermeasureAction =
  | { type: 'education_campaign'; investment: number }
  | { type: 'military_defense' }
  | { type: 'diplomatic_deception' }
  | { type: 'economic_leverage' }
  | { type: 'tech_superiority' };

/** Approval threshold below which construction is blocked */
const CONSTRUCTION_BLOCK_THRESHOLD = 30;

/** Approval decrease per nuclear plant per tick */
const APPROVAL_DECAY_PER_NUCLEAR = 0.1;

/** UN hostility increase per tick when stored energy > 1000 */
const HOSTILITY_ENERGY_RATE = 0.1;

/** UN hostility threshold for launching attacks */
const UN_ATTACK_HOSTILITY_THRESHOLD = 50;

/** Minimum ticks between UN attacks */
const UN_ATTACK_COOLDOWN = 100;

/** Global influence threshold for final UN confrontation */
const FINAL_CONFRONTATION_INFLUENCE_THRESHOLD = 70;

/** Protest duration in ticks */
const PROTEST_DURATION = 30;

/** Sanction duration in ticks */
const SANCTION_DURATION = 60;

/**
 * OppositionSystem manages public approval, protests, UN hostility, and UN attacks.
 *
 * Responsibilities:
 * - Track public approval (0-100), decreasing with nuclear plants
 * - Generate protests proportional to nuclear plant count
 * - Block construction when approval < 30%
 * - Escalate UN hostility based on energy output and territory
 * - Generate UN attack events (sanctions, embargo, military intervention)
 * - Allow countermeasures to mitigate opposition effects
 * - Reduce UN power when player defeats interventions
 * - Trigger final UN confrontation at >70% global influence
 *
 * Active from Nuclear Era onwards.
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 22.6
 */
export class OppositionSystem {
  readonly id = 'opposition';

  readonly activeEras: Era[] = [
    'nuclear',
    'solar',
    'orbital',
    'mars_colonization',
    'space_mining',
    'dyson_ring',
  ];

  /**
   * Returns the current public approval level.
   */
  getPublicApproval(state: GameState): number {
    return state.opposition.publicApproval;
  }

  /**
   * Returns the current UN threat level (combination of hostility and power).
   */
  getUNThreatLevel(state: GameState): number {
    return Math.min(100, (state.opposition.unHostility + state.opposition.unPowerLevel) / 2);
  }

  /**
   * Checks the current game state for opposition events (protests, UN attacks).
   */
  checkForEvents(state: GameState): GameEvent[] {
    const events: GameEvent[] = [];

    // Check for protest events
    const nuclearPlants = state.energy.powerPlants.filter((p) => p.type === 'nuclear');
    if (nuclearPlants.length > 0 && Math.random() < nuclearPlants.length * 0.05) {
      events.push({
        id: `protest_${generateId()}`,
        type: 'protest',
        payload: {
          cause: 'anti_nuclear',
          severity: Math.min(1, nuclearPlants.length * 0.1),
        },
        timestamp: Date.now(),
      });
    }

    // Check for UN attack events (UN can't attack if their power is 0 — defeated)
    if (
      state.opposition.unPowerLevel > 0 &&
      state.opposition.unHostility > UN_ATTACK_HOSTILITY_THRESHOLD &&
      state.statistics.playTimeTicks - state.opposition.lastUNAttackTick >= UN_ATTACK_COOLDOWN
    ) {
      const attackType = this.determineAttackType(state.opposition.unHostility);
      events.push({
        id: `un_attack_${generateId()}`,
        type: 'un_attack',
        payload: {
          attackType,
          severity: state.opposition.unHostility / 100,
        },
        timestamp: Date.now(),
      });
    }

    return events;
  }

  /**
   * Applies a countermeasure action to the current state.
   */
  applyCountermeasure(state: GameState, action: CountermeasureAction): StateUpdate {
    const mutations: StateMutation[] = [];

    switch (action.type) {
      case 'education_campaign': {
        // Increase approval by investment / 100
        const approvalIncrease = action.investment / 100;
        const newApproval = Math.min(100, state.opposition.publicApproval + approvalIncrease);
        mutations.push({ path: 'opposition.publicApproval', value: newApproval });
        break;
      }

      case 'military_defense': {
        // Reduce UN power level by 5 if player military > UN power
        if (state.weapons.militaryPower > state.opposition.unPowerLevel) {
          const newPowerLevel = Math.max(0, state.opposition.unPowerLevel - 5);
          mutations.push({ path: 'opposition.unPowerLevel', value: newPowerLevel });
        }
        break;
      }

      case 'diplomatic_deception': {
        // Reduce UN hostility by 10
        const newHostility = Math.max(0, state.opposition.unHostility - 10);
        mutations.push({ path: 'opposition.unHostility', value: newHostility });
        break;
      }

      case 'economic_leverage': {
        // Reduce sanction severity by 25%
        const updatedSanctions = state.opposition.activeSanctions.map((s) => ({
          ...s,
          severity: s.severity * 0.75,
        }));
        mutations.push({ path: 'opposition.activeSanctions', value: updatedSanctions });
        break;
      }

      case 'tech_superiority': {
        // If player has 10+ completed research nodes, reduce UN hostility by 20
        const completedNodes = this.countCompletedResearchNodes(state);
        if (completedNodes >= 10) {
          const newHostility = Math.max(0, state.opposition.unHostility - 20);
          mutations.push({ path: 'opposition.unHostility', value: newHostility });
        }
        break;
      }
    }

    return { mutations };
  }

  /**
   * Main update loop: processes protests, approval decay, UN hostility, and attacks.
   */
  update(state: GameState, deltaTicks: number): StateUpdate {
    const events: GameEvent[] = [];
    const mutations: StateMutation[] = [];

    let publicApproval = state.opposition.publicApproval;
    let unHostility = state.opposition.unHostility;
    let unPowerLevel = state.opposition.unPowerLevel;
    let activeProtests = [...state.opposition.activeProtests];
    let activeSanctions = [...state.opposition.activeSanctions];
    let lastUNAttackTick = state.opposition.lastUNAttackTick;

    const nuclearPlants = state.energy.powerPlants.filter((p) => p.type === 'nuclear');
    const nuclearCount = nuclearPlants.length;

    // --- Protest generation ---
    // Chance per tick based on nuclear plant count
    if (nuclearCount > 0) {
      for (let t = 0; t < deltaTicks; t++) {
        const protestChance = nuclearCount * 0.02;
        if (Math.random() < protestChance) {
          const severity = Math.min(1, nuclearCount * 0.1);
          const protest: Protest = {
            id: `protest_${generateId()}`,
            cause: 'anti_nuclear',
            severity,
            remainingTicks: PROTEST_DURATION,
            affectedArea: 'construction',
          };
          activeProtests.push(protest);
          events.push({
            id: protest.id,
            type: 'protest',
            payload: { cause: 'anti_nuclear', severity },
            timestamp: Date.now(),
          });
        }
      }
    }

    // --- Decay protests ---
    activeProtests = activeProtests
      .map((p) => ({ ...p, remainingTicks: p.remainingTicks - deltaTicks }))
      .filter((p) => p.remainingTicks > 0);

    // --- Decay sanctions ---
    activeSanctions = activeSanctions
      .map((s) => ({ ...s, remainingTicks: s.remainingTicks - deltaTicks }))
      .filter((s) => s.remainingTicks > 0);

    // --- Adjust approval ---
    // Nuclear plants decrease approval slowly
    if (nuclearCount > 0) {
      const approvalDecrease = APPROVAL_DECAY_PER_NUCLEAR * nuclearCount * deltaTicks;
      publicApproval = Math.max(0, publicApproval - approvalDecrease);
    }

    // --- UN hostility increase ---
    // Increases based on total energy stored (>1000 = +0.1/tick)
    if (state.energy.stored > 1000) {
      unHostility = Math.min(100, unHostility + HOSTILITY_ENERGY_RATE * deltaTicks);
    }

    // Territory (orbital platforms, asteroid territories) also increase hostility
    const orbitalCount = state.space.orbitalPlatforms.length;
    const territoryCount = state.space.territories.length;
    const territoryHostilityRate = (orbitalCount + territoryCount) * 0.05;
    if (territoryHostilityRate > 0) {
      unHostility = Math.min(100, unHostility + territoryHostilityRate * deltaTicks);
    }

    // --- UN attacks (can't attack if power is 0 — permanently defeated) ---
    const currentTick = state.statistics.playTimeTicks;
    if (
      unPowerLevel > 0 &&
      unHostility > UN_ATTACK_HOSTILITY_THRESHOLD &&
      currentTick - lastUNAttackTick >= UN_ATTACK_COOLDOWN
    ) {
      const attackType = this.determineAttackType(unHostility);
      let severity = unHostility / 100;

      // Military comparison: if player military > UN power, reduce severity by 50%
      if (state.weapons.militaryPower > unPowerLevel) {
        severity *= 0.5;
      }

      if (attackType === 'sanctions' || attackType === 'embargo') {
        const sanction: Sanction = {
          id: `sanction_${generateId()}`,
          severity: severity * 50, // percentage cost increase
          remainingTicks: SANCTION_DURATION,
        };
        activeSanctions.push(sanction);
      }

      events.push({
        id: `un_attack_${generateId()}`,
        type: 'un_attack',
        payload: { attackType, severity },
        timestamp: Date.now(),
      });

      lastUNAttackTick = currentTick;

      // If player defeats the intervention (military > UN), reduce UN power
      if (attackType === 'military_intervention' && state.weapons.militaryPower > unPowerLevel) {
        unPowerLevel = Math.max(0, unPowerLevel - 10);
      }
    }

    // --- Final UN confrontation (fires only once when UN still has power) ---
    const globalInfluence = this.calculateGlobalInfluence(state);
    if (
      globalInfluence > FINAL_CONFRONTATION_INFLUENCE_THRESHOLD &&
      unPowerLevel > 0 &&
      !state.opposition.finalConfrontationDone
    ) {
      unHostility = 100;
      events.push({
        id: `un_final_confrontation_${generateId()}`,
        type: 'un_attack',
        payload: { attackType: 'final_confrontation', severity: 1.0 },
        timestamp: Date.now(),
      });
      mutations.push({ path: 'opposition.finalConfrontationDone', value: true });
    }

    // Clamp values
    publicApproval = Math.max(0, Math.min(100, publicApproval));
    unHostility = Math.max(0, Math.min(100, unHostility));
    unPowerLevel = Math.max(0, Math.min(100, unPowerLevel));

    mutations.push({ path: 'opposition.publicApproval', value: publicApproval });
    mutations.push({ path: 'opposition.unHostility', value: unHostility });
    mutations.push({ path: 'opposition.unPowerLevel', value: unPowerLevel });
    mutations.push({ path: 'opposition.activeProtests', value: activeProtests });
    mutations.push({ path: 'opposition.activeSanctions', value: activeSanctions });
    mutations.push({ path: 'opposition.lastUNAttackTick', value: lastUNAttackTick });

    return {
      mutations,
      events: events.length > 0 ? events : undefined,
    };
  }

  /**
   * Checks if a specific action is valid.
   * Supports 'countermeasure' action type.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    if (action.type === 'countermeasure') {
      const cmAction = action.payload as unknown as CountermeasureAction;
      if (!cmAction || !cmAction.type) return false;

      if (cmAction.type === 'education_campaign') {
        return (cmAction as { type: 'education_campaign'; investment: number }).investment > 0;
      }

      if (cmAction.type === 'military_defense') {
        return state.weapons.militaryPower > state.opposition.unPowerLevel;
      }

      if (cmAction.type === 'tech_superiority') {
        return this.countCompletedResearchNodes(state) >= 10;
      }

      return true;
    }

    return false;
  }

  /**
   * Executes a player action.
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    if (action.type === 'countermeasure') {
      const cmAction = action.payload as unknown as CountermeasureAction;
      return this.applyCountermeasure(state, cmAction);
    }

    return {};
  }

  /**
   * Returns whether construction is blocked due to low public approval.
   */
  isConstructionBlocked(state: GameState): boolean {
    return state.opposition.publicApproval < CONSTRUCTION_BLOCK_THRESHOLD;
  }

  // --- Private helpers ---

  /**
   * Determines the type of UN attack based on hostility level.
   * - 50-70: sanctions
   * - 70-90: embargo
   * - 90+: military_intervention
   */
  private determineAttackType(hostility: number): 'sanctions' | 'embargo' | 'military_intervention' {
    if (hostility >= 90) return 'military_intervention';
    if (hostility >= 70) return 'embargo';
    return 'sanctions';
  }

  /**
   * Counts the total number of completed research nodes across all tech trees.
   */
  private countCompletedResearchNodes(state: GameState): number {
    let count = 0;
    const treeIds: TechTreeId[] = ['energy', 'materials', 'weapons', 'political', 'space'];
    for (const treeId of treeIds) {
      const tree = state.research.trees[treeId];
      if (tree && tree.nodes) {
        for (const nodeId of Object.keys(tree.nodes)) {
          if (tree.nodes[nodeId].status === 'completed') {
            count++;
          }
        }
      }
    }
    return count;
  }

  /**
   * Calculates the player's global influence as a percentage (0-100).
   * Based on how many countries have high influence levels.
   */
  private calculateGlobalInfluence(state: GameState): number {
    const influenceValues = Object.values(state.political.influence);
    if (influenceValues.length === 0) return 0;
    const totalInfluence = influenceValues.reduce((sum, val) => sum + val, 0);
    // Average influence across all countries as percentage
    return totalInfluence / influenceValues.length;
  }
}
