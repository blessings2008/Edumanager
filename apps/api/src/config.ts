import { isIP } from "node:net";

export type ApiConfig = {
  port: number;
  host: string;
  webOrigins: string[];
  trustedProxies: string[];
};

type Environment = Record<string, string | undefined>;

function isValidIpOrCidr(value: string): boolean {
  const [address, prefix, ...extra] = value.split("/");
  if (extra.length > 0 || !address) return false;
  const version = isIP(address);
  if (version === 0) return false;
  if (prefix === undefined) return true;
  if (!/^\d+$/.test(prefix)) return false;
  const bits = Number(prefix);
  return Number.isInteger(bits) && bits >= 0 && bits <= (version === 4 ? 32 : 128);
}

export function readConfig(env: Environment = process.env): ApiConfig {
  const rawPort = env.API_PORT ?? "4000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be an integer between 1 and 65535.");
  }

  const webOrigins = (env.WEB_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (webOrigins.length === 0) {
    throw new Error("WEB_ORIGIN must contain at least one allowed origin.");
  }

  for (const origin of webOrigins) {
    try {
      const parsed = new URL(origin);
      if (![ "http:", "https:" ].includes(parsed.protocol)
        || parsed.origin !== origin
        || parsed.username !== ""
        || parsed.password !== ""
        || parsed.pathname !== "/"
        || parsed.search !== ""
        || parsed.hash !== "") {
        throw new Error();
      }
    } catch {
      throw new Error(`WEB_ORIGIN must contain only HTTP(S) origins without paths or credentials: ${origin}`);
    }
  }

  const trustedProxies = (env.TRUSTED_PROXIES ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const proxy of trustedProxies) {
    if (!isValidIpOrCidr(proxy)) {
      throw new Error(`TRUSTED_PROXIES contains an invalid IP address or CIDR range: ${proxy}`);
    }
  }

  return {
    port,
    host: env.API_HOST ?? "0.0.0.0",
    webOrigins,
    trustedProxies,
  };
}
