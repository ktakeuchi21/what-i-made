# What I Made Working Agreement

This is a personal product intended for regular use on an iPhone. Keep the process rigorous but proportional to a solo-user, solo-maintainer application.

## Product before platform

- Do not choose PWA, React Native/Expo, or SwiftUI until the core jobs, required device capabilities, data model, privacy needs, and distribution constraints are documented.
- Prefer the least operationally complex option that fully satisfies the validated requirements.
- Treat assumptions as assumptions. Separate confirmed needs from hypotheses and nice-to-haves.

## Delivery workflow

1. Frame the problem, primary user, jobs to be done, goals, non-goals, and success signals.
2. Compare platform options with explicit criteria and record the decision.
3. Write the PRD, story map, MVP release slice, user stories, and acceptance criteria.
4. Establish a small accessible design system and prototype the key flows.
5. Write and review the technical design before implementation.
6. Implement in small vertical slices, test observable behavior, and verify on the real target surface.

Use the project-local skills in `.agents/skills` only when their descriptions match the current task. Avoid ceremony that does not improve a decision or artifact. Do not add external services, accounts, analytics, or cloud infrastructure without a requirement that justifies them.

## Project documents

Keep durable product decisions under `docs/product/`, technical decisions under `docs/technical/`, and design-system decisions under `design-system/` when those artifacts are created.
