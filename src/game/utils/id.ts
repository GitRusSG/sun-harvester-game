/**
 * Generate a unique string ID.
 * Uses crypto.randomUUID() when available, falls back to a timestamp + random approach.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
