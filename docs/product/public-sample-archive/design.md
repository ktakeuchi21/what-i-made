# Public sample archive

## Decision

What I Made offers a public, read-only sample before invitation sign-in. It is a product tour made from the real Year, Map, Journal, recap, dish-history, and Ideas interfaces—not a separate slideshow or editable starter archive.

## Experience

- Signed-out visitors choose **Explore a sample archive** or **Sign in with email**.
- Exploration adds `demo=1` while retaining unrelated URL parameters. Browser Back returns to the signed-out page.
- A persistent **Sample archive · Fictional** bar and contextual Year card prevent sample activity from being mistaken for personal data.
- The fixture represents the previous full calendar year: 36 occasions, 40 dish attempts, 28 dishes, 22 countries across all 13 culinary regions, 40 photograph placements, and eight Ideas.
- Its food imagery is a curated set of real, openly licensed Wikimedia Commons photographs. Cook and Idea details retain the photographer, source page, license, and a disclosure that the local variant was cropped for display.
- Personal actions open one invitation dialog instead of changing data. Map display modes remain temporary in-memory preferences.
- Leaving the sample clears transient navigation, filters, scroll positions, and owned object URLs. Sign-in opens only the retained or newly authenticated account archive.

## Boundaries

Application mode is explicit: `signedOut`, `demo`, or `account`. Demo mode uses `demo-archive.js`, a read-only in-memory repository loaded from the versioned manifest. It has no database-opening or mutation methods and must never fall back to the account repository. The public fixture contains deterministic IDs, fictional copy, validated country references, and same-origin media paths.

The signed-out page loads the small repository module but does not request the manifest or food photographs. The service worker does not precache them. Once requested, same-origin runtime caching enables a previously visited sample to reopen offline. Cached public files remain separate from account records. Deployed photographs are metadata-free local WebP derivatives rather than hotlinks; the manifest is the durable attribution and license record.

## Acceptance evidence

- Base URL → sample → Back returns to sign-in without dropping unrelated parameters.
- Direct `demo=1` opens the sample; OAuth callback parameters take precedence.
- All 13 active map regions, Journal discovery, recap, histories, and Ideas are navigable.
- Mutating controls open the invitation dialog and the sample repository exposes no write surface.
- Packaging copies only manifest-referenced WebP files and rejects invalid paths or files above the 50 KB thumbnail, 250 KB display, or 12 MB total budgets.
- Manifest validation rejects missing creators, unsupported licenses, untrusted source hosts, and absent modification notices.
