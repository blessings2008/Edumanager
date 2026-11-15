import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true, trustProxy: true });
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";

await app.register(cors, { origin: webOrigin, credentials: true });

app.get("/health", async () => ({
  status: "ok",
  service: "edumanager-api",
  timestamp: new Date().toISOString(),
}));

app.get("/api/v1", async () => ({
  name: "EduManager API",
  version: "0.1.0",
  status: "foundation",
}));

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
