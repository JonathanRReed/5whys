# 5 Whys Career Studio — Design System

## Theme

Dual-theme: **Night** (default) and **Dawn** (light)

Physical scene: A person sitting at a desk in a quiet room, reviewing career materials on a laptop. The ambient light is low. The interface should feel like a calm, focused workspace — not a dashboard, not a nightclub.

## Color Strategy

Palette: **Evergreen & Brass**. A deep pine green carries primary actions and
the brand; warm brass is the secondary accent. Neutrals are tinted warm and
green, never blue. Tool accents fan out across green, brass, terracotta, and a
muted plum so the four tools stay distinguishable without a rainbow.

The source of truth is `src/styles/globals.css`. These same values are mirrored
in `public/career-tools-theme.js` (an inline anti-FOUC script that applies the
palette before the stylesheet loads). Keep the two in sync.

### Night (Default)
- **Background**: 150 9% 7% — warm green-charcoal, not pure black
- **Foreground**: 75 11% 91% — warm ivory, not pure white
- **Primary (foam)**: 150 44% 42% — evergreen
- **Accent / Gold**: 40 54% 56% — warm brass
- **Love**: 14 56% 57% — terracotta
- **Iris**: 286 24% 65% — muted plum
- **Muted-foreground**: 100 8% 72% — readable secondary text
- **Border**: 150 7% 22% — subtle separation

### Dawn (Light)
- **Background**: 48 30% 95% — warm ivory paper
- **Foreground**: 150 14% 15% — deep warm ink
- **Primary (foam)**: 150 50% 26% — deep pine
- **Accent / Gold**: 36 64% 36% / 36 66% 38% — bronze
- **Love**: 14 56% 41% — deep terracotta
- **Iris**: 286 30% 42% — deep plum
- **Border**: 48 20% 80% — light separation

### Rules
- Never use #000 or #fff
- No blue. Tint neutrals warm, toward the green/earth family
- Reduce chroma as lightness approaches 0 or 100
- Elevation comes from hairline borders, not heavy shadows

## Typography

Self-hosted via `@fontsource-variable/*` (no CDN, on-brand for privacy-first).

- **Display (headings)**: Fraunces Variable. A warm editorial serif, the voice of
  the field guide. Optical sizing on (`font-optical-sizing: auto`), gentle tracking
  (`-0.01em`). Applied to all headings globally. Use the `.display-italic` utility
  (Fraunces italic with opsz/SOFT/WONK axes) to emphasize one word in a heading.
- **Body / UI**: Inter Variable
- **Mono (labels, indices, data)**: JetBrains Mono Variable
- **Scale**: confident jumps for display; tight ratio for body
- **Body line length**: max ~70ch
- **Hierarchy**: typeface + scale + weight, not color
- **Labels/eyebrows**: the `.eyebrow` utility — mono, uppercase,
  tracking-[0.24em], 0.72rem. Use `.num-index` for the 01–05 numbering motif.

## Components

### Cards
- Border: 1px, hsl(var(--border)/0.35)
- Background: hsl(var(--overlay)/0.25)
- Border-radius: rounded-3xl (1.5rem)
- No heavy shadows — use subtle border-color shifts for elevation
- No nested cards

### Buttons
- Primary: bg-[hsl(var(--primary))], rounded-full, px-5 py-2.5
- Ghost: transparent bg, hover:bg-[hsl(var(--overlay)/0.3)]
- Outline: border only, subtle hover

### Inputs
- Border: hsl(var(--border)/0.5)
- Focus: ring-[hsl(var(--foam)/0.3)]
- Font-size: 16px minimum (prevent zoom on mobile)

## Layout

- Max content width: max-w-6xl (72rem)
- Section padding: generous vertical spacing (space-y-10, py-16)
- Container padding: px-4 on mobile, consistent
- No arbitrary container centers that create visual drift

## Motion

- Transition duration: 150–300ms
- Easing: ease-out with exponential curves
- No layout property animations (no width/height/top/left)
- Respect prefers-reduced-motion
- Motion conveys state only: hover feedback, focus rings, loading skeletons

## Absolute Bans

- Side-stripe borders (colored left/right borders on cards)
- Gradient text (background-clip: text)
- Glassmorphism as default
- Hero-metric template (big number + small label)
- Identical card grids without variation
- Modal as first thought
- Em dashes in copy
