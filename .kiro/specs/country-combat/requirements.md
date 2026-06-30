# Requirements Document

## Introduction

This feature adds country-versus-country combat to the Sun Harvester game. Today the player can grow political influence over the 10 world countries (`invest_influence`) and attack the UN faction, but there is no way to militarily attack a specific foreign country and take it by force. This feature introduces an attack action targeting a chosen country, a luck-plus-quantity combat resolution model that pits the player's committed military power against a defending country's garrison, win/lose consequences (ownership transfer on victory, loss of committed military power on defeat), an attack button surfaced in the country panel of the strategic world map, and a non-blocking combat animation that plays during the engagement and reflects the outcome.

The feature builds on existing systems: the `Weapons_System` (which tracks `state.weapons.militaryPower` and `state.weapons.arsenal`), the `Political_System` (which tracks `state.political.influence` and `state.political.installedPoliticians` for ownership), and the `GameShell` UI (which renders the world map and per-country panel and provides a notification/toast system). It aligns with the broader game requirements for the Combat Engine (sun-harvester-game spec, Requirements 25, 28, 29).

This document covers only the attack-country combat feature and its animation. Separate gameplay bugfixes are handled in the `game-interaction-fixes` spec and are out of scope here.

## Glossary

- **Combat_Engine**: The subsystem that resolves a country attack using a luck-plus-quantity formula and produces a combat outcome.
- **Weapons_System**: The existing subsystem that tracks the player's military power (`state.weapons.militaryPower`) and arsenal, and from which committed attack force is drawn.
- **Political_System**: The existing subsystem that tracks per-country influence and the player's controlled countries (`state.political.installedPoliticians`); ownership transfer on a combat victory is recorded here.
- **UI_System**: The `GameShell` user interface layer that renders the world map, the country panel, action buttons, and notifications.
- **Country_Garrison**: The defending military strength of a non-player country, used as the defense quantity in combat resolution.
- **Attacker_Power**: The amount of player military power committed to a single attack, drawn from `state.weapons.militaryPower`.
- **Luck_Factor**: A uniformly distributed random multiplier applied independently to attacker and defender strength during combat resolution.
- **Attack_Strength**: The computed offensive value for an engagement, equal to Attacker_Power multiplied by the attacker Luck_Factor.
- **Defense_Strength**: The computed defensive value for an engagement, equal to Country_Garrison multiplied by the defender Luck_Factor.
- **Combat_Outcome**: The resolved result of an engagement, consisting of a winner (attacker or defender), the computed strengths, and the resulting state changes.
- **Owned_Country**: A country recorded in `state.political.installedPoliticians` (rendered green), which the player controls and cannot attack.
- **Target_Country**: A non-owned country (rendered yellow or red) that the player can attack.
- **Combat_Animation**: The non-blocking visual sequence the UI_System plays during and after an attack to convey the engagement and its outcome.

## Requirements

### Requirement 1: Country Attack Action

**User Story:** As a player, I want to launch a military attack against a specific foreign country, so that I can take territory by force instead of only through political influence.

#### Acceptance Criteria

1. WHEN the player initiates an attack against a Target_Country, THE Combat_Engine SHALL resolve a single Combat_Outcome between the committed Attacker_Power and that country's Country_Garrison.
2. IF the player attempts to attack an Owned_Country, THEN THE Combat_Engine SHALL reject the attack and return an unchanged game state.
3. IF the player attempts to attack the player's home country, THEN THE Combat_Engine SHALL reject the attack and return an unchanged game state.
4. IF the player's available military power is below the minimum attack threshold of 10 power, THEN THE Combat_Engine SHALL reject the attack and return an unchanged game state.
5. WHEN an attack is initiated, THE Combat_Engine SHALL commit an Attacker_Power value equal to the player's current military power at the time of the attack.

### Requirement 2: Country Garrison Defense

**User Story:** As a player, I want each foreign country to have its own defending military strength, so that some countries are harder to conquer than others.

#### Acceptance Criteria

1. THE Combat_Engine SHALL assign each non-player country a Country_Garrison value derived from that country's defined starting military strength.
2. WHEN a Target_Country has political influence above 0, THE Combat_Engine SHALL reduce that country's effective Country_Garrison in proportion to its influence percentage, so that higher influence yields a weaker defense.
3. THE UI_System SHALL display each Target_Country's current Country_Garrison value in the country panel.
4. WHEN combat resolution transfers a country to the player, THE Combat_Engine SHALL retain that country's Country_Garrison value for display as the player's holding strength.

### Requirement 3: Luck-Plus-Quantity Combat Resolution

**User Story:** As a player, I want combat outcomes to depend on both committed force and random luck, so that battles feel uncertain while larger armies still hold an advantage.

#### Acceptance Criteria

1. THE Combat_Engine SHALL compute Attack_Strength as Attacker_Power multiplied by an attacker Luck_Factor, where the Luck_Factor is a uniformly distributed value between 0.5 and 1.5.
2. THE Combat_Engine SHALL compute Defense_Strength as Country_Garrison multiplied by a defender Luck_Factor, where the Luck_Factor is a uniformly distributed value between 0.5 and 1.5.
3. WHEN Attack_Strength is greater than Defense_Strength, THE Combat_Engine SHALL declare the attacker the winner of the Combat_Outcome.
4. WHEN Defense_Strength is greater than or equal to Attack_Strength, THE Combat_Engine SHALL declare the defender the winner of the Combat_Outcome.
5. THE Combat_Engine SHALL draw each Luck_Factor independently for the attacker and the defender within the same engagement.

### Requirement 4: Victory Consequences

**User Story:** As a player, I want winning an attack to give me control of the conquered country, so that military conquest meaningfully expands my territory.

#### Acceptance Criteria

1. WHEN the attacker wins a Combat_Outcome, THE Political_System SHALL set the conquered Target_Country's influence to 100 percent.
2. WHEN the attacker wins a Combat_Outcome, THE Political_System SHALL record the conquered Target_Country as an Owned_Country in `state.political.installedPoliticians`.
3. WHEN the attacker wins a Combat_Outcome AND the resulting count of Owned_Countries reaches the World Domination threshold, THE Political_System SHALL mark World Domination as achieved.
4. WHEN the attacker wins a Combat_Outcome, THE UI_System SHALL render the conquered Target_Country as an Owned_Country on the world map.

### Requirement 5: Defeat Consequences

**User Story:** As a player, I want losing an attack to cost me military strength, so that attacking carries real risk and I must build up forces.

#### Acceptance Criteria

1. WHEN the defender wins a Combat_Outcome, THE Weapons_System SHALL reduce the player's military power by the committed Attacker_Power.
2. WHEN the defender wins a Combat_Outcome, THE Combat_Engine SHALL leave the Target_Country's ownership and influence unchanged.
3. IF reducing the player's military power on defeat would produce a negative value, THEN THE Weapons_System SHALL set the player's military power to 0.

### Requirement 6: Attack Button in Country Panel

**User Story:** As a player, I want an attack button when I open a foreign country, so that I can clearly see and trigger a military assault from the interface.

#### Acceptance Criteria

1. WHEN the player opens the country panel for a Target_Country, THE UI_System SHALL display an attack button alongside the existing influence operations.
2. WHERE the opened country is an Owned_Country or the player's home country, THE UI_System SHALL omit the attack button from the country panel.
3. IF the player's available military power is below the minimum attack threshold of 10 power, THEN THE UI_System SHALL render the attack button in a disabled state.
4. WHEN the player activates the attack button, THE UI_System SHALL dispatch a country attack action identifying the Target_Country.
5. THE UI_System SHALL display the player's available Attacker_Power and the Target_Country's Country_Garrison on the country panel before the attack is launched.

### Requirement 7: Combat Outcome Feedback

**User Story:** As a player, I want clear feedback about what happened in a battle, so that I understand whether I won or lost and what changed.

#### Acceptance Criteria

1. WHEN the attacker wins a Combat_Outcome, THE UI_System SHALL display a victory notification identifying the conquered Target_Country.
2. WHEN the defender wins a Combat_Outcome, THE UI_System SHALL display a defeat notification reporting the amount of military power lost.
3. WHEN a Combat_Outcome is resolved, THE UI_System SHALL refresh the country panel and world map to reflect the updated ownership, influence, and military power.

### Requirement 8: Combat Animation

**User Story:** As a player, I want a combat animation to play when I attack a country, so that battles feel exciting and visually rewarding.

#### Acceptance Criteria

1. WHEN the player launches an attack, THE UI_System SHALL play a Combat_Animation overlay that conveys the engagement.
2. WHILE the Combat_Animation is playing, THE UI_System SHALL allow the underlying game simulation to continue without blocking input on other panels.
3. WHEN the Combat_Animation completes, THE UI_System SHALL present the Combat_Outcome result within the animation sequence.
4. THE Combat_Animation SHALL complete and dismiss its overlay within 5 seconds of being started.
5. WHERE combat visual assets are provided, THE Combat_Animation SHALL render those assets; WHERE no such assets are provided, THE Combat_Animation SHALL render a built-in CSS-based visual sequence.
6. THE Combat_Animation overlay SHALL provide a control that allows the player to dismiss the animation before it completes.

### Requirement 9: Accessibility and Reduced Motion

**User Story:** As a player who relies on assistive technology or prefers reduced motion, I want combat to remain usable and comfortable, so that I can play without barriers or discomfort.

#### Acceptance Criteria

1. THE UI_System SHALL provide an accessible text label for the attack button that identifies the action and the Target_Country.
2. WHEN a Combat_Outcome is resolved, THE UI_System SHALL expose the result as text to assistive technologies through the existing notification mechanism.
3. WHERE the operating system signals a reduced-motion preference, THE Combat_Animation SHALL present a reduced or static visual sequence in place of full motion.
4. THE attack button SHALL be operable using keyboard input.
