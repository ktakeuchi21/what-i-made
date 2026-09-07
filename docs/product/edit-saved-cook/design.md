# Edit a Saved Cook

> **Status:** Implemented prototype; pending deployed iPhone validation

## 1. Outcome

The owner can correct a saved cooking memory without deleting and recreating it. Attempt-specific values change only that cook, while canonical dish values stay consistent across its grouped history.

## 2. Data ownership

```text
Canonical dish: name, country
Cooking attempt: date, rating, notes, ingredients
Cooking occasion: main photo reference
Photo: optimized local image blob
```

Editing a dish name or country updates the existing canonical dish UUID and therefore every cook grouped under it. The edit screen explains this before those fields. Editing date, rating, notes, ingredients, or photo changes only the selected cook. Replacing the photo updates the existing photo record instead of creating an orphan. If that photo is the dish's selected map photo, the map naturally reflects the replacement.

## 3. Invariants

- `INV-E1`: An edit never changes the cooking occasion, attempt, dish, or photo IDs.
- `INV-E2`: All changed records commit in one IndexedDB transaction or none do.
- `INV-E3`: Editing one cook's attempt fields does not change another attempt.
- `INV-E4`: Dish name and country changes remain shared across the canonical dish.
- `INV-E5`: Replacement photographs are optimized locally and are not uploaded.

## 4. Failure behavior

Validation happens before the update is committed. A missing cook, attempt, dish, or required photo aborts the transaction and leaves the edit form intact with a recoverable error. Cancel warns only when fields or the photo changed. Failed photo processing retains the original photo and all typed edits.

## 5. Acceptance criteria

- `AC-E1`: Opening a journal entry and choosing Edit prepopulates every saved field and the current photo.
- `AC-E2`: Saving valid changes returns to the same cook and shows the updated values after reload.
- `AC-E3`: Replacing the photo stores the locally optimized replacement while preserving record IDs.
- `AC-E4`: Cancel with no changes returns immediately; cancel with changes requires confirmation and can retain the draft.
- `AC-E5`: Invalid name, date, rating, or photo cannot overwrite the saved cook.
- `AC-E6`: Shared dish fields clearly disclose their effect on grouped cooks.
- `AC-E7`: The edit flow has no horizontal overflow at 375 CSS pixels or iPhone landscape and all controls remain reachable.

## 6. Out of scope

- Deleting cooks or photos
- Moving one attempt between canonical dishes
- Merging dishes
- Editing map coordinates or selecting a different existing map photo
