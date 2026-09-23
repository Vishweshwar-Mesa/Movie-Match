import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#161221",
        paper: "#fbf8f3",
        ember: "#ff5d5d",
        ember2: "#ff8a5c",
        glow: "#ffd166",
        ok: "#2fbf71",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 20px 45px -15px rgba(22, 18, 33, 0.35)",
      },
      keyframes: {
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "60%": { opacity: "1", transform: "scale(1.04)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "float-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "float-up": "float-up 0.4s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
