import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import type { ApiConfig } from "./config.js";
import {
  parseAuthenticatedPrincipal,
  type AuthenticationAdapter,
} from "./domain/authentication.js";

export interface ApiDependencies {
  /** Optional trusted verifier. No adapter means protected routes deny by default. */
  authenticateRequest?: AuthenticationAdapter;
}

export function buildApp(
  config: ApiConfig,
  logger: boolean | object = true,
  dependencies: ApiDependencies = {},
): FastifyInstance {
  const app = Fastify({
    logger,
    // Forwarded headers are untrusted unless the deployment explicitly lists
    // the proxy IPs/CIDRs that are allowed to supply them.
    trustProxy: config.trustedProxies.length > 0 ? config.trustedProxies : false,
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
  });

  app.decorateRequest("authenticatedPrincipal", null);
  app.register(cors, { origin: config.webOrigins, credentials: true });

  const requireAuthentication = async (request: FastifyRequest, reply: FastifyReply) => {
    const adapter = dependencies.authenticateRequest;
    if (!adapter) {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Authentication is required.",
      });
    }

    const principal = parseAuthenticatedPrincipal(await adapter(request));
    if (!principal) {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Authentication is required.",
      });
    }

    request.authenticatedPrincipal = principal;
  };

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

  // This endpoint proves only the authenticated global identity. School
  // membership and tenant context are separate, server-resolved boundaries.
  app.get("/api/v1/me", { preHandler: requireAuthentication }, async (request) => ({
    userId: request.authenticatedPrincipal!.userId,
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
