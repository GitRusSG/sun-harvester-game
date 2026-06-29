import type { GameState, GameAction, StateUpdate, Era, StateMutation, GameEvent } from '../core/types.js';
import type { AlienSignal, AlienThreat } from '../core/combat.js';
import { generateId } from '../utils/id.js';

/** Signal detection chance per territory per tick */
const SIGNAL_CHANCE_PER_TERRITORY = 0.005;

/** Number of ignored signals before forced contact */
const FORCED_CONTACT_THRESHOLD = 5;

/** Relations change for cooperative encounter */
const COOPERATIVE_RELATIONS_CHANGE = 15;

/** Relations change for hostile encounter */
const HOSTILE_RELATIONS_CHANGE = -10;

/** Relations change for ignored signal */
const IGNORED_RELATIONS_CHANGE = -5;

/** Relations bonus for broadcasting a response */
const BROADCAST_RELATIONS_BONUS = 10;

/** Default threat remaining ticks */
const DEFAULT_THREAT_DURATION = 30;

/**
 * AlienSystem manages alien signal detection, encounters, and diplomatic relations.
 *
 * Responsibilities:
 * - Detect alien signals during asteroid mining operations (probability based on territories)
 * - Present player with choices: investigate, ignore, or broadcast response
 * - Determine encounter outcomes (cooperative or hostile) based on relations score
 * - Track alien relations score (-100 to 100)
 * - Escalate to forced contact after repeated ignored signals
 * - Manage active alien threats requiring defense resources
 *
 * Active from Space Mining Era onwards.
 *
 * Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.8
 */
export class AlienSystem {
  readonly id = 'alien';

  readonly activeEras: Era[] = ['space_mining', 'dyson_ring'];

  /**
   * Main update loop: handles signal detection and threat processing.
   */
  update(state: GameState, deltaTicks: number): StateUpdate {
    const events: GameEvent[] = [];
    const mutations: StateMutation[] = [];

    let signals = [...state.alien.signals];
    let ignoredSignals = state.alien.ignoredSignals;
    let activeThreat = state.alien.activeThreat;
    let relationsScore = state.alien.relationsScore;
    let encountered = state.alien.encountered;

    const territories = state.space.territories;

    // --- Signal detection ---
    if (territories.length > 0) {
      const signalChance = territories.length * SIGNAL_CHANCE_PER_TERRITORY;
      for (let t = 0; t < deltaTicks; t++) {
        if (Math.random() < signalChance) {
          const signal: AlienSignal = {
            id: `signal_${generateId()}`,
            detectedTick: state.statistics.playTimeTicks + t,
            investigated: false,
          };
          signals.push(signal);
          encountered = true;

          events.push({
            id: signal.id,
            type: 'alien_signal',
            payload: { signalId: signal.id },
            timestamp: Date.now(),
          });

          // Forced contact escalation: auto-investigate if too many ignored
          if (ignoredSignals >= FORCED_CONTACT_THRESHOLD) {
            const outcome = this.determineOutcome(relationsScore);
            signal.investigated = true;
            signal.outcome = outcome;

            if (outcome === 'cooperative') {
              relationsScore = Math.min(100, relationsScore + COOPERATIVE_RELATIONS_CHANGE);
              const tradeId = `trade_${generateId()}`;
              mutations.push({
                path: 'alien.tradesCompleted',
                value: [...state.alien.tradesCompleted, tradeId],
              });
            } else {
              relationsScore = Math.max(-100, relationsScore + HOSTILE_RELATIONS_CHANGE);
              activeThreat = this.createThreat();
            }

            events.push({
              id: `encounter_${generateId()}`,
              type: 'alien_encounter',
              payload: { outcome, forced: true },
              timestamp: Date.now(),
            });

            // Reset ignored count after forced contact
            ignoredSignals = 0;
          }
        }
      }
    }

    // --- Process active threats ---
    if (activeThreat) {
      activeThreat = { ...activeThreat };
      activeThreat.remainingTicks -= deltaTicks;

      if (state.weapons.militaryPower >= activeThreat.defenseRequired) {
        // Threat repelled successfully
        activeThreat = null;
      } else if (activeThreat.remainingTicks <= 0) {
        // Threat expired without sufficient defense - negative consequence
        relationsScore = Math.max(-100, relationsScore - 10);
        activeThreat = null;
      }
    }

    // Clamp relations score
    relationsScore = Math.max(-100, Math.min(100, relationsScore));

    mutations.push({ path: 'alien.signals', value: signals });
    mutations.push({ path: 'alien.ignoredSignals', value: ignoredSignals });
    mutations.push({ path: 'alien.activeThreat', value: activeThreat });
    mutations.push({ path: 'alien.relationsScore', value: relationsScore });
    mutations.push({ path: 'alien.encountered', value: encountered });

    return {
      mutations,
      events: events.length > 0 ? events : undefined,
    };
  }

  /**
   * Checks if a specific action is valid.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    if (action.type === 'investigate_signal' || action.type === 'ignore_signal' || action.type === 'broadcast_response') {
      const signalId = action.payload.signalId as string;
      if (!signalId) return false;
      const signal = state.alien.signals.find((s) => s.id === signalId);
      return !!signal && !signal.investigated && signal.outcome === undefined;
    }
    return false;
  }

  /**
   * Executes a player action.
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    if (action.type === 'investigate_signal') {
      return this.investigateSignal(state, action.payload.signalId as string);
    }

    if (action.type === 'ignore_signal') {
      return this.ignoreSignal(state, action.payload.signalId as string);
    }

    if (action.type === 'broadcast_response') {
      return this.broadcastResponse(state, action.payload.signalId as string);
    }

    return {};
  }

  /**
   * Investigate an alien signal. Outcome depends on relations score.
   */
  private investigateSignal(state: GameState, signalId: string): StateUpdate {
    const mutations: StateMutation[] = [];
    const events: GameEvent[] = [];

    const signals = state.alien.signals.map((s) => {
      if (s.id === signalId) {
        const outcome = this.determineOutcome(state.alien.relationsScore);
        return { ...s, investigated: true, outcome };
      }
      return s;
    });

    const updatedSignal = signals.find((s) => s.id === signalId)!;
    const outcome = updatedSignal.outcome!;

    let relationsScore = state.alien.relationsScore;

    if (outcome === 'cooperative') {
      relationsScore = Math.min(100, relationsScore + COOPERATIVE_RELATIONS_CHANGE);
      const tradeId = `trade_${generateId()}`;
      mutations.push({
        path: 'alien.tradesCompleted',
        value: [...state.alien.tradesCompleted, tradeId],
      });
    } else {
      relationsScore = Math.max(-100, relationsScore + HOSTILE_RELATIONS_CHANGE);
      mutations.push({
        path: 'alien.activeThreat',
        value: this.createThreat(),
      });
    }

    mutations.push({ path: 'alien.signals', value: signals });
    mutations.push({ path: 'alien.relationsScore', value: relationsScore });

    events.push({
      id: `encounter_${generateId()}`,
      type: 'alien_encounter',
      payload: { outcome, signalId },
      timestamp: Date.now(),
    });

    return { mutations, events };
  }

  /**
   * Ignore an alien signal. Increases ignored count, decreases relations.
   */
  private ignoreSignal(state: GameState, signalId: string): StateUpdate {
    const mutations: StateMutation[] = [];

    const signals = state.alien.signals.map((s) => {
      if (s.id === signalId) {
        return { ...s, outcome: 'ignored' as const };
      }
      return s;
    });

    const newIgnoredCount = state.alien.ignoredSignals + 1;
    const relationsScore = Math.max(-100, state.alien.relationsScore + IGNORED_RELATIONS_CHANGE);

    mutations.push({ path: 'alien.signals', value: signals });
    mutations.push({ path: 'alien.ignoredSignals', value: newIgnoredCount });
    mutations.push({ path: 'alien.relationsScore', value: relationsScore });

    return { mutations };
  }

  /**
   * Broadcast a response to an alien signal. Like investigate but with a relations bonus.
   */
  private broadcastResponse(state: GameState, signalId: string): StateUpdate {
    const mutations: StateMutation[] = [];
    const events: GameEvent[] = [];

    // Apply broadcast bonus to relations before determining outcome
    const adjustedRelations = Math.min(100, state.alien.relationsScore + BROADCAST_RELATIONS_BONUS);

    const signals = state.alien.signals.map((s) => {
      if (s.id === signalId) {
        const outcome = this.determineOutcome(adjustedRelations);
        return { ...s, investigated: true, outcome };
      }
      return s;
    });

    const updatedSignal = signals.find((s) => s.id === signalId)!;
    const outcome = updatedSignal.outcome!;

    let relationsScore = adjustedRelations;

    if (outcome === 'cooperative') {
      relationsScore = Math.min(100, relationsScore + COOPERATIVE_RELATIONS_CHANGE);
      const tradeId = `trade_${generateId()}`;
      mutations.push({
        path: 'alien.tradesCompleted',
        value: [...state.alien.tradesCompleted, tradeId],
      });
    } else {
      relationsScore = Math.max(-100, relationsScore + HOSTILE_RELATIONS_CHANGE);
      mutations.push({
        path: 'alien.activeThreat',
        value: this.createThreat(),
      });
    }

    mutations.push({ path: 'alien.signals', value: signals });
    mutations.push({ path: 'alien.relationsScore', value: relationsScore });

    events.push({
      id: `encounter_${generateId()}`,
      type: 'alien_encounter',
      payload: { outcome, signalId, broadcast: true },
      timestamp: Date.now(),
    });

    return { mutations, events };
  }

  /**
   * Determines encounter outcome based on relations score.
   * Formula: if Math.random() * 200 + relationsScore > 100 → cooperative, else hostile
   */
  private determineOutcome(relationsScore: number): 'cooperative' | 'hostile' {
    return Math.random() * 200 + relationsScore > 100 ? 'cooperative' : 'hostile';
  }

  /**
   * Creates a new alien threat.
   */
  private createThreat(): AlienThreat {
    const severity = Math.floor(Math.random() * 5) + 1;
    return {
      severity,
      defenseRequired: severity * 20,
      remainingTicks: DEFAULT_THREAT_DURATION,
    };
  }
}
