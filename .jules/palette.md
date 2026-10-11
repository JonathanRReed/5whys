## 2025-05-18 - Replacing Native Browser Confirm Dialogs with In-Place ConfirmButton

**Learning:** Native `window.confirm()` dialogs disrupt user flow, cannot be themed to match the application's design system, lack rich screen reader announcement context (`aria-live`), and violate the product's modal-free UI design rules.
**Action:** Use `shared/ConfirmButton` for all destructive actions across studio tools. It arms in-place with explicit stakes, announces the armed label to screen readers via `aria-live="polite"`, disarms on `Escape`/blur/timeout, and avoids jarring modal dialogs.

## 2025-05-19 - Dynamic ARIA Label Updates for In-Place Confirmation Buttons

**Learning:** When a button component uses an `aria-label` attribute for context (e.g., `aria-label="Delete story: API redesign"`), changing inner text content when armed does not update the accessible name computed by assistive technology, preventing `aria-live` regions from announcing the confirmation prompt to screen readers.
**Action:** Dynamically compute `aria-label` to switch to `confirmLabel` when armed so screen readers receive live announcements and accessible name queries accurately reflect button state changes.

## 2026-10-11 - Preventing Invisible Focus Trapping in Off-Screen Mobile Drawers

**Learning:** Off-screen side menus positioned via CSS `transform: translateX(100%)` remain focusable in the DOM. Using `aria-hidden` and `inert` when collapsed removes the container from screen reader trees and tab order, while avoiding `visibility: hidden` (`invisible`) allows CSS slide transitions to play smoothly without creating off-screen focus traps.
**Action:** Apply `aria-hidden={!isOpen}` and `inert={!isOpen ? true : undefined}` to off-screen slide drawers.
