import type { SchoolRole, TenantRequestContext } from "./identity.js";

export type SchoolPermission =
  | "school:read" | "school:manage" | "users:manage"
  | "students:read" | "students:write"
  | "attendance:read" | "attendance:write"
  | "academics:read" | "academics:write"
  | "finance:read" | "finance:write"
  | "reports:read" | "portal:self:read";

const ROLE_PERMISSIONS: Record<SchoolRole, readonly SchoolPermission[]> = {
  school_admin: [
    "school:read", "school:manage", "users:manage",
    "students:read", "students:write", "attendance:read", "attendance:write",
    "academics:read", "academics:write", "finance:read", "finance:write", "reports:read",
  ],
  school_staff: [
    "school:read", "students:read", "students:write", "attendance:read",
    "attendance:write", "academics:read", "finance:read", "reports:read",
  ],
  teacher: ["school:read", "students:read", "attendance:read", "attendance:write", "academics:read", "academics:write"],
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
  return input.userStatus === "active" && input.schoolStatus === "active"
    && membership !== null && membership.status === "active"
    && membership.userId === input.authenticatedUserId
    && membership.schoolId === input.requestedSchoolId;
}

export interface TrustedTenantContextInput {
  authenticatedUserId: string;
  userStatus: "pending" | "active" | "disabled";
  schoolId: string;
  schoolStatus: "provisioning" | "active" | "suspended" | "archived";
  membership: { id: string; userId: string; schoolId: string; role: SchoolRole; status: "invited" | "active" | "suspended" } | null;
}

/**
 * Creates a tenant context only from already-authenticated identity and
 * server-loaded school/membership records. Never pass raw request body values.
 */
export function buildTenantRequestContext(input: TrustedTenantContextInput): TenantRequestContext | null {
  if (!isActiveSchoolMember({
    authenticatedUserId: input.authenticatedUserId,
    requestedSchoolId: input.schoolId,
    membership: input.membership,
    userStatus: input.userStatus,
    schoolStatus: input.schoolStatus,
  })) return null;

  if (!input.membership?.id) return null;
  return {
    userId: input.authenticatedUserId,
    schoolId: input.schoolId,
    membershipId: input.membership.id,
    role: input.membership.role,
  };
}

export interface StudentGuardianRelationship {
  schoolId: string;
  guardianUserId: string;
  studentId: string;
  status: "pending" | "active" | "revoked";
}

export interface StudentPortalAccountLink {
  schoolId: string;
  studentId: string;
  userId: string;
  status: "pending" | "active" | "revoked";
}

export interface TeacherClassAssignment {
  schoolId: string;
  teacherUserId: string;
  classId: string;
  subjectId: string;
  academicPeriodId: string;
  status: "pending" | "active" | "ended";
}

export interface StudentEnrolment {
  schoolId: string;
  studentId: string;
  classId: string;
  academicPeriodId: string;
  status: "pending" | "active" | "completed" | "withdrawn";
}

export interface StudentRecordAccessInput {
  role: SchoolRole;
  actorUserId: string;
  schoolId: string;
  studentId: string;
  action: "read" | "write";
  studentPortalAccountLinks: readonly StudentPortalAccountLink[];
  guardianRelationships: readonly StudentGuardianRelationship[];
  teacherAssignments: readonly TeacherClassAssignment[];
  studentEnrolments: readonly StudentEnrolment[];
}

/**
 * Resource-level gate for an individual student record.
 * Call after tenant membership and coarse permission checks. Every relationship
 * collection must come from trusted, school-scoped server-side queries.
 *
 * Student login is optional: self-access requires a separate active account
 * link. Guardian access uses a student-record link. Teacher access is derived
 * from an active class/subject/period assignment plus an active enrolment in
 * that same class and academic period.
 */
export function canAccessStudentRecord(input: StudentRecordAccessInput): boolean {
  if (!input.actorUserId || !input.schoolId || !input.studentId) return false;

  if (input.role === "school_admin" || input.role === "school_staff") {
    return hasSchoolPermission(input.role, input.action === "read" ? "students:read" : "students:write");
  }

  if (input.action !== "read") return false;

  if (input.role === "student") {
    return input.studentPortalAccountLinks.some((link) =>
      link.status === "active" && link.schoolId === input.schoolId
      && link.userId === input.actorUserId && link.studentId === input.studentId);
  }

  if (input.role === "guardian") {
    return input.guardianRelationships.some((link) =>
      link.status === "active" && link.schoolId === input.schoolId
      && link.guardianUserId === input.actorUserId && link.studentId === input.studentId);
  }

  if (input.role === "teacher") {
    return input.teacherAssignments.some((assignment) =>
      assignment.status === "active" && assignment.schoolId === input.schoolId
      && assignment.teacherUserId === input.actorUserId
      && assignment.classId.length > 0
      && assignment.subjectId.length > 0
      && assignment.academicPeriodId.length > 0
      && input.studentEnrolments.some((enrolment) =>
        enrolment.status === "active" && enrolment.schoolId === input.schoolId
        && enrolment.studentId === input.studentId
        && enrolment.classId.length > 0 && enrolment.classId === assignment.classId
        && enrolment.academicPeriodId.length > 0
        && enrolment.academicPeriodId === assignment.academicPeriodId));
  }

  return false;
}
