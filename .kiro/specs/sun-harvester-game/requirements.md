# Requirements Document

## Introduction

Sun Harvester is an incremental management game where players progress from primitive energy sources to constructing a Dyson Ring around the Sun. Players begin by bootstrapping their civilization with coal and nuclear power, mining raw materials like iron and silicon, and gradually transitioning to solar technology. The ultimate goal is to gather enough resources and technology to build a Dyson Ring — a megastructure that harvests the Sun's full energy output. Unlike traditional clicker games, the focus is on strategic resource management, supply chain decisions, and technology progression. The game incorporates real-world science covering energy production, materials science, astrophysics, and megastructure engineering so players learn while they progress.

## Glossary

- **Game_Engine**: The core system that manages game state, progression, and calculations
- **Resource_Manager**: The subsystem responsible for tracking, producing, and consuming in-game resources
- **Upgrade_System**: The subsystem that handles technology upgrades and unlocks
- **Education_Module**: The subsystem that presents educational content and tracks player knowledge
- **UI_System**: The user interface layer that displays game state and accepts player input
- **Save_System**: The subsystem responsible for persisting and loading game state
- **Simulation_Clock**: The time-based engine that drives resource production and events even when the player is idle
- **Solar_Panel**: The primary resource-generating structure in the game
- **Energy_Grid**: The network connecting solar panels to storage and consumers
- **Research_Tree**: The branching structure of unlockable technologies and knowledge
- **Material_System**: The subsystem managing raw materials (iron, silicon, copper, etc.) and their extraction and refinement
- **Power_Plant**: A structure that generates energy from non-solar sources (coal, nuclear, fusion)
- **Dyson_Ring**: The end-game megastructure that encircles the Sun to harvest stellar energy
- **Supply_Chain**: The production pipeline converting raw materials into components and structures
- **Opposition_System**: The subsystem managing hostile factions that impede the player's progress
- **Diplomacy_Module**: The subsystem for managing relationships with factions (UN, protesters, aliens)
- **Mars_Base**: The player's colony on Mars used for resource extraction and Dyson Ring staging
- **Alien_Faction**: Extraterrestrial entities encountered during space expansion
- **Weapons_System**: The subsystem for manufacturing and deploying military assets for defense and offense
- **Political_System**: The subsystem managing political influence, politician placement, and country control
- **Country_Profile**: The starting configuration defining a country's unique buffs, resources, and starting conditions

## Requirements

### Requirement 1: Idle Resource Generation

**User Story:** As a player, I want resources to accumulate over time automatically, so that I can progress without constant interaction.

#### Acceptance Criteria

1. WHILE the game is running, THE Simulation_Clock SHALL calculate resource production every second based on current infrastructure capacity
2. WHEN the player returns after being away, THE Game_Engine SHALL calculate offline earnings based on elapsed time and production rates at time of departure
3. THE Resource_Manager SHALL cap offline earnings at a configurable maximum duration of 24 hours
4. WHILE the game is idle, THE UI_System SHALL display current production rates and accumulated resources in real time

### Requirement 2: Solar Panel Management

**User Story:** As a player, I want to place and manage solar panels in different locations, so that I can optimize my energy production strategy.

#### Acceptance Criteria

1. WHEN the player selects a location, THE Game_Engine SHALL display the solar irradiance rating for that location based on real-world data ranges
2. THE Resource_Manager SHALL calculate energy output for each Solar_Panel based on panel efficiency, location irradiance, and current weather modifier
3. WHEN the player places a Solar_Panel, THE Game_Engine SHALL deduct the panel cost from the player's available currency
4. IF the player has insufficient currency to place a Solar_Panel, THEN THE UI_System SHALL disable the placement action and display the required amount

### Requirement 3: Technology Upgrade System

**User Story:** As a player, I want to research and unlock technologies across multiple separate tech trees, so that I can specialize my strategy.

#### Acceptance Criteria

1. THE Upgrade_System SHALL present five separate Research_Trees: Energy Technology, Materials Science, Weapons Development, Political Influence, and Space Technology
2. WHEN the player unlocks a research node, THE Upgrade_System SHALL apply the corresponding bonus to the relevant game system
3. WHEN a research node is completed, THE Upgrade_System SHALL unlock dependent nodes within the same Research_Tree
4. THE Upgrade_System SHALL allow cross-tree synergies where completing nodes in one tree reduces costs in another related tree
5. THE Upgrade_System SHALL require both in-game currency and accumulated knowledge points to unlock research nodes
6. WHILE a research node is being investigated, THE UI_System SHALL display a progress indicator showing time remaining
7. THE UI_System SHALL display all five tech trees in a navigable interface with clear indication of unlocked, available, and locked nodes

### Requirement 4: Energy Storage and Distribution

**User Story:** As a player, I want to manage energy storage and distribution networks, so that I can handle supply and demand efficiently.

#### Acceptance Criteria

1. THE Resource_Manager SHALL track energy in two states: generated energy and stored energy
2. WHEN generated energy exceeds storage capacity, THE Resource_Manager SHALL cap stored energy at maximum capacity and discard the excess
3. WHEN the player builds distribution infrastructure, THE Energy_Grid SHALL increase the rate at which stored energy converts to revenue
4. IF stored energy drops to zero, THEN THE Game_Engine SHALL pause revenue generation until energy is available again
5. THE UI_System SHALL display current storage level as a percentage of maximum capacity

### Requirement 5: Educational Content Integration

**User Story:** As a player, I want to learn real facts about solar energy as I play, so that the game is both entertaining and informative.

#### Acceptance Criteria

1. WHEN the player unlocks a new research node, THE Education_Module SHALL present a factual explanation of the corresponding real-world solar technology concept
2. THE Education_Module SHALL include educational content covering: fossil fuel energy generation, nuclear fission and fusion, photovoltaic cell types, solar irradiance factors, materials science (iron smelting, silicon refining), orbital mechanics, and Dyson sphere/ring concepts
3. WHEN the player completes a milestone, THE Education_Module SHALL present a quiz question related to recently learned content
4. WHEN the player answers a quiz question correctly, THE Resource_Manager SHALL grant bonus knowledge points
5. IF the player answers a quiz question incorrectly, THEN THE Education_Module SHALL display the correct answer with a brief explanation

### Requirement 6: Progression and Milestones

**User Story:** As a player, I want clear progression milestones, so that I feel a sense of accomplishment and have goals to work toward.

#### Acceptance Criteria

1. THE Game_Engine SHALL define seven progression eras: Fossil Era → Nuclear Era → Solar Era → Orbital Era → Mars Colonization Era → Space Mining Era → Dyson Ring Era
2. WHEN the player meets all requirements for the next era, THE Game_Engine SHALL unlock the new era and its associated mechanics
3. WHEN a new era is unlocked, THE UI_System SHALL display a notification with the era name and newly available features
4. THE Game_Engine SHALL track and display completion percentage for each era based on fulfilled objectives
5. THE Game_Engine SHALL define the Dyson Ring completion as the final victory condition of the game

### Requirement 7: Weather and Environmental Simulation

**User Story:** As a player, I want environmental factors to affect my solar production, so that I must adapt my strategy to changing conditions.

#### Acceptance Criteria

1. THE Simulation_Clock SHALL cycle through weather patterns (sunny, partly cloudy, overcast, rainy) on a configurable time interval
2. WHILE a weather condition is active, THE Resource_Manager SHALL apply a production modifier to all Solar_Panel output (e.g., sunny: 100%, partly cloudy: 70%, overcast: 40%, rainy: 20%)
3. WHEN the weather changes, THE UI_System SHALL display the new weather condition and its effect on production
4. THE Education_Module SHALL explain how real-world weather affects solar panel efficiency when the player first encounters each weather type

### Requirement 8: Budget and Economics Management

**User Story:** As a player, I want to manage income and expenses, so that I must make strategic financial decisions.

#### Acceptance Criteria

1. THE Resource_Manager SHALL track currency earned from selling stored energy to consumers
2. THE Resource_Manager SHALL deduct maintenance costs from player currency at regular intervals based on total infrastructure size
3. IF the player's currency balance reaches zero, THEN THE Game_Engine SHALL trigger a warning state and halt new construction until currency is positive
4. WHEN the player sells energy, THE Resource_Manager SHALL calculate revenue using a dynamic pricing model that varies with supply volume
5. THE UI_System SHALL display a financial summary showing income rate, expense rate, and net profit

### Requirement 9: Game State Persistence

**User Story:** As a player, I want my progress to be saved automatically, so that I do not lose progress between sessions.

#### Acceptance Criteria

1. THE Save_System SHALL automatically save game state to browser local storage every 60 seconds
2. WHEN the player closes or navigates away from the game, THE Save_System SHALL perform a final save of the current game state
3. WHEN the player opens the game, THE Save_System SHALL load the most recent saved state and resume from that point
4. IF saved data is corrupted or incompatible, THEN THE Save_System SHALL start a new game and display a notification explaining that previous data could not be loaded
5. THE Save_System SHALL support manual export and import of save data as a JSON file

### Requirement 10: User Interface and Accessibility

**User Story:** As a player, I want a clear and accessible interface, so that I can understand and interact with the game comfortably.

#### Acceptance Criteria

1. THE UI_System SHALL display all resource quantities using abbreviated notation for large numbers (e.g., 1.5K, 2.3M, 1.1B)
2. THE UI_System SHALL provide tooltips for all interactive elements explaining their function
3. THE UI_System SHALL support keyboard navigation for all game actions
4. THE UI_System SHALL use sufficient color contrast ratios meeting WCAG 2.1 AA standards
5. WHEN a game event occurs, THE UI_System SHALL present a non-blocking notification that auto-dismisses after 5 seconds

### Requirement 11: Raw Material Extraction and Refining

**User Story:** As a player, I want to mine and refine raw materials, so that I can build increasingly advanced infrastructure.

#### Acceptance Criteria

1. THE Material_System SHALL track the following raw materials: Iron Ore, Silicon, Copper, Uranium, and Rare Earth Elements
2. WHEN the player builds a mining operation, THE Material_System SHALL produce raw materials at a rate determined by the mine level and resource deposit quality
3. THE Material_System SHALL require refining steps to convert raw materials into usable components (e.g., Iron Ore → Steel, Silicon → Solar Cells, Uranium → Fuel Rods)
4. WHEN a refining process completes, THE Resource_Manager SHALL deduct the raw inputs and add the refined output to the player's inventory
5. THE UI_System SHALL display current material stockpiles and production rates for each material type
6. WHEN the player unlocks a new era, THE Material_System SHALL introduce new material types relevant to that era

### Requirement 12: Early-Game Energy Bootstrap

**User Story:** As a player, I want to start with conventional energy sources, so that I can power my initial mining and construction operations.

#### Acceptance Criteria

1. THE Game_Engine SHALL provide coal-fired Power_Plant as the starting energy source available from game start
2. WHEN the player builds a coal Power_Plant, THE Resource_Manager SHALL consume Coal resources and produce energy at a fixed conversion rate
3. WHEN the player reaches the Nuclear Era, THE Upgrade_System SHALL unlock nuclear Power_Plant construction
4. THE Resource_Manager SHALL calculate nuclear Power_Plant output as higher energy per unit of fuel compared to coal
5. WHILE a Power_Plant is operating, THE Resource_Manager SHALL deduct fuel from material stockpiles at the consumption rate
6. IF fuel stockpile for an active Power_Plant reaches zero, THEN THE Resource_Manager SHALL halt that Power_Plant energy production until fuel is resupplied
7. THE Education_Module SHALL explain the real-world energy density differences between coal, nuclear fission, and solar when each source is first used

### Requirement 13: Supply Chain and Crafting

**User Story:** As a player, I want to manage production chains that convert materials into components, so that I can build advanced structures.

#### Acceptance Criteria

1. THE Supply_Chain SHALL define recipes for crafting components (e.g., Steel Beams require 3 Iron + 1 Coal, Solar Cells require 2 Silicon + 1 Copper)
2. WHEN the player queues a crafting order, THE Supply_Chain SHALL verify sufficient materials are available and reserve them
3. IF the player lacks required materials for a recipe, THEN THE UI_System SHALL highlight missing materials and their quantities
4. WHILE a crafting order is in progress, THE UI_System SHALL display time remaining and allow the player to queue multiple orders
5. THE Supply_Chain SHALL support automation: once unlocked, the player can set recipes to auto-craft when materials are available
6. WHEN an automated recipe triggers, THE Supply_Chain SHALL produce the output and deduct inputs without requiring player interaction

### Requirement 14: Dyson Ring Construction

**User Story:** As a player, I want to build a Dyson Ring as the ultimate project, so that I have a grand end-game goal to work toward.

#### Acceptance Criteria

1. WHEN the player reaches the Dyson Ring Era, THE Game_Engine SHALL unlock the Dyson Ring construction project as a multi-stage megastructure
2. THE Game_Engine SHALL divide Dyson Ring construction into at least five segments, each requiring large quantities of refined materials and components
3. WHEN the player completes a Dyson Ring segment, THE Resource_Manager SHALL increase total energy production by a multiplier proportional to segments completed
4. THE UI_System SHALL display a visual representation of the Dyson Ring with completed segments highlighted
5. WHEN all Dyson Ring segments are completed, THE Game_Engine SHALL trigger a victory sequence showing total energy harvested and educational facts learned
6. THE Education_Module SHALL present real-world information about Dyson sphere concepts, the Kardashev scale, and stellar energy output during Dyson Ring construction

### Requirement 15: Space Infrastructure

**User Story:** As a player, I want to expand into space to access resources and build orbital structures, so that I can progress toward the Dyson Ring.

#### Acceptance Criteria

1. WHEN the player reaches the Orbital Era, THE Game_Engine SHALL unlock orbital platform construction
2. THE Resource_Manager SHALL require launch costs (fuel and materials) to send components into orbit
3. WHEN the player reaches the Space Mining Era, THE Material_System SHALL unlock asteroid mining operations that produce materials at higher rates than terrestrial mines
4. THE Education_Module SHALL explain orbital mechanics concepts and real-world space launch economics when orbital features are unlocked
5. WHILE orbital infrastructure is active, THE Resource_Manager SHALL calculate reduced weather penalties for space-based solar collectors (no atmosphere interference)

### Requirement 16: Opposition and Public Resistance

**User Story:** As a player, I want to face resistance from anti-technology groups and fearful regulators, so that I must manage public opinion and politics alongside my infrastructure.

#### Acceptance Criteria

1. THE Opposition_System SHALL generate protest events from anti-nuclear and anti-technology factions that temporarily reduce construction speed in affected areas
2. WHEN the player builds nuclear Power_Plants, THE Opposition_System SHALL increase protest intensity proportional to the number of nuclear facilities
3. THE Diplomacy_Module SHALL track a public approval rating that affects construction permits and research speed
4. WHEN public approval drops below 30%, THE Opposition_System SHALL block new construction projects until approval recovers
5. THE Game_Engine SHALL provide countermeasures: the player can invest in public education campaigns to raise approval rating
6. WHEN the player invests in a public education campaign, THE Diplomacy_Module SHALL increase public approval by an amount proportional to investment spent
7. THE Education_Module SHALL explain real-world public perception challenges around nuclear energy and large-scale infrastructure projects

### Requirement 17: UN as Antagonist

**User Story:** As a player, I want to face the UN as an active opponent trying to shut down my operations, so that I must outmaneuver a powerful global adversary.

#### Acceptance Criteria

1. THE Opposition_System SHALL model the UN as an active enemy faction that escalates hostility as the player gains power
2. WHEN the player's energy output or territorial control exceeds defined thresholds, THE Opposition_System SHALL trigger UN attack events: sanctions, embargo enforcement, or military intervention
3. THE Game_Engine SHALL provide the player with counter-options: military defense, diplomatic deception, economic leverage, or technological superiority
4. WHEN the UN imposes sanctions, THE Resource_Manager SHALL increase all trade costs by a percentage proportional to sanction severity
5. IF the player defeats a UN military intervention, THEN THE Opposition_System SHALL reduce UN power level and delay subsequent attacks
6. WHEN the player's global influence exceeds 70%, THE Opposition_System SHALL trigger a final UN confrontation event that the player must overcome to proceed to space eras
7. THE Education_Module SHALL explain real-world international organizations, geopolitics, and how global governance structures function when UN events occur

### Requirement 18: Mars Base Construction

**User Story:** As a player, I want to build a base on Mars, so that I can access Mars resources and stage Dyson Ring construction closer to assembly.

#### Acceptance Criteria

1. WHEN the player reaches the Mars Colonization Era, THE Game_Engine SHALL unlock Mars base construction as a separate management zone
2. THE Resource_Manager SHALL require significant launch costs (fuel, materials, life support components) to send initial colonization payloads to Mars
3. THE Mars_Base SHALL produce resources unique to Mars: regolith-based iron, Martian ice (water), and CO2 for fuel synthesis
4. WHILE the Mars_Base is operational, THE Resource_Manager SHALL enable lower-cost orbital launches due to reduced Martian gravity
5. THE Game_Engine SHALL require the player to balance Earth and Mars resource allocation across both colonies
6. THE UI_System SHALL provide a view toggle between Earth operations and Mars operations
7. THE Education_Module SHALL present facts about Mars geology, atmosphere, gravity, and real-world colonization challenges when Mars features are unlocked

### Requirement 19: Alien Encounters

**User Story:** As a player, I want to encounter aliens during space expansion, so that the game has unexpected challenges and opportunities in the late game.

#### Acceptance Criteria

1. WHEN the player reaches the Space Mining Era, THE Game_Engine SHALL introduce a probability of alien signal detection during asteroid mining operations
2. WHEN an alien signal is detected, THE Game_Engine SHALL present the player with a choice: investigate, ignore, or broadcast a response
3. IF the player investigates an alien signal, THEN THE Game_Engine SHALL trigger an encounter event that can be cooperative or hostile
4. WHEN a cooperative alien encounter occurs, THE Alien_Faction SHALL offer technology trades that accelerate specific research branches
5. WHEN a hostile alien encounter occurs, THE Opposition_System SHALL generate a threat that requires the player to allocate resources to defense infrastructure
6. IF the player ignores repeated alien signals, THEN THE Game_Engine SHALL escalate the encounter to a forced contact event after a set number of ignored signals
7. THE Education_Module SHALL present real-world information about the Drake equation, Fermi paradox, and SETI when alien encounters begin
8. THE Diplomacy_Module SHALL track an alien relations score that affects whether future encounters trend cooperative or hostile

### Requirement 20: Space Expansion and Territory

**User Story:** As a player, I want to expand my operations across the solar system, so that I can access diverse resources and build at scale.

#### Acceptance Criteria

1. WHEN the player reaches the Space Mining Era, THE Game_Engine SHALL unlock asteroid belt territories that can be claimed and mined
2. THE Resource_Manager SHALL assign different resource profiles to different asteroid territories (iron-rich, rare-earth-rich, ice-rich)
3. WHEN the player claims a territory, THE Resource_Manager SHALL deduct a claim cost and begin resource surveys that reveal deposit quality over time
4. THE Game_Engine SHALL limit simultaneous active territories based on the player's logistics capacity (fleet size and fuel supply)
5. WHILE a territory is active, THE Material_System SHALL produce resources at rates determined by deposit quality and mining infrastructure level
6. THE UI_System SHALL display a solar system map showing claimed territories, resource flows, and fleet positions
7. THE Education_Module SHALL present facts about asteroid composition, the asteroid belt, and real-world space resource proposals when territory features are unlocked

### Requirement 21: Country Selection and Starting Conditions

**User Story:** As a player, I want to choose my starting country from the world's strongest nations, so that I can pick a strategy that matches my preferred playstyle.

#### Acceptance Criteria

1. WHEN the player starts a new game, THE Game_Engine SHALL present a selection of 10 playable countries: USA, China, Russia, India, Germany, Japan, UK, France, South Korea, and Brazil
2. THE Game_Engine SHALL assign each Country_Profile unique starting buffs (e.g., USA: military bonus, China: manufacturing speed, Germany: engineering efficiency, Russia: energy reserves)
3. THE Game_Engine SHALL assign each Country_Profile unique starting resources (currency, raw materials, energy capacity) based on the country's real-world strengths
4. THE Game_Engine SHALL assign each Country_Profile starting military assets that affect early-game defense capability
5. WHEN the player selects a country, THE UI_System SHALL display the country's buffs, starting resources, and a brief strategic description
6. THE Education_Module SHALL present real-world facts about each country's energy sector and industrial strengths during country selection

### Requirement 22: Weapons Manufacturing

**User Story:** As a player, I want to build weapons and military assets, so that I can defend against the UN and hostile forces.

#### Acceptance Criteria

1. THE Weapons_System SHALL define weapon categories: Conventional Arms, Missile Systems, Cyber Weapons, Energy Weapons, and Orbital Weapons
2. WHEN the player constructs a weapons factory, THE Weapons_System SHALL produce military units at a rate based on factory level and material supply
3. THE Supply_Chain SHALL define weapon recipes requiring specific materials (e.g., Missile Systems require Steel + Electronics + Fuel, Energy Weapons require Rare Earth + Advanced Circuits)
4. WHEN the player researches nodes in the Weapons Development tech tree, THE Weapons_System SHALL unlock higher-tier weapon categories
5. THE Weapons_System SHALL track total military power as a composite score of all active weapon systems
6. WHEN military power exceeds the UN's current threat level, THE Opposition_System SHALL reduce the severity of UN attacks
7. THE Education_Module SHALL explain real-world deterrence theory and arms technology concepts when weapons are first manufactured

### Requirement 23: Political Influence System

**User Story:** As a player, I want to exert political influence and install politicians in other countries, so that I can expand my control without direct military conflict.

#### Acceptance Criteria

1. THE Political_System SHALL track an influence score for each of the 10 playable countries (excluding the player's own)
2. WHEN the player invests resources in political operations targeting a country, THE Political_System SHALL increase influence score for that country over time
3. WHEN influence score for a country exceeds 75%, THE Political_System SHALL install a friendly politician in that country's leadership
4. WHEN a friendly politician is installed, THE Resource_Manager SHALL grant the player access to a portion of that country's resource production
5. WHEN the player controls more than 5 countries through political influence, THE Political_System SHALL unlock "World Domination" status that disables UN sanctions
6. IF the player's influence in a country drops below 50% after installation, THEN THE Political_System SHALL trigger a coup event that removes the friendly politician
7. THE Political_System SHALL provide multiple influence methods: economic aid, propaganda campaigns, corporate infiltration, and intelligence operations
8. THE Education_Module SHALL explain real-world concepts of soft power, geopolitical influence, and international relations when political features are first used

### Requirement 24: Global Control Victory Path

**User Story:** As a player, I want controlling the world to be a meaningful strategic path, so that political domination enables my space ambitions.

#### Acceptance Criteria

1. WHEN the player achieves World Domination status, THE Game_Engine SHALL unlock global resource pooling from all controlled countries
2. THE Resource_Manager SHALL calculate pooled resources as the sum of all controlled countries' production multiplied by an efficiency factor
3. WHEN global resource pooling is active, THE Game_Engine SHALL reduce all space launch costs by 50% due to global cooperation
4. THE Game_Engine SHALL allow progression to space eras through either military dominance over the UN OR political control of a majority of countries
5. THE UI_System SHALL display a world map showing controlled countries, influence levels, and contested regions
