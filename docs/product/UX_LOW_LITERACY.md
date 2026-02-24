# Low-Literacy UX Standard — v2

## Principles
- Big buttons, clear icons, minimal clutter
- Progressive disclosure: Basic → Standard → Advanced
- Help is always available on-screen
- Offline state is obvious
- Accessibility mode is one tap away

## Implemented Features (Phase 1)

### Guided Interaction Overlay
**Component:** `components/GuidedOnboarding.tsx`
**Flag:** `NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING=true`

- Auto-launches on first login; dismissed state persists in `localStorage`.
- Five guided steps covering dashboard overview, class cards, homework, and students.
- Dismissible at any step via the ✕ button.
- Re-openable at any time via the **? Help** button in the floating toolbar (bottom-right).
- Fires `onboarding.step_completed` and `onboarding.completed` telemetry events.

### Accessibility Mode Toggle
**Component:** `components/AccessibilityToggle.tsx`
**Flag:** `NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE=true`

- Toggle button ("Aa") in the floating toolbar (bottom-right).
- Sets `data-a11y="true"` on `<html>`, enabling global CSS in `globals.css`:
  - Base font size increased to 112.5% (18 px)
  - Minimum 44 px tap target on all buttons and links
  - Increased line height on paragraph and label text
  - Larger h1 / h2 / h3 sizes
- Preference stored in `localStorage` (`ll_a11y_mode`) and restored on every page load.

### Collapsible Panels
**Component:** `components/CollapsiblePanel.tsx`

- Wraps secondary and advanced UI sections; collapsed by default.
- Primary content (stats, class cards) always visible.
- Secondary content (Resources & quick links, future advanced settings) hidden until expanded.
- Implements the "progressive disclosure" principle without page navigation.

### Increased Button Sizes
Teacher dashboard buttons updated from `text-xs px-4 py-2` → `text-sm px-5 py-3`.
Nav tab tap targets increased from `py-1` → `py-2`.
Stat cards increased from `p-4` → `p-5` with larger figure text (`text-3xl`).

### Feature-Flagged Toolbar
Both the ? Help button and Accessibility toggle render only when their respective flags are enabled. The floating toolbar (`z-40`) does not appear in production until explicitly enabled, giving pilots control over rollout.

## Feature Flag Reference

| Flag | Default | Description |
|------|---------|-------------|
| `NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING` | `false` | Show step-by-step overlay + Help button |
| `NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE` | `false` | Show Aa toggle; applies large-font CSS mode |

See `docs/ops/FEATURE_FLAGS.md` for full flag catalogue.

## Telemetry Events

| Event | When |
|-------|------|
| `onboarding.step_completed` | Teacher advances each guide step |
| `onboarding.completed` | Teacher finishes all steps |
| `accessibility.mode_toggled` | Reserved for future toggle tracking |

All events flow to `/api/track` via the existing `trackEvent` client utility.

## Success Metrics
- Onboarding completion rate (target: >70% of first-time logins)
- Help re-invocation rate (indicates confusion; target: <15% of sessions)
- Workflow completion rate: create lesson → assign → grade → message parent

## Required UX Features (Outstanding)
- Training center access from every dashboard ← planned Phase 2
- Low-bandwidth mode (reduce heavy UI payloads) ← planned Phase 2
- Inline tooltip popovers anchored to DOM elements ← deferred (see ADR-0005)

## Architecture Reference
See `docs/adr/0005-usability-infrastructure.md` for the full decision record.
