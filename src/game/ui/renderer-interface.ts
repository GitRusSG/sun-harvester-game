import type { CountryId, GameState } from '../core/types.js';
import type { Quiz } from '../core/education.js';

/**
 * Notification severity levels.
 *
 * Used by the renderer's `showNotification` method and the underlying
 * notification system. Each level maps to a distinct visual style while
 * preserving WCAG 2.1 AA color contrast against its background.
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Identifies a "scene" or top-level view the renderer can display.
 *
 * The DOM renderer treats these as tab-style panels. A future Three.js or
 * WebGPU backend can interpret them as camera targets / 3D viewports
 * without any change to game logic.
 */
export type SceneId =
  | 'earth'
  | 'moon'
  | 'mars'
  | 'asteroids'
  | 'sun'
  | 'dashboard'
  | 'tech'
  | 'crafting'
  | 'world'
  | 'settings';

/**
 * Content payload for an interactive dialog (educational fact, quiz, prompt).
 *
 * Dialogs are modal and intended for content that requires the player's
 * attention. Use `showNotification` for non-blocking messages instead.
 */
export interface DialogContent {
  /** Headline shown at the top of the dialog. */
  title: string;
  /** Body copy; may contain plain text or pre-formatted educational facts. */
  body: string;
  /**
   * Optional list of buttons. If omitted, a default "Close" button is shown.
   * Each option's `action` callback fires when the player selects it; the
   * dialog is automatically dismissed after the action runs.
   */
  options?: Array<{ label: string; action: () => void }>;
}

/**
 * Abstract rendering contract for the Sun Harvester UI layer.
 *
 * The renderer is intentionally backend-agnostic: the default implementation
 * (`DomRenderer`) uses semantic HTML and CSS, but the same contract can be
 * fulfilled by a Three.js, Pixi.js, or WebGPU backend without touching any
 * game-logic code. Swap renderers by changing a single import in `main.ts`.
 *
 * Lifecycle:
 *   1. `init(container)` — set up the root DOM/canvas inside `container`.
 *   2. `render(state)` — called on every frame (or whenever state changes)
 *      with the current immutable `GameState`. Renderers should diff and
 *      patch rather than rebuild from scratch.
 *   3. `setScene(scene)` — switch which view is currently visible.
 *   4. `showNotification` / `showDialog` — surface transient UI affordances.
 *   5. `destroy()` — release listeners, timers, and DOM nodes.
 */
export interface Renderer {
  /** Initialize the renderer and attach it to the given container element. */
  init(container: HTMLElement): void;

  /** Render the current game state. Safe to call on every animation frame. */
  render(state: GameState): void;

  /** Show a non-blocking notification (auto-dismisses after ~5 seconds). */
  showNotification(message: string, type?: NotificationType): void;

  /** Display a modal dialog with educational content or a quiz. */
  showDialog(content: DialogContent): void;

  /** Switch to a specific scene/view (earth, moon, mars, sun, etc.). */
  setScene(scene: SceneId): void;

  /**
   * Display the country-selection screen, replacing the main UI until the
   * player picks a starting nation. The callback fires with the chosen
   * country id; the renderer is responsible for tearing down the selection
   * UI before the main loop renders for the first time.
   */
  showCountrySelection(onSelect: (country: CountryId) => void): void;

  /**
   * Display a non-interactive educational fact in a modal dialog with a
   * single dismiss button. Equivalent to {@link Renderer.showDialog} with
   * a pre-formatted title and body, but kept as a first-class affordance
   * so backends can specialize the presentation if desired.
   */
  showFact(content: string, topic: string): void;

  /**
   * Display a multiple-choice quiz in a modal dialog. The `onAnswer`
   * callback receives the zero-based index of the option the player
   * selected. The dialog is dismissed automatically after the callback
   * runs so that result feedback can be shown via a follow-up dialog or
   * notification.
   */
  showQuiz(quiz: Quiz, onAnswer: (index: number) => void): void;

  /** Tear down all DOM nodes, listeners, and timers owned by this renderer. */
  destroy(): void;
}
