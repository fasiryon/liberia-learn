# ADR 0005 — Usability Infrastructure for Low Computer-Literacy Teachers

## Status
Accepted

## Context
LiberiaLearn is deployed in schools where many teachers have limited prior experience with computers or touchscreen devices. The existing teacher dashboard was functional but had small tap targets, no progressive disclosure, and no contextual guidance. Onboarding relied entirely on verbal training, which is not reproducible or scalable.

Research from the pilot cohort identified three friction points:
1. Teachers missed secondary features because the UI presented everything at once.
2. First-time logins produced confusion about where to start.
3. Teachers with visual limitations struggled with the small text.

## Decision

We introduce three infrastructure primitives, all behind feature flags:

### 1. Guided Onboarding Overlay (`ENABLE_GUIDED_ONBOARDING`)
A step-by-step modal overlay (`GuidedOnboarding`) that auto-launches on first visit and is re-openable at any time via a persistent **? Help** button in the floating toolbar. State is stored in `localStorage` (`ll_onboarding_dismissed`, `ll_onboarding_step`) so the guide resumes where the teacher left off across page reloads. Telemetry events `onboarding.step_completed` and `onboarding.completed` are emitted on progression and completion.

### 2. Accessibility Mode Toggle (`ENABLE_ACCESSIBILITY_MODE`)
A toggle (`AccessibilityToggle`) that sets `data-a11y="true"` on `<html>`, enabling global CSS rules in `globals.css` that increase the base font size to 112.5% and enforce a minimum 44 px tap target on all buttons and links. Preference is persisted in `localStorage` (`ll_a11y_mode`) and restored on every page load.

### 3. Collapsible Panels (`CollapsiblePanel`)
A client component that wraps secondary and advanced sections, defaulting to collapsed. Primary content (class cards, stats) remains always visible. Secondary content (Resources & quick links, advanced settings) is hidden until the teacher explicitly expands it.

### Feature flags
Both overlays are controlled by `NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING` and `NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE` env vars (default: disabled). The floating toolbar only renders when at least one flag is active. This allows per-deployment control without a code change or migration.

### Scope boundary
All changes are front-end only. No API routes, Prisma models, or migration files are modified. Telemetry fires to the existing `/api/track` endpoint using the existing `trackEvent` client.

## Consequences
- Teachers on first login now have a guided path through the five most important actions.
- The ? Help button is always visible in the bottom-right corner when the flag is on, providing a recoverable entry point if a teacher loses their place.
- Accessibility mode integrates cleanly with the Tailwind v4 / globals.css pipeline without a Tailwind config change.
- CollapsiblePanel enforces the "progressive disclosure" principle from `docs/product/UX_LOW_LITERACY.md`.
- Feature flags allow safe staged rollout: enable per pilot school via env var before general availability.
- The floating toolbar is z-index 40, below any future modals (z-50+).

## Alternatives Considered
- **Inline tooltip popovers anchored to DOM elements** — rejected for the initial version due to positioning complexity on mobile screens with low viewport heights. Deferred to a future iteration.
- **Server-side onboarding state in the database** — rejected; localStorage is sufficient and avoids a schema migration. The guide auto-resets on `localStorage` clear, which is acceptable.
- **Third-party onboarding library (Shepherd.js, Intro.js)** — rejected; bundle size concern for low-bandwidth classrooms, and the simple modal pattern covers the needed use cases.

## References
- `docs/product/UX_LOW_LITERACY.md`
- `docs/ops/FEATURE_FLAGS.md`
- ADR-0001 (Offline Protocol) — offline-first compatibility preserved: no network calls from new components on page load
