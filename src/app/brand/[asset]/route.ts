import { SEO_ORIGIN } from "@/lib/seo/metadata";

const VERSIONED_ASSETS = {
  "isaudi-mark-v4": {
    source: "/brand/isaudi-mark-v1.png",
    contentType: "image/png",
  },
  "isaudi-apple-touch-v4": {
    source: "/brand/isaudi-apple-touch-v1.png",
    contentType: "image/png",
  },
  "isaudi-social-v4": {
    source: "/brand/isaudi-social-v1.png",
    contentType: "image/png",
  },
} as const;

type VersionedAsset = keyof typeof VERSIONED_ASSETS;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  const definition = VERSIONED_ASSETS[asset as VersionedAsset];

  if (!definition) {
    return new Response("Not found", { status: 404 });
  }

  const sourceUrl = new URL(definition.source, SEO_ORIGIN);
  const sourceResponse = await fetch(sourceUrl, { cache: "force-cache" });

  if (!sourceResponse.ok || !sourceResponse.body) {
    return new Response("Asset unavailable", { status: 502 });
  }

  return new Response(sourceResponse.body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": definition.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}