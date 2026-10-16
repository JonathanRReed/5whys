## 2025-05-18 - Replacing Native Browser Confirm Dialogs with In-Place ConfirmButton

**Learning:** Native `window.confirm()` dialogs disrupt user flow, cannot be themed to match the application's design system, lack rich screen reader announcement context (`aria-live`), and violate the product's modal-free UI design rules.
**Action:** Use `shared/ConfirmButton` for all destructive actions across studio tools. It arms in-place with explicit stakes, announces the armed label to screen readers via `aria-live="polite"`, disarms on `Escape`/blur/timeout, and avoids jarring modal dialogs.

## 2025-05-19 - Dynamic ARIA Label Updates for In-Place Confirmation Buttons

**Learning:** When a button component uses an `aria-label` attribute for context (e.g., `aria-label="Delete story: API redesign"`), changing inner text content when armed does not update the accessible name computed by assistive technology, preventing `aria-live` regions from announcing the confirmation prompt to screen readers.
**Action:** Dynamically compute `aria-label` to switch to `confirmLabel` when armed so screen readers receive live announcements and accessible name queries accurately reflect button state changes.

## 2026-10-11 - Preventing Invisible Focus Trapping in Off-Screen Mobile Drawers

**Learning:** Off-screen side menus positioned via CSS `transform: translateX(100%)` remain focusable in the DOM. Using `aria-hidden` and `inert` when collapsed removes the container from screen reader trees and tab order, while avoiding `visibility: hidden` (`invisible`) allows CSS slide transitions to play smoothly without creating off-screen focus traps.
**Action:** Apply `aria-hidden={!isOpen}` and `inert={!isOpen ? true : undefined}` to off-screen slide drawers.

## 2026-10-12 - Focus Management and Live Region Announcements for Multi-Step Wizards

**Learning:** When unmounting button elements during wizard step transitions, keyboard focus resets to `body`, causing screen reader and keyboard users to lose track of the active question or result screen.
**Action:** Move focus to a visibly outlined step/recommendation heading only after visitor navigation. Initial hydration, profile restoration, and StrictMode mounting leave existing focus in place. Keep one initially empty polite status region across steps/results, with concise progress or completion text so focus and live updates do not repeat the question. DOM and keyboard tests verify the behavior; actual screen-reader announcements have not been tested.

## 2026-10-13 - Preventing Screen Reader Flooding from Active Timer Live Regions

**Learning:** Assigning `aria-live="polite"` directly to countdown timer containers (`role="timer"`) or active elapsed time elements causes screen readers to announce every single second tick. This creates continuous audio chatter that interrupts visitors practicing speaking or reading aloud.
**Action:** Use `aria-live="off"` on `role="timer"` elements during rapid countdowns, and pair them with a separate polite status region (`role="status"`) that announces discrete state transitions ("Timer started", "Timer paused", "Time's up!") only when state changes.
