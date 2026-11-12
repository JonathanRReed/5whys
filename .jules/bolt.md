## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-06-22 - Static Text Scan Memoization in Signal Reports

**Learning:** During real-time bullet editing, `buildDeepSignalReport` is invoked on every single keystroke. Re-running full-text static scans (`computeKeywordDensity`, `detectAtsKeywords`, `extractSkills`, `analyzeResumeLength`) on the constant full `resumeText` caused significant CPU lag (~1,650 ms per 1,000 keystrokes).
**Action:** Memoize text-level analysis results on unchanged full strings using a LRU-bounded map while shallow-cloning returned arrays/objects to maintain caller isolation. This achieved a ~94% CPU processing time reduction (~92 ms per 1,000 keystrokes).
