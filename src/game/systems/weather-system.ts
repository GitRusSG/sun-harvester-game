import type { GameState, GameAction, StateUpdate, Era, GameEvent } from '../core/types.js';
import type { WeatherCondition } from '../core/weather.js';
import { WEATHER_MODIFIERS } from '../core/weather.js';

/**
 * All weather conditions available for transitions.
 */
const ALL_WEATHER_CONDITIONS: WeatherCondition[] = [
  'sunny',
  'partly_cloudy',
  'overcast',
  'rainy',
];

/**
 * WeatherSystem manages weather cycling and production modifiers.
 *
 * - Cycles weather on configurable tick intervals (state.weather.changeInterval)
 * - Provides production multipliers via getModifier()
 * - Emits weather_change events on transitions
 * - Active in all eras
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */
export class WeatherSystem {
  readonly id = 'weather';

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
   * Returns the current weather condition from state.
   */
  getCurrentWeather(state: GameState): WeatherCondition {
    return state.weather.current;
  }

  /**
   * Returns the production modifier for a given weather condition.
   * sunny: 1.0, partly_cloudy: 0.7, overcast: 0.4, rainy: 0.2
   */
  getModifier(weather: WeatherCondition): number {
    return WEATHER_MODIFIERS[weather];
  }

  /**
   * Computes the next weather condition after advancing deltaTicks.
   * Transitions to a random weather condition different from the current one
   * when ticksUntilChange reaches 0 or below.
   */
  advanceWeather(state: GameState, deltaTicks: number): WeatherCondition {
    const remaining = state.weather.ticksUntilChange - deltaTicks;
    if (remaining <= 0) {
      return this.pickNewWeather(state.weather.current);
    }
    return state.weather.current;
  }

  /**
   * Processes one or more ticks. Decrements ticksUntilChange by deltaTicks.
   * When it reaches 0 or below, transitions to a new weather condition,
   * resets ticksUntilChange, and emits a weather_change event.
   */
  update(state: GameState, deltaTicks: number): StateUpdate {
    const weather = state.weather;
    let remaining = weather.ticksUntilChange - deltaTicks;

    if (remaining > 0) {
      // No weather change, just update the countdown
      return {
        mutations: [
          { path: 'weather.ticksUntilChange', value: remaining },
        ],
      };
    }

    // Weather change occurs
    const newWeather = this.pickNewWeather(weather.current);
    const events: GameEvent[] = [];

    // Handle multiple transitions if deltaTicks spans multiple intervals
    // For simplicity, we only transition once per update call but consume
    // the overflow ticks into the new interval.
    const overflow = Math.abs(remaining);
    const newTicksUntilChange = weather.changeInterval - (overflow % weather.changeInterval);

    // Determine if overflow caused additional transitions
    const additionalTransitions = Math.floor(overflow / weather.changeInterval);
    let finalWeather = newWeather;

    // If multiple intervals elapsed, pick a final weather (each intermediate is random)
    for (let i = 0; i < additionalTransitions; i++) {
      finalWeather = this.pickNewWeather(finalWeather);
    }

    // Emit weather_change event
    events.push({
      id: `weather_change_${Date.now()}`,
      type: 'weather_change',
      payload: {
        previous: weather.current,
        current: finalWeather,
      },
      timestamp: Date.now(),
    });

    // Update history (keep last 10 entries)
    const newHistory = [...weather.history, weather.current].slice(-10);

    return {
      mutations: [
        { path: 'weather.current', value: finalWeather },
        { path: 'weather.ticksUntilChange', value: newTicksUntilChange },
        { path: 'weather.history', value: newHistory },
      ],
      events,
    };
  }

  /**
   * Checks if a specific action can be performed by this system.
   * The weather system does not handle player actions.
   */
  canPerform(_state: GameState, _action: GameAction): boolean {
    return false;
  }

  /**
   * Executes a player action. The weather system has no player actions.
   */
  perform(_state: GameState, _action: GameAction): StateUpdate {
    return {};
  }

  /**
   * Picks a random weather condition different from the current one.
   */
  private pickNewWeather(current: WeatherCondition): WeatherCondition {
    const options = ALL_WEATHER_CONDITIONS.filter((w) => w !== current);
    const index = Math.floor(Math.random() * options.length);
    return options[index];
  }
}
