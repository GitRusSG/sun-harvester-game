import type { CountryId, GameState } from '../core/types.js';
import type { Quiz } from '../core/education.js';
import type {
  DialogContent,
  NotificationType,
  Renderer,
  SceneId,
} from './renderer-interface.js';
import { DomRenderer } from './renderer-dom.js';
import {
  CelestialNavigator,
  type CelestialBodyId,
} from './celestial-nav.js';
import { SolarScene, type SurfaceMarker } from './three/solar-scene.js';

/** Scenes that are rendered in 3D rather than as flat DOM panels. */
const SPATIAL_SCENES: ReadonlySet<SceneId> = new Set<SceneId>([
  'earth',
  'moon',
  'mars',
  'asteroids',
  'sun',
]);

function isSpatialScene(scene: SceneId): scene is CelestialBodyId {
  return SPATIAL_SCENES.has(scene);
}

/**
 * Three.js rendering backend.
 *
 * This renderer fulfils the same {@link Renderer} contract as `DomRenderer`,
 * so the game loop is unchanged when swapping backends. It composes a
 * `DomRenderer` for all 2D concerns (HUD panels, notifications, dialogs,
 * country selection, quizzes) and layers a WebGL solar-system scene on top
 * for the spatial scenes (Earth, Moon, Mars, asteroids, Sun).
 *
 * Spatial navigation is driven by {@link CelestialNavigator}; selecting a
 * spatial scene triggers an animated zoom-out / pan / zoom-in camera flight
 * to the chosen body (Task 22.4).
 */
export class ThreeRenderer implements Renderer {
  private readonly dom = new DomRenderer();
  private readonly navigator = new CelestialNavigator();
  private scene: SolarScene | null = null;
  private overlay: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private currentScene: SceneId = 'dashboard';

  init(container: HTMLElement): void {
    this.container = container;

    // The DOM renderer builds the full HUD (header, nav tabs, panels).
    this.dom.init(container);

    // A floating 3D overlay sits above the spatial panels' content area.
    const overlay = document.createElement('div');
    overlay.className = 'shg-three-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    container.appendChild(overlay);
    this.overlay = overlay;

    this.scene = new SolarScene(overlay);

    // When a celestial body is clicked in 3D, navigate to its corresponding panel.
    // Earth click → World (political map), Moon → Moon panel, etc.
    this.scene.setBodyClickHandler((id) => {
      if (id === 'earth') {
        this.setScene('world');
      } else {
        this.setScene(id);
      }
    });

    // Bridge navigator -> scene camera transitions.
    this.navigator.onChange((next) => {
      this.scene?.focusBody(next);
    });

    // Bridge the DOM nav tab clicks to the navigator for spatial scenes.
    // The DomRenderer dispatches no event for tab changes, so we observe the
    // scene buttons via the shared container click handler.
    container.addEventListener('click', this.onContainerClick, true);
  }

  render(state: GameState): void {
    this.dom.render(state);
    this.navigator.updateState(state);

    if (!this.scene) return;

    // Push spatial data into the 3D scene.
    this.scene.setBodyMarkers('earth', this.earthMarkers(state));
    this.scene.setBodyMarkers('asteroids', this.asteroidMarkers(state));
    this.scene.setDysonProgress(
      state.dyson.completedSegments,
      state.dyson.totalSegments || 5,
    );
  }

  showNotification(message: string, type: NotificationType = 'info'): void {
    this.dom.showNotification(message, type);
  }

  showDialog(content: DialogContent): void {
    this.dom.showDialog(content);
  }

  showFact(content: string, topic: string): void {
    this.dom.showFact(content, topic);
  }

  showQuiz(quiz: Quiz, onAnswer: (index: number) => void): void {
    this.dom.showQuiz(quiz, onAnswer);
  }

  showCountrySelection(onSelect: (country: CountryId) => void): void {
    // Hide the 3D overlay while the selection screen is up.
    if (this.overlay) this.overlay.hidden = true;
    this.dom.showCountrySelection(onSelect);
  }

  setScene(scene: SceneId): void {
    this.currentScene = scene;
    this.dom.setScene(scene);

    if (isSpatialScene(scene)) {
      this.showOverlayForScene(scene);
      // Drive the camera. navigateTo no-ops if locked or already active.
      if (!this.navigator.navigateTo(scene)) {
        // Already active or locked — ensure camera is framed correctly.
        this.scene?.focusBody(scene);
      }
    } else if (this.overlay) {
      this.overlay.hidden = true;
      this.overlay.setAttribute('aria-hidden', 'true');
    }
  }

  destroy(): void {
    if (this.container) {
      this.container.removeEventListener('click', this.onContainerClick, true);
    }
    this.scene?.dispose();
    this.scene = null;
    if (this.overlay?.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.dom.destroy();
  }

  // ---------- internals ----------

  /**
   * Position the 3D overlay over the active spatial panel's body so the WebGL
   * canvas appears as a banner above that panel's textual content.
   */
  private showOverlayForScene(scene: SceneId): void {
    if (!this.overlay || !this.container) return;
    const panel = this.container.querySelector<HTMLElement>(`#shg-panel-${scene}`);
    if (!panel) return;

    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    const host = body ?? panel;
    // Insert the overlay as the first child of the panel body so it sits
    // above the textual cards the DomRenderer produced.
    if (this.overlay.parentNode !== host) {
      host.insertBefore(this.overlay, host.firstChild);
    }
    this.overlay.hidden = false;
    this.overlay.setAttribute('aria-hidden', 'false');
    // The container may have resized while hidden; re-fit on next frame.
    requestAnimationFrame(() => this.scene?.handleResize());
  }

  private readonly onContainerClick = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tab = target.closest<HTMLElement>('.shg-nav__tab');
    if (!tab) return;
    const id = tab.id.replace('shg-tab-', '') as SceneId;
    if (id && id !== this.currentScene) {
      // setScene is also called by the DomRenderer's own handler; calling it
      // here keeps the navigator/camera in sync. It is idempotent.
      this.setScene(id);
    }
  };

  /**
   * Build Earth surface markers from the player's infrastructure. Solar panels,
   * mines, and power plants are scattered deterministically by id hash so the
   * same infrastructure lands in the same spot each render.
   */
  private earthMarkers(state: GameState): SurfaceMarker[] {
    const markers: SurfaceMarker[] = [];
    for (const panel of state.energy.solarPanels) {
      markers.push({ ...this.hashToLatLon(panel.id), color: 0xfbbf24, label: 'Solar panel' });
    }
    for (const plant of state.energy.powerPlants) {
      const color = plant.type === 'nuclear' ? 0x86efac : 0x94a3b8;
      markers.push({ ...this.hashToLatLon(plant.id), color, label: `${plant.type} plant` });
    }
    for (const mine of state.infrastructure.mines) {
      markers.push({ ...this.hashToLatLon(mine.id), color: 0xc1440e, label: 'Mine' });
    }
    return markers;
  }

  /** Build asteroid-belt markers from claimed territories. */
  private asteroidMarkers(state: GameState): SurfaceMarker[] {
    return state.space.territories.map((t) => ({
      ...this.hashToLatLon(t.id),
      color: t.surveyed ? 0x86efac : 0x8a7f73,
      label: t.name,
    }));
  }

  /** Deterministically map an id string to a lat/lon on a sphere. */
  private hashToLatLon(id: string): { lat: number; lon: number } {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    const a = Math.abs(hash);
    const lat = ((a % 180) - 90) * 0.9; // keep away from poles
    const lon = ((Math.floor(a / 180) % 360) - 180);
    return { lat, lon };
  }
}
