import type { FastifyRequest } from "fastify";

/**
 * A verified global user identity. Tenant IDs and school roles deliberately do
 * not belong here; they must be resolved from trusted school records later.
 */
export interface AuthenticatedPrincipal {
  userId: string;
  userStatus: "active";
}

/**
 * Provider-neutral seam for a future cookie/session or token verifier.
 *
 * Implementations must validate credentials server-side and load the active
 * user from trusted persistence. They must not derive identity from request
 * headers, query parameters, body fields, hostname, or a client-supplied school
 * ID. The adapter returns unknown so the API validates its runtime boundary.
 */
export type AuthenticationAdapter = (request: FastifyRequest) => Promise<unknown>;

declare module "fastify" {
  interface FastifyRequest {
    authenticatedPrincipal: AuthenticatedPrincipal | null;
  }
}

/**
 * Accept only a nonblank, canonical ID belonging to an active user.
 * Read each property once into a detached snapshot: adapter results are runtime
 * data, and accessor-backed objects must not be able to change identity
 * between validation and the value returned to downstream authorization.
 */
export function parseAuthenticatedPrincipal(value: unknown): AuthenticatedPrincipal | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  try {
    const candidate = value as Record<string, unknown>;
    const userId = candidate.userId;
    const userStatus = candidate.userStatus;

    if (typeof userId !== "string"
      || userId.length === 0
      || userId.trim() !== userId
      || userStatus !== "active") {
      return null;
    }

    // Return only the global identity fields needed by downstream authorization.
    // Ignore any tenant, role, or permission claims on the adapter's object.
    return { userId, userStatus: "active" };
  } catch {
    // A throwing getter/proxy is not a valid authenticated principal.
    return null;
  }
}
