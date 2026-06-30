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
  private elapsedTime = 0;
  private sunGlow: THREE.Mesh | null = null;
  private starfield: THREE.Points | null = null;

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
  private dragMoved = false;

  /** Callback fired when a celestial body is clicked. */
  private onBodyClick: ((id: CelestialBodyId) => void) | null = null;

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
    this.starfield = this.buildStarfield();
    this.scene.add(this.starfield);
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

  /** Set a callback that fires when the player clicks a celestial body. */
  setBodyClickHandler(handler: (id: CelestialBodyId) => void): void {
    this.onBodyClick = handler;
  }

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
    this.sunGlow = glow;

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
      new THREE.SphereGeometry(body.bodyRadius, 64, 64),
      this.createBodyMaterial(body),
    );
    group.add(mesh);

    // Atmosphere shell for Earth.
    if (body.id === 'earth') {
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(body.bodyRadius * 1.025, 48, 48),
        new THREE.MeshBasicMaterial({
          color: 0x88bbff,
          transparent: true,
          opacity: 0.12,
          side: THREE.FrontSide,
        }),
      );
      group.add(atmo);

      // Animated cloud layer (rotates slightly faster than Earth).
      const cloudTexture = this.generateCloudTexture();
      const cloudMat = new THREE.MeshBasicMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.45,
        side: THREE.FrontSide,
        depthWrite: false,
      });
      // Upgrade to a real cloud texture (public domain), keep procedural fallback.
      new THREE.TextureLoader().load(
        `${import.meta.env.BASE_URL}earth-clouds.jpg`,
        (tex) => {
          cloudMat.map = tex;
          cloudMat.alphaMap = tex;
          cloudMat.opacity = 0.5;
          cloudMat.needsUpdate = true;
        },
        undefined,
        () => { /* keep procedural clouds on error */ },
      );
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(body.bodyRadius * 1.015, 48, 48),
        cloudMat,
      );
      clouds.name = 'earth_clouds';
      group.add(clouds);
    }

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

  /**
   * Creates an appropriate material for a celestial body. Earth and Moon get
   * procedurally-generated textures for a realistic look; others use flat color.
   */
  private createBodyMaterial(body: CelestialBody): THREE.Material {
    if (body.id === 'earth') {
      const material = new THREE.MeshStandardMaterial({
        map: this.generateEarthTexture(), // instant procedural fallback
        roughness: 0.85,
        metalness: 0.0,
      });
      // Upgrade to a real NASA "Blue Marble" texture from the public three.js
      // examples repo. If the network load fails, the procedural map remains.
      this.loadRealEarthTextures(material);
      return material;
    }
    if (body.id === 'moon') {
      const material = new THREE.MeshStandardMaterial({
        map: this.generateMoonTexture(),
        roughness: 0.95,
        metalness: 0.0,
      });
      new THREE.TextureLoader().load(
        `${import.meta.env.BASE_URL}moon-texture.jpg`,
        (tex) => { tex.colorSpace = THREE.SRGBColorSpace; material.map = tex; material.needsUpdate = true; },
        undefined,
        () => { /* keep procedural fallback */ },
      );
      return material;
    }
    if (body.id === 'mars') {
      const material = new THREE.MeshStandardMaterial({
        map: this.generateMarsTexture(),
        roughness: 0.92,
        metalness: 0.0,
      });
      new THREE.TextureLoader().load(
        `${import.meta.env.BASE_URL}mars-texture.jpg`,
        (tex) => { tex.colorSpace = THREE.SRGBColorSpace; material.map = tex; material.needsUpdate = true; },
        undefined,
        () => { /* keep procedural fallback */ },
      );
      return material;
    }
    return new THREE.MeshStandardMaterial({
      color: body.color,
      roughness: 0.85,
      metalness: 0.05,
    });
  }

  /**
   * Asynchronously loads real Earth textures (color + specular) from the
   * public three.js examples repository (NASA Blue Marble imagery). Applies
   * them to the given material once loaded; silently keeps the procedural
   * fallback if the network request fails.
   */
  private loadRealEarthTextures(material: THREE.MeshStandardMaterial): void {
    const loader = new THREE.TextureLoader();

    // Bundled with the app (public/) so there's no CORS or CDN dependency.
    const COLOR_URL = `${import.meta.env.BASE_URL}earth-texture.jpg`;

    loader.load(
      COLOR_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        material.map = tex;
        material.needsUpdate = true;
      },
      undefined,
      () => { /* keep procedural fallback on error */ },
    );
  }

  /**
   * Procedurally generates a simple Earth-like texture using canvas.
   * Draws oceans (blue), continents (green/brown), ice caps (white).
   */
  private generateEarthTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d')!;

    // Ocean base.
    ctx.fillStyle = '#1a5276';
    ctx.fillRect(0, 0, size, size / 2);

    // Simplified continent shapes using noise-like blobs.
    const continents = [
      { x: 0.25, y: 0.35, w: 0.12, h: 0.25, color: '#2e7d32' }, // South America-ish
      { x: 0.2, y: 0.2, w: 0.08, h: 0.12, color: '#33691e' },   // North America-ish
      { x: 0.47, y: 0.2, w: 0.1, h: 0.2, color: '#558b2f' },    // Europe/Africa-ish
      { x: 0.5, y: 0.35, w: 0.08, h: 0.18, color: '#6d4c41' },  // Africa south
      { x: 0.65, y: 0.25, w: 0.15, h: 0.15, color: '#4e342e' }, // Asia
      { x: 0.75, y: 0.4, w: 0.1, h: 0.08, color: '#795548' },   // Australia-ish
      { x: 0.55, y: 0.18, w: 0.08, h: 0.08, color: '#689f38' }, // India-ish
    ];

    for (const c of continents) {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.ellipse(
        c.x * size, c.y * (size / 2),
        c.w * size * 0.5, c.h * (size / 2) * 0.5,
        0, 0, Math.PI * 2,
      );
      ctx.fill();
      // Add some internal detail blobs.
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = `hsl(${80 + Math.random() * 40}, ${40 + Math.random() * 30}%, ${25 + Math.random() * 20}%)`;
        ctx.beginPath();
        ctx.ellipse(
          (c.x + (Math.random() - 0.5) * c.w * 0.6) * size,
          (c.y + (Math.random() - 0.5) * c.h * 0.6) * (size / 2),
          c.w * size * 0.15, c.h * (size / 2) * 0.15,
          Math.random() * Math.PI, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    }

    // Ice caps.
    const gradient = ctx.createLinearGradient(0, 0, 0, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.08, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.92, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.7)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size / 2);

    // Some cloud wisps.
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * size,
        Math.random() * size / 2,
        20 + Math.random() * 60,
        5 + Math.random() * 15,
        Math.random() * Math.PI, 0, Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Procedurally generates a Moon-like texture (grey with craters).
   */
  private generateMoonTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d')!;

    // Base grey.
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(0, 0, size, size / 2);

    // Craters.
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size / 2;
      const r = 2 + Math.random() * 12;
      const shade = 60 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // Lighter rim.
      ctx.strokeStyle = `rgb(${shade + 30},${shade + 30},${shade + 30})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Procedurally generates a Mars-like texture (red/orange with darker patches).
   */
  private generateMarsTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d')!;

    // Base rust.
    ctx.fillStyle = '#c1440e';
    ctx.fillRect(0, 0, size, size / 2);

    // Darker surface features.
    for (let i = 0; i < 40; i++) {
      const shade = Math.random() > 0.5 ? '#8b2500' : '#a0522d';
      ctx.fillStyle = shade;
      ctx.globalAlpha = 0.4 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * size,
        Math.random() * size / 2,
        10 + Math.random() * 30,
        8 + Math.random() * 20,
        Math.random() * Math.PI, 0, Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Polar ice.
    const gradient = ctx.createLinearGradient(0, 0, 0, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(0.06, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.94, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Procedurally generates a cloud texture (white wisps on transparent background).
   */
  private generateCloudTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d')!;

    // Transparent background.
    ctx.clearRect(0, 0, size, size / 2);

    // Draw cloud bands and wisps.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 50; i++) {
      ctx.globalAlpha = 0.15 + Math.random() * 0.35;
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * size,
        Math.random() * size / 2,
        15 + Math.random() * 80,
        4 + Math.random() * 20,
        Math.random() * Math.PI * 0.3,
        0, Math.PI * 2,
      );
      ctx.fill();
    }

    // Larger cloud masses.
    for (let i = 0; i < 12; i++) {
      ctx.globalAlpha = 0.2 + Math.random() * 0.25;
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * size,
        Math.random() * size / 2,
        40 + Math.random() * 100,
        15 + Math.random() * 40,
        Math.random() * Math.PI,
        0, Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
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
    this.dragMoved = false;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || this.transition) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.dragMoved = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.orbitYaw -= dx * 0.005;
    this.orbitPitch = THREE.MathUtils.clamp(
      this.orbitPitch - dy * 0.005,
      -1.2,
      1.2,
    );
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.dragging && !this.dragMoved && this.onBodyClick) {
      // It was a click, not a drag — check if a body was hit.
      this.handleBodyClick(e);
    }
    this.dragging = false;
    this.dragMoved = false;
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

  /** Raycast from pointer position to find clicked bodies. */
  private handleBodyClick(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // Collect all body meshes for intersection test.
    const meshes: Array<{ mesh: THREE.Mesh; id: CelestialBodyId }> = [];
    for (const [id, visual] of this.bodies) {
      meshes.push({ mesh: visual.mesh, id });
    }

    const intersects = raycaster.intersectObjects(meshes.map((m) => m.mesh));
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const hit = meshes.find((m) => m.mesh === hitMesh);
      if (hit && this.onBodyClick) {
        this.onBodyClick(hit.id);
      }
    }
  }

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
    this.elapsedTime += dt;

    // Gentle idle spin on each body for life. Different speeds per body.
    let bodyIndex = 0;
    for (const visual of this.bodies.values()) {
      const speed = visual.body.id === 'sun' ? 0.05 : 0.1 + bodyIndex * 0.02;
      visual.mesh.rotation.y += dt * speed;

      // Rotate Earth's cloud layer faster than the surface.
      if (visual.body.id === 'earth') {
        const clouds = visual.group.getObjectByName('earth_clouds');
        if (clouds) clouds.rotation.y += dt * 0.18;
      }

      bodyIndex++;
    }

    // Dyson ring counter-rotation.
    this.dysonRing.rotation.z += dt * 0.08;

    // Sun pulse: scale the glow shell subtly.
    if (this.sunGlow) {
      const pulse = 1 + Math.sin(this.elapsedTime * 1.5) * 0.04;
      this.sunGlow.scale.setScalar(pulse);
    }

    // Starfield slow drift for parallax.
    if (this.starfield) {
      this.starfield.rotation.y += dt * 0.005;
    }

    if (this.transition) {
      this.advanceTransition(dt);
    } else {
      // Keep the camera framed on the focused body, applying live orbit input.
      const target = this.bodyWorldPosition(this.focused);
      const body = getCelestialBody(this.focused);
      const distance = this.framingDistance(body);
      this.cameraTarget.lerp(target, 0.12);
      const desired = this.orbitCameraPosition(target, distance);
      this.camera.position.lerp(desired, 0.08);
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
