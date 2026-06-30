/**
 * Commands & Caps Configuration
 * 
 * Controls upgrade caps, infinite unlock thresholds, and build limits.
 * Once a player reaches the specified era, certain limits are removed.
 */

import type { Era } from '../core/types.js';

// ─── Infinite Unlock Era ─────────────────────────────────────────────────────
// Once the player reaches this era, queue size becomes unlimited and
// build times are instant (1 tick). Set to null to disable.
export const INFINITE_UNLOCK_ERA: Era | null = 'dyson_ring';

// ─── Build Queue Caps ────────────────────────────────────────────────────────
// Max queue size a player can upgrade to (before infinite unlock).
export const MAX_QUEUE_SIZE = 20;

// Max build speed multiplier (before infinite unlock). e.g. 5.0 = 5× speed.
export const MAX_BUILD_SPEED = 5.0;

// ─── Upgrade Caps ────────────────────────────────────────────────────────────
// Max knowledge speed multiplier.
export const MAX_KNOWLEDGE_SPEED = 100000.0;

// Max research speed multiplier.
export const MAX_RESEARCH_SPEED = 1000.0;

// Max craft speed multiplier.
export const MAX_CRAFT_SPEED = 10.0;

// Max protest suppression level.
export const MAX_PROTEST_SUPPRESSION = 100;

// Max morale retainment level (reduces morale decay). 0 = no cap.
export const MAX_MORALE_RETAINMENT = 0;

// Pay off protesters cost multiplier (base cost × UN hostility).
export const PAYOFF_PROTESTERS_BASE_COST = 5000;

// ─── Instant Build (applies when infinite unlocked) ──────────────────────────
// Build time in ticks when infinite mode is active. 1 = completes next tick.
export const INSTANT_BUILD_TICKS = 1;

// Queue size when infinite mode is active. Infinity means no limit.
export const INFINITE_QUEUE_SIZE = 999;

// ─── Time Warp ───────────────────────────────────────────────────────────────
// Cost to purchase the time warp ability (one-time unlock, then togglable).
export const TIMEWARP_COST = 500000;

// How many simulation ticks run per real second when time warp is active.
// Normal = 1 tick/sec. Timewarp = TIMEWARP_SPEED ticks/sec.
export const TIMEWARP_SPEED = 5;

// ─── Helper ──────────────────────────────────────────────────────────────────

const ERA_RANK: Record<Era, number> = {
  fossil: 0,
  nuclear: 1,
  solar: 2,
  orbital: 3,
  mars_colonization: 4,
  space_mining: 5,
  dyson_ring: 6,
};

/**
 * Returns true if the player's current era is at or past the infinite unlock era.
 */
export function isInfiniteUnlocked(currentEra: Era): boolean {
  if (!INFINITE_UNLOCK_ERA) return false;
  return ERA_RANK[currentEra] >= ERA_RANK[INFINITE_UNLOCK_ERA];
}
