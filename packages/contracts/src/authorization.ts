import {
  MEMBERSHIP_STATUSES,
  SCHOOL_ROLES,
  SCHOOL_STATUSES,
  USER_STATUSES,
} from "./identity.js";
import type {
  MembershipStatus,
  SchoolRole,
  SchoolStatus,
  StudentGuardianLinkIdentity,
  StudentPortalAccountLinkIdentity,
  StudentEnrolmentIdentity,
  TeacherClassAssignmentIdentity,
  TenantRequestContext,
  UserStatus,
} from "./identity.js";

export type SchoolPermission =
  | "school:read" | "school:manage" | "users:manage"
  | "students:read" | "students:write"
  | "attendance:read" | "attendance:write"
  | "academics:read" | "academics:write"
  | "finance:read" | "finance:write"
  | "reports:read" | "portal:self:read";

const ROLE_PERMISSIONS: Record<SchoolRole, readonly SchoolPermission[]> = {
  school_owner: [
    "school:read", "school:manage", "users:manage",
    "students:read", "students:write", "attendance:read", "attendance:write",
    "academics:read", "academics:write", "finance:read", "finance:write", "reports:read",
  ],
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
  if (!Object.hasOwn(ROLE_PERMISSIONS, role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export interface MembershipAccessInput {
  authenticatedUserId: string;
  requestedSchoolId: string;
  membership: { userId: string; schoolId: string; role: SchoolRole; status: MembershipStatus } | null;
  userStatus: UserStatus;
  schoolStatus: SchoolStatus;
}

/** Fail-closed check: all identity, membership and tenant records must agree. */
export function isActiveSchoolMember(input: MembershipAccessInput): boolean {
  const { membership } = input;
  if (!input.authenticatedUserId.trim() || !input.requestedSchoolId.trim()) return false;
  if (!membership?.userId.trim() || !membership.schoolId.trim()) return false;
  if (!SCHOOL_ROLES.includes(membership.role)) return false;

  return input.userStatus === "active" && input.schoolStatus === "active"
    && membership.status === "active"
    && membership.userId === input.authenticatedUserId
    && membership.schoolId === input.requestedSchoolId;
}

export interface TrustedTenantContextInput {
  authenticatedUserId: string;
  userStatus: UserStatus;
  schoolId: string;
  schoolStatus: SchoolStatus;
  membership: { id: string; userId: string; schoolId: string; role: SchoolRole; status: MembershipStatus } | null;
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

  if (!input.membership?.id.trim()) return null;
  return {
    userId: input.authenticatedUserId,
    schoolId: input.schoolId,
    membershipId: input.membership.id,
    role: input.membership.role,
  };
}


export interface TenantMembershipReader {
  /**
   * Load the persisted user, school and membership records for this exact
   * authenticated-user/requested-school pair from one consistent snapshot.
   * Return their actual IDs and statuses; never copy identifiers or roles
   * from untrusted request data.
   */
  loadTenantMembership(input: {
    authenticatedUserId: string;
    requestedSchoolId: string;
  }): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isOneOf<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

/**
 * Creates the provider-neutral resolver expected by the API membership seam.
 *
 * The reader is a server-only persistence adapter. Its returned snapshot is
 * treated as untrusted until every record ID and status is checked. The
 * shared buildTenantRequestContext policy then enforces active status and
 * exact user/school/membership relationships. Persistence errors propagate
 * so the API can log them internally and return its sanitized error response.
 */
export function createTenantContextResolver(reader: TenantMembershipReader) {
  return async (input: {
    authenticatedUserId: string;
    requestedSchoolId: string;
  }): Promise<TenantRequestContext | null> => {
    if (!isCanonicalIdentifier(input.authenticatedUserId)
      || !isCanonicalIdentifier(input.requestedSchoolId)) return null;

    const snapshot = await reader.loadTenantMembership({
      authenticatedUserId: input.authenticatedUserId,
      requestedSchoolId: input.requestedSchoolId,
    });

    if (!isRecord(snapshot) || !isRecord(snapshot.user) || !isRecord(snapshot.school)
      || !isRecord(snapshot.membership)) return null;

    const user = snapshot.user;
    const school = snapshot.school;
    const membership = snapshot.membership;

    if (!isCanonicalIdentifier(user.id)
      || user.id !== input.authenticatedUserId
      || !isOneOf(USER_STATUSES, user.status)
      || !isCanonicalIdentifier(school.id)
      || school.id !== input.requestedSchoolId
      || !isOneOf(SCHOOL_STATUSES, school.status)
      || !isCanonicalIdentifier(membership.id)
      || !isCanonicalIdentifier(membership.userId)
      || !isCanonicalIdentifier(membership.schoolId)
      || !isOneOf(SCHOOL_ROLES, membership.role)
      || !isOneOf(MEMBERSHIP_STATUSES, membership.status)) {
      return null;
    }

    return buildTenantRequestContext({
      authenticatedUserId: input.authenticatedUserId,
      userStatus: user.status,
      schoolId: school.id,
      schoolStatus: school.status,
      membership: {
        id: membership.id,
        userId: membership.userId,
        schoolId: membership.schoolId,
        role: membership.role,
        status: membership.status,
      },
    });
  };
}

export type StudentGuardianRelationship = Pick<
  StudentGuardianLinkIdentity, "schoolId" | "guardianUserId" | "studentId" | "status"
>;

export type StudentPortalAccountLink = Pick<
  StudentPortalAccountLinkIdentity, "schoolId" | "studentId" | "userId" | "status"
>;

export type TeacherClassAssignment = Pick<
  TeacherClassAssignmentIdentity,
  "schoolId" | "teacherUserId" | "classId" | "subjectId" | "academicPeriodId" | "status"
>;

export type StudentEnrolment = Pick<
  StudentEnrolmentIdentity, "schoolId" | "studentId" | "classId" | "academicPeriodId" | "status"
>;

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
  if (!input.actorUserId.trim() || !input.schoolId.trim() || !input.studentId.trim()) return false;
  if (input.action !== "read" && input.action !== "write") return false;

  if (input.role === "school_owner" || input.role === "school_admin" || input.role === "school_staff") {
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
      && assignment.classId.trim().length > 0
      && assignment.subjectId.trim().length > 0
      && assignment.academicPeriodId.trim().length > 0
      && input.studentEnrolments.some((enrolment) =>
        enrolment.status === "active" && enrolment.schoolId === input.schoolId
        && enrolment.studentId === input.studentId
        && enrolment.classId.trim().length > 0 && enrolment.classId === assignment.classId
        && enrolment.academicPeriodId.trim().length > 0
        && enrolment.academicPeriodId === assignment.academicPeriodId));
  }

  return false;
}
