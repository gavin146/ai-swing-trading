import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#071418",
        surface: "#f5f7fb",
        panel: "#ffffff",
        line: "#d8e0ea",
        pine: "#0b3d3f",
        mint: "#dbf7e8",
        sky: "#e6f0ff",
        lime: "#b7f34b",
        amber: "#f8c45d",
        coral: "#ff7a70",
        steel: "#65758b",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(7, 20, 24, 0.09)",
        lift: "0 26px 70px rgba(7, 20, 24, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
