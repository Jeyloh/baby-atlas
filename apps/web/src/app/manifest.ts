import type { MetadataRoute } from "next";
import { BACKGROUND_COLOR, THEME_COLOR } from "@/lib/pwa/colors";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baby Atlas",
    short_name: "Baby Atlas",
    description: "Baby- og småbarnslogg for deg som er forelder i Norge.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    lang: "nb",
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
