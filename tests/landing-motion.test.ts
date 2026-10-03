import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('landing motion is presentation-only and creates no network or AI work', () => {
  const files = [
    'src/components/sections/hero.tsx',
    'src/components/sections/how-it-works.tsx',
    'src/components/sections/sample-report.tsx',
    'src/components/sections/pricing.tsx',
    'src/components/sections/trust.tsx',
  ].map(read).join('\n');
  assert.doesNotMatch(files, /fetch\(|OPENAI_API_KEY|\/api\/analysis|setInterval\(|Math\.random\(|Date\.now\(/);
  assert.match(read('src/app/page.tsx'), /landing-motion-root/);
});

test('hero has deterministic choreography, a real product showcase, and a real CTA path', () => {
  const hero = read('src/components/sections/hero.tsx');
  assert.match(hero, /landingStagger/);
  assert.match(hero, /landing-showcase-stage/);
  assert.match(hero, /landing-showcase-pointer/);
  assert.match(hero, /landing-product-light/);
  assert.match(hero, /motion\.path/);
  assert.match(hero, /href="\/login"/);
  assert.match(hero, /useLandingReducedMotion/);
  assert.match(hero, /requestAnimationFrame/);
  assert.match(hero, /passive: true/);
  assert.match(hero, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(hero, /normalizedX \* 14/);
  assert.match(hero, /normalizedY \* 10/);
  assert.match(hero, /const damping = 0\.13/);
  assert.match(hero, /pointerleave/);
  assert.doesNotMatch(hero, /useScroll/);
  assert.match(read('src/lib/animations.ts'), /useSyncExternalStore/);
});

test('scroll motion and mobile navigation preserve reduced-motion and logical RTL behavior', () => {
  const styles = read('src/app/globals.css');
  const header = read('src/components/layout/header.tsx');
  const revealedSections = [
    header,
    read('src/components/sections/hero.tsx'),
    read('src/components/sections/how-it-works.tsx'),
    read('src/components/sections/sample-report.tsx'),
    read('src/components/sections/trust.tsx'),
  ].join('\n');
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /landing-drawer-rtl[\s\S]*--drawer-start: 100%/);
  assert.match(styles, /landing-drawer-ltr[\s\S]*--drawer-start: -100%/);
  assert.match(header, /data-landing-drawer/);
  assert.match(header, /lang === "ar"/);
  assert.doesNotMatch(revealedSections, /initial=\{reduceMotion \? false/);
  assert.doesNotMatch(revealedSections, /variants=\{reduceMotion \? undefined/);
});

test('continuous motion stays inside the ambient and product-showcase budget', () => {
  const styles = read('src/app/globals.css');
  const infiniteAnimations = [...styles.matchAll(/animation:\s*([^;]*infinite[^;]*);/g)].map((match) => match[1]);
  assert.equal(infiniteAnimations.length, 10);
  assert.ok(infiniteAnimations.every((value) => /landing-(orbit-drift|showcase-cycle|product-light-cycle|sheen|live-pulse|kpi-cycle|chart-scan-cycle|insight-cycle|insight-line-cycle|float-metric-cycle)/.test(value)));
  assert.match(styles, /landing-showcase-cycle 12s/);
  assert.match(styles, /--landing-float-lift: 8px/);
  assert.doesNotMatch(styles, /transition:\s*(?:width|height|top|left)/);
  for (const name of ['showcase-cycle', 'product-light-cycle', 'kpi-cycle', 'chart-scan-cycle', 'insight-cycle', 'insight-line-cycle', 'float-metric-cycle']) {
    const block = styles.match(new RegExp(`@keyframes landing-${name} \\{([\\s\\S]*?)\\n\\}`));
    assert.ok(block, `missing landing-${name}`);
    assert.doesNotMatch(block[1], /box-shadow|filter:|(?:^|[;{])\s*(?:width|height|top|left)\s*:/);
  }
});

test('macro section reveals use depth and clipping with a fully visible reduced-motion state', () => {
  const animations = read('src/lib/animations.ts');
  const sections = [
    read('src/components/sections/how-it-works.tsx'),
    read('src/components/sections/sample-report.tsx'),
    read('src/components/sections/pricing.tsx'),
  ].join('\n');
  assert.match(animations, /landingSectionReveal/);
  assert.match(animations, /rotateX: 3/);
  assert.match(animations, /clipPath: "inset\(8% 0 12% 0 round 2rem\)"/);
  assert.match(animations, /landingSectionRevealReduced[\s\S]*opacity: 1[\s\S]*duration: 0/);
  assert.match(sections, /landingSectionReveal/);
});

test('sample recommendation remains a functional link rather than a fake button', () => {
  const sample = read('src/components/sections/sample-report.tsx');
  assert.match(sample, /<Button asChild[\s\S]*<Link href="\/login"/);
});
