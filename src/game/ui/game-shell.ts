/**
 * Game Shell — A lightweight UI shell that uses:
 * - 3D solar system as full-screen background (always pannable)
 * - Persistent HUD bar at top (resources, era)
 * - Slide-in panels that open ONLY on click (not rebuilt every frame)
 * - Event delegation for all buttons (never loses listeners)
 * - Tutorial as a bottom overlay bar with step counter
 *
 * This replaces the DomRenderer's broken "rebuild every frame" approach.
 */
import type { GameState, CountryId } from '../core/types.js';
import type { MaterialType } from '../core/resources.js';
import { WEATHER_MODIFIERS } from '../core/weather.js';
import { formatNumber } from '../utils/format.js';
import { ERA_ORDER } from '../core/state-manager.js';
import { SolarScene } from './three/solar-scene.js';
import { CelestialNavigator, CELESTIAL_BODIES, isBodyUnlocked } from './celestial-nav.js';
import { WorldMap } from './world-map.js';
import { COUNTRY_PROFILES, getAllCountryIds } from '../data/countries.js';
import { getTreeNodes } from '../data/tech-trees.js';
import { RECIPES } from '../data/recipes.js';
import { TUTORIAL_STEPS } from './tutorial.js';

type ActionPayload = { type: string; payload: Record<string, unknown> };
type ActionHandler = (action: ActionPayload) => void;

/**
 * The game shell. This is the ONLY UI class. It creates DOM once, then
 * updates text content in place (never rebuilds, never loses listeners).
 */
export class GameShell {
  private container: HTMLElement;
  private solarScene: SolarScene | null = null;
  private navigator: CelestialNavigator;
  private worldMap: WorldMap;
  private onAction: ActionHandler = () => {};
  private state: GameState | null = null;

  // DOM elements created once and updated in-place.
  private hud!: HTMLElement;
  private panel!: HTMLElement;
  private panelContent!: HTMLElement;
  private panelTitle!: HTMLElement;
  private tutorialBar!: HTMLElement;
  private tutorialText!: HTMLElement;
  private tutorialStep = 0;
  private tutorialActive = false;

  private activePanel: string | null = null;
  private buildQueue: Array<{ label: string; ticksRemaining: number; totalTicks: number }> = [];
  private morale = 100;
  private queueBar!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.navigator = new CelestialNavigator();
    this.worldMap = new WorldMap();
    this.worldMap.setCountryClickHandler((country) => {
      this.openPanel(`country_${country}`);
    });
    this.build();
  }

  setActionHandler(handler: ActionHandler): void {
    this.onAction = handler;
  }

  /** Update the build queue display. */
  setBuildQueue(queue: Array<{ label: string; ticksRemaining: number; totalTicks: number }>): void {
    this.buildQueue = queue;
    this.updateBuildQueueBar();
  }

  /** Update the morale value. */
  setMorale(morale: number): void {
    this.morale = morale;
  }

  /** Show a transient notification toast. */
  notify(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `gs-toast gs-toast-${type}`;
    toast.textContent = message;
    this.container.appendChild(toast);
    // Animate in then auto-remove.
    requestAnimationFrame(() => toast.classList.add('gs-toast-show'));
    setTimeout(() => {
      toast.classList.remove('gs-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /** Update HUD numbers in-place (no DOM rebuild). */
  render(state: GameState): void {
    this.state = state;
    this.navigator.updateState(state);
    this.updateHUD(state);
    // If panel is open, update its content.
    if (this.activePanel) {
      this.renderPanel(this.activePanel, state);
    }
  }

  showCountrySelection(onSelect: (country: CountryId) => void): void {
    this.panel.hidden = true;
    this.activePanel = null;
    this.hud.hidden = true;
    this.queueBar.hidden = true;
    // Remove any existing country overlay (prevents duplicates on double-restart).
    this.container.querySelector('.gs-country-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'gs-country-overlay';
    overlay.innerHTML = `<h1 class="gs-country-title">Choose Your Nation</h1>
      <p class="gs-country-subtitle">Each nation has unique bonuses. Pick your strategy.</p>
      <div class="gs-country-grid"></div>`;
    const grid = overlay.querySelector('.gs-country-grid')!;
    for (const id of getAllCountryIds()) {
      const p = COUNTRY_PROFILES[id];
      const card = document.createElement('button');
      card.className = 'gs-country-card';
      card.innerHTML = `<strong>${p.name}</strong><br><small>${p.buffs.map(b => b.description).join(', ')}</small>`;
      card.addEventListener('click', () => {
        overlay.remove();
        this.hud.hidden = false;
        onSelect(id);
      });
      grid.appendChild(card);
    }
    this.container.appendChild(overlay);
  }

  startTutorial(): void {
    let done = false;
    try { done = localStorage.getItem('shg_tutorial_done') === '1'; } catch { /* storage blocked */ }
    if (done) return;
    this.tutorialActive = true;
    this.tutorialStep = 0;
    this.showTutorialStep();
    this.tutorialBar.hidden = false;
  }

  dispose(): void {
    this.solarScene?.dispose();
  }

  // ─── Build DOM (once) ───────────────────────────────────────────────────

  private build(): void {
    this.container.innerHTML = '';

    // 3D canvas (full screen background).
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'gs-canvas';
    this.container.appendChild(canvasContainer);
    this.solarScene = new SolarScene(canvasContainer);
    this.solarScene.setBodyClickHandler((id) => {
      this.openPanel(id);
    });

    // HUD bar (top).
    this.hud = document.createElement('div');
    this.hud.className = 'gs-hud';
    this.hud.innerHTML = `
      <span class="gs-hud-item" data-hud="currency">💰 0</span>
      <span class="gs-hud-item" data-hud="energy">⚡ 0</span>
      <span class="gs-hud-item" data-hud="morale">😊 100%</span>
      <span class="gs-hud-item" data-hud="era">🏛️ Fossil</span>
      <span class="gs-hud-item" data-hud="weather">☀️ 1.0x</span>
      <span class="gs-hud-item" data-hud="military">🔫 0</span>
      <button class="gs-hud-btn" data-open="dashboard">📊 Dashboard</button>
      <button class="gs-hud-btn" data-open="build">🔨 Build</button>
      <button class="gs-hud-btn" data-open="crafting">⚒️ Craft</button>
      <button class="gs-hud-btn" data-open="research">🔬 Research</button>
      <button class="gs-hud-btn" data-open="settings">⚙️ Settings</button>
    `;
    this.container.appendChild(this.hud);

    // Build queue bar (below HUD).
    const queueBar = document.createElement('div');
    queueBar.className = 'gs-queue-bar';
    queueBar.hidden = true;
    this.container.appendChild(queueBar);
    this.queueBar = queueBar;

    // Slide-in panel.
    this.panel = document.createElement('div');
    this.panel.className = 'gs-panel';
    this.panel.hidden = true;
    this.panel.innerHTML = `
      <div class="gs-panel-header">
        <h2 class="gs-panel-title">Panel</h2>
        <button class="gs-panel-close">✕</button>
      </div>
      <div class="gs-panel-content"></div>
    `;
    this.panelTitle = this.panel.querySelector('.gs-panel-title')!;
    this.panelContent = this.panel.querySelector('.gs-panel-content')!;
    this.container.appendChild(this.panel);

    // Tutorial bar (bottom).
    this.tutorialBar = document.createElement('div');
    this.tutorialBar.className = 'gs-tutorial';
    this.tutorialBar.hidden = true;
    this.tutorialBar.innerHTML = `
      <span class="gs-tutorial-text"></span>
      <button class="gs-tutorial-next">Next →</button>
      <button class="gs-tutorial-skip">Skip</button>
    `;
    this.tutorialText = this.tutorialBar.querySelector('.gs-tutorial-text')!;
    this.container.appendChild(this.tutorialBar);

    // Event delegation — one listener for everything.
    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  // ─── Event Delegation ─────────────────────────────────────────────────

  private handleClick(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-open],[data-action],[data-nav]');
    if (!target) {
      // Close button.
      if ((e.target as HTMLElement).closest('.gs-panel-close')) {
        this.closePanel();
        return;
      }
      // Tutorial buttons.
      if ((e.target as HTMLElement).closest('.gs-tutorial-next')) {
        this.nextTutorialStep();
        return;
      }
      if ((e.target as HTMLElement).closest('.gs-tutorial-skip')) {
        this.endTutorial();
        return;
      }
      return;
    }

    // Open panel.
    if (target.dataset.open) {
      this.openPanel(target.dataset.open);
      return;
    }

    // Game action.
    if (target.dataset.action) {
      const actionData = target.dataset.action;
      try {
        const action = JSON.parse(actionData) as ActionPayload;
        this.onAction(action);
        // Re-render panel after action.
        if (this.activePanel && this.state) {
          setTimeout(() => {
            if (this.activePanel && this.state) this.renderPanel(this.activePanel, this.state);
          }, 100);
        }
      } catch { /* ignore parse errors */ }
      return;
    }

    // Nav to body.
    if (target.dataset.nav) {
      this.navigator.navigateTo(target.dataset.nav as 'earth' | 'moon' | 'mars' | 'asteroids' | 'sun');
      this.solarScene?.focusBody(target.dataset.nav as 'earth' | 'moon' | 'mars' | 'asteroids' | 'sun');
    }
  }

  private updateBuildQueueBar(): void {
    if (!this.queueBar) return;
    if (this.buildQueue.length === 0) {
      this.queueBar.hidden = true;
      return;
    }
    this.queueBar.hidden = false;
    this.queueBar.innerHTML = '<span class="gs-queue-label">🔨 Building:</span>' +
      this.buildQueue.map((o) => {
        const pct = Math.round(((o.totalTicks - o.ticksRemaining) / o.totalTicks) * 100);
        return `<span class="gs-queue-item">${o.label} <span class="gs-queue-prog"><span class="gs-queue-fill" style="width:${pct}%"></span></span> ${o.ticksRemaining}s</span>`;
      }).join('');
  }

  // ─── HUD Updates (text only, no rebuild) ──────────────────────────────

  private updateHUD(state: GameState): void {
    const set = (key: string, text: string) => {
      const el = this.hud.querySelector(`[data-hud="${key}"]`);
      if (el) el.textContent = text;
    };
    set('currency', `💰 ${formatNumber(state.resources.currency)}`);
    set('energy', `⚡ ${formatNumber(state.energy.stored)}/${formatNumber(state.energy.maxStorage)}`);
    set('era', `🏛️ ${state.currentEra.replace('_', ' ')}`);
    const wMod = WEATHER_MODIFIERS[state.weather.current];
    const wIcon = state.weather.current === 'sunny' ? '☀️' : state.weather.current === 'partly_cloudy' ? '⛅' : state.weather.current === 'overcast' ? '☁️' : '🌧️';
    set('weather', `${wIcon} ${wMod}x`);
    set('military', `🔫 ${formatNumber(state.weapons.militaryPower)}`);
    const moraleIcon = this.morale > 70 ? '😊' : this.morale > 40 ? '😐' : '😟';
    set('morale', `${moraleIcon} ${this.morale.toFixed(0)}%`);
  }

  // ─── Panel Rendering ──────────────────────────────────────────────────

  private openPanel(id: string): void {
    this.activePanel = id;
    this.panel.hidden = false;
    if (this.state) this.renderPanel(id, this.state);
  }

  private closePanel(): void {
    this.activePanel = null;
    this.panel.hidden = true;
  }

  private renderPanel(id: string, state: GameState): void {
    if (id.startsWith('country_')) {
      this.renderCountryPanel(id, state);
      return;
    }
    switch (id) {
      case 'dashboard': this.renderDashboard(state); break;
      case 'build': this.renderBuild(state); break;
      case 'crafting': this.renderCraftingPanel(state); break;
      case 'research': this.renderResearch(state); break;
      case 'settings': this.renderSettingsPanel(state); break;
      case 'earth': this.renderEarthPanel(state); break;
      case 'moon': this.renderMoonPanel(state); break;
      case 'mars': this.renderMarsPanel(state); break;
      case 'asteroids': this.renderAsteroidsPanel(state); break;
      case 'sun': this.renderSunPanel(state); break;
      default: this.panelTitle.textContent = id; this.panelContent.innerHTML = '<p>Coming soon...</p>';
    }
  }

  private renderDashboard(state: GameState): void {
    this.panelTitle.textContent = '📊 Dashboard';
    const income = state.resources.incomeRate;
    const expense = state.resources.expenseRate;
    const net = income - expense;
    const labCount = state.statistics.totalResearchCompleted;

    // Era cost info (imported from main).
    const eraInfo = this.getNextEraCostDisplay(state);

    this.panelContent.innerHTML = `
      <div class="gs-stat-grid">
        <div class="gs-stat"><span class="gs-stat-label">Currency</span><span class="gs-stat-value">${formatNumber(state.resources.currency)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Income</span><span class="gs-stat-value gs-positive">+${formatNumber(income)}/s</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Expenses</span><span class="gs-stat-value gs-negative">-${formatNumber(expense)}/s</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Net</span><span class="gs-stat-value ${net >= 0 ? 'gs-positive' : 'gs-negative'}">${net >= 0 ? '+' : ''}${formatNumber(net)}/s</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Energy</span><span class="gs-stat-value">${formatNumber(state.energy.stored)} / ${formatNumber(state.energy.maxStorage)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Knowledge</span><span class="gs-stat-value">${formatNumber(state.resources.knowledgePoints)} (+${labCount * 2}/s)</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Labs</span><span class="gs-stat-value">${labCount}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Coal</span><span class="gs-stat-value">${formatNumber(state.materials.stockpiles.coal ?? 0)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Iron</span><span class="gs-stat-value">${formatNumber(state.materials.stockpiles.iron_ore ?? 0)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Steel</span><span class="gs-stat-value">${formatNumber(state.materials.stockpiles.steel ?? 0)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Military</span><span class="gs-stat-value">${formatNumber(state.weapons.militaryPower)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Weapons Factories</span><span class="gs-stat-value">${state.weapons.factories.length} (-${state.weapons.factories.length * 5}⚡/s)</span></div>
      </div>
      <h3 class="gs-section-title">Era Progression</h3>
      ${eraInfo}
    `;
  }

  private getNextEraCostDisplay(state: GameState): string {
    const ERA_COSTS: Record<string, { currency: number; knowledge: number; steel: number; energy: number }> = {
      nuclear: { currency: 5000, knowledge: 200, steel: 50, energy: 2000 },
      solar: { currency: 15000, knowledge: 500, steel: 150, energy: 5000 },
      orbital: { currency: 50000, knowledge: 1500, steel: 500, energy: 15000 },
      mars_colonization: { currency: 150000, knowledge: 5000, steel: 2000, energy: 50000 },
      space_mining: { currency: 500000, knowledge: 15000, steel: 8000, energy: 150000 },
      dyson_ring: { currency: 2000000, knowledge: 50000, steel: 30000, energy: 500000 },
    };

    const eraOrder = ['fossil', 'nuclear', 'solar', 'orbital', 'mars_colonization', 'space_mining', 'dyson_ring'];
    const currentIndex = eraOrder.indexOf(state.currentEra);
    if (currentIndex >= eraOrder.length - 1) {
      return `<p class="gs-positive">🏆 Final era reached!</p>`;
    }

    const nextEra = eraOrder[currentIndex + 1];
    const cost = ERA_COSTS[nextEra];
    if (!cost) return '';

    const canAfford =
      state.resources.currency >= cost.currency &&
      state.resources.knowledgePoints >= cost.knowledge &&
      (state.materials.stockpiles.steel ?? 0) >= cost.steel &&
      state.energy.stored >= cost.energy;

    const check = (have: number, need: number) =>
      have >= need ? `<span class="gs-positive">${formatNumber(have)}/${formatNumber(need)} ✓</span>` : `<span class="gs-negative">${formatNumber(have)}/${formatNumber(need)} ✗</span>`;

    return `
      <div class="gs-stat-grid" style="margin-bottom:12px">
        <div class="gs-stat"><span class="gs-stat-label">Next Era</span><span class="gs-stat-value">${nextEra.replace('_', ' ')}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Currency</span>${check(state.resources.currency, cost.currency)}</div>
        <div class="gs-stat"><span class="gs-stat-label">Knowledge</span>${check(state.resources.knowledgePoints, cost.knowledge)}</div>
        <div class="gs-stat"><span class="gs-stat-label">Steel</span>${check(state.materials.stockpiles.steel ?? 0, cost.steel)}</div>
        <div class="gs-stat"><span class="gs-stat-label">Energy Stored</span>${check(state.energy.stored, cost.energy)}</div>
      </div>
      <button class="gs-action-btn ${canAfford ? '' : ''}" data-action='${JSON.stringify({ type: 'advance_era', payload: {} })}' ${canAfford ? '' : 'disabled'}>
        🚀 Advance to ${nextEra.replace('_', ' ')} Era
      </button>
    `;
  }

  private renderBuild(state: GameState): void {
    this.panelTitle.textContent = '🔨 Build';
    const currency = state.resources.currency;
    // btn with an optional info tooltip (ⓘ shows details on hover).
    const btn = (label: string, action: ActionPayload, cost: number, info = '') => {
      const infoIcon = info
        ? ` <span class="gs-info-badge" title="${info.replace(/"/g, '&quot;')}">ⓘ</span>`
        : '';
      return `<button class="gs-action-btn" data-action='${JSON.stringify(action)}' ${currency < cost ? 'disabled' : ''}>${label}${infoIcon}</button>`;
    };

    // Calculate labs and storage upgrade costs.
    const storageCost = 500 + state.energy.maxStorage * 0.8;
    const labCost = 500 + state.statistics.totalResearchCompleted * 150;
    const weaponsCost = 400 + state.weapons.factories.length * 200;

    this.panelContent.innerHTML = `
      <h3 class="gs-section-title">Power & Energy</h3>
      <div class="gs-action-list">
        ${btn('⚡ Coal Power Plant ($350)', { type: 'build_power_plant', payload: { type: 'coal', cost: 350 } }, 350, 'Generates energy by burning coal. Consumes coal stockpile. Reliable early power.')}
        ${btn('☀️ Solar Panel ($250)', { type: 'build_solar_panel', payload: { locationId: 'arizona', cost: 250 } }, 250, 'Clean energy from sunlight. Output drops in bad weather, but needs no fuel.')}
        ${btn(`🔋 Upgrade Storage ($${Math.floor(storageCost)}) [+200 cap]`, { type: 'upgrade_storage', payload: { cost: Math.floor(storageCost) } }, storageCost)}
      </div>

      <h3 class="gs-section-title">Mining & Industry</h3>
      <div class="gs-action-list">
        ${btn('⛏️ Coal Mine ($200)', { type: 'build_mine', payload: { materialType: 'coal', cost: 200, depositQuality: 0.5 } }, 200, 'Extracts coal over time — fuel for coal power plants.')}
        ${btn('⛏️ Iron Mine ($220)', { type: 'build_mine', payload: { materialType: 'iron_ore', cost: 220, depositQuality: 0.4 } }, 220, 'Extracts iron ore — refined into steel for building, weapons, and eras.')}
        ${btn('⛏️ Silicon Mine ($250)', { type: 'build_mine', payload: { materialType: 'silicon', cost: 250, depositQuality: 0.35 } }, 250, 'Extracts silicon — used to craft solar cells and electronics.')}
        ${btn('🏭 Distribution Network ($500)', { type: 'build_distribution_network', payload: { cost: 500 } }, 500, 'Increases the rate stored energy converts into currency income.')}
      </div>

      <h3 class="gs-section-title">Research & Military</h3>
      <div class="gs-action-list">
        ${btn(`🔬 Research Lab ($${labCost}) [+2 knowledge/tick]`, { type: 'build_lab', payload: { cost: labCost } }, labCost, 'Knowledge per tick (scaled by morale). Powers research and era advancement. Cost rises per lab.')}
        ${btn(`🔫 Weapons Factory ($${weaponsCost}, +5 power, uses 12 energy/tick)`, { type: 'build_weapons_factory', payload: { producing: 'conventional', cost: weaponsCost } }, weaponsCost, 'Plus 5 military power on build, then makes weapons from steel. Drains 12 energy/tick. Cost rises per factory.')}
      </div>

      <h3 class="gs-section-title">Space (requires orbital era)</h3>
      <div class="gs-action-list">
        ${btn('🛰️ Orbital Platform ($2000 + 10 fuel + 20 steel)', { type: 'build_orbital_platform', payload: { type: 'solar_collector', output: 15, cost: 2000 } }, 2000, 'Space solar collector — generates energy with no weather penalty. Needs 10 fuel + 20 steel too.')}
      </div>

      <h3 class="gs-section-title">Placement Grid</h3>
      <p class="gs-muted">Your base has ${state.energy.solarPanels.length} solar panels, ${state.energy.powerPlants.length} plants, ${state.infrastructure.mines.length} mines.</p>
      ${this.renderPlacementGrid(state)}
    `;
  }

  /**
   * Simple visual grid showing placed buildings as colored cells.
   * 8x6 grid; each building takes 1 cell.
   */
  private renderPlacementGrid(state: GameState): string {
    const COLS = 8;
    const ROWS = 6;
    const cells: string[] = new Array(COLS * ROWS).fill('⬛');

    // Fill cells with buildings.
    let idx = 0;
    for (let i = 0; i < state.energy.powerPlants.length && idx < cells.length; i++, idx++) {
      cells[idx] = state.energy.powerPlants[i].type === 'nuclear' ? '☢️' : '🏭';
    }
    for (let i = 0; i < state.energy.solarPanels.length && idx < cells.length; i++, idx++) {
      cells[idx] = '☀️';
    }
    for (let i = 0; i < state.infrastructure.mines.length && idx < cells.length; i++, idx++) {
      cells[idx] = '⛏️';
    }
    for (let i = 0; i < state.infrastructure.distributionNetworks.length && idx < cells.length; i++, idx++) {
      cells[idx] = '🏗️';
    }
    for (let i = 0; i < state.weapons.factories.length && idx < cells.length; i++, idx++) {
      cells[idx] = '🔫';
    }
    const labCount = state.statistics.totalResearchCompleted;
    for (let i = 0; i < labCount && idx < cells.length; i++, idx++) {
      cells[idx] = '🔬';
    }

    let gridHtml = '<div class="gs-grid">';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        gridHtml += `<span class="gs-grid-cell">${cells[r * COLS + c]}</span>`;
      }
    }
    gridHtml += '</div>';
    gridHtml += `<p class="gs-muted">${idx}/${COLS * ROWS} slots used</p>`;
    return gridHtml;
  }

  private renderCraftingPanel(state: GameState): void {
    this.panelTitle.textContent = '⚒️ Crafting';
    const currentEraIdx = ERA_ORDER.indexOf(state.currentEra);
    const btn = (label: string, action: ActionPayload, disabled = false) =>
      `<button class="gs-action-btn" data-action='${JSON.stringify(action)}' ${disabled ? 'disabled' : ''}>${label}</button>`;

    // Show active craft orders.
    let queueHtml = '';
    for (const factory of state.infrastructure.factories) {
      if (factory.type !== 'crafting') continue;
      for (const order of factory.currentOrders) {
        const pct = Math.round((order.progress / Math.max(1, order.totalTime)) * 100);
        queueHtml += `<div class="gs-stat"><span class="gs-stat-label">${order.recipeId} ×${order.quantity}</span><span class="gs-stat-value">${pct}%</span></div>`;
      }
    }

    // Show available recipes.
    let recipesHtml = '';
    for (const recipe of RECIPES) {
      const reqEraIdx = ERA_ORDER.indexOf(recipe.unlockedByEra);
      if (currentEraIdx < reqEraIdx) continue;

      const inputs = recipe.inputs.map(i => {
        const have = state.materials.stockpiles[i.material] ?? 0;
        const ok = have >= i.quantity;
        return `<span style="color:${ok ? '#86efac' : '#fca5a5'}">${i.material}: ${formatNumber(have)}/${i.quantity}</span>`;
      }).join(', ');

      const canCraft = recipe.inputs.every(i => (state.materials.stockpiles[i.material] ?? 0) >= i.quantity);
      const outputs = recipe.outputs.map(o => `${o.quantity} ${o.material}`).join(', ');

      recipesHtml += `
        <div style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:10px;margin-bottom:8px;">
          <strong>${recipe.name}</strong> (${recipe.craftTime}s)<br>
          <small>Needs: ${inputs}</small><br>
          <small>Makes: ${outputs}</small><br>
          ${btn(`Craft ${recipe.name}`, { type: 'queue_craft', payload: { recipeId: recipe.id, quantity: 1 } }, !canCraft)}
        </div>
      `;
    }

    this.panelContent.innerHTML = `
      ${queueHtml ? `<h3 class="gs-section-title">Active Orders</h3><div class="gs-stat-grid">${queueHtml}</div>` : ''}
      <h3 class="gs-section-title">Recipes</h3>
      ${recipesHtml || '<p class="gs-muted">No recipes available yet. Advance to a new era to unlock crafting.</p>'}
    `;
  }

  private renderResearch(state: GameState): void {
    this.panelTitle.textContent = '🔬 Research';
    const active = state.research.currentResearch;
    let html = '';
    if (active) {
      const remaining = active.remainingTicks;
      html += `<p class="gs-info">Researching: <strong>${active.nodeId}</strong> (${remaining} ticks left)</p>`;
    } else {
      html += `<p class="gs-info">Select a node to research:</p>`;
    }
    // Show available nodes across all trees.
    const trees = ['energy', 'materials', 'weapons', 'political', 'space'] as const;
    for (const tree of trees) {
      const treeState = state.research.trees[tree];
      const nodes = getTreeNodes(tree);
      const availableNodes = nodes.filter(n => {
        const ns = treeState.nodes[n.id];
        return ns ? ns.status === 'available' : n.status === 'available';
      });
      if (availableNodes.length > 0) {
        html += `<h3 class="gs-section-title">${tree.charAt(0).toUpperCase() + tree.slice(1)}</h3>`;
        for (const node of availableNodes) {
          const canAfford = state.resources.currency >= node.cost.currency && state.resources.knowledgePoints >= node.cost.knowledge;
          const action: ActionPayload = { type: 'start_research', payload: { nodeId: node.id } };
          html += `<button class="gs-action-btn" data-action='${JSON.stringify(action)}' ${!canAfford || active ? 'disabled' : ''}>
            ${node.name} — $${node.cost.currency} + ${node.cost.knowledge}kp (${node.researchTime}t)
          </button>`;
        }
      }
    }
    this.panelContent.innerHTML = html;
  }

  private renderSettingsPanel(_state: GameState): void {
    this.panelTitle.textContent = '⚙️ Settings';
    this.panelContent.innerHTML = `
      <div class="gs-action-list">
        <button class="gs-action-btn gs-danger" data-action='${JSON.stringify({ type: 'restart_game', payload: {} })}'>🔄 Restart Game (pick new country)</button>
        <button class="gs-action-btn" onclick="document.dispatchEvent(new CustomEvent('shg-export'))">💾 Export Save</button>
      </div>
      <h3 class="gs-section-title">Credits</h3>
      <p class="gs-muted">World map: "Simple World Map" by Al MacDonald, editor Fritz Lekschas. Licensed <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" style="color:#93c5fd">CC BY-SA 3.0</a>.</p>
    `;
  }

  private renderEarthPanel(state: GameState): void {
    this.panelTitle.textContent = '🌍 Earth — World Map & Military';
    const btn = (label: string, action: ActionPayload, disabled = false) =>
      `<button class="gs-action-btn" data-action='${JSON.stringify(action)}' ${disabled ? 'disabled' : ''}>${label}</button>`;

    const playerCountry = state.country;

    // Your country facilities.
    const labCount = state.statistics.totalResearchCompleted;
    const facilitiesHtml = `
      <h3 class="gs-section-title">Your Facilities (${COUNTRY_PROFILES[playerCountry]?.name})</h3>
      <div class="gs-stat-grid">
        <div class="gs-stat"><span class="gs-stat-label">🔬 Research Labs</span><span class="gs-stat-value">${labCount}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">🔫 Arms Centers</span><span class="gs-stat-value">${state.weapons.factories.length}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">☀️ Solar Centers</span><span class="gs-stat-value">${state.energy.solarPanels.length}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">🏭 Power Plants</span><span class="gs-stat-value">${state.energy.powerPlants.length}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">⛏️ Mines</span><span class="gs-stat-value">${state.infrastructure.mines.length}</span></div>
      </div>
    `;

    // Military base section.
    const soldiers = Math.floor(state.weapons.militaryPower * 10); // 10 soldiers per power point
    const arsenal = state.weapons.arsenal;
    const militaryHtml = `
      <h3 class="gs-section-title">🎖️ Military Base</h3>
      <div class="gs-stat-grid">
        <div class="gs-stat"><span class="gs-stat-label">Total Power</span><span class="gs-stat-value">${formatNumber(state.weapons.militaryPower)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Soldiers</span><span class="gs-stat-value">${formatNumber(soldiers)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">🔫 Rifles</span><span class="gs-stat-value">${arsenal.conventional} (1 soldier each)</span></div>
        <div class="gs-stat"><span class="gs-stat-label">🚀 Missiles</span><span class="gs-stat-value">${arsenal.missile} (5 soldiers each)</span></div>
        <div class="gs-stat"><span class="gs-stat-label">💻 Cyber</span><span class="gs-stat-value">${arsenal.cyber} (3 soldiers each)</span></div>
        <div class="gs-stat"><span class="gs-stat-label">⚡ Energy Wpns</span><span class="gs-stat-value">${arsenal.energy} (10 soldiers each)</span></div>
        <div class="gs-stat"><span class="gs-stat-label">🛰️ Orbital</span><span class="gs-stat-value">${arsenal.orbital} (20 soldiers each)</span></div>
      </div>
      <p class="gs-muted">Soldiers assigned: ${arsenal.conventional * 1 + arsenal.missile * 5 + arsenal.cyber * 3 + arsenal.energy * 10 + arsenal.orbital * 20} / ${soldiers} available</p>
      <div class="gs-action-list">
        ${btn('🔫 Produce Rifles (1 steel → +1 power)', { type: 'produce_rifles', payload: {} }, (state.materials.stockpiles.steel ?? 0) < 1)}
        ${btn('⚔️ Attack UN Forces', { type: 'countermeasure', payload: { type: 'military_defense' } }, state.weapons.militaryPower <= state.opposition.unPowerLevel)}
        ${btn('🕊️ Diplomatic Deception', { type: 'countermeasure', payload: { type: 'diplomatic_deception' } })}
        ${btn('📢 Education Campaign ($500)', { type: 'countermeasure', payload: { type: 'education_campaign', investment: 500 } }, state.resources.currency < 500)}
      </div>
    `;

    this.panelContent.innerHTML = `
      <h3 class="gs-section-title">World Map</h3>
      <p class="gs-muted">🟢 You | 🔵 Controlled | 🟡 Influenced | 🔴 Hostile. Click a country to interact.</p>
      <div class="gs-svgmap-host" id="gs-worldmap-host"></div>
      ${facilitiesHtml}
      ${militaryHtml}
    `;

    // Mount the interactive SVG map into its host container (after innerHTML set).
    const mapHost = this.panelContent.querySelector<HTMLElement>('#gs-worldmap-host');
    if (mapHost) this.worldMap.mount(mapHost, state);
  }

  /** Panel for interacting with a specific foreign country. */
  private renderCountryPanel(countryId: string, state: GameState): void {
    const id = countryId.replace('country_', '') as CountryId;
    const profile = COUNTRY_PROFILES[id];
    if (!profile || id === state.country) {
      // Player's home country → open Build panel
      this.renderBuild(state);
      return;
    }

    const influence = state.political.influence[id] ?? 0;
    const isControlled = state.political.installedPoliticians.includes(id);

    if (isControlled) {
      // Controlled country → shows tax income + build access
      const economy = profile.startingResources.currency ?? 800;
      const taxPerTick = (economy * 0.02).toFixed(1);
      this.panelTitle.textContent = `🏗️ ${profile.name} (Controlled)`;
      this.panelContent.innerHTML = `
        <p class="gs-positive">✓ This country is under your control.</p>
        <div class="gs-stat-grid">
          <div class="gs-stat"><span class="gs-stat-label">💰 Tax Income</span><span class="gs-stat-value gs-positive">+${taxPerTick}/tick</span></div>
          <div class="gs-stat"><span class="gs-stat-label">Influence</span><span class="gs-stat-value">${influence.toFixed(0)}%</span></div>
        </div>
        <p class="gs-muted">Controlled countries pay you taxes each tick. Keep influence above 50% or risk a coup. Control 5+ countries for World Domination (×1.5 tax bonus).</p>
      `;
      return;
    }

    const btn = (label: string, action: ActionPayload, disabled = false) =>
      `<button class="gs-action-btn" data-action='${JSON.stringify(action)}' ${disabled ? 'disabled' : ''}>${label}</button>`;

    const garrison = profile.startingMilitary ?? 10;
    const canAttack = !isControlled && state.weapons.militaryPower >= 10;

    this.panelTitle.textContent = `🎯 ${profile.name}`;
    this.panelContent.innerHTML = `
      <div class="gs-stat-grid">
        <div class="gs-stat"><span class="gs-stat-label">Influence</span><span class="gs-stat-value">${influence.toFixed(1)}%</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Status</span><span class="gs-stat-value">${isControlled ? '🟢 Controlled' : influence >= 75 ? '🟡 Ripe for takeover' : '🔴 Independent'}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Garrison</span><span class="gs-stat-value">🛡️ ${garrison}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Your Power</span><span class="gs-stat-value">⚔️ ${formatNumber(state.weapons.militaryPower)}</span></div>
      </div>
      ${!isControlled ? `
        <h3 class="gs-section-title">⚔️ Military Action</h3>
        <div class="gs-action-list">
          ${btn(`⚔️ Attack ${profile.name} (luck + quantity)`, { type: 'attack_country', payload: { country: id, garrison } }, !canAttack)}
        </div>
        <p class="gs-muted">${!canAttack ? 'Need at least 10 military power to attack.' : 'Outcome based on your power vs their garrison × luck.'}</p>
      ` : '<p class="gs-positive">✓ This country is under your control.</p>'}
      <h3 class="gs-section-title">Political Operations (cost $100 each)</h3>
      <div class="gs-action-list">
        ${btn('💰 Economic Aid (+0.5/tick)', { type: 'invest_influence', payload: { country: id, method: 'economic_aid', amount: 100 } }, state.resources.currency < 100)}
        ${btn('📺 Propaganda (+0.3/tick)', { type: 'invest_influence', payload: { country: id, method: 'propaganda', amount: 100 } }, state.resources.currency < 100)}
        ${btn('🏢 Corporate Infiltration (+0.8/tick)', { type: 'invest_influence', payload: { country: id, method: 'corporate_infiltration', amount: 100 } }, state.resources.currency < 100)}
        ${btn('🕵️ Intelligence (+1.0/tick)', { type: 'invest_influence', payload: { country: id, method: 'intelligence', amount: 100 } }, state.resources.currency < 100)}
      </div>
      <p class="gs-muted">At 75% influence, a politician is auto-installed. Control 5+ countries for World Domination.</p>
    `;
  }

  private renderMoonPanel(state: GameState): void {
    this.panelTitle.textContent = '🌙 Moon — Orbital & Aliens';
    const signals = state.alien?.signals?.filter(s => !s.investigated && !s.outcome) ?? [];
    const signalId = signals[0]?.id;
    const btn = (label: string, action: ActionPayload, disabled = false) =>
      `<button class="gs-action-btn" data-action='${JSON.stringify(action)}' ${disabled ? 'disabled' : ''}>${label}</button>`;

    this.panelContent.innerHTML = `
      <div class="gs-stat-grid">
        <div class="gs-stat"><span class="gs-stat-label">Platforms</span><span class="gs-stat-value">${state.space.orbitalPlatforms.length}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Alien Relations</span><span class="gs-stat-value">${state.alien?.relationsScore ?? 0}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Pending Signals</span><span class="gs-stat-value">${signals.length}</span></div>
      </div>
      <h3 class="gs-section-title">Alien Contact</h3>
      <div class="gs-action-list">
        ${signalId ? btn('🔍 Investigate Signal', { type: 'investigate_signal', payload: { signalId } }) : '<p class="gs-muted">No pending signals. Mine asteroids to detect signals.</p>'}
        ${signalId ? btn('📡 Broadcast Response (+relations)', { type: 'broadcast_response', payload: { signalId } }) : ''}
        ${signalId ? btn('🚫 Ignore Signal', { type: 'ignore_signal', payload: { signalId } }) : ''}
      </div>
    `;
  }

  private renderMarsPanel(state: GameState): void {
    this.panelTitle.textContent = '🔴 Mars';
    const mars = state.mars;
    this.panelContent.innerHTML = mars.unlocked
      ? `<div class="gs-stat-grid">
          <div class="gs-stat"><span class="gs-stat-label">Base Level</span><span class="gs-stat-value">${mars.baseLevel}</span></div>
          <div class="gs-stat"><span class="gs-stat-label">Regolith Iron</span><span class="gs-stat-value">${formatNumber(mars.resources.regolith_iron ?? 0)}</span></div>
          <div class="gs-stat"><span class="gs-stat-label">Martian Ice</span><span class="gs-stat-value">${formatNumber(mars.resources.martian_ice ?? 0)}</span></div>
        </div>`
      : `<p class="gs-muted">Mars not unlocked. Reach the Mars Colonization Era.</p>`;
  }

  private renderAsteroidsPanel(state: GameState): void {
    this.panelTitle.textContent = '☄️ Asteroid Belt';
    this.panelContent.innerHTML = `
      <div class="gs-stat-grid">
        <div class="gs-stat"><span class="gs-stat-label">Fleet Size</span><span class="gs-stat-value">${state.space.fleet.size}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Territories</span><span class="gs-stat-value">${state.space.territories.length} / ${state.space.maxTerritories}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Fuel</span><span class="gs-stat-value">${formatNumber(state.space.fleet.currentFuel)}</span></div>
      </div>
    `;
  }

  private renderSunPanel(state: GameState): void {
    this.panelTitle.textContent = '☀️ Dyson Ring';
    this.panelContent.innerHTML = `
      <div class="gs-stat-grid">
        <div class="gs-stat"><span class="gs-stat-label">Segments</span><span class="gs-stat-value">${state.dyson.completedSegments} / ${state.dyson.totalSegments}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Energy Multiplier</span><span class="gs-stat-value gs-positive">${state.dyson.energyMultiplier.toFixed(1)}x</span></div>
        ${state.dyson.victoryAchieved ? '<div class="gs-stat"><span class="gs-stat-value gs-positive">🏆 VICTORY</span></div>' : ''}
      </div>
    `;
  }

  // ─── Tutorial ─────────────────────────────────────────────────────────

  private showTutorialStep(): void {
    if (this.tutorialStep >= TUTORIAL_STEPS.length) {
      this.endTutorial();
      return;
    }
    const step = TUTORIAL_STEPS[this.tutorialStep];
    this.tutorialText.textContent = `[${this.tutorialStep + 1}/${TUTORIAL_STEPS.length}] ${step.title}: ${step.body}`;
  }

  private nextTutorialStep(): void {
    this.tutorialStep++;
    this.showTutorialStep();
  }

  private endTutorial(): void {
    this.tutorialActive = false;
    this.tutorialBar.hidden = true;
    try { localStorage.setItem('shg_tutorial_done', '1'); } catch { /* storage blocked */ }
  }
}
