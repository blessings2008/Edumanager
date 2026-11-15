export type TenantHostResolution =
  | { kind: "school"; slug: string }
  | { kind: "platform" }
  | { kind: "unmatched" };

function normalizeHostname(value: string): string | null {
  const candidate = value.trim().toLowerCase().replace(/\.$/, "");
  // Host values are hostnames only: reject schemes, ports, paths, escapes,
  // whitespace, backslashes and other URL syntax before parsing any tenant.
  if (!candidate || !/^[a-z0-9.-]+$/.test(candidate)) return null;
  if (candidate.startsWith(".") || candidate.endsWith(".") || candidate.includes("..")) return null;
  const labels = candidate.split(".");
  if (labels.some((label) => !label || label.length > 63
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
  return candidate;
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
