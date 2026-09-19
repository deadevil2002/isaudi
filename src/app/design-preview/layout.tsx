import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "iSaudi.ai — Design Preview",
  description: "The isolated iSaudi.ai visual design preview.",
  icons: {
    icon: "/brand/design-preview-logo.png",
    shortcut: "/brand/design-preview-logo.png",
    apple: "/brand/design-preview-logo.png",
  },
  openGraph: {
    title: "iSaudi.ai — Design Preview",
    description: "The isolated iSaudi.ai visual design preview.",
    images: ["/brand/design-preview-logo.png"],
  },
};

export default function DesignPreviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}