## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-05-18 - Optimized packet story filtering using Set lookup

**Learning:** Filtering arrays by checking presence in another array using `Array.includes` leads to O(N*M) time complexity. Utilizing a `Set` via `React.useMemo` reduces the lookup to O(1) per story, yielding an overall O(N) complexity and >20x speedup for large sets of stories and topStoryIds.
**Action:** Always prefer `Set.prototype.has` over `Array.prototype.includes` when filtering arrays against a collection of IDs.
