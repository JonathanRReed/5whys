## 2025-05-18 - Replacing Native Browser Confirm Dialogs with In-Place ConfirmButton

**Learning:** Native `window.confirm()` dialogs disrupt user flow, cannot be themed to match the application's design system, lack rich screen reader announcement context (`aria-live`), and violate the product's modal-free UI design rules.
**Action:** Use `shared/ConfirmButton` for all destructive actions across studio tools. It arms in-place with explicit stakes, announces the armed label to screen readers via `aria-live="polite"`, disarms on `Escape`/blur/timeout, and avoids jarring modal dialogs.
