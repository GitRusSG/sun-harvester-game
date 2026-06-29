// Core engine: game loop, state manager, event controller, types
export * from './types.js';
export * from './resources.js';
export * from './research.js';
export * from './infrastructure.js';
export * from './opposition.js';
export * from './space.js';
export * from './combat.js';
export * from './country.js';
export * from './education.js';
export * from './weather.js';
export * from './state-manager.js';
export { SaveSystem } from './save-system.js';
export { GameLoop } from './game-loop.js';
export type { RenderCallback } from './game-loop.js';
export { EventController } from './event-controller.js';
export type { EventListener } from './event-controller.js';
