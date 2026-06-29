import { describe, it, expect, vi } from 'vitest';
import { EventController } from '../../../../src/game/core/event-controller.js';
import type { GameEvent } from '../../../../src/game/core/types.js';

function createEvent(type: GameEvent['type'], payload: Record<string, unknown> = {}): GameEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    timestamp: Date.now(),
  };
}

describe('EventController', () => {
  describe('enqueue', () => {
    it('should add events to the queue', () => {
      const controller = new EventController();
      const event = createEvent('weather_change', { condition: 'rainy' });

      controller.enqueue([event]);

      const queue = controller.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]).toEqual(event);
    });

    it('should accumulate multiple enqueued batches', () => {
      const controller = new EventController();
      const event1 = createEvent('weather_change');
      const event2 = createEvent('research_complete');

      controller.enqueue([event1]);
      controller.enqueue([event2]);

      const queue = controller.getQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0]).toEqual(event1);
      expect(queue[1]).toEqual(event2);
    });

    it('should handle enqueuing multiple events in a single call', () => {
      const controller = new EventController();
      const events = [
        createEvent('era_unlock'),
        createEvent('crafting_complete'),
        createEvent('victory'),
      ];

      controller.enqueue(events);

      expect(controller.getQueue()).toHaveLength(3);
    });
  });

  describe('drain', () => {
    it('should return all queued events', () => {
      const controller = new EventController();
      const event1 = createEvent('weather_change');
      const event2 = createEvent('protest');

      controller.enqueue([event1, event2]);

      const drained = controller.drain();
      expect(drained).toHaveLength(2);
      expect(drained[0]).toEqual(event1);
      expect(drained[1]).toEqual(event2);
    });

    it('should clear the queue after draining', () => {
      const controller = new EventController();
      controller.enqueue([createEvent('weather_change')]);

      controller.drain();

      expect(controller.getQueue()).toHaveLength(0);
    });

    it('should return an empty array when queue is already empty', () => {
      const controller = new EventController();
      const drained = controller.drain();
      expect(drained).toEqual([]);
    });
  });

  describe('getQueue', () => {
    it('should return a copy of events without clearing the queue', () => {
      const controller = new EventController();
      const event = createEvent('research_complete');
      controller.enqueue([event]);

      const firstRead = controller.getQueue();
      const secondRead = controller.getQueue();

      // Queue is not cleared
      expect(firstRead).toHaveLength(1);
      expect(secondRead).toHaveLength(1);
    });

    it('should return a copy that does not mutate the internal queue', () => {
      const controller = new EventController();
      const event = createEvent('weather_change');
      controller.enqueue([event]);

      const copy = controller.getQueue();
      copy.push(createEvent('protest'));

      // Internal queue should be unaffected
      expect(controller.getQueue()).toHaveLength(1);
    });
  });

  describe('subscribe', () => {
    it('should register a listener', () => {
      const controller = new EventController();
      const listener = vi.fn();

      controller.subscribe(listener);

      const event = createEvent('era_unlock');
      controller.enqueue([event]);
      controller.dispatch();

      expect(listener).toHaveBeenCalledWith(event);
    });
  });

  describe('unsubscribe', () => {
    it('should remove a listener so it is no longer called', () => {
      const controller = new EventController();
      const listener = vi.fn();

      controller.subscribe(listener);
      controller.unsubscribe(listener);

      controller.enqueue([createEvent('weather_change')]);
      controller.dispatch();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not affect other listeners when one is removed', () => {
      const controller = new EventController();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      controller.subscribe(listener1);
      controller.subscribe(listener2);
      controller.unsubscribe(listener1);

      const event = createEvent('protest');
      controller.enqueue([event]);
      controller.dispatch();

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith(event);
    });
  });

  describe('dispatch', () => {
    it('should call all listeners for each event in order', () => {
      const controller = new EventController();
      const received: string[] = [];
      const listener = (event: GameEvent) => {
        received.push(event.type);
      };

      controller.subscribe(listener);

      const events = [
        createEvent('weather_change'),
        createEvent('research_complete'),
        createEvent('era_unlock'),
      ];
      controller.enqueue(events);
      controller.dispatch();

      expect(received).toEqual(['weather_change', 'research_complete', 'era_unlock']);
    });

    it('should clear the queue after processing', () => {
      const controller = new EventController();
      controller.subscribe(vi.fn());

      controller.enqueue([createEvent('protest'), createEvent('un_attack')]);
      controller.dispatch();

      expect(controller.getQueue()).toHaveLength(0);
    });

    it('should do nothing if queue is empty', () => {
      const controller = new EventController();
      const listener = vi.fn();
      controller.subscribe(listener);

      controller.dispatch();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('era_unlock events', () => {
    it('should dispatch era_unlock events to listeners', () => {
      const controller = new EventController();
      const unlockedEras: string[] = [];

      // Listener that watches specifically for era_unlock events
      const eraUnlockListener = (event: GameEvent) => {
        if (event.type === 'era_unlock') {
          unlockedEras.push(event.payload.era as string);
        }
      };

      controller.subscribe(eraUnlockListener);

      controller.enqueue([
        createEvent('weather_change', { condition: 'sunny' }),
        createEvent('era_unlock', { era: 'nuclear' }),
        createEvent('research_complete', { nodeId: 'node-1' }),
        createEvent('era_unlock', { era: 'solar' }),
      ]);

      controller.dispatch();

      expect(unlockedEras).toEqual(['nuclear', 'solar']);
    });
  });

  describe('multiple subscribers', () => {
    it('should notify all subscribers for each event', () => {
      const controller = new EventController();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      controller.subscribe(listener1);
      controller.subscribe(listener2);
      controller.subscribe(listener3);

      const event = createEvent('victory', { score: 100 });
      controller.enqueue([event]);
      controller.dispatch();

      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
      expect(listener3).toHaveBeenCalledWith(event);
    });

    it('should call each subscriber once per event with multiple events', () => {
      const controller = new EventController();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      controller.subscribe(listener1);
      controller.subscribe(listener2);

      controller.enqueue([
        createEvent('weather_change'),
        createEvent('protest'),
      ]);
      controller.dispatch();

      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(2);
    });
  });
});
