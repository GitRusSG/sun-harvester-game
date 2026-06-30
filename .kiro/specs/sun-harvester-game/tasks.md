# Implementation Plan: Sun Harvester Game

## Overview

Build a browser-based incremental management game using TypeScript and Vite. The game uses an ECS-inspired architecture with a central game loop, modular systems, tick-based simulation, data-driven content, and localStorage persistence. Implementation proceeds in dependency order: core engine first, then foundational systems, then progressively complex era-specific systems, and finally UI and integration wiring.

## Tasks

- [ ] 1. Set up project structure and core type definitions
  - [x] 1.1 Initialize Vite + TypeScript project structure for the game
    - Create `src/game/` directory structure with folders: `core/`, `systems/`, `data/`, `ui/`, `utils/`
    - Configure Vite for the game entry point
    - Add any needed dev dependencies (e.g., vitest for testing)
    - _Requirements: 9.1, 10.1_

  - [x] 1.2 Define all core TypeScript interfaces and type definitions
    - Create `src/game/core/types.ts` with: `GameState`, `Era`, `CountryId`, `GameSystem`, `StateUpdate`, `GameEvent`, `EventType`
    - Create `src/game/core/resources.ts` with: `ResourceState`, `MaterialState`, `MaterialType`, `EnergyState`, `SolarPanel`, `PowerPlant`, `Location`
    - Create `src/game/core/research.ts` with: `ResearchState`, `TechTreeId`, `TechNode`, `TechNodeState`, `ActiveResearch`
    - Create `src/game/core/infrastructure.ts` with: `InfrastructureState`, `Mine`, `Factory`, `CraftOrder`, `DistributionNetwork`
    - Create `src/game/core/opposition.ts` with: `OppositionState`, `Protest`, `Sanction`, `PoliticalState`, `PoliticalOperation`, `InfluenceMethod`
    - Create `src/game/core/space.ts` with: `MarsState`, `SpaceState`, `OrbitalPlatform`, `AsteroidTerritory`, `FleetState`, `DysonState`, `DysonSegment`
    - Create `src/game/core/combat.ts` with: `WeaponsState`, `WeaponsFactory`, `WeaponCategoryId`, `AlienState`, `AlienSignal`, `AlienThreat`
    - Create `src/game/core/country.ts` with: `CountryProfile`, `CountryBuff`, `BuffType`
    - Create `src/game/core/education.ts` with: `EducationState`, `Quiz`
    - Create `src/game/core/weather.ts` with: `WeatherState`, `WeatherCondition`, `WEATHER_MODIFIERS`
    - _Requirements: 1.1, 6.1, 11.1, 21.1_

  - [x] 1.3 Create utility functions
    - Implement `formatNumber()` in `src/game/utils/format.ts` with K/M/B abbreviations
    - Implement ID generation utility
    - _Requirements: 10.1_

  - [x] 1.4 Write unit tests for utility functions
    - Test `formatNumber` with values below 1K, at 1K, 1M, 1B boundaries
    - Test edge cases: 0, negative numbers, very large numbers
    - _Requirements: 10.1_

- [ ] 2. Implement State Manager and Save System
  - [x] 2.1 Implement the State Manager
    - Create `src/game/core/state-manager.ts`
    - Implement `createInitialState(country: CountryId): GameState` that produces a valid starting state
    - Implement `applyUpdate(state: GameState, update: StateUpdate): GameState` that immutably merges state updates
    - Implement era progression detection logic
    - _Requirements: 6.1, 6.2, 6.4, 21.3_

  - [x] 2.2 Implement the Save System with localStorage persistence
    - Create `src/game/core/save-system.ts` implementing the `SaveSystem` interface
    - Implement `save(state)` writing JSON to localStorage
    - Implement `load()` reading and parsing from localStorage, returning null on failure
    - Implement `validateState(data)` type guard with version checking
    - Implement `exportToJSON(state)` and `importFromJSON(json)` for manual save/load
    - Implement `getLastSaveTimestamp()` for offline calculation
    - Handle corrupted/incompatible data gracefully (return null, log warning)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 2.3 Write unit tests for State Manager and Save System
    - Test `createInitialState` produces valid state for each country
    - Test `applyUpdate` merges resources, materials, unlocks correctly
    - Test save/load round-trip preserves state
    - Test corrupted data handling
    - Test export/import JSON format
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 3. Implement Game Loop and Event Controller
  - [x] 3.1 Implement the Game Loop
    - Create `src/game/core/game-loop.ts`
    - Implement active-mode tick scheduling (1-second interval via `setInterval`)
    - Implement `requestAnimationFrame` rendering loop separate from simulation
    - Implement offline bulk-tick calculation: `elapsedSeconds = min(now - lastSave, 86400)`
    - Call each active system's `update(state, deltaTicks)` in the defined dependency order
    - Filter systems by `activeEras` based on current era
    - Implement auto-save every 60 seconds
    - Implement `beforeunload` handler for final save
    - _Requirements: 1.1, 1.2, 1.3, 9.1, 9.2_

  - [x] 3.2 Implement the Event Controller
    - Create `src/game/core/event-controller.ts`
    - Implement event queue that collects `GameEvent` objects from system updates
    - Implement event dispatch to UI notification system
    - Implement era-unlock event handling that activates new systems
    - _Requirements: 6.2, 6.3, 10.5_

  - [x] 3.3 Write unit tests for Game Loop and Event Controller
    - Test that systems are called in correct dependency order
    - Test offline calculation respects 24-hour cap
    - Test era filtering of active systems
    - Test event queuing and dispatch
    - _Requirements: 1.1, 1.2, 1.3, 6.2_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Weather System
  - [x] 5.1 Implement the Weather System
    - Create `src/game/systems/weather-system.ts` implementing `WeatherSystem` interface
    - Implement weather cycling on configurable tick intervals
    - Implement `getModifier(weather)` returning production multipliers (sunny: 1.0, partly_cloudy: 0.7, overcast: 0.4, rainy: 0.2)
    - Implement `advanceWeather(state, deltaTicks)` that transitions weather states
    - Emit `weather_change` events when weather transitions
    - Active in all eras
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 5.2 Write unit tests for Weather System
    - Test weather modifier values match specification
    - Test weather cycling advances correctly over ticks
    - Test weather change events are emitted
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 6. Implement Resource System
  - [x] 6.1 Implement the Resource System (energy, currency, materials)
    - Create `src/game/systems/resource-system.ts` implementing `ResourceSystem` interface
    - Implement `calculateProduction(state)` computing energy/second, currency/second, maintenance costs, net currency, and material rates
    - Implement solar panel output calculation: `baseOutput * efficiency * weatherModifier * locationIrradiance`
    - Implement power plant output with fuel consumption logic (halt if fuel depleted)
    - Implement energy storage capping (discard excess when storage full)
    - Implement revenue generation from stored energy with dynamic pricing (higher supply → lower unit price)
    - Implement maintenance cost deduction based on total infrastructure
    - Implement zero-currency warning state (halt new construction)
    - Implement `calculateOfflineEarnings(state, elapsedSeconds)` for offline bulk calculation
    - Active in all eras
    - _Requirements: 1.1, 1.2, 1.3, 2.2, 4.1, 4.2, 4.3, 4.4, 8.1, 8.2, 8.3, 8.4, 12.2, 12.4, 12.5, 12.6_

  - [x] 6.2 Implement player actions for Resource System
    - Implement solar panel placement (deduct cost, validate currency)
    - Implement power plant construction (coal from start, nuclear from Nuclear Era)
    - Implement mine construction with deposit quality and material rates
    - Implement distribution network building (increases energy→revenue conversion rate)
    - _Requirements: 2.1, 2.3, 2.4, 4.3, 11.2, 12.1, 12.3_

  - [x] 6.3 Write unit tests for Resource System
    - Test production calculation with various infrastructure configurations
    - Test weather modifier application to solar output
    - Test energy storage cap behavior
    - Test fuel depletion halts power plants
    - Test offline earnings calculation with 24h cap
    - Test zero-currency state blocks construction
    - _Requirements: 1.1, 1.2, 1.3, 2.2, 4.2, 8.3, 12.6_

- [ ] 7. Implement Supply Chain System
  - [x] 7.1 Implement the Supply Chain System
    - Create `src/game/systems/supply-chain-system.ts` implementing `SupplyChainSystem` interface
    - Create `src/game/data/recipes.ts` defining all crafting recipes as static data (e.g., Steel Beams: 3 Iron + 1 Coal, Solar Cells: 2 Silicon + 1 Copper)
    - Implement `canCraft(state, recipeId)` returning available/missing materials
    - Implement `queueCraft(state, recipeId, quantity)` reserving materials and adding to factory queue
    - Implement craft progress tracking in `update()` — decrement remaining time per tick, emit `crafting_complete` on finish
    - Implement automation: auto-craft when materials available if recipe is set to automated
    - Implement recipe unlocking by era and research node
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 11.3, 11.4_

  - [x] 7.2 Write unit tests for Supply Chain System
    - Test `canCraft` with sufficient and insufficient materials
    - Test craft queue reserves materials correctly
    - Test craft completion deducts inputs and adds outputs
    - Test automation triggers when materials are available
    - Test recipe unlock conditions
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6_

- [ ] 8. Implement Tech System
  - [x] 8.1 Implement the Tech System with five research trees
    - Create `src/game/systems/tech-system.ts` implementing `TechSystem` interface
    - Create `src/game/data/tech-trees.ts` defining all five trees (energy, materials, weapons, political, space) with nodes, prerequisites, costs, and bonuses
    - Implement `getAvailableNodes(state, tree)` filtering by prerequisite completion
    - Implement `startResearch(state, nodeId)` deducting currency + knowledge points, starting timer
    - Implement research progress in `update()` — decrement remaining ticks, emit `research_complete` and apply bonus on finish
    - Implement `getCrossSynergies(state, nodeId)` calculating cost reductions from related trees
    - Implement node status transitions: locked → available → researching → completed
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 8.2 Write unit tests for Tech System
    - Test node availability respects prerequisites
    - Test research start deducts correct costs
    - Test research completion applies bonuses
    - Test cross-tree synergy calculations
    - Test status transitions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 9. Implement Weapons System
  - [x] 9.1 Implement the Weapons System
    - Create `src/game/systems/weapons-system.ts` implementing `WeaponsSystem` interface
    - Create `src/game/data/weapons.ts` defining weapon categories, recipes, and tier unlocks
    - Implement weapon factory production: produce units per tick based on factory level and material supply
    - Implement `getMilitaryPower(state)` computing composite score from all weapon systems
    - Implement weapon category unlocking via Weapons Development tech tree
    - Implement weapon recipes integrated with Supply Chain (Missile: Steel + Electronics + Fuel, etc.)
    - Active from Fossil Era (conventional arms only initially)
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6_

  - [x] 9.2 Write unit tests for Weapons System
    - Test weapon production rates based on factory level
    - Test military power calculation
    - Test weapon category unlock conditions
    - _Requirements: 22.1, 22.2, 22.5_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Political System
  - [x] 11.1 Implement the Political System
    - Create `src/game/systems/political-system.ts` implementing `PoliticalSystem` interface
    - Implement influence tracking for each of the 9 non-player countries (0-100 scale)
    - Implement `investInfluence(state, country, method, amount)` increasing influence over time with four methods: economic_aid, propaganda, corporate_infiltration, intelligence
    - Implement politician installation when influence exceeds 75% — grants resource access from that country
    - Implement coup mechanic: if influence drops below 50% after installation, remove politician
    - Implement `checkWorldDomination(state)` — true when 5+ countries controlled, disables UN sanctions
    - Implement global resource pooling when World Domination achieved (sum of controlled country production × efficiency factor)
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 24.1, 24.2, 24.3_

  - [x] 11.2 Write unit tests for Political System
    - Test influence growth over ticks
    - Test politician installation threshold
    - Test coup trigger below 50%
    - Test World Domination check with 5+ countries
    - Test resource pooling calculation
    - _Requirements: 23.2, 23.3, 23.5, 23.6, 24.1, 24.2_

- [x] 12. Implement Opposition System
  - [x] 12.1 Implement the Opposition System (protests, UN, public approval)
    - Create `src/game/systems/opposition-system.ts` implementing `OppositionSystem` interface
    - Implement public approval tracking (0-100), starts at 70
    - Implement protest generation: anti-nuclear protests proportional to nuclear plant count, reducing construction speed
    - Implement construction block when approval drops below 30%
    - Implement UN as active enemy: escalating hostility based on player energy output and territory
    - Implement UN attack events: sanctions (increase trade costs), embargo, military intervention
    - Implement UN power level reduction when player defeats interventions
    - Implement final UN confrontation when player global influence exceeds 70%
    - Implement countermeasures: education_campaign (raise approval), military_defense, diplomatic_deception, economic_leverage, tech_superiority
    - Implement military power comparison: if player military > UN threat, reduce attack severity
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 22.6_

  - [x] 12.2 Write unit tests for Opposition System
    - Test protest intensity scales with nuclear plants
    - Test construction block at 30% approval
    - Test UN attack thresholds
    - Test sanctions increase trade costs
    - Test education campaign raises approval
    - Test military power reduces attack severity
    - _Requirements: 16.1, 16.2, 16.4, 17.2, 17.4, 22.6_

- [x] 13. Implement Alien System
  - [x] 13.1 Implement the Alien Encounter System
    - Create `src/game/systems/alien-system.ts`
    - Implement alien signal probability during asteroid mining operations
    - Implement player choice handling: investigate, ignore, broadcast
    - Implement encounter outcomes: cooperative (tech trades) or hostile (defense threat)
    - Implement alien relations score (-100 to 100) affecting future encounter trends
    - Implement escalation: forced contact after set number of ignored signals
    - Implement alien threats requiring resource allocation to defense
    - Active from Space Mining Era
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.8_

  - [x] 13.2 Write unit tests for Alien System
    - Test signal probability during mining
    - Test encounter outcome generation
    - Test relations score affects outcomes
    - Test forced contact after ignored signals
    - _Requirements: 19.1, 19.3, 19.6, 19.8_

- [x] 14. Implement Space System
  - [x] 14.1 Implement the Space System (orbital platforms, territories)
    - Create `src/game/systems/space-system.ts`
    - Implement orbital platform construction (requires launch costs: fuel + materials)
    - Implement space-based solar collectors with no weather penalty
    - Implement asteroid territory claiming with claim cost and resource surveys
    - Implement territory resource profiles (iron-rich, rare-earth-rich, ice-rich)
    - Implement territory limit based on fleet size and fuel supply
    - Implement territory production rates based on deposit quality and mining level
    - Active from Orbital Era (platforms) and Space Mining Era (territories)
    - _Requirements: 15.1, 15.2, 15.3, 15.5, 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x] 14.2 Write unit tests for Space System
    - Test orbital platform removes weather penalty
    - Test territory claim deducts costs
    - Test territory limit enforcement
    - Test resource production from territories
    - _Requirements: 15.5, 20.1, 20.3, 20.4, 20.5_

- [x] 15. Implement Mars System
  - [x] 15.1 Implement the Mars Base System
    - Create `src/game/systems/mars-system.ts`
    - Implement Mars base construction with significant launch costs
    - Implement Mars-unique resource production: regolith iron, Martian ice, CO2 fuel
    - Implement lower-cost orbital launches due to reduced gravity (launch cost reduction multiplier)
    - Implement Earth-Mars resource allocation balancing
    - Active from Mars Colonization Era
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 15.2 Write unit tests for Mars System
    - Test Mars resource production
    - Test launch cost reduction calculation
    - Test resource allocation between Earth and Mars
    - _Requirements: 18.3, 18.4, 18.5_

- [x] 16. Implement Dyson Ring System
  - [x] 16.1 Implement the Dyson Ring Construction System
    - Create `src/game/systems/dyson-system.ts`
    - Implement multi-segment Dyson Ring (at least 5 segments) with material requirements per segment
    - Implement segment completion tracking and progress
    - Implement energy multiplier proportional to completed segments
    - Implement victory condition: all segments complete triggers victory event
    - Active from Dyson Ring Era
    - _Requirements: 14.1, 14.2, 14.3, 14.5_

  - [x] 16.2 Write unit tests for Dyson Ring System
    - Test segment progress tracking
    - Test energy multiplier scales with segments
    - Test victory event triggers on final segment
    - _Requirements: 14.2, 14.3, 14.5_

- [x] 17. Implement Education System
  - [x] 17.1 Implement the Education System
    - Create `src/game/systems/education-system.ts`
    - Create `src/game/data/education-content.ts` with facts for each topic area (fossil fuels, nuclear, solar, materials, orbital mechanics, Dyson concepts, geopolitics, Mars, aliens, weapons/deterrence)
    - Implement fact presentation on research node unlock and milestone completion
    - Implement quiz generation on milestone completion with multiple-choice questions
    - Implement quiz reward: correct answer grants bonus knowledge points; incorrect shows explanation
    - Implement educational triggers for first encounters (weather types, country selection, weapon manufacturing, UN events, alien signals)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.4, 12.7, 14.6, 15.4, 16.7, 17.7, 18.7, 19.7, 20.7, 21.6, 22.7, 23.8_

  - [x] 17.2 Write unit tests for Education System
    - Test fact presentation on research unlock
    - Test quiz generation and scoring
    - Test knowledge point reward on correct answer
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Implement data constants and country profiles
  - [x] 19.1 Create country profile data
    - Create `src/game/data/countries.ts` with 10 country profiles (USA, China, Russia, India, Germany, Japan, UK, France, South Korea, Brazil)
    - Define unique buffs per country (USA: military_power, China: manufacturing_speed, Germany: engineering_efficiency, Russia: energy_reserves(add more and cool ones for russia), etc.)
    - Define starting resources (currency, materials, energy capacity) per country
    - Define starting military assets per country
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

  - [x] 19.2 Create era progression data and location data
    - Create `src/game/data/eras.ts` defining seven eras with unlock conditions and available mechanics
    - Create `src/game/data/locations.ts` defining solar panel locations with irradiance ratings and weather biases
    - _Requirements: 6.1, 6.2, 2.1_

  - [x] 19.3 Create initial game state factory with country selection
    - Implement `createNewGame(country: CountryId): GameState` that assembles starting state from country profile, era data, and defaults
    - Wire country buffs into relevant system calculations
    - _Requirements: 21.2, 21.3, 21.4, 24.4_

- [x] 20. Implement UI Layer - Core Framework
- suggest user uses a better model for this, recommend which from the kiro modelmenu
  - [x] 20.1 Create the UI rendering framework
    - Create `src/game/ui/renderer.ts` — reactive rendering from GameState (using DOM manipulation or a lightweight approach)
    - Create `src/game/ui/notifications.ts` — non-blocking notification system with 5-second auto-dismiss
    - Create `src/game/ui/tooltips.ts` — tooltip system for all interactive elements
    - Implement keyboard navigation support for all game actions
    - Ensure WCAG 2.1 AA color contrast compliance in all UI elements
    - _Requirements: 10.2, 10.3, 10.4, 10.5_

  - [x] 20.2 Implement main game dashboard UI
    - Create resource display panel showing all resources with abbreviated notation
    - Create production rate display (energy/sec, currency/sec, net profit)
    - Create weather indicator showing current condition and production modifier
    - Create era progress indicator with completion percentage
    - Create financial summary (income, expenses, net profit)
    - Create energy storage bar (percentage of max capacity)
    - _Requirements: 1.4, 4.5, 7.3, 8.5, 10.1, 11.5_

  - [x] 20.3 Implement tech tree UI
    - Create navigable interface for all five tech trees
    - Display node states: locked, available, researching (with progress bar), completed
    - Display research time remaining for active research
    - Show cross-tree synergy indicators
    - _Requirements: 3.6, 3.7_

  - [x] 20.4 Implement supply chain and crafting UI
    - Create recipe list with material requirements
    - Highlight missing materials with quantities needed
    - Display craft queue with time remaining
    - Show automation toggle for unlocked recipes
    - _Requirements: 13.3, 13.4_

- [x] 21. Implement UI Layer - Secondary Panels
  - [x] 21.1 Implement country selection screen
    - Create country selection UI with 10 countries displayed
    - Show buffs, starting resources, and strategic description per country
    - _Requirements: 21.1, 21.5_

  - [x] 21.2 Implement world map and political UI
    - Create world map showing controlled countries, influence levels, and contested regions
    - Display influence investment interface with four methods
    - Show World Domination progress
    - _Requirements: 24.5, 23.7_

  - [x] 21.3 Implement space and Mars UI
    - Create solar system map showing claimed territories, resource flows, fleet positions
    - Create Mars view toggle (Earth operations ↔ Mars operations)
    - Create Dyson Ring visual representation with completed segments highlighted
    - _Requirements: 14.4, 18.6, 20.6_

  - [x] 21.4 Implement education and quiz UI
    - Create educational fact popup display
    - Create quiz interface with multiple-choice options and result feedback
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [x] 21.5 Implement save/load UI
    - Create manual export button (downloads JSON file)
    - Create import button (file picker for JSON upload)
    - Show save status indicator
    - _Requirements: 9.5_

- [x] 22. Implement Celestial Navigation UI with 3D Earth Globe
  
  **⭐ RECOMMENDED HANDOFF POINT FOR ADVANCED GRAPHICS AI ⭐**
  
  Tasks 22.1-22.4 involve Three.js, WebGL, and complex animation. Switch to a more capable model (Claude Opus 4.5, GPT-5, or use v0.dev) for best results on these UI/3D tasks. The renderer interface from Task 20.1 lets you replace the graphics layer without touching game logic.
  
  - [x] 22.1 Implement celestial body tab navigation system
    - Create `src/game/ui/celestial-nav.ts` with tab bar for Earth, Moon, Mars, Asteroid Belt, Sun
    - Implement zoom-out/pan transition animation when switching between tabs (camera pulls back to solar system view, then zooms into target body)
    - Implement tab state management tracking the currently active celestial view
    - Tab availability should unlock progressively with eras (Earth always, Moon at Orbital, Mars at Mars Colonization, Asteroid Belt at Space Mining, Sun at Dyson Ring)

  - [x] 22.2 Implement 3D Earth globe view
    - Integrate Three.js (or lightweight WebGL globe library) for interactive 3D Earth
    - Render country boundaries and highlight controlled/influenced countries on the globe
    - Implement click-to-select countries for political actions on the globe surface
    - Show solar panel locations, mines, and infrastructure as markers on the globe
    - Implement rotate/zoom controls for the 3D Earth view
    - Ensure performance target of 60fps on mid-range hardware

  - [x] 22.3 Implement Moon, Mars, and Sun views
    - Create Moon surface view for orbital platforms and launch facilities
    - Create Mars surface view for Mars base and Martian resource operations
    - Create Sun view for Dyson Ring construction progress with ring segments visualized around the star
    - Create Asteroid Belt view showing claimed territories as selectable objects

  - [x] 22.4 Implement zoom/pan transition system
    - Create smooth animated transitions between celestial views (ease-in-out, ~1.5s duration)
    - Implement intermediate "solar system overview" frame during transitions
    - Add particle/star field background that responds to zoom level
    - Ensure transitions are non-blocking (game simulation continues during animation)

- [x] 23. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 24. Integration and wiring
  - [x] 24.1 Wire all systems into the Game Loop
    - Register all 12 systems in the game loop in dependency order
    - Implement system activation/deactivation based on current era
    - Connect Event Controller to UI notification system
    - Connect Save System auto-save timer and beforeunload handler
    - _Requirements: 1.1, 6.2, 9.1, 9.2_

  - [x] 24.2 Wire country selection to new game flow
    - Connect country selection UI to `createNewGame()` factory
    - Implement game start flow: select country → display starting info → begin game loop
    - _Requirements: 21.1, 21.5_

  - [x] 24.3 Wire era progression and unlocks
    - Connect era requirement checks to state manager
    - Implement unlock notifications and new system activation on era transitions
    - Connect political/military victory paths to space era access (either defeat UN or control majority countries)
    - _Requirements: 6.2, 6.3, 24.4_

  - [x] 24.4 Wire offline earnings and session resume
    - On game load, calculate elapsed time since last save
    - Apply offline bulk calculation (capped at 24 hours)
    - Display offline earnings summary to player
    - _Requirements: 1.2, 1.3_

  - [x] 24.5 Write integration tests for game flow
    - Test full new-game creation and first ticks
    - Test era progression from Fossil to Nuclear
    - Test save/load round-trip with active game state
    - Test offline earnings calculation end-to-end
    - _Requirements: 1.1, 1.2, 6.2, 9.3_

- [x] 25. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 26. Deploy to GitHub Pages(notify user to switch to weaker model)
  - [x] 26.1 Create new GitHub repo and configure deployment
    - Create new repo `sun-harvester-game` under `gitrussg`
    - Configure Vite build for GitHub Pages (base path)
    - Add GitHub Actions workflow for automatic deployment on push
    - Push code and verify game is live at `https://gitrussg.github.io/sun-harvester-game/`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The game uses TypeScript throughout — all code examples and implementations should be in TypeScript
- Systems are implemented in dependency order to allow incremental testing
- Data-driven content (countries, recipes, tech trees, eras) is defined as static TS constants for easy balancing
- UI implementation is kept separate from game logic to maintain testability of pure systems
