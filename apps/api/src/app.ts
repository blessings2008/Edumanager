import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import type { ApiConfig } from "./config.js";
import {
  parseAuthenticatedPrincipal,
  type AuthenticationAdapter,
} from "./domain/authentication.js";
import {
  parseTenantRequestContext,
  type TenantContextResolver,
} from "./domain/tenant-authorization.js";

export interface ApiDependencies {
  /** Optional trusted verifier. No adapter means protected routes deny by default. */
  authenticateRequest?: AuthenticationAdapter;
  /** Server-side membership lookup. It must use trusted persistence and fail closed. */
  resolveTenantContext?: TenantContextResolver;
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
  app.decorateRequest("tenantContext", null);
  app.register(cors, { origin: config.webOrigins, credentials: true });

  const requireAuthentication = async (request: FastifyRequest, reply: FastifyReply) => {
    const adapter = dependencies.authenticateRequest;
    if (!adapter) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Authentication is required.",
      });
      return;
    }

    const principal = parseAuthenticatedPrincipal(await adapter(request));
    if (!principal) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Authentication is required.",
      });
      return;
    }

    request.authenticatedPrincipal = principal;
  };

  const requireTenantContext = async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = request.authenticatedPrincipal;
    if (!principal) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Authentication is required.",
      });
      return;
    }

    // A path school ID is only a requested scope. It never grants access by itself.
    const { schoolId } = request.params as { schoolId?: unknown };
    if (typeof schoolId !== "string" || !schoolId || schoolId.trim() !== schoolId) {
      reply.code(400).send({
        error: "Bad Request",
        message: "A valid school identifier is required.",
      });
      return;
    }

    const resolver = dependencies.resolveTenantContext;
    if (!resolver) {
      reply.code(503).send({
        error: "Service Unavailable",
        message: "School access is not configured.",
      });
      return;
    }

    const context = parseTenantRequestContext(
      await resolver({
        authenticatedUserId: principal.userId,
        requestedSchoolId: schoolId,
      }),
      principal.userId,
      schoolId,
    );

    if (!context) {
      reply.code(403).send({
        error: "Forbidden",
        message: "You do not have access to this school.",
      });
      return;
    }

    request.tenantContext = context;
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

  // The resolver must verify the active user, school and membership in trusted
  // persistence. The route parameter is a selector, never an authorization claim.
  app.get(
    "/api/v1/schools/:schoolId/context",
    { preHandler: [requireAuthentication, requireTenantContext] },
    async (request) => ({
      schoolId: request.tenantContext!.schoolId,
      role: request.tenantContext!.role,
    }),
  );

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
