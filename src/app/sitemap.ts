import type { MetadataRoute } from 'next';
import { SEO_ORIGIN } from '@/lib/seo/metadata';

export const SITEMAP_PATHS = [
  '/',
  '/pricing',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/usage',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_PATHS.map((path) => ({
    url: new URL(path, SEO_ORIGIN).toString(),
  }));
}