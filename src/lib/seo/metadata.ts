import type { Metadata } from 'next';

export const SEO_ORIGIN = 'https://isaudi.ai';
export const BRAND_ICON_PATH = '/brand/isaudi-mark-v3.png';
export const BRAND_APPLE_ICON_PATH = '/brand/isaudi-apple-touch-v3.png';
export const SOCIAL_IMAGE_PATH = '/brand/isaudi-social-v3.png';
export const BRAND_ICON_URL = `${SEO_ORIGIN}${BRAND_ICON_PATH}`;
export const BRAND_APPLE_ICON_URL = `${SEO_ORIGIN}${BRAND_APPLE_ICON_PATH}`;
export const SOCIAL_IMAGE_URL = `${SEO_ORIGIN}${SOCIAL_IMAGE_PATH}`;
export const MANIFEST_URL = `${SEO_ORIGIN}/manifest.webmanifest`;

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
      images: [
        {
          url: SOCIAL_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: 'isaudi.ai',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [SOCIAL_IMAGE_URL],
    },
  };
}

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};