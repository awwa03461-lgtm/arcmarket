import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        usdc: "#2775CA",
        yes: "#16c784",
        no: "#ea3943",
      },
    },
  },
  plugins: [],
};
export default config;
