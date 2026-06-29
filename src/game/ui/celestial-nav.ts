import type { Era, GameState } from '../core/types.js';
import { ERA_ORDER } from '../core/state-manager.js';

/**
 * Identifies a celestial body the player can navigate to. These map onto the
 * renderer's spatial scenes (a future 3D backend treats each as a camera
 * target orbiting the Sun; the DOM backend treats them as tabbed panels).
 */
export type CelestialBodyId = 'earth' | 'moon' | 'mars' | 'asteroids' | 'sun';

/**
 * Static definition of a celestial body: display metadata, the era at which
 * it becomes reachable, and an approximate orbital radius used to lay the
 * solar-system overview out for zoom/pan transitions.
 */
export interface CelestialBody {
  id: CelestialBodyId;
  name: string;
  /** Short blurb shown in the navigation UI / tooltips. */
  description: string;
  /** Era at which this body becomes navigable. */
  unlockedByEra: Era;
  /**
   * Relative distance from the Sun (arbitrary scene units). Used by the
   * solar-system overview and the camera-transition framing maths. The Sun
   * sits at the origin (0) and the asteroid belt is farthest out.
   */
  orbitRadius: number;
  /** Relative display radius of the body itself (arbitrary scene units). */
  bodyRadius: number;
  /** Base color used for the body's material / nav accent (hex). */
  color: number;
}

/**
 * Ordered list of celestial bodies, sorted outward from the Sun is not the
 * navigation order — navigation order follows gameplay progression (Earth
 * first), while {@link CelestialBody.orbitRadius} captures spatial layout.
 */
export const CELESTIAL_BODIES: readonly CelestialBody[] = [
  {
    id: 'earth',
    name: 'Earth',
    description: 'Your home world. Manage energy, industry, and global politics.',
    unlockedByEra: 'fossil',
    orbitRadius: 30,
    bodyRadius: 3.2,
    color: 0x2e6fb7,
  },
  {
    id: 'moon',
    name: 'Moon',
    description: 'Orbital staging ground for launches and space-based solar.',
    unlockedByEra: 'orbital',
    orbitRadius: 38,
    bodyRadius: 1.1,
    color: 0xb8b8b8,
  },
  {
    id: 'mars',
    name: 'Mars',
    description: 'The red planet. Low-gravity launches and unique resources.',
    unlockedByEra: 'mars_colonization',
    orbitRadius: 52,
    bodyRadius: 2.1,
    color: 0xc1440e,
  },
  {
    id: 'asteroids',
    name: 'Asteroid Belt',
    description: 'Claim and mine asteroid territories rich in rare materials.',
    unlockedByEra: 'space_mining',
    orbitRadius: 70,
    bodyRadius: 1.6,
    color: 0x8a7f73,
  },
  {
    id: 'sun',
    name: 'Sun',
    description: 'The ultimate prize. Encircle the star with a Dyson Ring.',
    unlockedByEra: 'dyson_ring',
    orbitRadius: 0,
    bodyRadius: 6,
    color: 0xffcc33,
  },
] as const;

/** Look up a celestial body definition by id. */
export function getCelestialBody(id: CelestialBodyId): CelestialBody | undefined {
  return CELESTIAL_BODIES.find((b) => b.id === id);
}

/**
 * Returns true when the given body is reachable in the supplied game state.
 * A body unlocks once the player's current era is at or beyond the body's
 * required era in the canonical {@link ERA_ORDER} sequence.
 */
export function isBodyUnlocked(state: GameState, body: CelestialBody): boolean {
  const currentIndex = ERA_ORDER.indexOf(state.currentEra);
  const requiredIndex = ERA_ORDER.indexOf(body.unlockedByEra);
  if (currentIndex < 0 || requiredIndex < 0) return false;
  return currentIndex >= requiredIndex;
}

/** Returns the list of currently-unlocked celestial bodies. */
export function getUnlockedBodies(state: GameState): CelestialBody[] {
  return CELESTIAL_BODIES.filter((b) => isBodyUnlocked(state, b));
}

/**
 * Listener invoked whenever the active celestial body changes. The previous
 * and next ids are supplied so a renderer can animate a camera transition
 * between them.
 */
export type CelestialChangeListener = (
  next: CelestialBodyId,
  previous: CelestialBodyId,
) => void;

/**
 * Framework-agnostic state machine for celestial-body navigation.
 *
 * Responsibilities (Task 22.1):
 *   - Track which body is currently focused.
 *   - Gate navigation behind era-based unlocks.
 *   - Notify listeners (e.g. a 3D renderer) so they can drive a zoom-out /
 *     pan / zoom-in camera transition between bodies.
 *
 * This class holds no DOM or WebGL references, so it is reused by both the
 * DOM and Three.js renderers and is unit-testable in isolation.
 */
export class CelestialNavigator {
  private active: CelestialBodyId = 'earth';
  private readonly listeners = new Set<CelestialChangeListener>();
  private latestState: GameState | null = null;

  /** Currently focused celestial body. */
  getActive(): CelestialBodyId {
    return this.active;
  }

  /**
   * Feed the latest game state so the navigator can answer unlock queries
   * without the caller having to thread state through every method.
   */
  updateState(state: GameState): void {
    this.latestState = state;
  }

  /** Whether the given body is currently navigable. */
  canNavigateTo(id: CelestialBodyId): boolean {
    const body = getCelestialBody(id);
    if (!body) return false;
    if (!this.latestState) return id === 'earth';
    return isBodyUnlocked(this.latestState, body);
  }

  /**
   * Attempt to focus a celestial body. Returns false (and does nothing) when
   * the body is locked or already active. On success, listeners are notified
   * with both the new and previous ids so they can animate the transition.
   */
  navigateTo(id: CelestialBodyId): boolean {
    if (id === this.active) return false;
    if (!this.canNavigateTo(id)) return false;

    const previous = this.active;
    this.active = id;
    for (const listener of this.listeners) {
      listener(id, previous);
    }
    return true;
  }

  /** Subscribe to active-body changes. Returns an unsubscribe function. */
  onChange(listener: CelestialChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
