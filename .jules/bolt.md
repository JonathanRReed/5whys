## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-06-21 - Short-Circuiting & Helper Caching on Fast Sub-Millisecond Paths

**Learning:** Micro-optimizing already-fast text analysis functions (like short-circuiting regexes in `detectImpact` or caching `quantifiedCount` across report generators) offers negligible real-world gains on typical 12-bullet inputs (~1.2ms scan time). Additionally, changing return structure shapes like `benchmark.details` breaks byte-for-byte API compatibility.
**Action:** Do not modify core data structures or return shapes for sub-millisecond micro-optimizations. Only target optimizations with significant, measurable user-facing latency improvements without modifying exported API shapes.
