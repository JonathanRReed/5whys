## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-09-30 - Set Lookup for Array Filtering in React Components

**Learning:** Using `Array.includes` inside iteration loops or filter callbacks over collection data structures creates an O(N*M) algorithmic complexity. Converting the lookup array to a `Set` prior to filtering reduces the lookup to O(1) time complexity, yielding a ~14x performance improvement in array filtering operations.
**Action:** When filtering collections against an array of IDs in render functions or data processing routines, pre-compute a `Set` to perform O(1) `.has()` checks instead of linear `.includes()` scans.
