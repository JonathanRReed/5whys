## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-06-22 - O(1) Set Lookups for Power Verbs

**Learning:** `Array.includes` on power verbs list during bullet/resume health score calculations scales as O(N*M) with N bullets and M verbs. Pre-creating static `Set` instances for power verb collections turns linear scans into O(1) set membership checks, achieving ~3x lookup performance improvement over 1,000,000 verb checks.
**Action:** Replace `Array.includes` on static list constants with module-level `Set` instances using `.has()` for O(1) lookup efficiency.
