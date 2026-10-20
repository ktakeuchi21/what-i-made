# Multiple photos while documenting and editing a cook

The existing gallery can store many photos, but capture and edit expose only one. Reuse the local photo processor and IndexedDB photo records; no new service or database migration is needed.

The new photo editor supports selecting several library images, taking additional camera photos, replacing or removing individual images, and choosing the main photo. It appears in capture, saved-cook editing, and additional-dish forms. The first photo is main by default. Editing shows the occasion's whole gallery, with existing dish assignments preserved and new photos assigned to the edited dish.

Images are processed sequentially on the device. A failed selection leaves the previous draft intact. Temporary image URLs are released when removed, replaced, or discarded. Saving is unavailable during processing. Cancel invalidates in-flight work and discards only the draft.

## Requirements and proof

- **AC-1:** New capture accepts multiple photos in one selection and across selections. Review/back preserves the gallery, and saving/reopening retains every photo.
- **AC-2:** Editing supports adding, replacing, deleting, and choosing a main photo. At least one photo must remain. Cancel leaves the saved gallery untouched.
- **AC-3:** Additional dishes support multiple optional photos, both during capture and after an occasion is saved.
- **AC-4:** Invalid images, processing failures, and storage failures retain prior data and show a recoverable message. Late processing results cannot enter a discarded draft or another account.
- **INV-1:** Cook metadata and gallery edits commit in one transaction. A stale gallery fails rather than overwriting another edit.
- **INV-2:** Every saved occasion has a valid main photo. Existing photo identity and dish assignment survive replacement. Map defaults are repaired if their photo is removed or no longer eligible.
- **INV-3:** Photo blobs, thumbnails, and previews stay local. Existing single-photo archives and backups remain compatible.

Use unit tests for draft lifecycle and gallery validation, then browser checks against real IndexedDB for create, review/back, edit, cancel, rollback, multi-dish association, backup round-trip, and reopening. Check phone and desktop layouts, keyboard controls, and console/network errors. Physical iPhone camera selection remains a device check.
