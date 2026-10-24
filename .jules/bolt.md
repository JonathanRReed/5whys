## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-06-21 - Verify User-Facing Paths Before Optimizing Unused Helpers

**Learning:** `escapeHtml` in `src/lib/resume-game/text.ts` is only used by `highlightResume`, which is a legacy HTML formatter with no active callers in production React components (rendering uses `parseHighlightedResume` directly as React children). Bypassing regex work in an unused helper yields no measurable user-facing improvement.
**Action:** Always trace the end-to-end caller path to confirm an optimized helper function is actively executed on hot user paths before implementing optimizations.
