# Feasibility Lab Page Decisions

> **Overrides:** These decisions refine the [What I Made master design system](../MASTER.md) for temporary device-capability testing.

## Purpose

The feasibility lab is a trustworthy diagnostic surface, not a product destination. It should feel related to What I Made while prioritizing clarity, privacy, and unambiguous test status over photographic immersion.

## Page-specific rules

- Use one continuous, numbered sequence of six tests. Each test is a real interaction group and may use a bounded surface.
- Pair every color state with explicit text: Not run, Incomplete, Passed, or Needs attention.
- Keep one polite live announcement region for completed actions; do not make every changing badge a competing live region.
- Show the privacy boundary before the first device permission request. Require local-only speech recognition when the browser exposes that control; otherwise state explicitly that Safari may send microphone audio to Apple even though the lab has no app-owned upload.
- Separate microphone permission from browser transcription so a failure identifies the correct adapter decision.
- Require manual confirmation for visual orientation and Apple Files availability because browser APIs cannot prove those outcomes alone.
- Exclude photographs, file names, and transcript text from copied or downloaded diagnostic reports.
- On phones, stack actions to full width. Controls remain at least 44 CSS pixels high, with visible labels and focus.
- Preserve results locally across reloads because reload survival is itself part of the test.
- Use no external scripts, fonts, analytics, icons, or app-owned uploads. Treat Safari's potentially server-backed speech recognition as a disclosed external-processing boundary, not as on-device behavior.

## Status language

| Tone | Meaning | Example |
| --- | --- | --- |
| Idle | The owner has not generated evidence yet | Not run |
| Attention | Partial evidence or a required manual step remains | Reload once |
| Pass | The observable criterion is satisfied | Passed |
| Fail | The tested path cannot meet the requirement as-is | Needs another route |

## Completion boundary

Desktop browser validation can prove rendering, keyboard operation, local photo processing, IndexedDB mechanics, report generation, and fallbacks. Only the owner's physical iPhone over HTTPS can close Home Screen, camera, HEIC/orientation, microphone quality, Safari speech recognition, persistence policy, and Save to Files criteria.
