/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
  ],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222.2 84% 4.9%)",
        card: "hsl(0 0% 100%)",
        "card-foreground": "hsl(222.2 84% 4.9%)",
        popover: "hsl(0 0% 100%)",
        "popover-foreground": "hsl(222.2 84% 4.9%)",
        primary: { DEFAULT: "hsl(222.2 47.4% 11.2%)", foreground: "hsl(210 40% 98%)" },
        secondary: { DEFAULT: "hsl(210 40% 96.1%)", foreground: "hsl(222.2 47.4% 11.2%)" },
        muted: { DEFAULT: "hsl(210 40% 96.1%)", foreground: "hsl(215.4 16.3% 46.9%)" },
        accent: { DEFAULT: "hsl(210 40% 96.1%)", foreground: "hsl(222.2 47.4% 11.2%)" },
        destructive: { DEFAULT: "hsl(0 84.2% 60.2%)", foreground: "hsl(210 40% 98%)" },
        border: "hsl(214.3 31.8% 91.4%)",
        input: "hsl(214.3 31.8% 91.4%)",
        ring: "hsl(222.2 84% 4.9%)",
      },
      borderRadius: { lg: "0.5rem", md: "calc(0.5rem - 2px)", sm: "calc(0.5rem - 4px)" },
      keyframes: {
        "accordion-down": { from: { height: 0 }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: 0 } },
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-up": { from: { transform: "translateY(20px)", opacity: 0 }, to: { transform: "translateY(0)", opacity: 1 } },
      },
      animation: { 
        "accordion-down": "accordion-down 0.2s ease-out", 
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.6s ease-out",
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [require("tailwindcss-animate")],
};