import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Academic Pathways Advisor",
    short_name: "Recruit",
    description:
      "Catalog-aware degree pathways aligned to the job market, validated by human advisors.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0058cc",
    icons: [
      { src: "/icon-256.png", sizes: "256x256", type: "image/png" },
      { src: "/icon-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
  };
}
