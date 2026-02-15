import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getD1Database(): unknown {
  try {
    const ctx = getCloudflareContext();
    const env = ctx?.env as { DB?: unknown } | undefined;
    return env?.DB ?? null;
  } catch {
    return null;
  }
}
