# Bugfix Requirements Document

## Introduction

This document covers three gameplay defects in the Sun Harvester game:

**Bug 1 — Era progression never triggers.** The `eraProgress` field is never incremented by any game system, so `detectEraProgression()` never fires. Additionally, the manual "Advance Era" button bypasses the intended `unlockConditions` defined in `eras.ts`, using only flat resource costs instead. This renders the era progression system non-functional and inconsistent with the designed unlock conditions.

**Bug 2 — Weapons factory building has no observable effect.** Clicking to build a weapons factory creates and persists a factory, but produces no visible result. A factory only raises military power when it produces units on later ticks, and production silently requires `steel` (1 per conventional unit). When steel is insufficient, `WeaponsSystem.update()` produces nothing and gives no feedback, so the player perceives "no correlation" between building and effect. Separately, the Earth panel's "🔫 Produce Rifles (1 steel)" button sends a `build_weapons_factory` action, so it builds an entire factory rather than producing a single rifle — its label does not match its behavior.

**Bug 3 — Switching planets does not focus/zoom the camera.** Navigating via the nav buttons (`data-nav`) correctly calls both `navigator.navigateTo(...)` and `solarScene.focusBody(...)`. However, clicking a celestial body directly in the 3D scene only calls `openPanel(id)` — it does not call `solarScene.focusBody(id)` or `navigator.navigateTo(id)`, so the camera never focuses or zooms onto the body selected by a direct click.

## Bug 1: Era Progression

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the game loop ticks THEN the system never increments `eraProgress` for the current era, so automatic era advancement is impossible regardless of player progress.

1.2 WHEN the player clicks the manual "Advance Era" button and meets the flat resource costs THEN the system advances the era without checking the `unlockConditions` defined in `eras.ts` (e.g., research completion, energy production thresholds).

1.3 WHEN `areEraConditionsMet()` returns true for the next era THEN the system does not use this result to drive or gate era progression in any way.

### Expected Behavior (Correct)

2.1 WHEN the game loop ticks and `areEraConditionsMet()` returns true for the next era THEN the system SHALL increment `eraProgress[currentEra]` toward 100 each tick (representing gradual transition progress).

2.2 WHEN the player attempts to advance to the next era THEN the system SHALL verify that the `unlockConditions` from `eras.ts` for that era are satisfied before allowing advancement.

2.3 WHEN `eraProgress[currentEra]` reaches 100 THEN the system SHALL transition the game state to the next era via `advanceEra()`.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `areEraConditionsMet()` returns false for the next era THEN the system SHALL CONTINUE TO keep `eraProgress` at its current value and not advance the era.

3.2 WHEN the player is already in the final era (dyson_ring) THEN the system SHALL CONTINUE TO not attempt any further era advancement.

3.3 WHEN the game loop ticks other systems (resources, research, weather, etc.) THEN the system SHALL CONTINUE TO update those systems independently and without disruption from the era progression logic.

3.4 WHEN the player has not met unlock conditions but has sufficient flat resource costs THEN the system SHALL CONTINUE TO prevent era advancement (closing the bypass loophole).

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type GameTickInput (state + deltaTicks)
  OUTPUT: boolean

  // The bug manifests when unlock conditions ARE met but eraProgress is never incremented
  RETURN areEraConditionsMet(nextEra, X.state) = TRUE
     AND X.state.eraProgress[X.state.currentEra] < 100
     AND X.state.currentEra ≠ 'dyson_ring'
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Era progress increments when conditions are met
FOR ALL X WHERE isBugCondition(X) DO
  state' ← tick(X.state, X.deltaTicks)
  ASSERT state'.eraProgress[X.state.currentEra] > X.state.eraProgress[X.state.currentEra]
END FOR
```

### Preservation Checking Property

```pascal
// Property: Era progress does NOT increment when conditions are NOT met
FOR ALL X WHERE NOT isBugCondition(X) DO
  state' ← tick(X.state, X.deltaTicks)
  ASSERT state'.eraProgress[X.state.currentEra] = X.state.eraProgress[X.state.currentEra]
END FOR
```

---

## Bug 2: Weapons Factory Has No Observable Effect

## Bug Analysis

### Current Behavior (Defect)

4.1 WHEN the player builds a weapons factory THEN the system creates and persists the factory in `state.weapons.factories` but does not change `weapons.militaryPower`, so the player observes no immediate effect from the build.

4.2 WHEN a weapons factory exists and the current `steel` stockpile is below the per-unit material requirement (1 steel for conventional arms) THEN `WeaponsSystem.update()` produces zero units and returns an empty update, with no notification, error, or indication that steel is the bottleneck.

4.3 WHEN the player clicks the Earth panel "🔫 Produce Rifles (1 steel)" button THEN the system dispatches a `build_weapons_factory` action that builds an entire factory instead of producing a single rifle, so the button's behavior does not match its label.

4.4 WHEN weapons factories exist THEN the system drains energy each tick (`wf * 12` energy/tick in the render loop) regardless of whether any units are produced, so factories incur an ongoing cost with no offsetting benefit when steel is missing.

### Expected Behavior (Correct)

5.1 WHEN the player builds a weapons factory or produces weapons THEN the system SHALL produce an observable correlation to military power — either an immediate `militaryPower` change or clear feedback that production has started/queued.

5.2 WHEN a weapons factory cannot produce because the required material (steel) is insufficient THEN the system SHALL surface feedback to the player indicating that steel is the bottleneck, rather than silently producing nothing.

5.3 WHEN the player clicks the "🔫 Produce Rifles (1 steel)" button THEN the system SHALL perform the labeled action (produce rifles consuming steel), not build a new factory.

5.4 WHEN weapons factories drain energy each tick THEN the system SHALL ensure the player can perceive the relationship between that cost and the resulting military benefit (or lack thereof when materials are missing).

### Unchanged Behavior (Regression Prevention)

6.1 WHEN a weapons factory exists and sufficient `steel` is available THEN the system SHALL CONTINUE TO produce conventional units at the factory's production rate and increase `weapons.militaryPower` accordingly.

6.2 WHEN computing military power THEN the system SHALL CONTINUE TO sum `arsenal[category] * powerPerUnit[category]` across all weapon categories.

6.3 WHEN a weapon category is not unlocked via its required tech node THEN the system SHALL CONTINUE TO prevent production for that category.

6.4 WHEN the player builds a weapons factory THEN the system SHALL CONTINUE TO create and persist the factory in `state.weapons.factories`.

---

## Bug Condition (Formal) — Bug 2

```pascal
FUNCTION isWeaponsBugCondition(X)
  INPUT: X of type GameTickInput (state + deltaTicks)
  OUTPUT: boolean

  // The bug manifests when at least one unlocked factory exists but production
  // yields nothing AND no feedback is given (steel below per-unit requirement).
  RETURN EXISTS factory IN X.state.weapons.factories WHERE
           isCategoryUnlocked(X.state, factory.producing)
       AND getAffordableUnits(X.state, factory.producing, factory.productionRate * X.deltaTicks) = 0
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: When a factory cannot produce due to missing steel, the system
// surfaces feedback (rather than silently doing nothing).
FOR ALL X WHERE isWeaponsBugCondition(X) DO
  result ← tick'(X.state, X.deltaTicks)
  ASSERT producedFeedback(result) = TRUE
     AND feedbackIdentifies(result, 'steel') = TRUE
END FOR
```

```pascal
// Property: The "Produce Rifles" action produces rifles, not a factory.
FOR ALL X WHERE clicked(X, 'produce_rifles') AND steelAvailable(X.state) ≥ 1 DO
  state' ← handleAction'(X.state, X.action)
  ASSERT state'.weapons.arsenal.conventional > X.state.weapons.arsenal.conventional
     AND |state'.weapons.factories| = |X.state.weapons.factories|
END FOR
```

### Preservation Checking Property

```pascal
// Property: When a factory CAN produce (steel sufficient), production and
// military power behave exactly as before the fix.
FOR ALL X WHERE NOT isWeaponsBugCondition(X) DO
  ASSERT F(X) = F'(X)   // identical arsenal, militaryPower, and stockpile outcomes
END FOR
```

---

## Bug 3: Switching Planets Does Not Focus/Zoom the Camera

## Bug Analysis

### Current Behavior (Defect)

7.1 WHEN the player clicks a celestial body directly in the 3D scene THEN the `setBodyClickHandler` callback only calls `openPanel(id)` and does not call `solarScene.focusBody(id)` or `navigator.navigateTo(id)`, so the camera never animates to focus or zoom onto the selected body.

7.2 WHEN the player selects a body via direct 3D click THEN the active navigator body is not updated to match the opened panel, so panel selection and camera/navigation state can diverge.

### Expected Behavior (Correct)

8.1 WHEN the player clicks a celestial body directly in the 3D scene THEN the system SHALL animate the camera to focus and zoom in on that body (via `solarScene.focusBody(id)`) in addition to opening its panel.

8.2 WHEN the player selects a body via direct 3D click THEN the system SHALL update navigation state (via `navigator.navigateTo(id)`) so panel, camera, and active-body state stay consistent — provided the body is navigable.

### Unchanged Behavior (Regression Prevention)

9.1 WHEN the player navigates via the nav buttons (`data-nav`) THEN the system SHALL CONTINUE TO call both `navigator.navigateTo(...)` and `solarScene.focusBody(...)`, focusing and zooming as it does today.

9.2 WHEN the player clicks a celestial body in the 3D scene THEN the system SHALL CONTINUE TO open that body's panel via `openPanel(id)`.

9.3 WHEN the player clicks a body that is locked / not navigable THEN the system SHALL CONTINUE TO respect `canNavigateTo()` (navigation is a no-op for locked bodies).

---

## Bug Condition (Formal) — Bug 3

```pascal
FUNCTION isFocusBugCondition(X)
  INPUT: X of type ClickEvent (selected body id, source)
  OUTPUT: boolean

  // The bug manifests when a body is selected via a direct 3D-scene click
  // (rather than a nav button), because focus/navigation is not invoked.
  RETURN X.source = 'scene_click'
     AND canNavigateTo(X.bodyId) = TRUE
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: A direct scene click focuses/zooms the camera and updates nav state.
FOR ALL X WHERE isFocusBugCondition(X) DO
  effects ← handleBodyClick'(X)
  ASSERT calledFocusBody(effects, X.bodyId) = TRUE
     AND activeBody(effects) = X.bodyId
     AND openedPanel(effects, X.bodyId) = TRUE
END FOR
```

### Preservation Checking Property

```pascal
// Property: Nav-button navigation and locked-body handling are unchanged.
FOR ALL X WHERE NOT isFocusBugCondition(X) DO
  ASSERT F(X) = F'(X)   // nav-button focus/zoom and locked no-op behavior preserved
END FOR
```
