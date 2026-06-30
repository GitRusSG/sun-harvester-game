/**
 * Interactive SVG world map.
 *
 * Loads the CC BY-SA 3.0 ISO-tagged world map (public/world-map.svg) once,
 * caches the parsed SVG, and can be mounted into a host element on every
 * panel render (the Earth panel rebuilds its innerHTML each tick). Each
 * playable country is colored by ownership status and is clickable.
 *
 * Map source: "Simple World Map" by Al MacDonald, editor Fritz Lekschas,
 * licensed CC BY-SA 3.0. Attribution is surfaced in the game's settings panel.
 *
 * Country groups in the SVG are keyed by lowercase ISO 3166-1 alpha-2 ids
 * (e.g. "us", "cn"). We map our internal CountryId values onto those ids.
 */
import type { CountryId, GameState } from '../core/types.js';
import { getAllCountryIds } from '../data/countries.js';

/** Maps internal CountryId -> lowercase ISO 3166-1 alpha-2 code used in the SVG. */
export const COUNTRY_ISO: Record<CountryId, string> = {
  usa: 'us',
  china: 'cn',
  russia: 'ru',
  india: 'in',
  germany: 'de',
  japan: 'jp',
  uk: 'gb',
  france: 'fr',
  south_korea: 'kr',
  brazil: 'br',
};

/** Reverse lookup: ISO code -> CountryId. */
const ISO_TO_COUNTRY: Record<string, CountryId> = Object.fromEntries(
  getAllCountryIds().map((id) => [COUNTRY_ISO[id], id]),
) as Record<string, CountryId>;

/** Ownership categories that drive country fill color. */
export type CountryStatus = 'player' | 'controlled' | 'influenced' | 'hostile';

/** Resolved URL for the SVG asset (respects Vite base path). */
const MAP_URL = `${import.meta.env.BASE_URL}world-map.svg`;

export type CountryClickHandler = (country: CountryId) => void;

/**
 * Loads and renders an interactive SVG world map. A single instance is reused
 * across renders: `mount(host, state)` injects a fresh clone of the cached SVG
 * into the given host and recolors it. The expensive fetch+parse happens once.
 */
export class WorldMap {
  private template: SVGSVGElement | null = null;
  private mountedSvg: SVGSVGElement | null = null;
  private currentHost: HTMLElement | null = null;
  private onCountryClick: CountryClickHandler = () => {};
  private loadPromise: Promise<void> | null = null;

  setCountryClickHandler(handler: CountryClickHandler): void {
    this.onCountryClick = handler;
  }

  /**
   * Mount the map into a host element and color it for the given state.
   * Triggers a one-time async load if needed; on first load it shows a
   * lightweight placeholder, then injects the SVG when ready.
   */
  mount(host: HTMLElement, state: GameState): void {
    this.currentHost = host;

    if (this.template) {
      this.injectInto(host, state);
      return;
    }

    host.innerHTML = '<p class="gs-muted">Loading world map…</p>';
    void this.load().then(() => {
      // Only inject if this host is still the active one.
      if (this.currentHost === host && this.template) {
        this.injectInto(host, state);
      }
    });
  }

  /** Recolor the currently mounted map (no-op if not mounted). */
  update(state: GameState): void {
    if (this.mountedSvg) this.colorCountries(this.mountedSvg, state);
  }

  /** Fetches and parses the SVG once, caching it as a template node. */
  private load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      const res = await fetch(MAP_URL);
      if (!res.ok) throw new Error(`Failed to load world map: ${res.status}`);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) throw new Error('World map SVG had no <svg> root');

      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('class', 'gs-svgmap');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      this.template = svg as unknown as SVGSVGElement;
    })().catch((err) => {
      if (this.currentHost) {
        this.currentHost.innerHTML = `<p class="gs-muted">World map failed to load: ${
          err instanceof Error ? err.message : String(err)
        }</p>`;
      }
      // Allow a later retry.
      this.loadPromise = null;
      throw err;
    });
    return this.loadPromise;
  }

  /** Clone the cached SVG into the host, wire interactivity, and color it. */
  private injectInto(host: HTMLElement, state: GameState): void {
    if (!this.template) return;
    const clone = host.ownerDocument.importNode(this.template, true) as unknown as SVGSVGElement;

    for (const id of getAllCountryIds()) {
      const iso = COUNTRY_ISO[id];
      // Countries can be <g> groups or standalone <path> elements.
      const el = clone.querySelector<SVGElement>(`#${CSS.escape(iso)}`);
      if (!el) continue;
      el.classList.add('gs-svgmap-country');
      el.setAttribute('data-country', id);
    }

    clone.addEventListener('click', (e) => {
      const el = (e.target as Element).closest<SVGElement>('.gs-svgmap-country');
      if (!el) return;
      const country = el.getAttribute('data-country') as CountryId | null;
      if (country) this.onCountryClick(country);
    });

    host.innerHTML = '';
    host.appendChild(clone);
    this.mountedSvg = clone;
    this.colorCountries(clone, state);
  }

  /** Applies a data-status attribute to each playable country for CSS coloring. */
  private colorCountries(svg: SVGSVGElement, state: GameState): void {
    const controlled = new Set(state.political.installedPoliticians);
    for (const id of getAllCountryIds()) {
      const el = svg.querySelector<SVGElement>(`#${CSS.escape(COUNTRY_ISO[id])}`);
      if (!el) continue;

      let status: CountryStatus;
      if (id === state.country) status = 'player';
      else if (controlled.has(id)) status = 'controlled';
      else if ((state.political.influence[id] ?? 0) > 30) status = 'influenced';
      else status = 'hostile';

      el.setAttribute('data-status', status);
    }
  }

  /** Returns the CountryId for an ISO code, if it is a playable country. */
  static countryFromIso(iso: string): CountryId | undefined {
    return ISO_TO_COUNTRY[iso.toLowerCase()];
  }
}
