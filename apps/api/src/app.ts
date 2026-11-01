import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { ApiConfig } from "./config.js";

export function buildApp(config: ApiConfig, logger: boolean | object = true): FastifyInstance {
  const app = Fastify({
    logger,
    trustProxy: true,
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
  });

  app.register(cors, { origin: config.webOrigins, credentials: true });

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

  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send({
    error: "Not Found",
    message: "The requested API route does not exist.",
  }));

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Request failed");
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode
      : 500;

    return reply.code(statusCode).send({
      error: statusCode === 500 ? "Internal Server Error" : error.name,
      message: statusCode === 500 ? "An unexpected error occurred." : error.message,
      requestId: request.id,
    });
  });

  return app;
}
