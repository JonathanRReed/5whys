# 5 Whys Career Studio — Megaplan Design Spec

**Date:** 2025-05-12  
**Scope:** Full-site cleanup, frontend/backend improvement, and premium UX overhaul.  
**Approach:** Hybrid Edge-Enhanced (static Astro + Cloudflare Workers for newsletter, analytics, optional AI).  
**Contact form backend is OUT OF SCOPE** per user direction.

---

## 1. Goals

1. Transform the 4 interactive tools into premium, app-like experiences.
2. Establish a production-quality development pipeline (tests, lint, typecheck, CI).
3. Add a lightweight Cloudflare edge backend for audience capture and privacy-first analytics.
4. Launch a content flywheel (blog/resources) for SEO authority.
5. Achieve Lighthouse scores > 95 across all categories.

---

## 2. Architecture

### 2.1 Frontend
- **Framework:** Astro 5.x (static output), React 19 islands.
- **Styling:** Tailwind CSS 3.x + custom CSS variables for the dual-theme system.
- **Components:** shadcn/ui base + custom premium components.
- **State:** localStorage for tool data (privacy-first, no sign-up).
- **Animations:** CSS transitions + keyframes (no heavy animation library).

### 2.2 Backend (Cloudflare Workers)
- **Endpoints:**
  - `POST /newsletter` — email waitlist signup (KV storage).
  - `POST /analytics` — privacy-first pageview (no cookies, no IP, D1/KV).
  - `POST /enhance` — optional AI resume bullet enhancer (Workers AI Llama).
- **Storage:** KV for newsletter; D1 for analytics aggregates.
- **Security:** CORS restricted to 5whys.jonathanrreed.com + localhost; rate limiting via CF WAF.

### 2.3 Build & Deploy
- **Package Manager:** Bun.
- **Testing:** Vitest (unit) + Playwright (e2e for critical tool flows).
- **Linting:** ESLint + Prettier.
- **Typecheck:** `tsc --noEmit`.
- **CI/CD:** GitHub Actions — build, lint, typecheck, test on PR; Lighthouse CI on push to main.
- **Deploy:** Astro static build → Cloudflare Pages.

---

## 3. Phase Breakdown

### Phase 1 — Infrastructure & Quality

| Task | Detail |
|------|--------|
| Add scripts | `bun test`, `bun run lint`, `bun run typecheck`, `bun run format` |
| Add Vitest | Config for React + TypeScript testing |
| Add ESLint + Prettier | Extend Astro + React configs |
| Add GitHub Actions CI | `.github/workflows/ci.yml` — build, lint, typecheck, test |
| Add Lighthouse CI | `.github/workflows/lighthouse.yml` — fail if < 95 |
| Refactor components | Split oversized files (Career5Whys 897 → ~5 files, ResumeGame 636 → ~4 files, NetworkingPractice 919 → ~5 files, InterviewGlowUpWorkspace 1263 → ~6 files) |
| Add Error Boundaries | Wrap each interactive tool in a React Error Boundary with graceful fallback UI |
| Add loading skeletons | Skeleton components for all async/data-heavy UI sections |

### Phase 2 — Tool UX Overhaul

#### Resume Game
- **Shareable score cards:** Export a beautifully styled image (html-to-image) of the score summary for social sharing.
- **Before/after comparison:** Split-pane view comparing original vs improved bullet.
- **Power verb suggestions:** Inline chip suggestions when a weak verb is detected.
- **Empty state:** Illustration + quick-start prompt when no text is entered.
- **Progress ring:** Animated ring showing visible-value score.

#### Career 5 Whys
- **Progress visualization:** Stepper with animated progress bar.
- **Insight summary cards:** Auto-generated cards from completed answers (theme, alignment, core value).
- **History browser:** Better list with search/filter, date grouping.
- **Export:** Beautiful PDF export via `html2pdf.js` or similar.
- **Celebration micro-interaction:** Subtle confetti/checkmark on completion.

#### Networking Practice
- **Audio recording:** Web Audio API for optional voice rehearsal (stored locally as blob URLs, not uploaded).
- **Timer UX overhaul:** Larger, more prominent timer with animated ring.
- **Post-practice dashboard:** Insight cards showing rating trends, best attempts, growth areas.
- **Empty states:** Guidance when no scenarios selected.

#### Interview Glow Up
- **Replace emojis with SVG icons:** All tab icons, HUD icons → custom SVG set.
- **Role comparison:** Side-by-side comparison of two decoded JDs (skill overlap, gaps).
- **Skill gap visualization:** Radar chart or bar chart showing required vs possessed skills.
- **Packet share links:** Generate a shareable hash-based link for a packet (data encoded in URL hash, no server storage).
- **Empty states:** Guided onboarding for first-time users.

### Phase 3 — Cloudflare Edge Backend

| Endpoint | Method | Purpose | Storage |
|----------|--------|---------|---------|
| `/newsletter` | POST | Email waitlist signup | KV |
| `/analytics` | POST | Privacy-first pageview event | D1 |
| `/enhance` | POST | AI resume bullet rewrite (opt-in) | Stateless |

**Privacy policy for analytics:**
- No cookies.
- No IP addresses stored.
- Only: pathname, referrer (domain only), timestamp, user-agent (browser family only), screen size bucket.
- Aggregated daily; no individual session tracking.

### Phase 4 — Design Polish & Content

#### Blog / Resources
- **Astro Content Collections** for blog posts and resource guides.
- **Categories:** Career reflection, Resume tips, Interview prep, Networking, AI & career.
- **SEO:** Each post gets full Schema.org Article markup.

#### OG Images
- **Dynamic OG:** Astro endpoint that generates Open Graph images per page using Satori or similar.
- **Static fallback:** Keep existing `/og-default.png`.

#### Page Transitions
- **Astro View Transitions** (`ClientRouter`) already in use; enhance with custom transition styles.
- **Subtle fade + slide** for tool pages.

#### Mobile UX
- **Touch targets:** Minimum 44x44px across all tools.
- **Input zoom prevention:** Proper viewport meta + font-size 16px on inputs.
- **Bottom sheet modals:** For mobile interactions instead of center modals where appropriate.

#### 404 Page
- Custom branded 404 with links back to tools and a search-like experience.

### Phase 5 — SEO & Shareability

| Task | Detail |
|------|--------|
| FAQ schema | Add `FAQPage` structured data to all 4 tool pages |
| Social share | "Copy link" + native share API for tool outputs |
| Interview packet links | Hash-encoded shareable packet URLs |
| Sitemap | Enhance `sitemap.xml.ts` with priority + changefreq per page type |
| Robots.txt | Add crawl-delay, disallow patterns for tool data endpoints |
| Breadcrumbs | Ensure all pages have valid breadcrumb schema |

---

## 4. Design System Updates (impeccable-aligned)

### Color Strategy: Committed
- Keep the existing dual-theme (night/dawn) but refine OKLCH usage.
- Tint all neutrals toward the brand hue (cyan/teal family).
- Ensure no `#000` or `#fff` anywhere.

### Typography
- Maintain current Inter/system stack.
- Cap body line length at 70ch.
- Hierarchy via scale + weight (≥1.25 ratio).

### Motion
- Ease-out with exponential curves.
- No layout property animations (no animating width/height/top/left).
- Respect `prefers-reduced-motion`.

### Bans (impeccable absolute bans)
- No side-stripe borders.
- No gradient text.
- No glassmorphism as default.
- No hero-metric template (big number + small label cliché).
- No identical card grids (vary card sizes or use asymmetric layouts).
- No modal as first thought (exhaust inline alternatives).

---

## 5. Component Architecture

### New Directory Structure

```
src/
  components/
    ui/              # shadcn/ui base components
    shared/          # Reusable across tools (ErrorBoundary, Skeleton, EmptyState, ShareCard)
    resume-game/     # Split from ResumeGame.tsx
    career-5whys/    # Split from Career5Whys.tsx
    networking/      # Split from NetworkingPractice.tsx
    interview-glowup/# Split from InterviewGlowUpWorkspace.tsx
    blog/            # Blog-specific components
  lib/
    analytics.ts     # Privacy-first analytics client
    newsletter.ts    # Newsletter signup client
    api.ts           # Cloudflare API client
  pages/
    blog/
      index.astro
      [slug].astro
  content/
    blog/            # Astro content collections
  styles/
    globals.css      # Keep existing, add new utilities
```

---

## 6. Data Flow

### Tool Data (localStorage)
```
User Input → React State → localStorage → (Export JSON / PDF / Image)
```

### Analytics (Cloudflare)
```
Page Load → analytics.ts → POST /analytics (no cookies, aggregated)
```

### Newsletter (Cloudflare)
```
Email Input → newsletter.ts → POST /newsletter → KV Storage
```

### AI Enhancer (Cloudflare Workers AI)
```
Bullet Text → POST /enhance → Workers AI (Llama) → Improved Bullet
```

---

## 7. Error Handling

| Layer | Strategy |
|-------|----------|
| React components | Error Boundaries with fallback UI + retry button |
| localStorage | Graceful degradation (tools work without persistence) |
| API calls | Retry once with exponential backoff; show toast on failure |
| AI enhancement | Timeout at 10s; fallback to heuristic suggestions |

---

## 8. Testing Strategy

| Type | Scope | Tool |
|------|-------|------|
| Unit | Utility functions (scoring, storage, export) | Vitest |
| Component | UI components in isolation | Vitest + React Testing Library |
| E2E | Critical tool flows (complete 5 Whys, analyze resume, full networking rep) | Playwright |
| Visual | Lighthouse perf/a11y/best-practices | Lighthouse CI |

---

## 9. Dependencies to Add

| Package | Purpose |
|---------|---------|
| `vitest` | Testing framework |
| `@testing-library/react` | React component testing |
| `@testing-library/jest-dom` | DOM assertions |
| `playwright` | E2E testing |
| `eslint` + `prettier` | Linting/formatting |
| `@astrojs/check` | Astro type checking |
| `html-to-image` | Shareable score cards |
| `html2pdf.js` | PDF export for 5 Whys |
| `satori` | OG image generation |
| `@resvg/resvg-js` | SVG rendering for OG images |

**No backend dependencies** — the Cloudflare backend is standalone Workers code (separate repo or `functions/` directory).

---

## 10. Success Criteria

- [ ] `bun run lint && bun run typecheck && bun test` passes.
- [ ] CI green on PR.
- [ ] Lighthouse > 95 on all pages.
- [ ] All 4 tools have shareable outputs.
- [ ] No component file > 300 lines.
- [ ] 404 page exists and is branded.
- [ ] Blog has at least 3 seed posts.
- [ ] All emoji icons replaced with SVG.
- [ ] Analytics endpoint receives events without cookies.
- [ ] Newsletter endpoint stores emails.

---

## 11. Out of Scope

- Contact form backend (user explicitly excluded).
- User accounts / auth / cloud sync.
- Paid features or SaaS billing.
- Real-time collaboration.
- Mobile native apps.
