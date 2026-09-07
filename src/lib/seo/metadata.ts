import type { Metadata } from 'next';

export const SEO_ORIGIN = 'https://isaudi.ai';

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}

export function createPageMetadata({
  title,
  description,
  path,
  index = true,
}: PageMetadataOptions): Metadata {
  const absoluteUrl = new URL(path, SEO_ORIGIN).toString();

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl,
    },
    robots: {
      index,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl,
      siteName: 'isaudi.ai',
      locale: 'ar_SA',
      type: 'website',
    },
  };
}

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};