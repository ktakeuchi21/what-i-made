# Backup & Storage

This page follows `../MASTER.md` and adds recovery-specific rules.

- Enter from the Year screen; do not add a fifth bottom-navigation destination.
- Lead with the distinction between local storage and a separate backup, using calm language rather than warnings or guilt.
- Keep creation, restoration, and erasure in separate sections. Destructive styling appears only in the final recovery section and confirmation dialog.
- Inspect a selected backup before enabling restore. Show its date, schema, size, and human-readable counts without changing IndexedDB.
- Never merge or silently replace a non-empty archive. Direct the owner to create a backup and use the separately confirmed erase flow.
- Require the exact text `ERASE` before enabling permanent deletion. The dialog names current archive counts and returns focus predictably.
- Announce progress and outcomes with stable live regions. Do not claim that a share-sheet file was saved; say that the backup was prepared.
- Preserve the Year scroll position and originating control when navigating back.
