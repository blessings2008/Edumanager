import type { SchoolRole } from "./identity.js";

export type SchoolPermission =
  | "school:read"
  | "school:manage"
  | "users:manage"
  | "students:read"
  | "students:write"
  | "attendance:read"
  | "attendance:write"
  | "academics:read"
  | "academics:write"
  | "finance:read"
  | "finance:write"
  | "reports:read"
  | "portal:self:read";

/**
 * Coarse role grants only. Student/guardian record access still requires
 * a separate relationship check for the specific student record.
 */
const ROLE_PERMISSIONS: Record<SchoolRole, readonly SchoolPermission[]> = {
  school_admin: [
    "school:read", "school:manage", "users:manage",
    "students:read", "students:write",
    "attendance:read", "attendance:write",
    "academics:read", "academics:write",
    "finance:read", "finance:write", "reports:read",
  ],
  school_staff: [
    "school:read", "students:read", "students:write",
    "attendance:read", "attendance:write", "academics:read",
    "finance:read", "reports:read",
  ],
  teacher: [
    "school:read", "students:read", "attendance:read",
    "attendance:write", "academics:read", "academics:write",
  ],
  student: ["portal:self:read"],
  guardian: ["portal:self:read"],
};

export function hasSchoolPermission(role: SchoolRole, permission: SchoolPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export interface MembershipAccessInput {
  authenticatedUserId: string;
  requestedSchoolId: string;
  membership: { userId: string; schoolId: string; role: SchoolRole; status: "invited" | "active" | "suspended" } | null;
  userStatus: "pending" | "active" | "disabled";
  schoolStatus: "provisioning" | "active" | "suspended" | "archived";
}

/** Fail-closed check: all identity, membership and tenant records must agree. */
export function isActiveSchoolMember(input: MembershipAccessInput): boolean {
  const { membership } = input;
  return input.userStatus === "active"
    && input.schoolStatus === "active"
    && membership !== null
    && membership.status === "active"
    && membership.userId === input.authenticatedUserId
    && membership.schoolId === input.requestedSchoolId;
}
