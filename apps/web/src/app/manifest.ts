import type { MetadataRoute } from "next";
import { BACKGROUND_COLOR, THEME_COLOR } from "@/lib/pwa/colors";
import { SHORTCUT_TARGETS, shortcutUrl } from "@/lib/pwa/shortcuts";

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
    shortcuts: SHORTCUT_TARGETS.map((target) => ({
      name: target.name,
      short_name: target.shortName,
      description: target.description,
      url: shortcutUrl(target.id),
      icons: [{ src: "/pwa-icon/192", sizes: "192x192", type: "image/png" }],
    })),
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
