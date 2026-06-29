import * as THREE from 'three';
import {
  CELESTIAL_BODIES,
  getCelestialBody,
  type CelestialBody,
  type CelestialBodyId,
} from '../celestial-nav.js';

/** Easing for camera transitions: smooth ease-in-out (cubic). */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface BodyVisual {
  body: CelestialBody;
  /** Group positioned at the body's world location. */
  group: THREE.Group;
  /** The body mesh itself (sphere). */
  mesh: THREE.Mesh;
  /** Marker container for surface features (panels, mines, territories). */
  markers: THREE.Group;
  /** World-space position of the body's center. */
  position: THREE.Vector3;
}

/** A simple marker placed on a body's surface (infrastructure, territory). */
export interface SurfaceMarker {
  /** Latitude in degrees (-90..90). */
  lat: number;
  /** Longitude in degrees (-180..180). */
  lon: number;
  /** Marker color (hex). */
  color: number;
  /** Optional label used for hit-testing / tooltips later. */
  label?: string;
}

interface CameraTransition {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  /** Elapsed seconds. */
  elapsed: number;
  /** Total duration in seconds. */
  duration: number;
  /** Whether to arc the camera outward (solar-system overview) mid-flight. */
  arc: boolean;
}

/**
 * Self-contained Three.js solar-system scene.
 *
 * Renders the Sun at the origin, each celestial body on its orbit, a starfield
 * backdrop, and supports animated zoom-out / pan / zoom-in camera transitions
 * between bodies (Task 22.4). Earth is rendered with surface markers
 * (Task 22.2); Moon/Mars/asteroids/Sun get their own framing (Task 22.3).
 *
 * The scene owns no game logic — it exposes imperative methods the renderer
 * calls in response to state changes and navigation events.
 */
export class SolarScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly bodies = new Map<CelestialBodyId, BodyVisual>();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly dysonRing: THREE.Group;
  private dysonSegmentMeshes: THREE.Mesh[] = [];

  private transition: CameraTransition | null = null;
  private focused: CelestialBodyId = 'earth';
  private animationHandle: number | null = null;
  private lastFrameTime = 0;
  private readonly container: HTMLElement;
  private readonly resizeObserver: ResizeObserver;

  // Pointer-drag orbit controls (lightweight, no external dep).
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private orbitYaw = 0;
  private orbitPitch = 0.35;
  private orbitDistanceScale = 1;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      50,
      (container.clientWidth || 800) / (container.clientHeight || 600),
      0.1,
      2000,
    );

    this.scene.background = new THREE.Color(0x05070f);
    this.scene.add(this.buildStarfield());
    this.scene.add(this.buildLights());

    // Sun glow at the origin.
    this.scene.add(this.buildSun());

    // Build each non-sun body on its orbit.
    for (const body of CELESTIAL_BODIES) {
      if (body.id === 'sun') continue;
      this.addBody(body);
    }

    // Dyson ring lives around the Sun; hidden until segments exist.
    this.dysonRing = new THREE.Group();
    this.scene.add(this.dysonRing);

    // Earth markers demo container already created in addBody.
    this.focusImmediate('earth');

    this.attachControls();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.start();
  }

  // ---------- public API ----------

  /** Animate a camera transition from the current body to `id`. */
  focusBody(id: CelestialBodyId): void {
    const target = this.bodyWorldPosition(id);
    const body = getCelestialBody(id);
    const distance = this.framingDistance(body);

    const desiredPos = this.orbitCameraPosition(target, distance);

    this.transition = {
      fromPos: this.camera.position.clone(),
      toPos: desiredPos,
      fromTarget: this.cameraTarget.clone(),
      toTarget: target.clone(),
      elapsed: 0,
      // Longer hops (e.g. Earth -> Sun) get a slightly longer flight.
      duration: 1.5,
      arc: true,
    };
    this.focused = id;
  }

  /** Snap the camera to a body with no animation (used on init). */
  focusImmediate(id: CelestialBodyId): void {
    const target = this.bodyWorldPosition(id);
    const body = getCelestialBody(id);
    const distance = this.framingDistance(body);
    this.cameraTarget.copy(target);
    this.camera.position.copy(this.orbitCameraPosition(target, distance));
    this.camera.lookAt(this.cameraTarget);
    this.focused = id;
  }

  /**
   * Replace the surface markers on a body (e.g. Earth's solar panels / mines,
   * or asteroid territories). Markers are placed on the body's surface using
   * lat/lon spherical coordinates.
   */
  setBodyMarkers(id: CelestialBodyId, markers: SurfaceMarker[]): void {
    const visual = this.bodies.get(id);
    if (!visual) return;
    visual.markers.clear();

    const radius = visual.body.bodyRadius * 1.02;
    for (const marker of markers) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(visual.body.bodyRadius * 0.06, 8, 8),
        new THREE.MeshBasicMaterial({ color: marker.color }),
      );
      const phi = THREE.MathUtils.degToRad(90 - marker.lat);
      const theta = THREE.MathUtils.degToRad(marker.lon + 180);
      dot.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      );
      visual.markers.add(dot);
    }
  }

  /**
   * Update the Dyson ring visualization around the Sun. `completed` segments
   * are rendered as solid glowing arcs; the rest are dim wireframe arcs.
   */
  setDysonProgress(completedSegments: number, totalSegments: number): void {
    // Rebuild only when the segment count changes shape.
    if (this.dysonSegmentMeshes.length !== totalSegments) {
      this.dysonRing.clear();
      this.dysonSegmentMeshes = [];
      const sun = getCelestialBody('sun')!;
      const ringRadius = sun.bodyRadius * 2.2;
      const segmentArc = (Math.PI * 2) / Math.max(1, totalSegments);
      for (let i = 0; i < totalSegments; i++) {
        const geometry = new THREE.TorusGeometry(
          ringRadius,
          0.35,
          8,
          24,
          segmentArc * 0.85,
        );
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: 0x444a55,
            emissive: 0x000000,
            metalness: 0.6,
            roughness: 0.4,
          }),
        );
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = segmentArc * i;
        this.dysonRing.add(mesh);
        this.dysonSegmentMeshes.push(mesh);
      }
    }

    // Apply completion styling.
    this.dysonSegmentMeshes.forEach((mesh, i) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (i < completedSegments) {
        mat.color.set(0xffcc33);
        mat.emissive.set(0xaa7711);
      } else {
        mat.color.set(0x444a55);
        mat.emissive.set(0x000000);
      }
      mat.needsUpdate = true;
    });
  }

  /** Resize the renderer/camera to the current container size. */
  handleResize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Stop the render loop and release GPU resources. */
  dispose(): void {
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
    this.resizeObserver.disconnect();
    this.detachControls();
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const material = obj.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material.dispose();
        }
      }
    });
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  // ---------- scene construction ----------

  private buildStarfield(): THREE.Points {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribute on a large sphere shell around the scene.
      const r = 600 + Math.random() * 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.85,
    });
    return new THREE.Points(geometry, material);
  }

  private buildLights(): THREE.Group {
    const group = new THREE.Group();
    // The Sun is the primary light source at the origin.
    const sunLight = new THREE.PointLight(0xffffff, 2.4, 0, 0.4);
    sunLight.position.set(0, 0, 0);
    group.add(sunLight);
    // Faint ambient so night sides are not pure black.
    group.add(new THREE.AmbientLight(0x404a5a, 0.6));
    return group;
  }

  private buildSun(): THREE.Group {
    const group = new THREE.Group();
    const sun = getCelestialBody('sun')!;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(sun.bodyRadius, 48, 48),
      new THREE.MeshBasicMaterial({ color: sun.color }),
    );
    group.add(core);
    // Glow shell.
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(sun.bodyRadius * 1.35, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 0.18,
      }),
    );
    group.add(glow);

    // Register the sun as a (marker-less) navigable body for framing maths.
    this.bodies.set('sun', {
      body: sun,
      group,
      mesh: core,
      markers: new THREE.Group(),
      position: new THREE.Vector3(0, 0, 0),
    });
    return group;
  }

  private addBody(body: CelestialBody): void {
    const group = new THREE.Group();

    // Position the body on its orbit. Spread bodies around the ring so they
    // do not all line up (purely cosmetic).
    const angle = (CELESTIAL_BODIES.indexOf(body) / CELESTIAL_BODIES.length) * Math.PI * 2;
    const position = new THREE.Vector3(
      Math.cos(angle) * body.orbitRadius,
      0,
      Math.sin(angle) * body.orbitRadius,
    );
    group.position.copy(position);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(body.bodyRadius, 40, 40),
      new THREE.MeshStandardMaterial({
        color: body.color,
        roughness: 0.85,
        metalness: 0.05,
      }),
    );
    group.add(mesh);

    const markers = new THREE.Group();
    group.add(markers);

    // Faint orbit ring to hint at the spatial layout.
    const orbit = new THREE.Mesh(
      new THREE.RingGeometry(body.orbitRadius - 0.05, body.orbitRadius + 0.05, 128),
      new THREE.MeshBasicMaterial({
        color: 0x223044,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      }),
    );
    orbit.rotation.x = Math.PI / 2;
    this.scene.add(orbit);

    this.scene.add(group);
    this.bodies.set(body.id, { body, group, mesh, markers, position });
  }

  // ---------- camera framing ----------

  private bodyWorldPosition(id: CelestialBodyId): THREE.Vector3 {
    return this.bodies.get(id)?.position.clone() ?? new THREE.Vector3();
  }

  private framingDistance(body: CelestialBody | undefined): number {
    const radius = body?.bodyRadius ?? 3;
    // Frame the body comfortably; clamp for very small/large bodies.
    return THREE.MathUtils.clamp(radius * 4.5, 8, 40) * this.orbitDistanceScale;
  }

  private orbitCameraPosition(target: THREE.Vector3, distance: number): THREE.Vector3 {
    const offset = new THREE.Vector3(
      Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch),
      Math.sin(this.orbitPitch),
      Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch),
    ).multiplyScalar(distance);
    return target.clone().add(offset);
  }

  // ---------- controls ----------

  private attachControls(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private detachControls(): void {
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerUp);
    el.removeEventListener('wheel', this.onWheel);
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || this.transition) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.orbitYaw -= dx * 0.005;
    this.orbitPitch = THREE.MathUtils.clamp(
      this.orbitPitch - dy * 0.005,
      -1.2,
      1.2,
    );
  };

  private readonly onPointerUp = (): void => {
    this.dragging = false;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (this.transition) return;
    this.orbitDistanceScale = THREE.MathUtils.clamp(
      this.orbitDistanceScale + (e.deltaY > 0 ? 0.1 : -0.1),
      0.5,
      2.5,
    );
  };

  // ---------- render loop ----------

  private start(): void {
    this.lastFrameTime = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
      this.lastFrameTime = now;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.animationHandle = requestAnimationFrame(loop);
    };
    this.animationHandle = requestAnimationFrame(loop);
  }

  private update(dt: number): void {
    // Gentle idle spin on each body for life.
    for (const visual of this.bodies.values()) {
      visual.mesh.rotation.y += dt * 0.15;
    }
    this.dysonRing.rotation.z += dt * 0.05;

    if (this.transition) {
      this.advanceTransition(dt);
    } else {
      // Keep the camera framed on the focused body, applying live orbit input.
      const target = this.bodyWorldPosition(this.focused);
      const body = getCelestialBody(this.focused);
      const distance = this.framingDistance(body);
      this.cameraTarget.lerp(target, 0.2);
      const desired = this.orbitCameraPosition(target, distance);
      this.camera.position.lerp(desired, 0.15);
      this.camera.lookAt(this.cameraTarget);
    }
  }

  private advanceTransition(dt: number): void {
    const t = this.transition;
    if (!t) return;
    t.elapsed += dt;
    const raw = Math.min(t.elapsed / t.duration, 1);
    const eased = easeInOutCubic(raw);

    // Position: lerp, with an optional outward arc that pulls the camera back
    // toward a "solar-system overview" at the midpoint before zooming in.
    const pos = t.fromPos.clone().lerp(t.toPos, eased);
    if (t.arc) {
      const arcLift = Math.sin(raw * Math.PI); // 0 -> 1 -> 0
      const outward = pos.clone().normalize().multiplyScalar(arcLift * 22);
      pos.add(outward);
      pos.y += arcLift * 10;
    }
    this.camera.position.copy(pos);

    this.cameraTarget.copy(t.fromTarget.clone().lerp(t.toTarget, eased));
    this.camera.lookAt(this.cameraTarget);

    if (raw >= 1) {
      this.transition = null;
    }
  }
}
