import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        usdc: "#4d8dff",
        yes: "#2dd4a7",
        no: "#f25e7a",
        amber: "#f5b14c",
        ink: "#eef2fb",
        "ink-dim": "#8b96b5",
      },
    },
  },
  plugins: [],
};
export default config;
