## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-06-22 - Unbounded Regex Lookaheads in Document Parsers

**Learning:** Regexes with unbounded multi-line matchers or lookaheads (`[\s\S]*`) cause catastrophic backtracking and excessive scanning on document inputs. Combining fast string substring checks (`includes()`) before regex execution eliminates evaluation for non-matching documents.
**Action:** Replace `[\s\S]*` lookaheads with discrete boolean string checks (`lowerText.includes(kw)`) and short-circuit evaluation.
