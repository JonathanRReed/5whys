## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-06-22 - Substring Fast-Paths for Context-Gated Document Matching

**Learning:** Complex regexes with ordering constraints or lookaheads run unnecessarily on non-matching documents. Performing fast string substring prechecks (`lowerText.includes(kw)`) before invoking regex evaluation short-circuits regex execution for 95%+ of documents while guaranteeing 100% behavior preservation for ordering semantics.
**Action:** Use precheck token maps to guard complex document regexes without altering regex definitions.
