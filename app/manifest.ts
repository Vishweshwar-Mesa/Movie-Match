import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Movie Match",
    short_name: "Movie Match",
    description: "Two people, one pick. Swipe your way to tonight's movie or show.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12101c",
    theme_color: "#161221",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
