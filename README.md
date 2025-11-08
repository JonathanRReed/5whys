# Career Tools Studio

A modern collection of reflection, résumé, and networking practice tools built with Astro, React, Tailwind CSS, and Bun. The experience is designed around the Rosé Pine palette to keep every session calm, intentional, and focused on your next professional chapter.

## ✨ Features

- **Career Reflection · 5 Whys**: Journal through layered prompts to uncover the motivations behind your next move and save snapshots for future review.
- **Resume Momentum Game**: Rewrite résumé bullets with guidance on action, impact, and clarity while tracking improvements over time.
- **Networking Practice Studio**: Cycle through guided scenarios, rehearse introductions with a built-in timer, and capture reflections after each rep.

## 🧰 Tech Stack

- Astro 5 with hybrid Astro + React pages
- React 19 for interactive flows
- Tailwind CSS for styling and utility composition
- Bun as the package manager and runtime

## 🚀 Getting Started

1. **Install dependencies**

   ```sh
   bun install
   ```

2. **Start the dev server**

   ```sh
   bun dev
   ```

   The site runs at `http://localhost:4321` by default.

## 🛠️ Available Scripts

All commands run from the project root:

| Command         | Description                                   |
| :-------------- | :-------------------------------------------- |
| `bun dev`       | Start the local development server            |
| `bun build`     | Produce a production build in `./dist/`       |
| `bun preview`   | Preview the production build locally          |
| `bun astro ...` | Run Astro CLI commands (e.g., `astro check`)  |

## 📂 Project Structure

```text
/
├── public/
│   ├── data/
│   │   └── skills.json
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── Career5Whys.tsx
│   │   └── NetworkingPractice.tsx
│   ├── data/
│   │   ├── networking-scenarios.json
│   │   └── skills.json
│   ├── layouts/
│   │   └── Base.astro
│   └── pages/
│       ├── career.astro
│       ├── index.astro
│       ├── networking-practice.astro
│       └── resume-game.astro
├── astro.config.mjs
├── bun.lock
├── package.json
├── postcss.config.cjs
├── tailwind.config.cjs
└── tsconfig.json
```

## 🧾 Data & Content

- `src/data` contains curated JSON for job skills and networking scenarios.
- `public/data/skills.json` mirrors the skills dataset for static access.

## 🤝 Contributing

Issues and pull requests are welcome. Please open an issue describing your idea or bug before submitting significant changes.

## 📄 License

Icons by [Creatype](https://www.flaticon.com/authors/creatype).
This project is released under the MIT License.
