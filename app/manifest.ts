import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sipfluence Partners",
    short_name: "Sipfluence",
    description: "Your Sipfluence affiliate dashboard — links, codes, earnings, and payouts.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF7F1",
    theme_color: "#FF5C9E",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
