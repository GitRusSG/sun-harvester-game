# Bugfix Requirements Document

## Introduction

This document covers a cluster of gameplay/UI interaction defects in the Sun Harvester game. The player reports six symptoms across the Earth/World military and political flows: the weapons factory appears not to build, built weapons show no correlation to displayed military power, soldiers cannot be assigned, the "Build Rifles" button is mislabeled and triggers a factory build, influence operations on other countries do nothing visible, and the world map does not load.

Investigation against the codebase identifies six distinct defects:

- **Bug A — "Produce Rifles" is mislabeled and routes to a factory build.** In `renderEarthPanel` (`game-shell.ts`), the `🔫 Produce Rifles` button emits the SAME action as the Build panel's `🔫 Weapons Factory` button: `{ type: 'build_weapons_factory', payload: { producing: 'conventional' } }`. The `getBuildLabel()` map in `main.ts` maps `build_weapons_factory` → "Weapons Factory", so pressing "Produce Rifles" notifies "Building Weapons Factory". No distinct produce-a-unit action exists.

- **Bug B — Influence operations never progress in the Fossil Era and gating is inconsistent.** `PoliticalSystem.investInfluence` (via `invest_influence`) queues a `PoliticalOperation` and deducts currency, but influence only grows inside `PoliticalSystem.update()`. `PoliticalSystem.activeEras` excludes `'fossil'`, so the game loop never ticks the political system in the Fossil Era — money is deducted, an operation is queued, but influence stays at 0 forever. Additionally, the `main.ts` action handler loops all systems calling `canPerform`/`perform` regardless of era, so `invest_influence.perform()` succeeds (deducting money) even when the system can never tick to apply it.

- **Bug C — Military power has no correlation to the arsenal at initialization.** `createInitialState`/`createNewGame` (`state-manager.ts`) set `weapons.militaryPower = profile.startingMilitary` AND independently set `weapons.arsenal = { conventional: 10, missile: 2, ... }`. The two values are not derived from one another. `WeaponsSystem.getMilitaryPower()` computes power as `arsenal × powerPerUnit`, but the stored `militaryPower` field (read by the UI) is never reconciled with the arsenal at init. Once production runs, `update()` recomputes `militaryPower` from the arsenal, producing numbers that do not line up with the initial displayed value — "no correlation."

- **Bug D — Weapons factory build appears to do nothing.** `build_weapons_factory` is in `BUILD_TIMES`, so it goes through the 3-second build queue and `completeBuild()` adds a factory via `WeaponsSystem.buildFactory`. The factory produces conventional weapons in `update()`, but conventional arms require 1 steel per unit. With no steel, `getAffordableUnits` returns 0 and production silently no-ops, so the player sees no change in military power and concludes "the factory doesn't build." No feedback identifies the missing material.

- **Bug E — Soldier assignment is display-only.** The Earth panel shows "Soldiers assigned: X / Y available" computed inline from the arsenal, but there is NO action or UI control to actually assign soldiers. No `assign_soldier` action type exists anywhere in the codebase. The feature is referenced in UI text but never implemented.

- **Bug F — World map not loading.** The world map is rendered in `renderEarthPanel` via `mapHtml` using `COUNTRY_PROFILES[c]` for ten country ids, reached by clicking Earth in the 3D scene (`renderer-three` routes an Earth click to `setScene('world')`, while the panel itself opens via `openPanel('earth')`). This requires verifying that the Earth panel actually opens on a body click, that `COUNTRY_PROFILES` resolves for all ten ids, and that the `gs-world-map` / `gs-map-country` markup renders non-empty.

> Scope note: The separate "attack other countries button + combat animation" work is being handled as its own feature spec and is explicitly **excluded** from this bugfix.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the player clicks the Earth panel `🔫 Produce Rifles` button THEN the system dispatches `build_weapons_factory` and notifies "Building Weapons Factory", so the button's behavior and label do not match and no single unit is produced. *(Bug A)*

1.2 WHEN the player invests influence in another country during the Fossil Era THEN the system deducts currency and queues a `PoliticalOperation`, but `PoliticalSystem.update()` never runs (the system is inactive in the Fossil Era), so the country's influence stays at 0 forever and the operation never progresses. *(Bug B)*

1.3 WHEN the player triggers `invest_influence` while the political system is inactive for the current era THEN the system still executes `perform()` and deducts currency, because the `main.ts` action handler ignores `activeEras` for direct actions, producing an inconsistent gate between deduction and effect. *(Bug B)*

1.4 WHEN a new game starts THEN the system sets `weapons.militaryPower` from `profile.startingMilitary` independently of `weapons.arsenal`, so the displayed military power does not equal `Σ(arsenal[category] × powerPerUnit[category])` and produced weapons do not line up with the initial displayed value. *(Bug C)*

1.5 WHEN the player builds a weapons factory and has no steel THEN the factory's `update()` production computes 0 affordable units and silently returns an empty update with no feedback, so the player observes no change in military power and concludes the factory did not build. *(Bug D)*

1.6 WHEN the player attempts to assign soldiers THEN the system provides no button, action, or state field to do so, because soldier assignment exists only as a derived display value (`Math.floor(state.weapons.militaryPower * 10)` and a static computed "assigned" line). *(Bug E)*

1.7 WHEN the player opens the Earth/World view THEN the world map may render empty if the Earth panel does not open on a body click, if `COUNTRY_PROFILES` lookups return undefined for any of the ten country ids, or if the `gs-world-map` / `gs-map-country` markup is not produced. *(Bug F)*

### Expected Behavior (Correct)

2.1 WHEN the player clicks the `🔫 Produce Rifles` button THEN the system SHALL perform the labeled action — produce conventional rifle units (consuming the required steel) — rather than enqueuing a new weapons factory build, and any notification SHALL describe producing rifles. *(Bug A)*

2.2 WHEN the player invests influence in another country THEN the system SHALL cause that country's influence to increase over time for the invested operation, regardless of the current era (or it SHALL prevent the action and refund/withhold the currency when influence cannot be applied). *(Bug B)*

2.3 WHEN the player triggers `invest_influence` THEN the system SHALL gate currency deduction and effect consistently, so currency is only deducted when the operation can actually progress. *(Bug B)*

2.4 WHEN a new game starts THEN the system SHALL initialize `weapons.militaryPower` consistently with the initial arsenal, so the displayed military power equals `Σ(arsenal[category] × powerPerUnit[category])` and subsequent production keeps the two values reconciled. *(Bug C)*

2.5 WHEN the player builds a weapons factory and the required material (steel) is insufficient to produce any units THEN the system SHALL surface feedback identifying steel as the bottleneck rather than silently producing nothing. *(Bug D)*

2.6 WHEN the player wants to assign soldiers THEN the system SHALL provide an interactive mechanic (control + action + persisted state) that performs the assignment, so the action referenced in the UI is actually possible. *(Bug E)*

2.7 WHEN the player opens the Earth/World view THEN the system SHALL render the world map with one selectable entry per country, resolving `COUNTRY_PROFILES` for all ten country ids and producing non-empty `gs-world-map` markup. *(Bug F)*

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the player clicks the Build panel `🔫 Weapons Factory` button THEN the system SHALL CONTINUE TO enqueue a `build_weapons_factory` build and, on completion, create and persist a factory in `state.weapons.factories`. *(Bug A/D)*

3.2 WHEN a weapons factory exists and sufficient steel is available THEN the system SHALL CONTINUE TO produce conventional units at the factory's production rate and increase `weapons.militaryPower` accordingly. *(Bug D)*

3.3 WHEN computing military power THEN the system SHALL CONTINUE TO sum `arsenal[category] × powerPerUnit[category]` across all weapon categories. *(Bug C)*

3.4 WHEN the player invests influence during an era where the political system is already active (Nuclear Era onward) THEN the system SHALL CONTINUE TO queue operations and grow influence as before, including politician installation at the 75% threshold and coups below the coup threshold. *(Bug B)*

3.5 WHEN a weapon category is not unlocked via its required tech node THEN the system SHALL CONTINUE TO prevent production for that category. *(Bug D)*

3.6 WHEN the player clicks a country on the world map THEN the system SHALL CONTINUE TO open the corresponding country panel (`country_<id>`) with its influence and operation buttons. *(Bug F)*

3.7 WHEN the player triggers other Earth-panel military actions (Attack UN Forces, Diplomatic Deception, Education Campaign) THEN the system SHALL CONTINUE TO dispatch their existing `countermeasure` actions unchanged. *(out of scope guard)*

---

## Bug Conditions (Formal)

The following predicates identify the buggy inputs for each distinct defect. **F** denotes the original (unfixed) behavior; **F'** the fixed behavior.

### Bug A — Mislabeled / misrouted "Produce Rifles"

```pascal
FUNCTION isMislabeledRiflesBug(X)
  INPUT: X of type ClickEvent (buttonId, dispatched action)
  OUTPUT: boolean

  // The "Produce Rifles" button dispatches a factory build.
  RETURN X.buttonId = 'produce_rifles'
     AND X.action.type = 'build_weapons_factory'
END FUNCTION
```

```pascal
// Property: Fix Checking — clicking "Produce Rifles" produces rifles, not a factory.
FOR ALL X WHERE isMislabeledRiflesBug(X) AND steelAvailable(X.state) >= 1 DO
  state' <- handleAction'(X.state, producedRiflesAction(X))
  ASSERT state'.weapons.arsenal.conventional > X.state.weapons.arsenal.conventional
     AND |state'.weapons.factories| = |X.state.weapons.factories|
END FOR
```

### Bug B — Influence never progresses + inconsistent gating

```pascal
FUNCTION isInfluenceStalledBug(X)
  INPUT: X of type ActionInput (state, invest_influence action)
  OUTPUT: boolean

  // Influence is invested but the political system cannot tick in the current era,
  // so currency is deducted while influence can never grow.
  RETURN X.action.type = 'invest_influence'
     AND NOT politicalSystemActiveInEra(X.state.currentEra)
END FUNCTION
```

```pascal
// Property: Fix Checking — investing influence either grows influence over time,
// or is prevented without net currency loss; deduction and effect are consistent.
FOR ALL X WHERE isInfluenceStalledBug(X) DO
  state' <- applyInvest'(X.state, X.action)
  ASSERT (influenceCanGrow(state', X.action.payload.country) = TRUE)
      OR (state'.resources.currency = X.state.resources.currency
          AND operationQueued(state', X.action) = FALSE)
END FOR
```

### Bug C — Military power not reconciled with arsenal at init

```pascal
FUNCTION isMilitaryMismatchBug(X)
  INPUT: X of type GameState (freshly initialized)
  OUTPUT: boolean

  // Stored militaryPower disagrees with the arsenal-derived power.
  RETURN X.weapons.militaryPower
       != SUM over categories c OF (X.weapons.arsenal[c] * powerPerUnit[c])
END FUNCTION
```

```pascal
// Property: Fix Checking — initialized military power equals arsenal-derived power.
FOR ALL X WHERE isMilitaryMismatchBug(X) DO
  state' <- createInitialState'(X.config)
  ASSERT state'.weapons.militaryPower
       = SUM over categories c OF (state'.weapons.arsenal[c] * powerPerUnit[c])
END FOR
```

### Bug D — Silent factory production with no feedback

```pascal
FUNCTION isSilentProductionBug(X)
  INPUT: X of type GameTickInput (state, deltaTicks)
  OUTPUT: boolean

  // At least one unlocked factory exists but cannot afford any units and no feedback is given.
  RETURN EXISTS factory IN X.state.weapons.factories WHERE
           isCategoryUnlocked(X.state, factory.producing)
       AND getAffordableUnits(X.state, factory.producing,
                              factory.productionRate * X.deltaTicks) = 0
END FUNCTION
```

```pascal
// Property: Fix Checking — when a factory cannot produce due to missing material,
// the system surfaces feedback identifying the bottleneck material.
FOR ALL X WHERE isSilentProductionBug(X) DO
  result <- tick'(X.state, X.deltaTicks)
  ASSERT producedFeedback(result) = TRUE
     AND feedbackIdentifies(result, 'steel') = TRUE
END FOR
```

### Bug E — Soldier assignment unimplemented

```pascal
FUNCTION isSoldierAssignmentBug(X)
  INPUT: X of type UIState
  OUTPUT: boolean

  // The player intends to assign soldiers but no assignment action/state exists.
  RETURN intendsToAssignSoldiers(X)
     AND NOT existsSoldierAssignmentAction(X)
END FUNCTION
```

```pascal
// Property: Fix Checking — a soldier-assignment mechanic exists and performs the assignment.
FOR ALL X WHERE isSoldierAssignmentBug(X) DO
  state' <- handleAction'(X.state, assignSoldiersAction(X))
  ASSERT existsSoldierAssignmentAction(X) = TRUE
     AND assignedSoldiers(state') reflects the requested assignment
END FOR
```

### Bug F — World map not loading

```pascal
FUNCTION isWorldMapEmptyBug(X)
  INPUT: X of type EarthPanelRender (state, rendered markup)
  OUTPUT: boolean

  // The Earth panel renders but the world map produces no country entries.
  RETURN earthPanelOpened(X)
     AND countOf(X.markup, 'gs-map-country') = 0
END FUNCTION
```

```pascal
// Property: Fix Checking — the world map renders one entry per resolvable country.
FOR ALL X WHERE isWorldMapEmptyBug(X) DO
  view' <- renderEarthPanel'(X.state)
  ASSERT countOf(view'.markup, 'gs-map-country') = |allCountryIds|
     AND FOR ALL c IN allCountryIds: COUNTRY_PROFILES[c] != undefined
END FOR
```

### Preservation Checking Property

```pascal
// Property: Preservation — for all non-buggy inputs, the fixed code behaves identically
// to the original. Build-panel factory builds, weapon production when steel is sufficient,
// arsenal-based military power computation, tech-gating, influence growth in active eras
// (installs/coups/world domination), country-panel opening, and the existing countermeasure
// actions are all unchanged.
FOR ALL X WHERE NOT isMislabeledRiflesBug(X)
            AND NOT isInfluenceStalledBug(X)
            AND NOT isMilitaryMismatchBug(X)
            AND NOT isSilentProductionBug(X)
            AND NOT isSoldierAssignmentBug(X)
            AND NOT isWorldMapEmptyBug(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
