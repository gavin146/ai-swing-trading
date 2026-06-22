import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12211f",
        surface: "#f6f7f4",
        panel: "#ffffff",
        line: "#dce3dd",
        pine: "#183f36",
        mint: "#d8f4e4",
        sky: "#dcefff",
        amber: "#ffcf70",
        coral: "#f28b82",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(18, 33, 31, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
