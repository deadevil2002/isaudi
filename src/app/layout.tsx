import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/providers/language-provider";
import { cookies } from "next/headers";
import { t } from "@/lib/i18n/translations";
import {
  BRAND_APPLE_ICON_URL,
  BRAND_ICON_URL,
  MANIFEST_URL,
  SEO_ORIGIN,
  SOCIAL_IMAGE_URL,
} from "@/lib/seo/metadata";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
});

export const metadata: Metadata = {
  metadataBase: new URL(SEO_ORIGIN),
  title: t("ar", "meta.title"),
  description: t("ar", "meta.description"),
  openGraph: {
    title: t("ar", "meta.title"),
    description: t("ar", "meta.description"),
    siteName: "isaudi.ai",
    locale: "ar_SA",
    type: "website",
    url: SEO_ORIGIN,
    images: [
      {
        url: SOCIAL_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "isaudi.ai",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: t("ar", "meta.title"),
    description: t("ar", "meta.description"),
    images: [SOCIAL_IMAGE_URL],
  },
  icons: {
    icon: [{ url: BRAND_ICON_URL, type: "image/png", sizes: "512x512" }],
    shortcut: BRAND_ICON_URL,
    apple: [{ url: BRAND_APPLE_ICON_URL, type: "image/png", sizes: "180x180" }],
  },
  manifest: MANIFEST_URL,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("lang")?.value === "en" ? "en" : "ar";
  const dir = langCookie === "en" ? "ltr" : "rtl";

  return (
    <html lang={langCookie} dir={dir}>
      <body
        className={`${ibmPlexSansArabic.variable} antialiased font-sans bg-white`}
      >
        <LanguageProvider initialLang={langCookie}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
