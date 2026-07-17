## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.
