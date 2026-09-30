## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-09-30 - O(N*M) Array.includes Filtering in Event Handlers

**Learning:** Performing `Array.includes` inside array filter and map calls during batch operations (like `handleBatchAddToPacket`) scales quadratically with dataset size. Converting target lookup arrays to `Set` instances beforehand drops time complexity from O(N*M) to O(N+M) and yields an ~80-100x speedup on multi-thousand item sets without sacrificing code readability or state integrity.
**Action:** Always instantiate lookup `Set`s prior to filtering or mapping collections when performing set difference or batch membership checks.
