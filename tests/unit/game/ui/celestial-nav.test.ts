import { describe, it, expect } from 'vitest';
import {
  CELESTIAL_BODIES,
  CelestialNavigator,
  getCelestialBody,
  getUnlockedBodies,
  isBodyUnlocked,
} from '../../../../src/game/ui/celestial-nav.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import type { GameState } from '../../../../src/game/core/types.js';

function stateInEra(era: GameState['currentEra']): GameState {
  const state = createInitialState('usa');
  state.currentEra = era;
  return state;
}

describe('celestial body data', () => {
  it('defines all five celestial bodies', () => {
    const ids = CELESTIAL_BODIES.map((b) => b.id);
    expect(ids).toEqual(['earth', 'moon', 'mars', 'asteroids', 'sun']);
  });

  it('looks up bodies by id', () => {
    expect(getCelestialBody('mars')?.name).toBe('Mars');
    expect(getCelestialBody('nope' as never)).toBeUndefined();
  });
});

describe('isBodyUnlocked', () => {
  it('unlocks Earth from the start (fossil era)', () => {
    const state = stateInEra('fossil');
    expect(isBodyUnlocked(state, getCelestialBody('earth')!)).toBe(true);
  });

  it('keeps the Moon locked until the orbital era', () => {
    expect(isBodyUnlocked(stateInEra('solar'), getCelestialBody('moon')!)).toBe(false);
    expect(isBodyUnlocked(stateInEra('orbital'), getCelestialBody('moon')!)).toBe(true);
  });

  it('keeps the Sun locked until the dyson ring era', () => {
    expect(isBodyUnlocked(stateInEra('space_mining'), getCelestialBody('sun')!)).toBe(false);
    expect(isBodyUnlocked(stateInEra('dyson_ring'), getCelestialBody('sun')!)).toBe(true);
  });
});

describe('getUnlockedBodies', () => {
  it('returns only Earth in the fossil era', () => {
    const unlocked = getUnlockedBodies(stateInEra('fossil')).map((b) => b.id);
    expect(unlocked).toEqual(['earth']);
  });

  it('returns all bodies in the dyson ring era', () => {
    const unlocked = getUnlockedBodies(stateInEra('dyson_ring')).map((b) => b.id);
    expect(unlocked).toEqual(['earth', 'moon', 'mars', 'asteroids', 'sun']);
  });
});

describe('CelestialNavigator', () => {
  it('defaults to Earth', () => {
    const nav = new CelestialNavigator();
    expect(nav.getActive()).toBe('earth');
  });

  it('blocks navigation to locked bodies', () => {
    const nav = new CelestialNavigator();
    nav.updateState(stateInEra('fossil'));
    expect(nav.navigateTo('mars')).toBe(false);
    expect(nav.getActive()).toBe('earth');
  });

  it('allows navigation to unlocked bodies and notifies listeners', () => {
    const nav = new CelestialNavigator();
    nav.updateState(stateInEra('mars_colonization'));

    const transitions: Array<[string, string]> = [];
    nav.onChange((next, prev) => transitions.push([prev, next]));

    expect(nav.navigateTo('mars')).toBe(true);
    expect(nav.getActive()).toBe('mars');
    expect(transitions).toEqual([['earth', 'mars']]);
  });

  it('ignores navigation to the already-active body', () => {
    const nav = new CelestialNavigator();
    nav.updateState(stateInEra('dyson_ring'));
    let calls = 0;
    nav.onChange(() => { calls += 1; });
    expect(nav.navigateTo('earth')).toBe(false);
    expect(calls).toBe(0);
  });

  it('unsubscribes listeners', () => {
    const nav = new CelestialNavigator();
    nav.updateState(stateInEra('orbital'));
    let calls = 0;
    const off = nav.onChange(() => { calls += 1; });
    off();
    nav.navigateTo('moon');
    expect(calls).toBe(0);
  });

  it('canNavigateTo reflects era unlocks', () => {
    const nav = new CelestialNavigator();
    nav.updateState(stateInEra('space_mining'));
    expect(nav.canNavigateTo('asteroids')).toBe(true);
    expect(nav.canNavigateTo('sun')).toBe(false);
  });
});
