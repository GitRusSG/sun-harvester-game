import type { NotificationType } from './renderer-interface.js';

/**
 * Default auto-dismiss duration in milliseconds.
 * Spec Requirement 10.5: notifications auto-dismiss after 5 seconds.
 */
export const NOTIFICATION_DISMISS_MS = 5000;

/**
 * Non-blocking notification system.
 *
 * Renders short status messages in an absolutely-positioned container that
 * does not steal focus or block input. Each notification:
 *
 *   - is announced to screen readers via an ARIA live region (`polite`),
 *   - is keyboard-dismissible (click/Enter on the close button),
 *   - auto-dismisses after {@link NOTIFICATION_DISMISS_MS} milliseconds,
 *   - uses color tokens that meet WCAG 2.1 AA contrast (4.5:1 minimum).
 *
 * Lifecycle:
 *   1. `attach(container)` — creates the live region in the provided parent.
 *   2. `show(message, type?)` — enqueues a notification element.
 *   3. `clear()` — removes all pending notifications immediately.
 *   4. `detach()` — removes the live region and clears all timers.
 */
export class NotificationSystem {
  private root: HTMLElement | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  /** Attach the notification region to the given container. */
  attach(container: HTMLElement): void {
    if (this.root) {
      this.detach();
    }

    const root = document.createElement('div');
    root.className = 'shg-notifications';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Notifications');
    // Polite live region: screen readers announce new messages without
    // interrupting the user's current task.
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'false');

    container.appendChild(root);
    this.root = root;
  }

  /** Show a notification message with the given severity. */
  show(message: string, type: NotificationType = 'info'): void {
    if (!this.root) {
      // Fail silently if not attached — the renderer is responsible for
      // wiring this system up. We don't want a stray notification call to
      // crash the simulation loop.
      return;
    }

    const note = document.createElement('div');
    note.className = `shg-notification shg-notification--${type}`;
    note.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const text = document.createElement('span');
    text.className = 'shg-notification__text';
    text.textContent = message;
    note.appendChild(text);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'shg-notification__close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = '×';
    close.addEventListener('click', () => this.dismiss(note));
    note.appendChild(close);

    this.root.appendChild(note);

    const timer = setTimeout(() => this.dismiss(note), NOTIFICATION_DISMISS_MS);
    this.timers.add(timer);
  }

  /** Dismiss all currently visible notifications immediately. */
  clear(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    if (this.root) {
      this.root.replaceChildren();
    }
  }

  /** Remove the notification region from the DOM and clear all timers. */
  detach(): void {
    this.clear();
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
  }

  private dismiss(note: HTMLElement): void {
    if (note.parentNode) {
      note.parentNode.removeChild(note);
    }
  }
}
