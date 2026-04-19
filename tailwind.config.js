/** @type {import("tailwindcss").Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        "ll-bg": "var(--ll-bg)",
        "ll-surface": "var(--ll-surface)",
        "ll-surface-muted": "var(--ll-surface-muted)",
        "ll-border": "var(--ll-border)",
        "ll-border-strong": "var(--ll-border-strong)",
        "ll-text": "var(--ll-text)",
        "ll-text-muted": "var(--ll-text-muted)",
        "ll-text-faint": "var(--ll-text-faint)",
        "ll-accent": "var(--ll-accent)",
        "ll-accent-soft": "var(--ll-accent-soft)",
        "ll-warning": "var(--ll-warning)",
        "ll-danger": "var(--ll-danger)",
      },
      borderRadius: {
        "ll-card": "var(--ll-radius-card)",
        "ll-control": "var(--ll-radius-control)",
      },
    },
  },
  plugins: [],
};
