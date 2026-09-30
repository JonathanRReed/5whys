## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-09-30 - O(1) Set lookup vs O(N) Array.includes for power verbs

**Learning:** Replacing `Array.includes()` on static array constants (`POWER_VERBS_STRONG`) with a module-level `Set.has()` lookup in `computeBenchmarkScore` and `getVerbStrength` improves lookup performance by ~30% when processing larger bullet lists (1000 bullets over 100k iterations dropped from 7036ms to 4948ms).
**Action:** Always precompile constant arrays used in filtering/membership checks into static `Set` instances at definition time.
