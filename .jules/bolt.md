## 2025-06-21 - Premature React Micro-Optimizations

**Learning:** Wrapping basic array methods (e.g., `find`, `reduce`, `filter`) on small arrays (like 5 resume bullets) in `React.useMemo` is an anti-pattern. The memory overhead and dependency checking cost outweigh any CPU savings, leading to a rejected optimization.
**Action:** Focus on reducing algorithmic complexity or hoisting heavy computations (like RegExp creation) out of render loops and loops entirely, rather than defaulting to `React.useMemo` for trivial calculations.

## 2025-06-22 - Fast-Path Pre-Checks for String Sanitization

**Learning:** Multi-stage string replacement functions (like `escapeHtml`) execute all regular expression passes even when the string contains no special characters. Adding a quick character presence test (`/[&<>"']/`) allows plain text tokens to bypass all replacement passes, reducing string escaping CPU time by >50% during token parsing and real-time highlighting.
**Action:** Always check if input strings can take a fast-path bypass before running multiple sequential `.replace()` calls in string processing utilities.
