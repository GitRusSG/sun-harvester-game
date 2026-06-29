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
import { SolarScene } from './three/solar-scene.js';
import { CelestialNavigator, CELESTIAL_BODIES, isBodyUnlocked } from './celestial-nav.js';
import { COUNTRY_PROFILES, getAllCountryIds } from '../data/countries.js';
import { getTreeNodes } from '../data/tech-trees.js';
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

  constructor(container: HTMLElement) {
    this.container = container;
    this.navigator = new CelestialNavigator();
    this.build();
  }

  setActionHandler(handler: ActionHandler): void {
    this.onAction = handler;
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
    this.hud.hidden = true;
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
    if (localStorage.getItem('shg_tutorial_done') === '1') return;
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
      <span class="gs-hud-item" data-hud="era">🏛️ Fossil</span>
      <span class="gs-hud-item" data-hud="weather">☀️ 1.0x</span>
      <span class="gs-hud-item" data-hud="military">🔫 0</span>
      <button class="gs-hud-btn" data-open="dashboard">📊 Dashboard</button>
      <button class="gs-hud-btn" data-open="build">🔨 Build</button>
      <button class="gs-hud-btn" data-open="research">🔬 Research</button>
      <button class="gs-hud-btn" data-open="settings">⚙️ Settings</button>
    `;
    this.container.appendChild(this.hud);

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
    switch (id) {
      case 'dashboard': this.renderDashboard(state); break;
      case 'build': this.renderBuild(state); break;
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
    this.panelContent.innerHTML = `
      <div class="gs-stat-grid">
        <div class="gs-stat"><span class="gs-stat-label">Currency</span><span class="gs-stat-value">${formatNumber(state.resources.currency)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Income</span><span class="gs-stat-value gs-positive">+${formatNumber(income)}/s</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Expenses</span><span class="gs-stat-value gs-negative">-${formatNumber(expense)}/s</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Net</span><span class="gs-stat-value ${net >= 0 ? 'gs-positive' : 'gs-negative'}">${net >= 0 ? '+' : ''}${formatNumber(net)}/s</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Energy</span><span class="gs-stat-value">${formatNumber(state.energy.stored)} / ${formatNumber(state.energy.maxStorage)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Knowledge</span><span class="gs-stat-value">${formatNumber(state.resources.knowledgePoints)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Coal</span><span class="gs-stat-value">${formatNumber(state.materials.stockpiles.coal ?? 0)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Iron</span><span class="gs-stat-value">${formatNumber(state.materials.stockpiles.iron_ore ?? 0)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Steel</span><span class="gs-stat-value">${formatNumber(state.materials.stockpiles.steel ?? 0)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Military</span><span class="gs-stat-value">${formatNumber(state.weapons.militaryPower)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Solar Panels</span><span class="gs-stat-value">${state.energy.solarPanels.length}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Power Plants</span><span class="gs-stat-value">${state.energy.powerPlants.length}</span></div>
      </div>
    `;
  }

  private renderBuild(state: GameState): void {
    this.panelTitle.textContent = '🔨 Build';
    const currency = state.resources.currency;
    const btn = (label: string, action: ActionPayload, cost: number) =>
      `<button class="gs-action-btn" data-action='${JSON.stringify(action)}' ${currency < cost ? 'disabled' : ''}>${label}</button>`;

    this.panelContent.innerHTML = `
      <div class="gs-action-list">
        ${btn('⚡ Coal Power Plant ($150)', { type: 'build_power_plant', payload: { type: 'coal', cost: 150 } }, 150)}
        ${btn('☀️ Solar Panel ($100)', { type: 'build_solar_panel', payload: { locationId: 'arizona', cost: 100 } }, 100)}
        ${btn('⛏️ Coal Mine ($80)', { type: 'build_mine', payload: { materialType: 'coal', cost: 80, depositQuality: 0.7 } }, 80)}
        ${btn('⛏️ Iron Mine ($80)', { type: 'build_mine', payload: { materialType: 'iron_ore', cost: 80, depositQuality: 0.6 } }, 80)}
        ${btn('🏭 Distribution ($200)', { type: 'build_distribution_network', payload: { cost: 200 } }, 200)}
        ${btn('🔫 Weapons Factory', { type: 'build_weapons_factory', payload: { producing: 'conventional' } }, 0)}
        ${btn('🛰️ Orbital Platform (10 fuel + 20 steel)', { type: 'build_orbital_platform', payload: { type: 'solar_collector', output: 15 } }, 0)}
      </div>
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
        <button class="gs-action-btn gs-danger" onclick="localStorage.clear(); window.location.reload();">🔄 Restart Game</button>
        <button class="gs-action-btn" onclick="document.dispatchEvent(new CustomEvent('shg-export'))">💾 Export Save</button>
      </div>
    `;
  }

  private renderEarthPanel(state: GameState): void {
    this.panelTitle.textContent = '🌍 Earth — War & Politics';
    const btn = (label: string, action: ActionPayload, disabled = false) =>
      `<button class="gs-action-btn" data-action='${JSON.stringify(action)}' ${disabled ? 'disabled' : ''}>${label}</button>`;

    this.panelContent.innerHTML = `
      <div class="gs-stat-grid">
        <div class="gs-stat"><span class="gs-stat-label">Approval</span><span class="gs-stat-value">${state.opposition.publicApproval.toFixed(0)}%</span></div>
        <div class="gs-stat"><span class="gs-stat-label">UN Hostility</span><span class="gs-stat-value gs-negative">${state.opposition.unHostility.toFixed(0)}%</span></div>
        <div class="gs-stat"><span class="gs-stat-label">UN Power</span><span class="gs-stat-value">${state.opposition.unPowerLevel.toFixed(0)}</span></div>
        <div class="gs-stat"><span class="gs-stat-label">Your Military</span><span class="gs-stat-value">${formatNumber(state.weapons.militaryPower)}</span></div>
      </div>
      <h3 class="gs-section-title">War Actions</h3>
      <div class="gs-action-list">
        ${btn('⚔️ Attack UN (Military)', { type: 'countermeasure', payload: { type: 'military_defense' } }, state.weapons.militaryPower <= state.opposition.unPowerLevel)}
        ${btn('🕊️ Diplomatic Deception (-10 hostility)', { type: 'countermeasure', payload: { type: 'diplomatic_deception' } })}
        ${btn('📢 Education Campaign ($500)', { type: 'countermeasure', payload: { type: 'education_campaign', investment: 500 } }, state.resources.currency < 500)}
        ${btn('💰 Economic Leverage', { type: 'countermeasure', payload: { type: 'economic_leverage' } }, state.opposition.activeSanctions.length === 0)}
      </div>
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
    localStorage.setItem('shg_tutorial_done', '1');
  }
}
