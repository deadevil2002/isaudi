import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/providers/language-provider";
import { cookies } from "next/headers";
import { t } from "@/lib/i18n/translations";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
});

export const metadata: Metadata = {
  title: t("ar", "meta.title"),
  description: t("ar", "meta.description"),
  openGraph: {
    title: t("ar", "meta.title"),
    description: t("ar", "meta.description"),
    url: "https://isaudi.ai",
    siteName: "isaudi.ai",
    locale: "ar_SA",
    type: "website",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
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
