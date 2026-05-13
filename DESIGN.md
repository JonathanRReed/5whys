# 5 Whys Career Studio — Design System

## Theme

Dual-theme: **Night** (default) and **Dawn** (light)

Physical scene: A person sitting at a desk in a quiet room, reviewing career materials on a laptop. The ambient light is low. The interface should feel like a calm, focused workspace — not a dashboard, not a nightclub.

## Color Strategy

### Night (Default)
- **Background**: 230 18% 8% — deep navy-black, not pure black
- **Foreground**: 228 36% 94% — warm white, not pure white
- **Primary**: 188 58% 58% — cyan/teal (foam)
- **Accent**: 260 64% 74% — soft purple (iris)
- **Muted**: 228 10% 43% — mid-gray for secondary text
- **Border**: 226 17% 26% — subtle separation
- **Destructive/Love**: 350 78% 66% — rose red
- **Gold**: 45 86% 64% — warm amber for highlights

### Dawn (Light)
- **Background**: 220 32% 97% — warm off-white
- **Foreground**: 232 24% 22% — dark slate
- **Primary**: 192 55% 34% — deep teal
- **Accent**: 259 35% 48% — muted purple
- **Muted**: 228 10% 61% — medium gray
- **Border**: 222 24% 84% — light separation

### Rules
- Never use #000 or #fff
- Tint all neutrals toward the brand hue (cyan/teal family)
- Reduce chroma as lightness approaches 0 or 100
- OKLCH for all new color work

## Typography

- **Stack**: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- **Scale**: Tight ratio (1.125–1.2 between steps)
- **Body line length**: max 70ch
- **Hierarchy**: Scale + weight contrast, not color
- **Labels/eyebrows**: uppercase, tracking-[0.28em], text-xs, font-semibold

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
