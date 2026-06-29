import type { GameEvent } from './types.js';

/**
 * Listener callback type for game events.
 */
export type EventListener = (event: GameEvent) => void;

/**
 * The EventController manages a queue of GameEvent objects produced by system updates.
 *
 * Usage within the game loop:
 * 1. After all systems call update(), their StateUpdate.events are collected.
 * 2. Events are enqueued via `enqueue()`.
 * 3. `dispatch()` is called to notify all subscribers (e.g., the UI notification system).
 *
 * Era-unlock events can be handled by subscribers that activate new systems
 * when they receive an event with type === 'era_unlock'.
 */
export class EventController {
  private queue: GameEvent[] = [];
  private listeners: EventListener[] = [];

  /**
   * Adds one or more events to the internal queue.
   */
  enqueue(events: GameEvent[]): void {
    for (const event of events) {
      this.queue.push(event);
    }
  }

  /**
   * Returns all queued events and clears the queue.
   */
  drain(): GameEvent[] {
    const drained = this.queue.slice();
    this.queue = [];
    return drained;
  }

  /**
   * Returns a read-only copy of the current event queue.
   */
  getQueue(): GameEvent[] {
    return this.queue.slice();
  }

  /**
   * Registers a listener that will be called for each event during dispatch.
   */
  subscribe(listener: EventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Removes a previously registered listener.
   */
  unsubscribe(listener: EventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Processes all queued events by calling every registered listener for each event,
   * then clears the queue.
   *
   * This is the primary integration point with the UI notification system:
   * subscribers listening for specific event types (e.g., 'era_unlock') can
   * trigger notifications, activate new systems, or perform other side effects.
   */
  dispatch(): void {
    const events = this.drain();
    for (const event of events) {
      for (const listener of this.listeners) {
        listener(event);
      }
    }
  }
}
