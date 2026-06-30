# Bugfix Requirements Document

## Introduction

This document covers a cluster of weapons/military defects in the Sun Harvester game that share a single root cause: **the military UI is decoupled from a coherent weapons/soldier mechanic, and one of its buttons is mislabeled and misrouted.**

The player reports four symptoms, all stemming from this root cause:

1. **"The weapons factory doesn't build."** Building a weapons factory persists a factory in `state.weapons.factories`, but produces no immediate observable effect. The factory only raises military power on later ticks, and only when `steel` is available (1 steel per conventional unit). When steel is insufficient, `WeaponsSystem.update()` silently returns an empty update with no feedback, so the build appears to do nothing.

2. **"The building of weapons has NO correlation."** The Earth panel displays two unrelated, irreconcilable numbers derived from the same `arsenal` via different formulas: `soldiers = militaryPower * 10` and `soldiers assigned = conventional*1 + missile*5 + cyber*3 + energy*10 + orbital*20`. There is no coherent model linking factories → production → soldiers → military power that the player can reason about, so produced weapons never correlate with what is displayed.

3. **"I can't assign soldiers."** Soldier assignment is purely a derived display value in `renderEarthPanel`. No button, action, or state field exists for assigning soldiers — the interactive mechanic was never implemented. The player literally cannot assign soldiers.

4. **"When I press build rifles, it says building weapons factory."** The Earth panel button labeled `🔫 Produce Rifles (1 steel)` dispatches a `build_weapons_factory` action (with the same payload as the Build panel's `🔫 Weapons Factory` button). Pressing it queues a 10s factory build and notifies "Building Weapons Factory", so the label and the action do not match.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the player clicks the Earth panel `🔫 Produce Rifles (1 steel)` button THEN the system dispatches a `build_weapons_factory` action that enqueues a 10s factory build and notifies "Building Weapons Factory", so the button's behavior does not match its "Produce Rifles" label.

1.2 WHEN the player wants to assign soldiers THEN the system provides no button, action, or state field to do so, because soldier assignment exists only as a derived display value (`Math.floor(state.weapons.militaryPower * 10)`) and a static computed line, never as an interactive mechanic.

1.3 WHEN the Earth panel renders the military section THEN the system displays two irreconcilable numbers derived from the same `arsenal` via different formulas — `soldiers = militaryPower * 10` and `soldiers assigned = conventional*1 + missile*5 + cyber*3 + energy*10 + orbital*20` — so produced weapons show no coherent correlation to displayed military strength.

1.4 WHEN the player builds a weapons factory THEN the system creates and persists the factory in `state.weapons.factories` but does not change `weapons.militaryPower`, so the player observes no immediate effect from the build.

1.5 WHEN a weapons factory exists and the `steel` stockpile is below the per-unit requirement (1 steel for conventional arms) THEN `WeaponsSystem.update()` produces zero units and returns an empty update, with no notification or indication that steel is the bottleneck, so the factory appears to "do nothing".

### Expected Behavior (Correct)

2.1 WHEN the player clicks the `🔫 Produce Rifles (1 steel)` button THEN the system SHALL perform the labeled action — produce rifles (conventional units) consuming steel — rather than building a new factory.

2.2 WHEN the player wants to assign soldiers THEN the system SHALL provide an interactive mechanic (button + action + persisted state field) that assigns soldiers, so the player can perform the action they expect from the UI.

2.3 WHEN the Earth panel renders the military section THEN the system SHALL present a single coherent model linking factories → production → soldiers → military power, so the displayed numbers reconcile and produced weapons correlate visibly with military strength.

2.4 WHEN the player builds a weapons factory or produces weapons THEN the system SHALL produce an observable correlation to military power — either an immediate `militaryPower` change or clear feedback that production has started/queued.

2.5 WHEN a weapons factory cannot produce because the required material (steel) is insufficient THEN the system SHALL surface feedback to the player identifying steel as the bottleneck, rather than silently producing nothing.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the player clicks the Build panel `🔫 Weapons Factory` button THEN the system SHALL CONTINUE TO enqueue a `build_weapons_factory` build and, on completion, create and persist a factory in `state.weapons.factories`.

3.2 WHEN a weapons factory exists and sufficient `steel` is available THEN the system SHALL CONTINUE TO produce conventional units at the factory's production rate and increase `weapons.militaryPower` accordingly.

3.3 WHEN computing military power THEN the system SHALL CONTINUE TO sum `arsenal[category] * powerPerUnit[category]` across all weapon categories.

3.4 WHEN a weapon category is not unlocked via its required tech node THEN the system SHALL CONTINUE TO prevent production for that category.

3.5 WHEN the player triggers other military actions (Attack UN Forces, Diplomatic Deception, Education Campaign) THEN the system SHALL CONTINUE TO dispatch their existing `countermeasure` actions unchanged.

---

## Bug Condition (Formal)

The cluster shares one root cause but manifests through distinct conditions. The following predicates identify the buggy inputs.

```pascal
FUNCTION isMislabeledActionBug(X)
  INPUT: X of type ClickEvent (button id, dispatched action)
  OUTPUT: boolean

  // The bug manifests when the "Produce Rifles" button dispatches a factory build.
  RETURN X.buttonId = 'produce_rifles'
     AND X.action.type = 'build_weapons_factory'
END FUNCTION
```

```pascal
FUNCTION isSoldierAssignmentBug(X)
  INPUT: X of type UIState
  OUTPUT: boolean

  // The bug manifests when the player intends to assign soldiers but no
  // assignment mechanic (action or state field) exists.
  RETURN intendsToAssignSoldiers(X)
     AND NOT existsSoldierAssignmentAction(X)
END FUNCTION
```

```pascal
FUNCTION isNoCorrelationBug(X)
  INPUT: X of type GameState
  OUTPUT: boolean

  // The bug manifests when the two displayed soldier figures disagree,
  // i.e. military display is incoherent.
  RETURN floor(X.weapons.militaryPower * 10)
       ≠ (X.weapons.arsenal.conventional * 1
        + X.weapons.arsenal.missile * 5
        + X.weapons.arsenal.cyber * 3
        + X.weapons.arsenal.energy * 10
        + X.weapons.arsenal.orbital * 20)
END FUNCTION
```

```pascal
FUNCTION isSilentProductionBug(X)
  INPUT: X of type GameTickInput (state + deltaTicks)
  OUTPUT: boolean

  // The bug manifests when at least one unlocked factory exists but production
  // yields nothing and no feedback is given (steel below per-unit requirement).
  RETURN EXISTS factory IN X.state.weapons.factories WHERE
           isCategoryUnlocked(X.state, factory.producing)
       AND getAffordableUnits(X.state, factory.producing,
                              factory.productionRate * X.deltaTicks) = 0
END FUNCTION
```

### Fix Checking Properties

```pascal
// Property: The "Produce Rifles" action produces rifles, not a factory.
FOR ALL X WHERE isMislabeledActionBug(X) AND steelAvailable(X.state) ≥ 1 DO
  state' ← handleAction'(X.state, producedRiflesAction(X))
  ASSERT state'.weapons.arsenal.conventional > X.state.weapons.arsenal.conventional
     AND |state'.weapons.factories| = |X.state.weapons.factories|
END FOR
```

```pascal
// Property: A soldier-assignment mechanic exists and assigns soldiers.
FOR ALL X WHERE isSoldierAssignmentBug(X) DO
  state' ← handleAction'(X.state, assignSoldiersAction(X))
  ASSERT existsSoldierAssignmentAction(X) = TRUE
     AND assignedSoldiers(state') reflects the requested assignment
END FOR
```

```pascal
// Property: The displayed military figures reconcile under one coherent model.
FOR ALL X WHERE isNoCorrelationBug(X) DO
  view' ← renderMilitary'(X)
  ASSERT soldiersDisplayed(view') is consistent with arsenal and militaryPower
         under a single defined formula (no two contradictory figures)
END FOR
```

```pascal
// Property: When a factory cannot produce due to missing steel, the system
// surfaces feedback identifying steel rather than silently doing nothing.
FOR ALL X WHERE isSilentProductionBug(X) DO
  result ← tick'(X.state, X.deltaTicks)
  ASSERT producedFeedback(result) = TRUE
     AND feedbackIdentifies(result, 'steel') = TRUE
END FOR
```

### Preservation Checking Property

```pascal
// Property: For all non-buggy inputs, the fixed code behaves identically
// to the original — factory builds via the Build panel, weapon production
// when steel is sufficient, military power computation, tech-gating, and
// the existing countermeasure actions are all unchanged.
FOR ALL X WHERE NOT isMislabeledActionBug(X)
            AND NOT isSoldierAssignmentBug(X)
            AND NOT isNoCorrelationBug(X)
            AND NOT isSilentProductionBug(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
