import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import manifest from "../src/app/manifest";
import {
  BRAND_APPLE_ICON_URL,
  BRAND_ICON_URL,
  createPageMetadata,
  MANIFEST_URL,
  SEO_ORIGIN,
  SOCIAL_IMAGE_URL,
} from "../src/lib/seo/metadata";

function readPngDimensions(relativePath: string) {
  const file = readFileSync(new URL(relativePath, import.meta.url));
  assert.deepEqual(Array.from(file.subarray(1, 4)), [0x50, 0x4e, 0x47]);
  return {
    file,
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}

test("versioned iSaudi branding assets have the required formats and dimensions", () => {
  const icon = readPngDimensions("../public/brand/isaudi-mark-v1.png");
  const apple = readPngDimensions("../public/brand/isaudi-apple-touch-v1.png");
  const social = readPngDimensions("../public/brand/isaudi-social-v1.png");
  const favicon = readFileSync(new URL("../src/app/favicon.ico", import.meta.url));

  assert.deepEqual([icon.width, icon.height], [512, 512]);
  assert.deepEqual([apple.width, apple.height], [180, 180]);
  assert.deepEqual([social.width, social.height], [1200, 630]);
  assert.notEqual(
    createHash("sha256").update(favicon).digest("hex"),
    "2b8ad2d30aee80dd103af288948a68caf09b52af212a8d7fd5f8b5011e775932",
  );
});

test("page metadata uses canonical HTTPS iSaudi icon and social URLs", () => {
  const metadata = createPageMetadata({
    title: "Pricing",
    description: "Pricing description",
    path: "/pricing",
  });

  assert.equal(BRAND_ICON_URL, `${SEO_ORIGIN}/brand/isaudi-mark-v4`);
  assert.equal(BRAND_APPLE_ICON_URL, `${SEO_ORIGIN}/brand/isaudi-apple-touch-v4`);
  assert.equal(SOCIAL_IMAGE_URL, `${SEO_ORIGIN}/brand/isaudi-social-v4`);
  assert.equal(MANIFEST_URL, `${SEO_ORIGIN}/manifest.webmanifest`);
  assert.deepEqual(metadata.openGraph?.images, [
    {
      url: SOCIAL_IMAGE_URL,
      width: 1200,
      height: 630,
      alt: "isaudi.ai",
    },
  ]);
  assert.deepEqual(metadata.twitter?.images, [SOCIAL_IMAGE_URL]);
  const twitter = metadata.twitter as { card?: string } | undefined;
  assert.equal(twitter?.card, "summary_large_image");
  assert.equal(SOCIAL_IMAGE_URL.startsWith("https://isaudi.ai/"), true);
});

test("web manifest uses only versioned same-origin iSaudi icons", () => {
  const result = manifest();
  assert.equal(result.start_url, "/");
  assert.equal(result.theme_color, "#006C35");
  assert.deepEqual(
    result.icons?.map((icon) => icon.src),
    ["/brand/isaudi-mark-v4", "/brand/isaudi-apple-touch-v4"],
  );
  assert.equal(result.icons?.some((icon) => /^https?:\/\//.test(icon.src)), false);
});

test("new brand filenames map to the approved source assets without query-only cache busting", () => {
  const routeSource = readFileSync(
    new URL("../src/app/brand/[asset]/route.ts", import.meta.url),
    "utf8",
  );
  const activeSource = [
    readFileSync(new URL("../src/lib/seo/metadata.ts", import.meta.url), "utf8"),
    readFileSync(new URL("../src/components/layout/header.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../src/components/layout/footer.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../src/components/sections/hero.tsx", import.meta.url), "utf8"),
  ].join("\n");

  for (const [versioned, approved] of [
    ["isaudi-mark-v4", "isaudi-mark-v1.png"],
    ["isaudi-apple-touch-v4", "isaudi-apple-touch-v1.png"],
    ["isaudi-social-v4", "isaudi-social-v1.png"],
  ]) {
    assert.match(routeSource, new RegExp(`"${versioned}"`));
    assert.match(routeSource, new RegExp(`source: "/brand/${approved}"`));
    assert.doesNotMatch(activeSource, new RegExp(`${approved.replace(".", "\\.")}`));
  }

  assert.match(routeSource, /max-age=31536000, immutable/);
  assert.match(routeSource, /"Content-Type": definition\.contentType/);
  assert.doesNotMatch(activeSource, /PlayCircle/);
});