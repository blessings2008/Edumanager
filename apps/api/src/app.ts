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
import {
  assertSafeTenantDatabaseRole,
  type RuntimeDatabaseRoleInspector,
} from "./persistence/database-runtime-role-safety.js";

export interface TenantDatabaseSafety {
  /** Server-only inspector for the actual connection used by tenant persistence. */
  inspector: RuntimeDatabaseRoleInspector;
  /** Explicit, server-configured list of every tenant table used by the resolver. */
  requiredTenantTables: readonly string[];
}

export interface ApiDependencies {
  /** Optional trusted verifier. No adapter means protected routes deny by default. */
  authenticateRequest?: AuthenticationAdapter;
  /** Server-side membership lookup. It must use trusted persistence and fail closed. */
  resolveTenantContext?: TenantContextResolver;
  /** Required whenever a tenant membership resolver is configured. */
  tenantDatabaseSafety?: TenantDatabaseSafety;
}


function snapshotTenantDatabaseSafety(value: TenantDatabaseSafety | undefined): TenantDatabaseSafety {
  try {
    if (!value || typeof value !== "object") throw new TypeError();

    const inspector = value.inspector;
    const requiredTenantTables = value.requiredTenantTables;
    if (!inspector || typeof inspector !== "object" || !Array.isArray(requiredTenantTables)) {
      throw new TypeError();
    }

    const inspect = inspector.inspect;
    if (typeof inspect !== "function") throw new TypeError();

    const tableNames = Array.prototype.slice.call(requiredTenantTables) as unknown[];
    if (!tableNames.every((name) => typeof name === "string")) throw new TypeError();

    return {
      // Snapshot both the method and receiver so later dependency mutation
      // cannot replace the check after the app has been constructed.
      inspector: Object.freeze({
        inspect: () => inspect.call(inspector),
      }),
      requiredTenantTables: Object.freeze(tableNames as string[]),
    };
  } catch {
    throw new Error(
      "A runtime database-role inspector and required tenant-table list are required when school membership resolution is configured.",
    );
  }
}

export function buildApp(
  config: ApiConfig,
  logger: boolean | object = true,
  dependencies: ApiDependencies = {},
): FastifyInstance {
  const resolveTenantContext = dependencies.resolveTenantContext;
  const tenantDatabaseSafety = resolveTenantContext
    ? snapshotTenantDatabaseSafety(dependencies.tenantDatabaseSafety)
    : null;

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

  if (tenantDatabaseSafety) {
    app.addHook("onReady", async () => {
      await assertSafeTenantDatabaseRole(
        tenantDatabaseSafety.inspector,
        tenantDatabaseSafety.requiredTenantTables,
      );
    });
  }

  const requireAuthentication = async (request: FastifyRequest, reply: FastifyReply) => {
    const adapter = dependencies.authenticateRequest;
    if (!adapter) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Authentication is required.",
      });
      return;
    }

    let adapterResult: unknown;
    try {
      adapterResult = await adapter(request);
    } catch (error) {
      request.log.error({ err: error }, "Authentication adapter failed");
      reply.code(503).send({
        error: "Service Unavailable",
        message: "Authentication is temporarily unavailable.",
      });
      return;
    }

    const principal = parseAuthenticatedPrincipal(adapterResult);
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

    const resolver = resolveTenantContext;
    if (!resolver) {
      reply.code(503).send({
        error: "Service Unavailable",
        message: "School access is not configured.",
      });
      return;
    }

    let resolverResult: unknown;
    try {
      resolverResult = await resolver({
        authenticatedUserId: principal.userId,
        requestedSchoolId: schoolId,
      });
    } catch (error) {
      request.log.error({ err: error }, "School membership resolver failed");
      reply.code(503).send({
        error: "Service Unavailable",
        message: "School access is temporarily unavailable.",
      });
      return;
    }

    const context = parseTenantRequestContext(
      resolverResult,
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
  app.get("/api/v1/me", { preHandler: requireAuthentication }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    return { userId: request.authenticatedPrincipal!.userId };
  });

  // The resolver must verify the active user, school and membership in trusted
  // persistence. The route parameter is a selector, never an authorization claim.
  app.get(
    "/api/v1/schools/:schoolId/context",
    { preHandler: [requireAuthentication, requireTenantContext] },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      return {
        schoolId: request.tenantContext!.schoolId,
        role: request.tenantContext!.role,
      };
    },
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
