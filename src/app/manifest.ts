import type { MetadataRoute } from "next";
import {
  BRAND_APPLE_ICON_PATH,
  BRAND_ICON_PATH,
} from "@/lib/seo/metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "isaudi.ai",
    short_name: "isaudi.ai",
    description: "تحليلات واضحة للمبيعات والتكاليف والربحية للمتاجر السعودية",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#006C35",
    lang: "ar",
    dir: "rtl",
    icons: [
      {
        src: BRAND_ICON_PATH,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: BRAND_APPLE_ICON_PATH,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}