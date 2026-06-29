import { describe, it, expect, vi } from 'vitest';
import { WeatherSystem } from '../../../../src/game/systems/weather-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { WeatherCondition } from '../../../../src/game/core/weather.js';

describe('WeatherSystem', () => {
  const system = new WeatherSystem();

  describe('getModifier', () => {
    it('returns 1.0 for sunny', () => {
      expect(system.getModifier('sunny')).toBe(1.0);
    });

    it('returns 0.7 for partly_cloudy', () => {
      expect(system.getModifier('partly_cloudy')).toBe(0.7);
    });

    it('returns 0.4 for overcast', () => {
      expect(system.getModifier('overcast')).toBe(0.4);
    });

    it('returns 0.2 for rainy', () => {
      expect(system.getModifier('rainy')).toBe(0.2);
    });
  });

  describe('update - no transition', () => {
    it('decrements ticksUntilChange when no transition occurs', () => {
      const state = createInitialState('usa');
      state.weather.ticksUntilChange = 30;
      state.weather.changeInterval = 60;

      const result = system.update(state, 5);

      expect(result.mutations).toBeDefined();
      const tickMutation = result.mutations!.find(
        (m) => m.path === 'weather.ticksUntilChange'
      );
      expect(tickMutation).toBeDefined();
      expect(tickMutation!.value).toBe(25);
    });

    it('does not emit events when no transition occurs', () => {
      const state = createInitialState('usa');
      state.weather.ticksUntilChange = 30;

      const result = system.update(state, 5);

      expect(result.events).toBeUndefined();
    });
  });

  describe('update - transition', () => {
    it('transitions to a new weather condition when ticksUntilChange reaches 0', () => {
      const state = createInitialState('usa');
      state.weather.current = 'sunny';
      state.weather.ticksUntilChange = 5;
      state.weather.changeInterval = 60;

      const result = system.update(state, 5);

      const weatherMutation = result.mutations!.find(
        (m) => m.path === 'weather.current'
      );
      expect(weatherMutation).toBeDefined();
      expect(weatherMutation!.value).not.toBe('sunny');
      // Must be a valid weather condition
      const validConditions: WeatherCondition[] = ['sunny', 'partly_cloudy', 'overcast', 'rainy'];
      expect(validConditions).toContain(weatherMutation!.value);
    });

    it('the new weather is different from the current weather', () => {
      const state = createInitialState('usa');
      state.weather.current = 'overcast';
      state.weather.ticksUntilChange = 1;
      state.weather.changeInterval = 60;

      // Run multiple times to be statistically confident
      for (let i = 0; i < 20; i++) {
        const result = system.update(state, 1);
        const weatherMutation = result.mutations!.find(
          (m) => m.path === 'weather.current'
        );
        expect(weatherMutation!.value).not.toBe('overcast');
      }
    });

    it('resets ticksUntilChange to changeInterval after transition', () => {
      const state = createInitialState('usa');
      state.weather.current = 'sunny';
      state.weather.ticksUntilChange = 5;
      state.weather.changeInterval = 60;

      const result = system.update(state, 5);

      const tickMutation = result.mutations!.find(
        (m) => m.path === 'weather.ticksUntilChange'
      );
      expect(tickMutation).toBeDefined();
      // When deltaTicks exactly equals ticksUntilChange, overflow is 0, so newTicks = changeInterval - 0 = 60
      expect(tickMutation!.value).toBe(60);
    });

    it('emits a weather_change event on transition', () => {
      const state = createInitialState('usa');
      state.weather.current = 'rainy';
      state.weather.ticksUntilChange = 3;
      state.weather.changeInterval = 60;

      const result = system.update(state, 3);

      expect(result.events).toBeDefined();
      expect(result.events!.length).toBeGreaterThan(0);
      const event = result.events![0];
      expect(event.type).toBe('weather_change');
      expect(event.payload.previous).toBe('rainy');
      expect(event.payload.current).toBeDefined();
      expect(event.payload.current).not.toBe('rainy');
    });

    it('updates weather history', () => {
      const state = createInitialState('usa');
      state.weather.current = 'sunny';
      state.weather.ticksUntilChange = 2;
      state.weather.changeInterval = 60;
      state.weather.history = ['rainy', 'overcast'];

      const result = system.update(state, 2);

      const historyMutation = result.mutations!.find(
        (m) => m.path === 'weather.history'
      );
      expect(historyMutation).toBeDefined();
      const history = historyMutation!.value as WeatherCondition[];
      // Previous weather ('sunny') should be appended to history
      expect(history).toContain('sunny');
      expect(history.length).toBe(3);
    });

    it('handles large deltaTicks spanning multiple intervals', () => {
      const state = createInitialState('usa');
      state.weather.current = 'sunny';
      state.weather.ticksUntilChange = 10;
      state.weather.changeInterval = 60;

      // deltaTicks = 130 means: 10 ticks to first transition, then 120 ticks overflow = 2 more intervals
      const result = system.update(state, 130);

      const weatherMutation = result.mutations!.find(
        (m) => m.path === 'weather.current'
      );
      expect(weatherMutation).toBeDefined();
      // The weather changed (multiple transitions happened)
      const validConditions: WeatherCondition[] = ['sunny', 'partly_cloudy', 'overcast', 'rainy'];
      expect(validConditions).toContain(weatherMutation!.value);

      const tickMutation = result.mutations!.find(
        (m) => m.path === 'weather.ticksUntilChange'
      );
      expect(tickMutation).toBeDefined();
      // The new ticks should be within [1, changeInterval]
      expect(tickMutation!.value as number).toBeGreaterThan(0);
      expect(tickMutation!.value as number).toBeLessThanOrEqual(60);
    });
  });

  describe('getCurrentWeather', () => {
    it('returns state.weather.current', () => {
      const state = createInitialState('usa');
      state.weather.current = 'overcast';

      expect(system.getCurrentWeather(state)).toBe('overcast');
    });

    it('returns sunny for initial state', () => {
      const state = createInitialState('usa');
      expect(system.getCurrentWeather(state)).toBe('sunny');
    });
  });

  describe('activeEras', () => {
    it('includes all 7 eras', () => {
      expect(system.activeEras).toHaveLength(7);
      expect(system.activeEras).toContain('fossil');
      expect(system.activeEras).toContain('nuclear');
      expect(system.activeEras).toContain('solar');
      expect(system.activeEras).toContain('orbital');
      expect(system.activeEras).toContain('mars_colonization');
      expect(system.activeEras).toContain('space_mining');
      expect(system.activeEras).toContain('dyson_ring');
    });
  });
});
