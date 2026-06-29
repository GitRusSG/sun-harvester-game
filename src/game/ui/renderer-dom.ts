import type { GameState, Era, CountryId } from '../core/types.js';
import type { MaterialType } from '../core/resources.js';
import type { WeatherCondition } from '../core/weather.js';
import type { TechTreeId, TechNode } from '../core/research.js';
import type { Quiz } from '../core/education.js';
import type { InfluenceMethod } from '../core/opposition.js';
import { WEATHER_MODIFIERS } from '../core/weather.js';
import { ERA_ORDER } from '../core/state-manager.js';
import { getEraDefinition } from '../data/eras.js';
import { getTreeNodes, calculateSynergies, SYNERGY_RULES } from '../data/tech-trees.js';
import { RECIPES, getRecipeById } from '../data/recipes.js';
import { COUNTRY_PROFILES, getAllCountryIds } from '../data/countries.js';
import { formatNumber } from '../utils/format.js';
import type {
  DialogContent,
  NotificationType,
  Renderer,
  SceneId,
} from './renderer-interface.js';
import { NotificationSystem } from './notifications.js';
import { TooltipSystem } from './tooltips.js';

/** Friendly emoji icons for each weather condition. */
const WEATHER_ICONS: Record<WeatherCondition, string> = {
  sunny: '☀️',
  partly_cloudy: '⛅',
  overcast: '☁️',
  rainy: '🌧️',
};

/** Friendly labels for weather conditions. */
const WEATHER_LABELS: Record<WeatherCondition, string> = {
  sunny: 'Sunny',
  partly_cloudy: 'Partly Cloudy',
  overcast: 'Overcast',
  rainy: 'Rainy',
};

/** Materials surfaced on the dashboard at a glance. */
const DASHBOARD_MATERIALS: MaterialType[] = [
  'coal',
  'iron_ore',
  'silicon',
  'copper',
  'uranium',
  'steel',
  'electronics',
];

/** Human-readable names for material types shown on the dashboard. */
const MATERIAL_LABELS: Partial<Record<MaterialType, string>> = {
  coal: 'Coal',
  iron_ore: 'Iron Ore',
  silicon: 'Silicon',
  copper: 'Copper',
  uranium: 'Uranium',
  steel: 'Steel',
  electronics: 'Electronics',
};

/** All scenes the DOM renderer knows how to display. */
const SCENE_IDS: readonly SceneId[] = [
  'dashboard',
  'tech',
  'crafting',
  'world',
  'earth',
  'moon',
  'mars',
  'asteroids',
  'sun',
  'settings',
];

/** Human-readable labels for each scene's nav button. */
const SCENE_LABELS: Record<SceneId, string> = {
  dashboard: 'Dashboard',
  tech: 'Research',
  crafting: 'Crafting',
  world: 'World',
  earth: 'Earth',
  moon: 'Moon',
  mars: 'Mars',
  asteroids: 'Asteroid Belt',
  sun: 'Sun',
  settings: 'Settings',
};

/** Tech tree tabs displayed inside the Research scene. */
const TECH_TREE_IDS: readonly TechTreeId[] = [
  'energy',
  'materials',
  'weapons',
  'political',
  'space',
];

const TECH_TREE_LABELS: Record<TechTreeId, string> = {
  energy: 'Energy',
  materials: 'Materials',
  weapons: 'Weapons',
  political: 'Political',
  space: 'Space',
};

/** Friendly labels for material types referenced across panels. */
const MATERIAL_TYPE_LABELS: Partial<Record<MaterialType, string>> = {
  coal: 'Coal',
  iron_ore: 'Iron Ore',
  silicon: 'Silicon',
  copper: 'Copper',
  uranium: 'Uranium',
  steel: 'Steel',
  electronics: 'Electronics',
  solar_cells: 'Solar Cells',
  fuel_rods: 'Fuel Rods',
  rare_earth: 'Rare Earth',
  advanced_circuits: 'Advanced Circuits',
  water: 'Water',
  fuel: 'Fuel',
  regolith_iron: 'Regolith Iron',
  martian_ice: 'Martian Ice',
  co2: 'CO₂',
};

function formatMaterial(material: MaterialType): string {
  return MATERIAL_TYPE_LABELS[material] ?? material;
}

/** Friendly labels for political influence investment methods. */
const INFLUENCE_METHOD_LABELS: Record<InfluenceMethod, string> = {
  economic_aid: 'Economic Aid',
  propaganda: 'Propaganda',
  corporate_infiltration: 'Corporate Infiltration',
  intelligence: 'Intelligence',
};

/** Tooltip text describing each influence method. */
const INFLUENCE_METHOD_TOOLTIPS: Record<InfluenceMethod, string> = {
  economic_aid: 'Slow, low-risk influence growth (+0.5/tick).',
  propaganda: 'Quiet media influence (+0.3/tick).',
  corporate_infiltration: 'Higher-risk corporate takeover (+0.8/tick).',
  intelligence: 'Aggressive covert influence (+1.0/tick).',
};

/** Default currency invested per influence action. */
const DEFAULT_INFLUENCE_INVESTMENT = 100;

/** Threshold above which a politician is automatically installed. */
const INFLUENCE_INSTALL_THRESHOLD = 75;

/** Number of countries needed for World Domination. */
const WORLD_DOMINATION_TARGET = 5;

/**
 * Default DOM-based implementation of the {@link Renderer} contract.
 *
 * This renderer prioritizes functional structure and accessibility over
 * visual polish: semantic HTML5 landmarks (`<header>`, `<main>`, `<nav>`),
 * ARIA labels on all interactive elements, full keyboard support, and color
 * tokens that satisfy WCAG 2.1 AA contrast.
 *
 * The renderer is intentionally simple so it can serve as a baseline before
 * a 3D upgrade (Three.js, WebGPU). Game logic depends only on the
 * `Renderer` interface, so swapping backends is a single import change.
 */
export class DomRenderer implements Renderer {
  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private scenePanels = new Map<SceneId, HTMLElement>();
  private sceneButtons = new Map<SceneId, HTMLButtonElement>();
  private currentScene: SceneId = 'dashboard';

  /** Currently selected tech tree tab inside the Research scene. */
  private currentTechTree: TechTreeId = 'energy';

  /** Latest state used by per-scene event handlers (e.g., tab switches). */
  private lastState: GameState | null = null;

  /**
   * Active country-selection callback, if the renderer is currently showing
   * the country-selection screen. While set, the main UI is replaced by the
   * selection screen and `render()` is a no-op.
   */
  private countrySelectionRoot: HTMLElement | null = null;
  private countrySelectionResolve: ((country: CountryId) => void) | null = null;

  private readonly notifications = new NotificationSystem();
  private readonly tooltips = new TooltipSystem();

  // Modal dialog state.
  private dialogOverlay: HTMLElement | null = null;
  private previousFocus: HTMLElement | null = null;
  private readonly onDialogKeydown = (e: KeyboardEvent): void =>
    this.handleDialogKeydown(e);

  /** Build the root DOM structure and attach subsystems. */
  init(container: HTMLElement): void {
    if (this.root) {
      this.destroy();
    }

    this.container = container;
    container.replaceChildren();

    const root = document.createElement('div');
    root.className = 'shg-root';

    root.appendChild(this.buildHeader());
    root.appendChild(this.buildNav());
    root.appendChild(this.buildMain());

    container.appendChild(root);
    this.root = root;

    this.notifications.attach(container);
    this.tooltips.attach(container);

    this.setScene(this.currentScene);
  }

  /**
   * Render the current game state into the active scene panel.
   *
   * This implementation does a coarse-grained re-render of each panel on
   * every call. Game logic never reads from the DOM, so the renderer is
   * free to choose whatever update strategy fits the backend.
   */
  render(state: GameState): void {
    if (!this.root) return;
    // While the country-selection screen is up, suppress dashboard renders so
    // the placeholder pre-game state does not flash behind the modal screen.
    if (this.countrySelectionRoot) return;
    this.lastState = state;

    // Only render the currently visible panel to avoid destroying buttons
    // with event listeners on inactive panels.
    switch (this.currentScene) {
      case 'dashboard': this.renderDashboard(state); break;
      case 'tech': this.renderTechTree(state); break;
      case 'crafting': this.renderCrafting(state); break;
      case 'world': this.renderWorld(state); break;
      case 'earth': this.renderEarth(state); break;
      case 'moon': this.renderMoon(state); break;
      case 'mars': this.renderMars(state); break;
      case 'asteroids': this.renderAsteroids(state); break;
      case 'sun': this.renderSun(state); break;
      case 'settings': this.renderSettings(state); break;
    }
  }

  showNotification(message: string, type: NotificationType = 'info'): void {
    this.notifications.show(message, type);
  }

  showDialog(content: DialogContent): void {
    this.closeDialog();
    if (!this.container) return;

    this.previousFocus = document.activeElement as HTMLElement | null;

    const overlay = document.createElement('div');
    overlay.className = 'shg-dialog-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeDialog();
    });

    const dialog = document.createElement('div');
    dialog.className = 'shg-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'shg-dialog-title');
    dialog.tabIndex = -1;

    const title = document.createElement('h2');
    title.id = 'shg-dialog-title';
    title.className = 'shg-dialog__title';
    title.textContent = content.title;
    dialog.appendChild(title);

    const body = document.createElement('p');
    body.className = 'shg-dialog__body';
    body.textContent = content.body;
    dialog.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'shg-dialog__actions';
    const options = content.options ?? [
      { label: 'Close', action: () => this.closeDialog() },
    ];
    for (const option of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shg-dialog__button';
      btn.textContent = option.label;
      btn.addEventListener('click', () => {
        // Close the current dialog BEFORE running the action, so that if the
        // action opens a new dialog (e.g. tutorial Next step), it isn't
        // immediately torn down.
        this.closeDialog();
        option.action();
      });
      actions.appendChild(btn);
    }
    dialog.appendChild(actions);

    overlay.appendChild(dialog);
    this.container.appendChild(overlay);
    this.dialogOverlay = overlay;

    document.addEventListener('keydown', this.onDialogKeydown);

    // Focus the first interactive element so keyboard users land inside the
    // dialog immediately.
    const firstButton = actions.querySelector('button');
    if (firstButton instanceof HTMLElement) {
      firstButton.focus();
    } else {
      dialog.focus();
    }
  }

  showFact(content: string, topic: string): void {
    this.showDialog({
      title: `Did you know? — ${topic}`,
      body: content,
      options: [{ label: 'Got it', action: () => {} }],
    });
  }

  showQuiz(quiz: Quiz, onAnswer: (index: number) => void): void {
    this.showDialog({
      title: `Quiz — ${quiz.relatedTopic}`,
      body: quiz.question,
      options: quiz.options.map((option, index) => ({
        label: `${String.fromCharCode(65 + index)}. ${option}`,
        action: () => onAnswer(index),
      })),
    });
  }

  showCountrySelection(onSelect: (country: CountryId) => void): void {
    if (!this.container) return;

    // Tear down any prior selection screen so this call is idempotent.
    this.closeCountrySelection();

    this.countrySelectionResolve = onSelect;

    // Hide the main UI behind the selection screen but keep it mounted so we
    // don't lose subsystem state (notifications, tooltips).
    if (this.root) {
      this.root.style.display = 'none';
    }

    const root = document.createElement('div');
    root.className = 'shg-country-select';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Country selection');

    const heading = document.createElement('h1');
    heading.className = 'shg-country-select__heading';
    heading.textContent = 'Choose Your Nation';
    root.appendChild(heading);

    const intro = document.createElement('p');
    intro.className = 'shg-country-select__intro';
    intro.textContent =
      'Each nation grants unique buffs, starting resources, and a strategic identity. Select the one that fits your playstyle.';
    root.appendChild(intro);

    const grid = document.createElement('ul');
    grid.className = 'shg-country-select__grid';
    grid.setAttribute('role', 'list');

    for (const id of getAllCountryIds()) {
      grid.appendChild(this.buildCountryCard(id));
    }

    root.appendChild(grid);
    this.container.appendChild(root);
    this.countrySelectionRoot = root;

    // Move focus to the first Select button so keyboard users can act
    // immediately.
    const firstButton = grid.querySelector('button');
    if (firstButton instanceof HTMLElement) {
      firstButton.focus();
    }
  }

  setScene(scene: SceneId): void {
    if (!this.scenePanels.size) {
      // init() hasn't run yet; remember the request for after init.
      this.currentScene = scene;
      return;
    }

    this.currentScene = scene;
    for (const [id, panel] of this.scenePanels) {
      const active = id === scene;
      panel.hidden = !active;
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
    for (const [id, button] of this.sceneButtons) {
      const active = id === scene;
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    }
  }

  destroy(): void {
    this.closeDialog();
    this.closeCountrySelection();
    this.notifications.detach();
    this.tooltips.detach();
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.container = null;
    this.scenePanels.clear();
    this.sceneButtons.clear();
  }

  // ---------- private helpers ----------

  private buildHeader(): HTMLElement {
    const header = document.createElement('header');
    header.className = 'shg-header';
    header.setAttribute('role', 'banner');

    const title = document.createElement('h1');
    title.className = 'shg-header__title';
    title.textContent = 'Sun Harvester';
    header.appendChild(title);

    return header;
  }

  private buildNav(): HTMLElement {
    const nav = document.createElement('nav');
    nav.className = 'shg-nav';
    nav.setAttribute('aria-label', 'Scene navigation');

    const tablist = document.createElement('div');
    tablist.className = 'shg-nav__tabs';
    tablist.setAttribute('role', 'tablist');

    for (const id of SCENE_IDS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shg-nav__tab';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', `shg-panel-${id}`);
      btn.setAttribute('aria-selected', id === this.currentScene ? 'true' : 'false');
      btn.setAttribute('data-tooltip', `View ${SCENE_LABELS[id]}`);
      btn.id = `shg-tab-${id}`;
      btn.tabIndex = id === this.currentScene ? 0 : -1;
      btn.textContent = SCENE_LABELS[id];
      btn.addEventListener('click', () => this.setScene(id));
      btn.addEventListener('keydown', (e) => this.handleTabKeydown(e, id));
      tablist.appendChild(btn);
      this.sceneButtons.set(id, btn);
    }

    nav.appendChild(tablist);
    return nav;
  }

  private buildMain(): HTMLElement {
    const main = document.createElement('main');
    main.className = 'shg-main';
    main.setAttribute('role', 'main');

    for (const id of SCENE_IDS) {
      const panel = document.createElement('section');
      panel.className = `shg-panel shg-panel--${id}`;
      panel.id = `shg-panel-${id}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `shg-tab-${id}`);
      panel.hidden = id !== this.currentScene;

      const heading = document.createElement('h2');
      heading.className = 'shg-panel__heading';
      heading.textContent = SCENE_LABELS[id];
      panel.appendChild(heading);

      const body = document.createElement('div');
      body.className = 'shg-panel__body';
      body.dataset.role = 'panel-body';
      panel.appendChild(body);

      main.appendChild(panel);
      this.scenePanels.set(id, panel);
    }

    return main;
  }

  private renderDashboard(state: GameState): void {
    const panel = this.scenePanels.get('dashboard');
    if (!panel) return;
    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    if (!body) return;

    body.replaceChildren();

    body.appendChild(this.buildDashboardHeader(state));

    const grid = document.createElement('div');
    grid.className = 'shg-dashboard__grid';
    grid.appendChild(this.buildResourcesCard(state));
    grid.appendChild(this.buildEnergyCard(state));
    grid.appendChild(this.buildWeatherCard(state));
    grid.appendChild(this.buildEraProgressCard(state));
    grid.appendChild(this.buildMaterialsCard(state));
    grid.appendChild(this.buildActionsCard(state));
    body.appendChild(grid);
  }

  // ---------- dashboard card builders ----------

  private buildDashboardHeader(state: GameState): HTMLElement {
    const header = document.createElement('section');
    header.className = 'shg-dashboard__summary';
    header.setAttribute('aria-label', 'Top-line summary');

    const countryName = state.countryProfile?.name ?? state.country;
    const eraDef = getEraDefinition(state.currentEra);
    const eraName = eraDef?.name ?? state.currentEra;

    header.appendChild(
      this.buildSummaryStat({
        label: 'Currency',
        value: formatNumber(state.resources.currency),
        tooltip: `${state.resources.currency.toFixed(0)} total currency`,
      }),
    );
    header.appendChild(
      this.buildSummaryStat({
        label: 'Knowledge',
        value: formatNumber(state.resources.knowledgePoints),
        tooltip: `${state.resources.knowledgePoints.toFixed(0)} knowledge points`,
      }),
    );
    header.appendChild(
      this.buildSummaryStat({
        label: 'Nation',
        value: countryName,
        tooltip: `Playing as ${countryName} in the ${eraName}`,
      }),
    );
    header.appendChild(
      this.buildSummaryStat({
        label: 'Era',
        value: eraName,
        tooltip: eraDef?.description ?? '',
      }),
    );

    return header;
  }

  private buildSummaryStat(opts: {
    label: string;
    value: string;
    tooltip?: string;
  }): HTMLElement {
    const stat = document.createElement('div');
    stat.className = 'shg-stat';
    if (opts.tooltip) {
      stat.setAttribute('data-tooltip', opts.tooltip);
    }
    stat.setAttribute('role', 'group');
    stat.setAttribute('aria-label', `${opts.label}: ${opts.value}`);

    const label = document.createElement('span');
    label.className = 'shg-stat__label';
    label.textContent = opts.label;
    stat.appendChild(label);

    const value = document.createElement('span');
    value.className = 'shg-stat__value';
    value.textContent = opts.value;
    stat.appendChild(value);

    return stat;
  }

  private buildCard(title: string, ariaLabel?: string): HTMLElement {
    const card = document.createElement('section');
    card.className = 'shg-card';
    card.setAttribute('aria-label', ariaLabel ?? title);

    const heading = document.createElement('h3');
    heading.className = 'shg-card__title';
    heading.textContent = title;
    card.appendChild(heading);

    return card;
  }

  private buildResourcesCard(state: GameState): HTMLElement {
    const card = this.buildCard('Resources');

    const income = state.resources.incomeRate;
    const expense = state.resources.expenseRate;
    const net = income - expense;

    card.appendChild(
      this.buildLineItem({
        label: 'Currency',
        value: formatNumber(state.resources.currency),
        tooltip: 'Total currency on hand',
      }),
    );
    card.appendChild(
      this.buildLineItem({
        label: 'Knowledge',
        value: formatNumber(state.resources.knowledgePoints),
        tooltip: 'Knowledge points used to research new technologies',
      }),
    );
    card.appendChild(
      this.buildLineItem({
        label: 'Income',
        value: `${formatNumber(income)}/s`,
        tone: 'positive',
        tooltip: 'Currency earned per second from energy sales',
      }),
    );
    card.appendChild(
      this.buildLineItem({
        label: 'Expenses',
        value: `${formatNumber(expense)}/s`,
        tone: 'negative',
        tooltip: 'Maintenance costs per second',
      }),
    );
    card.appendChild(
      this.buildLineItem({
        label: 'Net profit',
        value: `${net >= 0 ? '+' : ''}${formatNumber(net)}/s`,
        tone: net >= 0 ? 'positive' : 'negative',
        tooltip: 'Net currency change per second (income minus expenses)',
      }),
    );

    return card;
  }

  private buildEnergyCard(state: GameState): HTMLElement {
    const card = this.buildCard('Energy');

    const stored = Math.max(0, state.energy.stored);
    const maxStorage = Math.max(1, state.energy.maxStorage);
    const pct = Math.min(100, Math.max(0, (stored / maxStorage) * 100));
    const generated = state.energy.generated;
    const weather = state.weather.current;
    const weatherModifier = WEATHER_MODIFIERS[weather];

    // Storage line + progress bar.
    card.appendChild(
      this.buildLineItem({
        label: 'Storage',
        value: `${formatNumber(stored)} / ${formatNumber(maxStorage)}`,
        tooltip: `${pct.toFixed(1)}% of maximum storage`,
      }),
    );

    const barWrap = document.createElement('div');
    barWrap.className = 'shg-bar';
    barWrap.setAttribute('role', 'progressbar');
    barWrap.setAttribute('aria-valuemin', '0');
    barWrap.setAttribute('aria-valuemax', '100');
    barWrap.setAttribute('aria-valuenow', pct.toFixed(0));
    barWrap.setAttribute(
      'aria-label',
      `Energy storage ${pct.toFixed(0)} percent full`,
    );

    const fill = document.createElement('div');
    fill.className = 'shg-bar__fill';
    fill.style.width = `${pct}%`;
    barWrap.appendChild(fill);

    const barLabel = document.createElement('span');
    barLabel.className = 'shg-bar__label';
    barLabel.textContent = `${pct.toFixed(0)}%`;
    barWrap.appendChild(barLabel);

    card.appendChild(barWrap);

    card.appendChild(
      this.buildLineItem({
        label: 'Generation',
        value: `${formatNumber(generated)}/s`,
        tone: generated > 0 ? 'positive' : undefined,
        tooltip: 'Total energy generated per second across all sources',
      }),
    );

    card.appendChild(
      this.buildLineItem({
        label: 'Weather impact',
        value: `${weatherModifier.toFixed(1)}x ${WEATHER_ICONS[weather]}`,
        tooltip: `${WEATHER_LABELS[weather]} reduces solar output to ${(weatherModifier * 100).toFixed(0)}%`,
      }),
    );

    return card;
  }

  private buildWeatherCard(state: GameState): HTMLElement {
    const card = this.buildCard('Weather');

    const current = state.weather.current;
    const modifier = WEATHER_MODIFIERS[current];
    const ticks = Math.max(0, state.weather.ticksUntilChange);

    const banner = document.createElement('div');
    banner.className = 'shg-weather__banner';
    banner.setAttribute(
      'aria-label',
      `Current weather: ${WEATHER_LABELS[current]}`,
    );

    const icon = document.createElement('span');
    icon.className = 'shg-weather__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = WEATHER_ICONS[current];
    banner.appendChild(icon);

    const text = document.createElement('span');
    text.className = 'shg-weather__label';
    text.textContent = WEATHER_LABELS[current];
    banner.appendChild(text);

    card.appendChild(banner);

    card.appendChild(
      this.buildLineItem({
        label: 'Production modifier',
        value: `${modifier.toFixed(1)}x`,
        tooltip: 'Multiplier applied to solar panel output',
      }),
    );
    card.appendChild(
      this.buildLineItem({
        label: 'Next change',
        value: `${formatNumber(ticks)} ticks`,
        tooltip: 'Ticks remaining until weather may change',
      }),
    );

    return card;
  }

  private buildEraProgressCard(state: GameState): HTMLElement {
    const card = this.buildCard('Era Progress');

    const currentEra = state.currentEra;
    const eraDef = getEraDefinition(currentEra);
    const progress = Math.min(
      100,
      Math.max(0, state.eraProgress[currentEra] ?? 0),
    );
    const nextEra = this.getNextEra(currentEra);
    const nextDef = nextEra ? getEraDefinition(nextEra) : null;

    card.appendChild(
      this.buildLineItem({
        label: 'Current era',
        value: eraDef?.name ?? currentEra,
        tooltip: eraDef?.description ?? '',
      }),
    );

    const barWrap = document.createElement('div');
    barWrap.className = 'shg-bar';
    barWrap.setAttribute('role', 'progressbar');
    barWrap.setAttribute('aria-valuemin', '0');
    barWrap.setAttribute('aria-valuemax', '100');
    barWrap.setAttribute('aria-valuenow', progress.toFixed(0));
    barWrap.setAttribute(
      'aria-label',
      `Era progress ${progress.toFixed(0)} percent`,
    );

    const fill = document.createElement('div');
    fill.className = 'shg-bar__fill shg-bar__fill--era';
    fill.style.width = `${progress}%`;
    barWrap.appendChild(fill);

    const barLabel = document.createElement('span');
    barLabel.className = 'shg-bar__label';
    barLabel.textContent = `${progress.toFixed(0)}%`;
    barWrap.appendChild(barLabel);

    card.appendChild(barWrap);

    card.appendChild(
      this.buildLineItem({
        label: 'Next era',
        value: nextDef?.name ?? 'Final era reached',
        tooltip: nextDef?.description ?? 'You have reached the final era',
      }),
    );

    return card;
  }

  private buildMaterialsCard(state: GameState): HTMLElement {
    const card = this.buildCard('Materials');

    const list = document.createElement('ul');
    list.className = 'shg-materials__list';
    list.setAttribute('aria-label', 'Material stockpiles');

    for (const mat of DASHBOARD_MATERIALS) {
      const stock = state.materials.stockpiles[mat] ?? 0;
      const item = document.createElement('li');
      item.className = 'shg-materials__item';
      item.setAttribute(
        'data-tooltip',
        `${stock.toFixed(0)} units in stockpile`,
      );

      const name = document.createElement('span');
      name.className = 'shg-materials__name';
      name.textContent = MATERIAL_LABELS[mat] ?? mat;
      item.appendChild(name);

      const value = document.createElement('span');
      value.className = 'shg-materials__value';
      value.textContent = formatNumber(stock);
      item.appendChild(value);

      list.appendChild(item);
    }

    card.appendChild(list);
    return card;
  }

  private buildActionsCard(state: GameState): HTMLElement {
    const card = this.buildCard('Quick Actions');

    const actions = [
      {
        label: '⚡ Build Coal Plant ($150)',
        tooltip: 'Build a coal power plant. Consumes coal, generates energy.',
        action: { type: 'build_power_plant', payload: { type: 'coal', cost: 150 } },
        disabled: state.resources.currency < 150,
      },
      {
        label: '☀️ Build Solar Panel ($100)',
        tooltip: 'Build a solar panel. Output varies with weather.',
        action: { type: 'build_solar_panel', payload: { locationId: 'arizona', cost: 100 } },
        disabled: state.resources.currency < 100,
      },
      {
        label: '⛏️ Build Coal Mine ($80)',
        tooltip: 'Mine coal for power plant fuel.',
        action: { type: 'build_mine', payload: { materialType: 'coal', cost: 80, depositQuality: 0.7 } },
        disabled: state.resources.currency < 80,
      },
      {
        label: '⛏️ Build Iron Mine ($80)',
        tooltip: 'Mine iron ore for steel production.',
        action: { type: 'build_mine', payload: { materialType: 'iron_ore', cost: 80, depositQuality: 0.6 } },
        disabled: state.resources.currency < 80,
      },
      {
        label: '🏭 Build Distribution ($200)',
        tooltip: 'Increases energy-to-revenue conversion rate.',
        action: { type: 'build_distribution_network', payload: { cost: 200 } },
        disabled: state.resources.currency < 200,
      },
      {
        label: '🔫 Build Weapons Factory',
        tooltip: 'Produces conventional arms to defend against the UN.',
        action: { type: 'build_weapons_factory', payload: { producing: 'conventional' } },
        disabled: false,
      },
    ];

    const grid = document.createElement('div');
    grid.className = 'shg-actions__grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Build actions');

    for (const item of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shg-actions__button';
      btn.textContent = item.label;
      btn.disabled = item.disabled;
      btn.setAttribute('data-tooltip', item.tooltip);
      btn.addEventListener('click', () => {
        this.dispatchAction(item.action);
      });
      grid.appendChild(btn);
    }

    card.appendChild(grid);
    return card;
  }

  private buildLineItem(opts: {
    label: string;
    value: string;
    tone?: 'positive' | 'negative';
    tooltip?: string;
  }): HTMLElement {
    const row = document.createElement('div');
    row.className = 'shg-line';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `${opts.label}: ${opts.value}`);
    if (opts.tooltip) {
      row.setAttribute('data-tooltip', opts.tooltip);
    }

    const label = document.createElement('span');
    label.className = 'shg-line__label';
    label.textContent = opts.label;
    row.appendChild(label);

    const value = document.createElement('span');
    value.className = 'shg-line__value';
    if (opts.tone === 'positive') value.classList.add('shg-line__value--positive');
    if (opts.tone === 'negative') value.classList.add('shg-line__value--negative');
    value.textContent = opts.value;
    row.appendChild(value);

    return row;
  }

  // ---------- tech tree panel ----------

  /**
   * Render the Research scene: five tech-tree tabs, the currently selected
   * tree's nodes (with locked/available/researching/completed states),
   * active research summary, and cross-tree synergy indicators.
   */
  private renderTechTree(state: GameState): void {
    const panel = this.scenePanels.get('tech');
    if (!panel) return;
    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    if (!body) return;

    body.replaceChildren();

    // Active research summary (if any).
    body.appendChild(this.buildActiveResearchCard(state));

    // Synergy indicators across all trees.
    body.appendChild(this.buildSynergyCard(state));

    // Tree tabs.
    body.appendChild(this.buildTechTreeTabs(state));

    // Node list for the currently selected tree.
    body.appendChild(this.buildTechNodeList(state, this.currentTechTree));
  }

  private buildActiveResearchCard(state: GameState): HTMLElement {
    const card = this.buildCard('Active Research');
    const active = state.research.currentResearch;

    if (!active) {
      const empty = document.createElement('p');
      empty.className = 'shg-tech__empty';
      empty.textContent = 'No research in progress. Select an available node below to start.';
      card.appendChild(empty);
      return card;
    }

    const node = getTreeNodes(active.treeId).find((n) => n.id === active.nodeId);
    const total = node?.researchTime ?? Math.max(active.remainingTicks, 1);
    const remaining = Math.max(0, active.remainingTicks);
    const done = Math.max(0, total - remaining);
    const pct = Math.min(100, Math.max(0, (done / total) * 100));

    card.appendChild(
      this.buildLineItem({
        label: 'Researching',
        value: node?.name ?? active.nodeId,
        tooltip: node?.description ?? '',
      }),
    );
    card.appendChild(
      this.buildLineItem({
        label: 'Tree',
        value: TECH_TREE_LABELS[active.treeId],
      }),
    );
    card.appendChild(
      this.buildLineItem({
        label: 'Time remaining',
        value: `${formatNumber(remaining)} ticks`,
        tooltip: `${remaining} ticks remaining out of ${total} total`,
      }),
    );

    const bar = document.createElement('div');
    bar.className = 'shg-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', pct.toFixed(0));
    bar.setAttribute('aria-label', `Research progress ${pct.toFixed(0)} percent`);

    const fill = document.createElement('div');
    fill.className = 'shg-bar__fill shg-bar__fill--era';
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    const label = document.createElement('span');
    label.className = 'shg-bar__label';
    label.textContent = `${pct.toFixed(0)}%`;
    bar.appendChild(label);

    card.appendChild(bar);
    return card;
  }

  private buildSynergyCard(state: GameState): HTMLElement {
    const card = this.buildCard('Cross-Tree Synergies');

    const completedByTree = this.countCompletedByTree(state);
    const activeRules = SYNERGY_RULES.filter(
      (rule) => (completedByTree[rule.sourceTree] ?? 0) >= rule.requiredCompletions,
    );

    if (activeRules.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shg-tech__empty';
      empty.textContent = 'Complete more nodes to unlock cross-tree cost reductions.';
      card.appendChild(empty);
      return card;
    }

    const list = document.createElement('ul');
    list.className = 'shg-tech__synergy-list';
    list.setAttribute('aria-label', 'Active synergies');

    for (const rule of activeRules) {
      const item = document.createElement('li');
      item.className = 'shg-tech__synergy-item';
      const reductionPct = Math.round((1 - rule.costReduction) * 100);
      item.textContent = `${TECH_TREE_LABELS[rule.sourceTree]} → ${TECH_TREE_LABELS[rule.targetTree]}: −${reductionPct}% cost`;
      item.setAttribute('data-tooltip', rule.description);
      list.appendChild(item);
    }

    card.appendChild(list);
    return card;
  }

  private buildTechTreeTabs(state: GameState): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'shg-tech__tree-tabs';
    wrap.setAttribute('role', 'tablist');
    wrap.setAttribute('aria-label', 'Tech tree selection');

    const completedByTree = this.countCompletedByTree(state);

    for (const treeId of TECH_TREE_IDS) {
      const total = getTreeNodes(treeId).length;
      const completed = completedByTree[treeId] ?? 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shg-tech__tree-tab';
      btn.setAttribute('role', 'tab');
      btn.setAttribute(
        'aria-selected',
        treeId === this.currentTechTree ? 'true' : 'false',
      );
      btn.setAttribute(
        'data-tooltip',
        `${TECH_TREE_LABELS[treeId]} tree: ${completed} of ${total} researched`,
      );
      btn.textContent = `${TECH_TREE_LABELS[treeId]} (${completed}/${total})`;
      btn.addEventListener('click', () => {
        this.currentTechTree = treeId;
        if (this.lastState) this.renderTechTree(this.lastState);
      });
      wrap.appendChild(btn);
    }

    return wrap;
  }

  private buildTechNodeList(state: GameState, tree: TechTreeId): HTMLElement {
    const card = this.buildCard(`${TECH_TREE_LABELS[tree]} Tree`);
    const treeState = state.research.trees[tree];
    const nodes = getTreeNodes(tree).slice().sort((a, b) => a.tier - b.tier);
    const isResearching = state.research.currentResearch !== null;

    if (nodes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shg-tech__empty';
      empty.textContent = 'No nodes available in this tree yet.';
      card.appendChild(empty);
      return card;
    }

    const list = document.createElement('ul');
    list.className = 'shg-tech__node-list';
    list.setAttribute('aria-label', `${TECH_TREE_LABELS[tree]} nodes`);

    for (const node of nodes) {
      const nodeState = treeState.nodes[node.id];
      const status = nodeState?.status ?? node.status;
      list.appendChild(this.buildTechNodeItem(state, node, status, nodeState?.progress ?? 0, isResearching));
    }

    card.appendChild(list);
    return card;
  }

  private buildTechNodeItem(
    state: GameState,
    node: TechNode,
    status: 'locked' | 'available' | 'researching' | 'completed',
    progress: number,
    isResearching: boolean,
  ): HTMLElement {
    const item = document.createElement('li');
    item.className = `shg-tech__node shg-tech__node--${status}`;
    item.setAttribute('aria-label', `${node.name}: ${status}`);

    const header = document.createElement('div');
    header.className = 'shg-tech__node-header';

    const name = document.createElement('span');
    name.className = 'shg-tech__node-name';
    name.textContent = `${node.name} (Tier ${node.tier})`;
    header.appendChild(name);

    const badge = document.createElement('span');
    badge.className = `shg-tech__node-badge shg-tech__node-badge--${status}`;
    badge.textContent = this.statusLabel(status);
    header.appendChild(badge);

    item.appendChild(header);

    const desc = document.createElement('p');
    desc.className = 'shg-tech__node-desc';
    desc.textContent = node.description;
    item.appendChild(desc);

    if (status === 'locked') {
      const prereqs = document.createElement('p');
      prereqs.className = 'shg-tech__node-meta';
      if (node.prerequisites.length === 0) {
        prereqs.textContent = 'Locked — prerequisites pending.';
      } else {
        const names = node.prerequisites
          .map((id) => {
            const found = getTreeNodes(node.tree).find((n) => n.id === id);
            if (found) return found.name;
            // Search other trees if not in same tree.
            for (const t of TECH_TREE_IDS) {
              const candidate = getTreeNodes(t).find((n) => n.id === id);
              if (candidate) return candidate.name;
            }
            return id;
          })
          .join(', ');
        prereqs.textContent = `Requires: ${names}`;
      }
      item.appendChild(prereqs);
    } else if (status === 'available') {
      const synergies = calculateSynergies(this.countCompletedByTree(state), node.tree);
      let currencyCost = node.cost.currency;
      let knowledgeCost = node.cost.knowledge;
      for (const s of synergies) {
        currencyCost = Math.floor(currencyCost * s.costReduction);
        knowledgeCost = Math.floor(knowledgeCost * s.costReduction);
      }

      const cost = document.createElement('p');
      cost.className = 'shg-tech__node-meta';
      cost.textContent = `Cost: ${formatNumber(currencyCost)} currency, ${formatNumber(knowledgeCost)} knowledge · ${node.researchTime} ticks`;
      item.appendChild(cost);

      const affordable =
        state.resources.currency >= currencyCost &&
        state.resources.knowledgePoints >= knowledgeCost;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shg-tech__node-button';
      btn.textContent = 'Research';
      btn.dataset.action = 'start_research';
      btn.dataset.nodeId = node.id;
      btn.disabled = isResearching || !affordable;
      if (isResearching) {
        btn.setAttribute('data-tooltip', 'Another research is already in progress.');
      } else if (!affordable) {
        btn.setAttribute('data-tooltip', 'Not enough currency or knowledge points.');
      } else {
        btn.setAttribute('data-tooltip', `Start researching ${node.name}`);
      }
      btn.addEventListener('click', () => {
        this.dispatchAction({ type: 'start_research', payload: { nodeId: node.id } });
      });
      item.appendChild(btn);
    } else if (status === 'researching') {
      const total = node.researchTime;
      const pct = Math.min(100, Math.max(0, (progress / total) * 100));
      const remaining = Math.max(0, total - progress);

      const bar = document.createElement('div');
      bar.className = 'shg-bar';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', pct.toFixed(0));
      bar.setAttribute('aria-label', `${node.name} progress ${pct.toFixed(0)} percent`);

      const fill = document.createElement('div');
      fill.className = 'shg-bar__fill shg-bar__fill--era';
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);

      const label = document.createElement('span');
      label.className = 'shg-bar__label';
      label.textContent = `${pct.toFixed(0)}%`;
      bar.appendChild(label);

      item.appendChild(bar);

      const meta = document.createElement('p');
      meta.className = 'shg-tech__node-meta';
      meta.textContent = `${formatNumber(remaining)} ticks remaining`;
      item.appendChild(meta);
    } else if (status === 'completed') {
      const meta = document.createElement('p');
      meta.className = 'shg-tech__node-meta shg-tech__node-meta--positive';
      meta.textContent = `✓ ${node.bonus.description}`;
      item.appendChild(meta);
    }

    return item;
  }

  private statusLabel(status: 'locked' | 'available' | 'researching' | 'completed'): string {
    switch (status) {
      case 'locked': return 'Locked';
      case 'available': return 'Available';
      case 'researching': return 'Researching';
      case 'completed': return 'Completed';
    }
  }

  private countCompletedByTree(state: GameState): Record<TechTreeId, number> {
    const out: Record<TechTreeId, number> = {
      energy: 0, materials: 0, weapons: 0, political: 0, space: 0,
    };
    for (const tree of TECH_TREE_IDS) {
      const ts = state.research.trees[tree];
      if (!ts) continue;
      for (const nodeId of Object.keys(ts.nodes)) {
        if (ts.nodes[nodeId]?.status === 'completed') out[tree] += 1;
      }
    }
    return out;
  }

  // ---------- crafting panel ----------

  /**
   * Render the Crafting scene: active craft queue across all crafting
   * factories, plus a list of unlocked recipes with material requirements,
   * craft buttons, and automation toggles.
   */
  private renderCrafting(state: GameState): void {
    const panel = this.scenePanels.get('crafting');
    if (!panel) return;
    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    if (!body) return;

    body.replaceChildren();

    body.appendChild(this.buildCraftQueueCard(state));
    body.appendChild(this.buildRecipeListCard(state));
  }

  private buildCraftQueueCard(state: GameState): HTMLElement {
    const card = this.buildCard('Active Craft Queue');

    const orders: Array<{
      recipeId: string;
      recipeName: string;
      quantity: number;
      progress: number;
      totalTime: number;
    }> = [];

    for (const factory of state.infrastructure.factories) {
      if (factory.type !== 'crafting') continue;
      for (const order of factory.currentOrders) {
        const recipe = getRecipeById(order.recipeId);
        orders.push({
          recipeId: order.recipeId,
          recipeName: recipe?.name ?? order.recipeId,
          quantity: order.quantity,
          progress: order.progress,
          totalTime: order.totalTime,
        });
      }
    }

    if (orders.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shg-craft__empty';
      empty.textContent = 'No active craft orders. Queue a recipe below to begin.';
      card.appendChild(empty);
      return card;
    }

    const list = document.createElement('ul');
    list.className = 'shg-craft__queue-list';
    list.setAttribute('aria-label', 'Active craft orders');

    for (const order of orders) {
      const total = Math.max(1, order.totalTime);
      const pct = Math.min(100, Math.max(0, (order.progress / total) * 100));
      const remaining = Math.max(0, order.totalTime - order.progress);

      const item = document.createElement('li');
      item.className = 'shg-craft__queue-item';

      const header = document.createElement('div');
      header.className = 'shg-craft__queue-header';

      const name = document.createElement('span');
      name.className = 'shg-craft__queue-name';
      name.textContent = `${order.recipeName} ×${order.quantity}`;
      header.appendChild(name);

      const time = document.createElement('span');
      time.className = 'shg-craft__queue-time';
      time.textContent = `${formatNumber(remaining)} ticks left`;
      header.appendChild(time);

      item.appendChild(header);

      const bar = document.createElement('div');
      bar.className = 'shg-bar';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', pct.toFixed(0));
      bar.setAttribute('aria-label', `${order.recipeName} progress ${pct.toFixed(0)} percent`);

      const fill = document.createElement('div');
      fill.className = 'shg-bar__fill';
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);

      const label = document.createElement('span');
      label.className = 'shg-bar__label';
      label.textContent = `${pct.toFixed(0)}%`;
      bar.appendChild(label);

      item.appendChild(bar);
      list.appendChild(item);
    }

    card.appendChild(list);
    return card;
  }

  private buildRecipeListCard(state: GameState): HTMLElement {
    const card = this.buildCard('Recipes');

    const unlocked = RECIPES.filter((recipe) => this.isRecipeUnlockedForUi(state, recipe));

    if (unlocked.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shg-craft__empty';
      empty.textContent = 'No recipes unlocked yet. Advance era or complete research to unlock crafting.';
      card.appendChild(empty);
      return card;
    }

    const list = document.createElement('ul');
    list.className = 'shg-craft__recipe-list';
    list.setAttribute('aria-label', 'Available recipes');

    const automated = new Set(state.supplyChain.automatedRecipes);

    for (const recipe of unlocked) {
      const item = document.createElement('li');
      item.className = 'shg-craft__recipe';

      const header = document.createElement('div');
      header.className = 'shg-craft__recipe-header';

      const name = document.createElement('span');
      name.className = 'shg-craft__recipe-name';
      name.textContent = recipe.name;
      header.appendChild(name);

      const time = document.createElement('span');
      time.className = 'shg-craft__recipe-time';
      time.textContent = `${recipe.craftTime} ticks`;
      header.appendChild(time);

      item.appendChild(header);

      // Inputs (highlight missing in red).
      const inputs = document.createElement('ul');
      inputs.className = 'shg-craft__material-list';
      inputs.setAttribute('aria-label', `${recipe.name} requirements`);

      let canCraft = true;
      for (const input of recipe.inputs) {
        const available = state.materials.stockpiles[input.material] ?? 0;
        const missing = available < input.quantity;
        if (missing) canCraft = false;

        const li = document.createElement('li');
        li.className = `shg-craft__material${missing ? ' shg-craft__material--missing' : ''}`;
        li.setAttribute(
          'data-tooltip',
          missing
            ? `Need ${input.quantity - available} more ${formatMaterial(input.material)}`
            : `${available} / ${input.quantity} ${formatMaterial(input.material)} on hand`,
        );
        li.textContent = `${formatMaterial(input.material)}: ${formatNumber(available)} / ${input.quantity}`;
        inputs.appendChild(li);
      }
      item.appendChild(inputs);

      // Outputs.
      const outputs = document.createElement('p');
      outputs.className = 'shg-craft__recipe-meta';
      outputs.textContent = `Produces: ${recipe.outputs
        .map((o) => `${o.quantity} ${formatMaterial(o.material)}`)
        .join(', ')}`;
      item.appendChild(outputs);

      // Actions.
      const actions = document.createElement('div');
      actions.className = 'shg-craft__recipe-actions';

      const craftBtn = document.createElement('button');
      craftBtn.type = 'button';
      craftBtn.className = 'shg-craft__button';
      craftBtn.textContent = 'Craft';
      craftBtn.dataset.action = 'queue_craft';
      craftBtn.dataset.recipeId = recipe.id;
      craftBtn.disabled = !canCraft;
      craftBtn.setAttribute(
        'data-tooltip',
        canCraft ? `Queue 1× ${recipe.name}` : 'Insufficient materials',
      );
      craftBtn.addEventListener('click', () => {
        this.dispatchAction({
          type: 'queue_craft',
          payload: { recipeId: recipe.id, quantity: 1 },
        });
      });
      actions.appendChild(craftBtn);

      if (recipe.automatable) {
        const isAuto = automated.has(recipe.id);
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = `shg-craft__button shg-craft__button--toggle${isAuto ? ' shg-craft__button--on' : ''}`;
        toggleBtn.textContent = `Automate: ${isAuto ? 'On' : 'Off'}`;
        toggleBtn.dataset.action = 'set_automate';
        toggleBtn.dataset.recipeId = recipe.id;
        toggleBtn.setAttribute('aria-pressed', isAuto ? 'true' : 'false');
        toggleBtn.setAttribute(
          'data-tooltip',
          isAuto
            ? 'Stop auto-crafting this recipe'
            : 'Auto-craft whenever materials are available',
        );
        toggleBtn.addEventListener('click', () => {
          this.dispatchAction({
            type: 'set_automate',
            payload: { recipeId: recipe.id, enabled: !isAuto },
          });
        });
        actions.appendChild(toggleBtn);
      }

      item.appendChild(actions);
      list.appendChild(item);
    }

    card.appendChild(list);
    return card;
  }

  /**
   * UI-side mirror of SupplyChainSystem.isRecipeUnlocked. Recipes appear once
   * the player reaches the required era and (if specified) completes the
   * gating research node.
   */
  private isRecipeUnlockedForUi(
    state: GameState,
    recipe: { unlockedByEra: Era; unlockedByResearch?: string },
  ): boolean {
    const currentEraIndex = ERA_ORDER.indexOf(state.currentEra);
    const requiredEraIndex = ERA_ORDER.indexOf(recipe.unlockedByEra);
    if (currentEraIndex < requiredEraIndex) return false;

    if (recipe.unlockedByResearch) {
      const nodeId = recipe.unlockedByResearch;
      for (const treeId of TECH_TREE_IDS) {
        const tree = state.research.trees[treeId];
        const node = tree?.nodes[nodeId];
        if (node && node.status === 'completed') return true;
      }
      return false;
    }
    return true;
  }

  /**
   * Dispatch a game-action CustomEvent on the renderer root. The game layer
   * (wired up in task 24) listens for `shg-action` to translate UI events
   * into engine actions.
   */
  private dispatchAction(detail: { type: string; payload: Record<string, unknown> }): void {
    if (!this.root) return;
    this.root.dispatchEvent(
      new CustomEvent('shg-action', { detail, bubbles: true }),
    );
  }

  private getNextEra(current: Era): Era | null {
    const idx = ERA_ORDER.indexOf(current);
    if (idx < 0 || idx >= ERA_ORDER.length - 1) return null;
    return ERA_ORDER[idx + 1];
  }

  /** Arrow-key roving tabindex for the scene tablist (WAI-ARIA tab pattern). */
  private handleTabKeydown(event: KeyboardEvent, current: SceneId): void {
    const ids = SCENE_IDS;
    const idx = ids.indexOf(current);
    if (idx < 0) return;

    let next: SceneId | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = ids[(idx + 1) % ids.length];
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = ids[(idx - 1 + ids.length) % ids.length];
        break;
      case 'Home':
        next = ids[0];
        break;
      case 'End':
        next = ids[ids.length - 1];
        break;
      default:
        return;
    }

    event.preventDefault();
    if (next) {
      this.setScene(next);
      this.sceneButtons.get(next)?.focus();
    }
  }

  private handleDialogKeydown(event: KeyboardEvent): void {
    if (!this.dialogOverlay) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDialog();
      return;
    }
    if (event.key === 'Tab') {
      // Simple focus trap: keep Tab cycling within the dialog.
      const focusables = this.dialogOverlay.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  private closeDialog(): void {
    if (!this.dialogOverlay) return;
    document.removeEventListener('keydown', this.onDialogKeydown);
    if (this.dialogOverlay.parentNode) {
      this.dialogOverlay.parentNode.removeChild(this.dialogOverlay);
    }
    this.dialogOverlay = null;
    if (this.previousFocus && document.contains(this.previousFocus)) {
      this.previousFocus.focus();
    }
    this.previousFocus = null;
  }

  // ---------- country selection ----------

  private buildCountryCard(id: CountryId): HTMLElement {
    const profile = COUNTRY_PROFILES[id];

    const item = document.createElement('li');
    item.className = 'shg-country-card';
    item.setAttribute('aria-label', `${profile.name} country profile`);

    const name = document.createElement('h2');
    name.className = 'shg-country-card__name';
    name.textContent = profile.name;
    item.appendChild(name);

    const desc = document.createElement('p');
    desc.className = 'shg-country-card__desc';
    desc.textContent = profile.description;
    item.appendChild(desc);

    // Buffs.
    const buffsHeading = document.createElement('h3');
    buffsHeading.className = 'shg-country-card__subheading';
    buffsHeading.textContent = 'Buffs';
    item.appendChild(buffsHeading);

    const buffsList = document.createElement('ul');
    buffsList.className = 'shg-country-card__buffs';
    for (const buff of profile.buffs) {
      const li = document.createElement('li');
      li.className = 'shg-country-card__buff';
      li.textContent = buff.description;
      buffsList.appendChild(li);
    }
    item.appendChild(buffsList);

    // Starting resources.
    const resourcesHeading = document.createElement('h3');
    resourcesHeading.className = 'shg-country-card__subheading';
    resourcesHeading.textContent = 'Starting Resources';
    item.appendChild(resourcesHeading);

    const resourcesList = document.createElement('ul');
    resourcesList.className = 'shg-country-card__resources';

    const currencyRow = document.createElement('li');
    currencyRow.textContent = `Currency: ${formatNumber(profile.startingResources.currency)}`;
    resourcesList.appendChild(currencyRow);

    const capacityRow = document.createElement('li');
    capacityRow.textContent = `Energy capacity: ${formatNumber(profile.startingResources.energyCapacity)}`;
    resourcesList.appendChild(capacityRow);

    const materialEntries = Object.entries(profile.startingResources.materials)
      .filter(([, qty]) => (qty ?? 0) > 0);
    if (materialEntries.length > 0) {
      const materialsRow = document.createElement('li');
      materialsRow.textContent =
        'Materials: ' +
        materialEntries
          .map(([mat, qty]) => `${formatMaterial(mat as MaterialType)} ${qty}`)
          .join(', ');
      resourcesList.appendChild(materialsRow);
    }

    const militaryRow = document.createElement('li');
    militaryRow.textContent = `Starting military: ${profile.startingMilitary}`;
    resourcesList.appendChild(militaryRow);

    item.appendChild(resourcesList);

    // Select button.
    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'shg-country-card__select';
    select.textContent = `Select ${profile.name}`;
    select.setAttribute('aria-label', `Play as ${profile.name}`);
    select.addEventListener('click', () => {
      const resolve = this.countrySelectionResolve;
      this.closeCountrySelection();
      if (resolve) resolve(id);
    });
    item.appendChild(select);

    return item;
  }

  private closeCountrySelection(): void {
    if (this.countrySelectionRoot && this.countrySelectionRoot.parentNode) {
      this.countrySelectionRoot.parentNode.removeChild(this.countrySelectionRoot);
    }
    this.countrySelectionRoot = null;
    this.countrySelectionResolve = null;
    if (this.root) {
      this.root.style.display = '';
    }
  }

  // ---------- world / political panel ----------

  // ---------- Earth panel ----------

  private renderEarth(state: GameState): void {
    const panel = this.scenePanels.get('earth');
    if (!panel) return;
    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    if (!body) return;

    body.replaceChildren();

    const card = this.buildCard('Earth Operations');
    card.appendChild(this.buildLineItem({
      label: 'Public Approval',
      value: `${state.opposition.publicApproval.toFixed(0)}%`,
      tone: state.opposition.publicApproval > 50 ? 'positive' : 'negative',
      tooltip: 'Keep approval above 30% or construction is blocked.',
    }));
    card.appendChild(this.buildLineItem({
      label: 'UN Hostility',
      value: `${state.opposition.unHostility.toFixed(0)}%`,
      tone: state.opposition.unHostility > 50 ? 'negative' : undefined,
      tooltip: 'High hostility triggers UN attacks.',
    }));
    card.appendChild(this.buildLineItem({
      label: 'Military Power',
      value: formatNumber(state.weapons.militaryPower),
      tooltip: 'Total composite military score.',
    }));

    // War actions.
    const warSection = document.createElement('div');
    warSection.className = 'shg-actions__grid';
    warSection.style.marginTop = '12px';

    const warActions = [
      {
        label: '⚔️ Declare War (Attack UN)',
        tooltip: 'Use military force against the UN. Requires military power > UN power level.',
        action: { type: 'countermeasure', payload: { type: 'military_defense' } },
        disabled: state.weapons.militaryPower <= state.opposition.unPowerLevel,
      },
      {
        label: '🕊️ Diplomatic Deception',
        tooltip: 'Reduce UN hostility by 10 through misdirection.',
        action: { type: 'countermeasure', payload: { type: 'diplomatic_deception' } },
        disabled: false,
      },
      {
        label: '📢 Education Campaign ($500)',
        tooltip: 'Invest in public education to raise approval.',
        action: { type: 'countermeasure', payload: { type: 'education_campaign', investment: 500 } },
        disabled: state.resources.currency < 500,
      },
      {
        label: '💰 Economic Leverage',
        tooltip: 'Reduce active sanction severity by 25%.',
        action: { type: 'countermeasure', payload: { type: 'economic_leverage' } },
        disabled: state.opposition.activeSanctions.length === 0,
      },
    ];

    for (const item of warActions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shg-actions__button';
      btn.textContent = item.label;
      btn.disabled = item.disabled;
      btn.setAttribute('data-tooltip', item.tooltip);
      btn.addEventListener('click', () => this.dispatchAction(item.action));
      warSection.appendChild(btn);
    }

    card.appendChild(warSection);
    body.appendChild(card);
  }

  // ---------- Moon panel ----------

  private renderMoon(state: GameState): void {
    const panel = this.scenePanels.get('moon');
    if (!panel) return;
    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    if (!body) return;

    body.replaceChildren();

    // Orbital platforms card.
    const orbitalCard = this.buildCard('Orbital Platforms');
    orbitalCard.appendChild(this.buildLineItem({
      label: 'Platforms',
      value: formatNumber(state.space.orbitalPlatforms.length),
      tooltip: 'Space-based solar collectors and stations.',
    }));
    orbitalCard.appendChild(this.buildLineItem({
      label: 'Space Solar Output',
      value: `${formatNumber(state.space.orbitalPlatforms.filter(p => p.type === 'solar_collector').reduce((s, p) => s + p.output, 0))}/s`,
      tone: 'positive',
      tooltip: 'Energy from orbital solar collectors (no weather penalty!).',
    }));

    const buildPlatformBtn = document.createElement('button');
    buildPlatformBtn.type = 'button';
    buildPlatformBtn.className = 'shg-actions__button';
    buildPlatformBtn.textContent = '🛰️ Build Orbital Platform (10 fuel + 20 steel)';
    buildPlatformBtn.disabled = (state.materials.stockpiles.fuel ?? 0) < 10 || (state.materials.stockpiles.steel ?? 0) < 20;
    buildPlatformBtn.setAttribute('data-tooltip', 'Build a space-based solar collector with no weather penalty.');
    buildPlatformBtn.addEventListener('click', () => this.dispatchAction({
      type: 'build_orbital_platform',
      payload: { type: 'solar_collector', output: 15 },
    }));
    orbitalCard.appendChild(buildPlatformBtn);
    body.appendChild(orbitalCard);

    // Alien Contact card.
    const alienCard = this.buildCard('Alien Contact 👽');
    const signals = state.alien?.signals ?? [];
    const uninvestigated = signals.filter(s => !s.investigated && !s.outcome);

    alienCard.appendChild(this.buildLineItem({
      label: 'Relations Score',
      value: `${state.alien?.relationsScore ?? 0}`,
      tone: (state.alien?.relationsScore ?? 0) > 0 ? 'positive' : (state.alien?.relationsScore ?? 0) < 0 ? 'negative' : undefined,
      tooltip: 'Alien disposition toward you. -100 to +100.',
    }));
    alienCard.appendChild(this.buildLineItem({
      label: 'Signals Detected',
      value: `${signals.length}`,
      tooltip: 'Total alien signals encountered during space mining.',
    }));
    alienCard.appendChild(this.buildLineItem({
      label: 'Ignored Signals',
      value: `${state.alien?.ignoredSignals ?? 0} / 5`,
      tooltip: 'Forced contact triggers at 5 ignored signals.',
    }));

    if (uninvestigated.length > 0) {
      const signalId = uninvestigated[0].id;

      const contactActions = document.createElement('div');
      contactActions.className = 'shg-actions__grid';
      contactActions.style.marginTop = '12px';

      const investigateBtn = document.createElement('button');
      investigateBtn.type = 'button';
      investigateBtn.className = 'shg-actions__button';
      investigateBtn.textContent = '🔍 Investigate Signal';
      investigateBtn.setAttribute('data-tooltip', 'Investigate the alien signal. Outcome depends on relations.');
      investigateBtn.addEventListener('click', () => this.dispatchAction({
        type: 'investigate_signal',
        payload: { signalId },
      }));
      contactActions.appendChild(investigateBtn);

      const broadcastBtn = document.createElement('button');
      broadcastBtn.type = 'button';
      broadcastBtn.className = 'shg-actions__button';
      broadcastBtn.textContent = '📡 Broadcast Response';
      broadcastBtn.setAttribute('data-tooltip', 'Broadcast a friendly response (+10 relations bonus).');
      broadcastBtn.addEventListener('click', () => this.dispatchAction({
        type: 'broadcast_response',
        payload: { signalId },
      }));
      contactActions.appendChild(broadcastBtn);

      const ignoreBtn = document.createElement('button');
      ignoreBtn.type = 'button';
      ignoreBtn.className = 'shg-actions__button';
      ignoreBtn.textContent = '🚫 Ignore Signal';
      ignoreBtn.setAttribute('data-tooltip', 'Ignore the signal (-5 relations). 5 ignores = forced contact.');
      ignoreBtn.addEventListener('click', () => this.dispatchAction({
        type: 'ignore_signal',
        payload: { signalId },
      }));
      contactActions.appendChild(ignoreBtn);

      alienCard.appendChild(contactActions);
    } else {
      const noSignals = document.createElement('p');
      noSignals.className = 'shg-tech__empty';
      noSignals.textContent = signals.length === 0
        ? 'No alien signals yet. Claim asteroid territories to start detecting signals.'
        : 'No pending signals. Continue mining to detect more.';
      alienCard.appendChild(noSignals);
    }

    body.appendChild(alienCard);
  }

  /**
   * Render the World scene: shows player nation, all foreign countries with
   * influence bars and method buttons, and World Domination progress.
   */
  private renderWorld(state: GameState): void {
    const panel = this.scenePanels.get('world');
    if (!panel) return;
    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    if (!body) return;

    body.replaceChildren();

    body.appendChild(this.buildWorldDominationCard(state));
    body.appendChild(this.buildCountryListCard(state));
  }

  private buildWorldDominationCard(state: GameState): HTMLElement {
    const card = this.buildCard('World Domination');

    const controlled = state.political.installedPoliticians.length;
    const pct = Math.min(100, Math.round((controlled / WORLD_DOMINATION_TARGET) * 100));
    const achieved = state.political.worldDominationAchieved;

    card.appendChild(
      this.buildLineItem({
        label: 'Countries controlled',
        value: `${controlled} / ${WORLD_DOMINATION_TARGET}`,
        tooltip: achieved
          ? 'World Domination achieved — UN sanctions are disabled.'
          : 'Install politicians in 5 countries to disable UN sanctions and pool global resources.',
      }),
    );

    const bar = document.createElement('div');
    bar.className = 'shg-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', pct.toFixed(0));
    bar.setAttribute('aria-label', `World Domination progress ${pct} percent`);

    const fill = document.createElement('div');
    fill.className = 'shg-bar__fill';
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    const label = document.createElement('span');
    label.className = 'shg-bar__label';
    label.textContent = `${pct}%`;
    bar.appendChild(label);

    card.appendChild(bar);

    if (achieved) {
      const ok = document.createElement('p');
      ok.className = 'shg-tech__node-meta shg-tech__node-meta--positive';
      ok.textContent = '✓ World Domination active — global resource pool engaged.';
      card.appendChild(ok);
    }

    return card;
  }

  private buildCountryListCard(state: GameState): HTMLElement {
    const card = this.buildCard('Nations');

    const list = document.createElement('ul');
    list.className = 'shg-world__country-list';
    list.setAttribute('aria-label', 'Country influence list');

    const installed = new Set(state.political.installedPoliticians);

    for (const id of getAllCountryIds()) {
      list.appendChild(this.buildCountryRow(state, id, installed.has(id)));
    }

    card.appendChild(list);
    return card;
  }

  private buildCountryRow(
    state: GameState,
    id: CountryId,
    isControlled: boolean,
  ): HTMLElement {
    const profile = COUNTRY_PROFILES[id];
    const isPlayer = state.country === id;
    const influence = isPlayer ? 100 : state.political.influence[id] ?? 0;
    const pct = Math.min(100, Math.max(0, Math.round(influence)));

    const item = document.createElement('li');
    item.className = 'shg-world__country';
    if (isPlayer) item.classList.add('shg-world__country--player');
    if (isControlled) item.classList.add('shg-world__country--controlled');
    item.setAttribute('aria-label', `${profile.name} influence ${pct} percent`);

    const header = document.createElement('div');
    header.className = 'shg-world__country-header';

    const name = document.createElement('span');
    name.className = 'shg-world__country-name';
    name.textContent = profile.name;
    header.appendChild(name);

    const badge = document.createElement('span');
    badge.className = 'shg-tech__node-badge';
    if (isPlayer) {
      badge.classList.add('shg-tech__node-badge--available');
      badge.textContent = 'You';
    } else if (isControlled) {
      badge.classList.add('shg-tech__node-badge--completed');
      badge.textContent = 'Controlled';
    } else if (influence >= INFLUENCE_INSTALL_THRESHOLD) {
      badge.classList.add('shg-tech__node-badge--researching');
      badge.textContent = 'Ripe';
    } else {
      badge.textContent = 'Foreign';
    }
    header.appendChild(badge);

    item.appendChild(header);

    // Influence bar.
    const bar = document.createElement('div');
    bar.className = 'shg-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', pct.toFixed(0));
    bar.setAttribute('aria-label', `${profile.name} influence ${pct} percent`);

    const fill = document.createElement('div');
    fill.className = 'shg-bar__fill';
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    const label = document.createElement('span');
    label.className = 'shg-bar__label';
    label.textContent = `${pct}%`;
    bar.appendChild(label);

    item.appendChild(bar);

    // Method buttons (only for non-player countries).
    if (!isPlayer) {
      const methods: InfluenceMethod[] = [
        'economic_aid',
        'propaganda',
        'corporate_infiltration',
        'intelligence',
      ];

      const actions = document.createElement('div');
      actions.className = 'shg-world__country-actions';

      const canAfford = state.resources.currency >= DEFAULT_INFLUENCE_INVESTMENT;

      for (const method of methods) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shg-world__method-button';
        btn.textContent = INFLUENCE_METHOD_LABELS[method];
        btn.disabled = !canAfford;
        btn.setAttribute(
          'data-tooltip',
          `${INFLUENCE_METHOD_TOOLTIPS[method]} Cost: ${DEFAULT_INFLUENCE_INVESTMENT} currency.`,
        );
        btn.addEventListener('click', () => {
          this.dispatchAction({
            type: 'invest_influence',
            payload: {
              country: id,
              method,
              amount: DEFAULT_INFLUENCE_INVESTMENT,
            },
          });
        });
        actions.appendChild(btn);
      }

      item.appendChild(actions);
    }

    return item;
  }

  // ---------- Mars scene ----------

  private renderMars(state: GameState): void {
    const panel = this.scenePanels.get('mars');
    if (!panel) return;
    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    if (!body) return;

    body.replaceChildren();

    const mars = state.mars;

    if (!mars.unlocked) {
      const card = this.buildCard('Mars Operations');
      const empty = document.createElement('p');
      empty.className = 'shg-tech__empty';
      empty.textContent =
        'Mars base not yet established. Reach the Mars Colonization Era and build a base to begin Martian operations.';
      card.appendChild(empty);
      body.appendChild(card);
      return;
    }

    // Status card.
    const status = this.buildCard('Mars Base');
    status.appendChild(
      this.buildLineItem({
        label: 'Base level',
        value: formatNumber(mars.baseLevel),
        tooltip: 'Higher base levels increase Martian resource output.',
      }),
    );
    status.appendChild(
      this.buildLineItem({
        label: 'Launch cost reduction',
        value: `${(mars.launchCostReduction * 100).toFixed(0)}%`,
        tooltip:
          'Mars-to-Earth launches consume only a fraction of normal fuel due to lower gravity.',
      }),
    );
    body.appendChild(status);

    // Stockpile + production card.
    const inventory = this.buildCard('Martian Stockpile');
    const marsMaterials: MaterialType[] = ['regolith_iron', 'martian_ice', 'co2'];
    for (const mat of marsMaterials) {
      const stock = mars.resources[mat] ?? 0;
      const rate = mars.productionRates[mat] ?? 0;
      inventory.appendChild(
        this.buildLineItem({
          label: formatMaterial(mat),
          value: `${formatNumber(stock)} (+${formatNumber(rate)}/s)`,
          tooltip: `${formatNumber(stock)} units stockpiled, producing ${formatNumber(rate)} per tick`,
        }),
      );
    }
    body.appendChild(inventory);
  }

  // ---------- Asteroid Belt scene ----------

  private renderAsteroids(state: GameState): void {
    const panel = this.scenePanels.get('asteroids');
    if (!panel) return;
    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    if (!body) return;

    body.replaceChildren();

    const space = state.space;

    // Fleet status.
    const fleet = this.buildCard('Fleet Status');
    fleet.appendChild(
      this.buildLineItem({
        label: 'Fleet size',
        value: formatNumber(space.fleet.size),
        tooltip: 'Each fleet unit raises the max territory cap by two.',
      }),
    );
    fleet.appendChild(
      this.buildLineItem({
        label: 'Fuel',
        value: `${formatNumber(space.fleet.currentFuel)} / ${formatNumber(space.fleet.fuelCapacity)}`,
        tooltip: 'Fleet consumes fuel passively while mining territories.',
      }),
    );
    fleet.appendChild(
      this.buildLineItem({
        label: 'Territories',
        value: `${space.territories.length} / ${space.maxTerritories}`,
        tooltip: 'Cap is fleet size × 2. Expand the fleet to claim more.',
      }),
    );
    body.appendChild(fleet);

    // Territory list.
    const territories = this.buildCard('Claimed Territories');
    if (space.territories.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shg-tech__empty';
      empty.textContent =
        'No territories claimed yet. Reach the Space Mining Era and claim asteroid territories to begin extraction.';
      territories.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'shg-territory__list';
      list.setAttribute('aria-label', 'Claimed asteroid territories');

      for (const t of space.territories) {
        const li = document.createElement('li');
        li.className = 'shg-territory__item';

        const header = document.createElement('div');
        header.className = 'shg-world__country-header';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'shg-world__country-name';
        nameSpan.textContent = t.name;
        header.appendChild(nameSpan);

        const badge = document.createElement('span');
        badge.className = 'shg-tech__node-badge';
        if (t.surveyed) {
          badge.classList.add('shg-tech__node-badge--completed');
          badge.textContent = 'Surveyed';
        } else {
          badge.textContent = 'Unsurveyed';
        }
        header.appendChild(badge);

        li.appendChild(header);

        const meta = document.createElement('p');
        meta.className = 'shg-tech__node-meta';
        const profile = Object.entries(t.resourceProfile)
          .filter(([, weight]) => (weight ?? 0) > 0)
          .map(([mat, weight]) => `${formatMaterial(mat as MaterialType)} ${(weight as number).toFixed(2)}`)
          .join(', ');
        meta.textContent = `Quality ${(t.depositQuality * 100).toFixed(0)}% · Mining lvl ${t.miningLevel} · Profile: ${profile || 'unknown'}`;
        li.appendChild(meta);

        list.appendChild(li);
      }

      territories.appendChild(list);
    }
    body.appendChild(territories);
  }

  // ---------- Sun / Dyson Ring scene ----------

  private renderSun(state: GameState): void {
    const panel = this.scenePanels.get('sun');
    if (!panel) return;
    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    if (!body) return;

    body.replaceChildren();

    const dyson = state.dyson;

    // Overview card.
    const overview = this.buildCard('Dyson Ring Overview');
    overview.appendChild(
      this.buildLineItem({
        label: 'Segments complete',
        value: `${dyson.completedSegments} / ${dyson.totalSegments}`,
        tooltip: 'Each completed segment increases your global energy multiplier.',
      }),
    );
    overview.appendChild(
      this.buildLineItem({
        label: 'Energy multiplier',
        value: `${dyson.energyMultiplier.toFixed(2)}x`,
        tone: dyson.energyMultiplier > 1 ? 'positive' : undefined,
        tooltip: 'Global multiplier applied to all energy production.',
      }),
    );
    if (dyson.victoryAchieved) {
      const win = document.createElement('p');
      win.className = 'shg-tech__node-meta shg-tech__node-meta--positive';
      win.textContent = '🏆 Dyson Ring complete — victory achieved.';
      overview.appendChild(win);
    }
    body.appendChild(overview);

    // Segment cards.
    const segments = this.buildCard('Dyson Segments');
    if (dyson.segments.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shg-tech__empty';
      empty.textContent =
        'Dyson Ring construction has not started. Reach the Dyson Ring Era to begin.';
      segments.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'shg-dyson__segment-list';
      list.setAttribute('aria-label', 'Dyson Ring segments');

      for (const segment of dyson.segments) {
        const li = document.createElement('li');
        li.className = 'shg-dyson__segment';
        if (segment.completed) li.classList.add('shg-dyson__segment--completed');

        const header = document.createElement('div');
        header.className = 'shg-world__country-header';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'shg-world__country-name';
        nameSpan.textContent = segment.name;
        header.appendChild(nameSpan);

        const badge = document.createElement('span');
        badge.className = 'shg-tech__node-badge';
        if (segment.completed) {
          badge.classList.add('shg-tech__node-badge--completed');
          badge.textContent = 'Complete';
        } else if (segment.progress > 0) {
          badge.classList.add('shg-tech__node-badge--researching');
          badge.textContent = 'In Progress';
        } else {
          badge.textContent = 'Pending';
        }
        header.appendChild(badge);

        li.appendChild(header);

        const reqs = document.createElement('p');
        reqs.className = 'shg-tech__node-meta';
        reqs.textContent = `Requires: ${segment.requirements
          .map((r) => `${r.quantity} ${formatMaterial(r.material)}`)
          .join(', ')}`;
        li.appendChild(reqs);

        const pct = Math.min(100, Math.max(0, segment.progress));
        const bar = document.createElement('div');
        bar.className = 'shg-bar';
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        bar.setAttribute('aria-valuenow', pct.toFixed(0));
        bar.setAttribute('aria-label', `${segment.name} progress ${pct.toFixed(0)} percent`);

        const fill = document.createElement('div');
        fill.className = 'shg-bar__fill';
        fill.style.width = `${pct}%`;
        bar.appendChild(fill);

        const label = document.createElement('span');
        label.className = 'shg-bar__label';
        label.textContent = `${pct.toFixed(0)}%`;
        bar.appendChild(label);

        li.appendChild(bar);
        list.appendChild(li);
      }

      segments.appendChild(list);
    }
    body.appendChild(segments);
  }

  // ---------- Settings / Save & Load scene ----------

  private renderSettings(state: GameState): void {
    const panel = this.scenePanels.get('settings');
    if (!panel) return;
    const body = panel.querySelector<HTMLElement>('[data-role="panel-body"]');
    if (!body) return;

    body.replaceChildren();

    // Save status card.
    const status = this.buildCard('Save Status');
    const lastSave = state.lastSaveTimestamp;
    const relative = this.formatRelativeTime(lastSave);
    status.appendChild(
      this.buildLineItem({
        label: 'Last save',
        value: relative,
        tooltip: lastSave > 0 ? new Date(lastSave).toLocaleString() : 'No save yet',
      }),
    );
    body.appendChild(status);

    // Export / Import card.
    const io = this.buildCard('Manual Save & Restore');

    const intro = document.createElement('p');
    intro.className = 'shg-craft__empty';
    intro.textContent =
      'Export your save to a JSON file or import a previously exported file. Imports replace the current game state.';
    io.appendChild(intro);

    const actions = document.createElement('div');
    actions.className = 'shg-settings__actions';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'shg-tech__node-button';
    exportBtn.textContent = 'Export save';
    exportBtn.setAttribute('data-tooltip', 'Download the current game state as a JSON file.');
    exportBtn.addEventListener('click', () => this.downloadSave(state));
    actions.appendChild(exportBtn);

    const importLabel = document.createElement('label');
    importLabel.className = 'shg-tech__node-button shg-settings__import';
    importLabel.textContent = 'Import save';
    importLabel.setAttribute('data-tooltip', 'Restore a previously exported save file.');

    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importInput.className = 'shg-settings__import-input';
    importInput.setAttribute('aria-label', 'Choose save file to import');
    importInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      this.readSaveFile(file)
        .then((json) => {
          this.dispatchAction({
            type: 'import_save',
            payload: { json },
          });
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Failed to read save file.';
          this.showNotification(message, 'error');
        })
        .finally(() => {
          // Reset the input so the same file can be re-selected later.
          target.value = '';
        });
    });
    importLabel.appendChild(importInput);

    actions.appendChild(importLabel);
    io.appendChild(actions);

    body.appendChild(io);

    // Restart card.
    const restart = this.buildCard('Restart Game');
    const restartIntro = document.createElement('p');
    restartIntro.className = 'shg-craft__empty';
    restartIntro.textContent = 'Wipe your save and start fresh with a new country.';
    restart.appendChild(restartIntro);

    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'shg-actions__button';
    restartBtn.style.background = '#fca5a5';
    restartBtn.style.color = '#0f172a';
    restartBtn.style.borderColor = '#fca5a5';
    restartBtn.textContent = '🔄 Restart Game';
    restartBtn.setAttribute('data-tooltip', 'Delete your save and pick a new country.');
    restartBtn.addEventListener('click', () => {
      this.showDialog({
        title: 'Restart Game?',
        body: 'This will permanently delete your save. Are you sure?',
        options: [
          {
            label: 'Yes, restart',
            action: () => {
              try { localStorage.removeItem('sun_harvester_save'); } catch {}
              try { localStorage.removeItem('sun_harvester_tutorial_complete'); } catch {}
              window.location.reload();
            },
          },
          { label: 'Cancel', action: () => {} },
        ],
      });
    });
    restart.appendChild(restartBtn);
    body.appendChild(restart);
  }

  private downloadSave(state: GameState): void {
    try {
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      anchor.download = `sun-harvester-save-${timestamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Defer revoke so Safari has a chance to read the URL.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.showNotification('Save exported.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed.';
      this.showNotification(message, 'error');
    }
  }

  private readSaveFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Save file is not a text file.'));
        }
      };
      reader.onerror = () => reject(new Error('Could not read save file.'));
      reader.readAsText(file);
    });
  }

  private formatRelativeTime(timestamp: number): string {
    if (!timestamp || timestamp <= 0) return 'Never';

    const now = Date.now();
    const diff = Math.max(0, now - timestamp);

    const seconds = Math.floor(diff / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
}
