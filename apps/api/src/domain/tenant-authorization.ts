import type { FastifyRequest } from "fastify";

export const TENANT_SCHOOL_ROLES = [
  "school_owner",
  "school_admin",
  "school_staff",
  "teacher",
  "student",
  "guardian",
] as const;

export type TenantSchoolRole = typeof TENANT_SCHOOL_ROLES[number];

/** Minimal tenant context accepted by protected school routes. */
export interface TenantRequestContext {
  userId: string;
  schoolId: string;
  membershipId: string;
  role: TenantSchoolRole;
}

/**
 * Provider-neutral seam for a trusted, server-side membership lookup.
 *
 * Implementations must load the user, school and membership from trusted
 * persistence and return a context only when all three are active and agree.
 * They should use buildTenantRequestContext from @edumanager/contracts for
 * those status and relationship checks. The requested school ID is a selector,
 * not proof of membership; never trust a role or membership ID from the client.
 */
export type TenantContextResolver = (input: {
  authenticatedUserId: string;
  requestedSchoolId: string;
}) => Promise<unknown>;

declare module "fastify" {
  interface FastifyRequest {
    tenantContext: TenantRequestContext | null;
  }
}

function isNonBlankCanonicalString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

/**
 * Validate the resolver result again at the API boundary. The expected user
 * and school IDs come from authenticated server context and the requested
 * route scope respectively. Unknown fields are deliberately discarded.
 */
export function parseTenantRequestContext(
  value: unknown,
  expectedUserId: string,
  requestedSchoolId: string,
): TenantRequestContext | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  try {
    const candidate = value as Record<string, unknown>;
    // Snapshot every resolver field once so accessor-backed results cannot
    // change the tenant identity or role between validation and use.
    const userId = candidate.userId;
    const schoolId = candidate.schoolId;
    const membershipId = candidate.membershipId;
    const role = candidate.role;

    if (!isNonBlankCanonicalString(userId)
      || !isNonBlankCanonicalString(schoolId)
      || !isNonBlankCanonicalString(membershipId)
      || userId !== expectedUserId
      || schoolId !== requestedSchoolId
      || typeof role !== "string"
      || !TENANT_SCHOOL_ROLES.includes(role as TenantSchoolRole)) {
      return null;
    }

    return {
      userId,
      schoolId,
      membershipId,
      role: role as TenantSchoolRole,
    };
  } catch {
    // Throwing getters and proxy traps are invalid resolver results.
    return null;
  }
}
