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


export interface StudentRecordAccessInput {
  role: SchoolRole;
  actorUserId: string;
  studentUserId: string;
  action: "read" | "write";
  /** Must come from a trusted, school-scoped relationship lookup. */
  isGuardianOfStudent: boolean;
  /** Must come from a trusted, school-scoped teaching-assignment lookup. */
  isTeacherAssignedToStudent: boolean;
}

/**
 * Resource-level gate for an individual student record.
 * Call only after tenant membership and coarse permission checks.
 * Relationship flags must be computed server-side, never accepted from request input.
 */
export function canAccessStudentRecord(input: StudentRecordAccessInput): boolean {
  if (!input.actorUserId || !input.studentUserId) return false;

  if (input.role === "school_admin" || input.role === "school_staff") {
    return hasSchoolPermission(input.role, input.action === "read" ? "students:read" : "students:write");
  }

  if (input.action !== "read") return false;

  if (input.role === "student") {
    return input.actorUserId === input.studentUserId;
  }

  if (input.role === "guardian") {
    return input.isGuardianOfStudent;
  }

  if (input.role === "teacher") {
    return input.isTeacherAssignedToStudent;
  }

  return false;
}
