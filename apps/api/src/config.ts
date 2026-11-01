export type ApiConfig = {
  port: number;
  host: string;
  webOrigins: string[];
};

type Environment = Record<string, string | undefined>;

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
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new Error(`WEB_ORIGIN contains an invalid HTTP(S) origin: ${origin}`);
    }
  }

  return { port, host: env.API_HOST ?? "0.0.0.0", webOrigins };
}
