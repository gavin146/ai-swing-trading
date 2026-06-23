import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SwingFi",
    short_name: "SwingFi",
    description: "AI-ranked swing trade opportunities, every morning.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#0b3d3f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
