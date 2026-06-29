// UI layer: renderer, notifications, tooltips, panels.
//
// All UI surfaces are accessed through the Renderer interface so the
// underlying graphics backend (DOM today, Three.js or WebGPU later) can be
// swapped without touching game logic.

export type {
  Renderer,
  NotificationType,
  SceneId,
  DialogContent,
} from './renderer-interface.js';
export { NotificationSystem, NOTIFICATION_DISMISS_MS } from './notifications.js';
export { TooltipSystem } from './tooltips.js';
export { DomRenderer } from './renderer-dom.js';
export { ThreeRenderer } from './renderer-three.js';
export {
  CelestialNavigator,
  CELESTIAL_BODIES,
  getCelestialBody,
  getUnlockedBodies,
  isBodyUnlocked,
} from './celestial-nav.js';
export type {
  CelestialBody,
  CelestialBodyId,
  CelestialChangeListener,
} from './celestial-nav.js';
export { SolarScene } from './three/solar-scene.js';
export type { SurfaceMarker } from './three/solar-scene.js';
export { TutorialController, TUTORIAL_STEPS } from './tutorial.js';
export type { TutorialStep } from './tutorial.js';
