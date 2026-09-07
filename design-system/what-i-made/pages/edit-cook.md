# Edit Cook

> **Status:** Prototype rules  
> **Overrides:** These rules refine the [What I Made master design system](../MASTER.md) for saved-cook correction.

- Use a full navigable screen, not a modal, so iPhone keyboards and larger text have room.
- The occasion detail keeps the main photograph visually dominant and presents every saved photograph in a reserved-aspect-ratio gallery.
- Offer labeled Camera and Library controls for adding photographs after save. A photo-options sheet lets the owner assign a photograph to one dish or the whole occasion, make it main, or delete it.
- Disable deletion for the current main photograph and explain that another photograph must be promoted first.
- Put the shared-dish explanation immediately before dish name and country.
- Use visible labels for every field, numeric keyboard semantics for rating, and inline recovery errors.
- Keep one final Save changes action. Cancel returns to the unchanged detail and warns only for a dirty edit.
- Put one Edit action on each dish card. Removing a dish requires confirmation, deletes its non-main assigned photographs, preserves a main photograph by making it occasion-wide, and is disabled for the last dish.
