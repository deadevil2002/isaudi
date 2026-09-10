import assert from 'node:assert/strict';
import test from 'node:test';
import sitemap, { SITEMAP_PATHS } from '../src/app/sitemap';
import {
  createPageMetadata,
  noIndexMetadata,
  SEO_ORIGIN,
} from '../src/lib/seo/metadata';

test('page metadata keeps query variants canonicalized to the clean path', () => {
  const metadata = createPageMetadata({
    title: 'Pricing',
    description: 'Pricing description',
    path: '/pricing',
  });

  assert.equal(metadata.alternates?.canonical, `${SEO_ORIGIN}/pricing`);
  assert.equal(metadata.openGraph?.url, `${SEO_ORIGIN}/pricing`);
  assert.deepEqual(metadata.robots, { index: true, follow: true });
});

test('utility metadata is noindex, follow', () => {
  assert.deepEqual(noIndexMetadata.robots, {
    index: false,
    follow: true,
  });
});

test('sitemap contains only the approved canonical public URLs', () => {
  const urls = sitemap().map((entry) => entry.url);

  assert.deepEqual(SITEMAP_PATHS, [
    '/',
    '/how-it-works',
    '/pricing',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/usage',
  ]);
  assert.deepEqual(urls, [
    `${SEO_ORIGIN}/`,
    `${SEO_ORIGIN}/how-it-works`,
    `${SEO_ORIGIN}/pricing`,
    `${SEO_ORIGIN}/about`,
    `${SEO_ORIGIN}/contact`,
    `${SEO_ORIGIN}/privacy`,
    `${SEO_ORIGIN}/terms`,
    `${SEO_ORIGIN}/usage`,
  ]);
  assert.equal(urls.some((url) => url.startsWith('http://')), false);
  assert.equal(urls.some((url) => url.includes('www.')), false);
});