export type TenantHostResolution =
  | { kind: "school"; slug: string }
  | { kind: "platform" }
  | { kind: "unmatched" };

function normalizeHostname(value: string): string | null {
  const candidate = value.trim().toLowerCase().replace(/\.$/, "");
  if (!candidate || candidate.includes("/") || candidate.includes("@")) return null;
  try {
    const url = new URL("http://" + candidate);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (url.port) return null;
    return url.hostname;
  } catch { return null; }
}

/**
 * Resolves platform-managed school subdomains only.
 * Custom domains must be resolved through an exact, verified database mapping.
 */
export function resolveTenantHost(host: string, platformDomain: string): TenantHostResolution {
  const hostname = normalizeHostname(host);
  const baseDomain = normalizeHostname(platformDomain);
  if (!hostname || !baseDomain) return { kind: "unmatched" };
  if (hostname === baseDomain || hostname === "www." + baseDomain) return { kind: "platform" };
  const suffix = "." + baseDomain;
  if (!hostname.endsWith(suffix)) return { kind: "unmatched" };
  const slug = hostname.slice(0, -suffix.length);
  if (!slug || slug.includes(".") || slug.length > 48) return { kind: "unmatched" };
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) return { kind: "unmatched" };
  return { kind: "school", slug };
}
