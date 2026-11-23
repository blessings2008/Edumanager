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
  try {
    // Snapshot every field before checking it. A persistence adapter result may
    // be accessor-backed or proxied, so never re-read a value after validation.
    const authenticatedUserId = input.authenticatedUserId;
    const requestedSchoolId = input.requestedSchoolId;
    const userStatus = input.userStatus;
    const schoolStatus = input.schoolStatus;
    const membershipValue = input.membership;

    if (!isCanonicalIdentifier(authenticatedUserId)
      || !isCanonicalIdentifier(requestedSchoolId)
      || !isRecord(membershipValue)) return false;

    const membershipUserId = membershipValue.userId;
    const membershipSchoolId = membershipValue.schoolId;
    const membershipRole = membershipValue.role;
    const membershipStatus = membershipValue.status;

    return userStatus === "active" && schoolStatus === "active"
      && isCanonicalIdentifier(membershipUserId)
      && isCanonicalIdentifier(membershipSchoolId)
      && membershipUserId === authenticatedUserId
      && membershipSchoolId === requestedSchoolId
      && SCHOOL_ROLES.includes(membershipRole as SchoolRole)
      && membershipStatus === "active";
  } catch {
    // Malformed records, throwing accessors and revoked proxies deny access.
    return false;
  }
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
  try {
    const authenticatedUserId = input.authenticatedUserId;
    const userStatus = input.userStatus;
    const schoolId = input.schoolId;
    const schoolStatus = input.schoolStatus;
    const membershipValue = input.membership;
    if (!isRecord(membershipValue)) return null;

    const membershipId = membershipValue.id;
    const membershipUserId = membershipValue.userId;
    const membershipSchoolId = membershipValue.schoolId;
    const membershipRole = membershipValue.role;
    const membershipStatus = membershipValue.status;

    if (!isCanonicalIdentifier(membershipId)
      || !isActiveSchoolMember({
        authenticatedUserId,
        requestedSchoolId: schoolId,
        userStatus,
        schoolStatus,
        membership: {
          userId: membershipUserId as string,
          schoolId: membershipSchoolId as string,
          role: membershipRole as SchoolRole,
          status: membershipStatus as MembershipStatus,
        },
      })) return null;

    return {
      userId: authenticatedUserId,
      schoolId,
      membershipId,
      role: membershipRole as SchoolRole,
    };
  } catch {
    return null;
  }
}


/** Expected shape of one consistent, server-loaded membership snapshot. */
export interface TenantMembershipSnapshot {
  user: { id: string; status: UserStatus };
  school: { id: string; status: SchoolStatus };
  membership: {
    id: string;
    userId: string;
    schoolId: string;
    role: SchoolRole;
    status: MembershipStatus;
  } | null;
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
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
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
    let authenticatedUserId: unknown;
    let requestedSchoolId: unknown;
    try {
      authenticatedUserId = input.authenticatedUserId;
      requestedSchoolId = input.requestedSchoolId;
    } catch {
      return null;
    }

    if (!isCanonicalIdentifier(authenticatedUserId)
      || !isCanonicalIdentifier(requestedSchoolId)) return null;

    const snapshot = await reader.loadTenantMembership({
      authenticatedUserId,
      requestedSchoolId,
    });

    try {
      if (!isRecord(snapshot)) return null;

      // Read the three persisted records once, then detach every field before
      // validating. This prevents mutable getters from changing a role or
      // relationship between validation and context construction.
      const userValue = snapshot.user;
      const schoolValue = snapshot.school;
      const membershipValue = snapshot.membership;
      if (!isRecord(userValue) || !isRecord(schoolValue) || !isRecord(membershipValue)) {
        return null;
      }

      const userId = userValue.id;
      const userStatus = userValue.status;
      const schoolId = schoolValue.id;
      const schoolStatus = schoolValue.status;
      const membershipId = membershipValue.id;
      const membershipUserId = membershipValue.userId;
      const membershipSchoolId = membershipValue.schoolId;
      const membershipRole = membershipValue.role;
      const membershipStatus = membershipValue.status;

      if (!isCanonicalIdentifier(userId)
        || userId !== authenticatedUserId
        || !isOneOf(USER_STATUSES, userStatus)
        || !isCanonicalIdentifier(schoolId)
        || schoolId !== requestedSchoolId
        || !isOneOf(SCHOOL_STATUSES, schoolStatus)
        || !isCanonicalIdentifier(membershipId)
        || !isCanonicalIdentifier(membershipUserId)
        || !isCanonicalIdentifier(membershipSchoolId)
        || !isOneOf(SCHOOL_ROLES, membershipRole)
        || !isOneOf(MEMBERSHIP_STATUSES, membershipStatus)) {
        return null;
      }

      return buildTenantRequestContext({
        authenticatedUserId,
        userStatus,
        schoolId,
        schoolStatus,
        membership: {
          id: membershipId,
          userId: membershipUserId,
          schoolId: membershipSchoolId,
          role: membershipRole,
          status: membershipStatus,
        },
      });
    } catch {
      // Throwing accessors and revoked proxies are invalid persistence results.
      return null;
    }
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
const STUDENT_PORTAL_LINK_STATUSES = ["pending", "active", "revoked"] as const;
const STUDENT_GUARDIAN_LINK_STATUSES = ["pending", "active", "revoked"] as const;
const TEACHER_ASSIGNMENT_STATUSES = ["pending", "active", "ended"] as const;
const STUDENT_ENROLMENT_STATUSES = ["pending", "active", "completed", "withdrawn"] as const;

/**
 * Detach relationship rows returned by persistence before evaluating access.
 * A malformed row, throwing getter or revoked proxy invalidates the collection;
 * authorization must never depend on repeatedly reading mutable adapter data.
 */
function snapshotRelationshipRows<T>(
  value: unknown,
  snapshotRow: (row: unknown) => T | null,
): T[] | null {
  try {
    if (!Array.isArray(value)) return null;

    const rows = value as unknown[];
    const length = rows.length;
    if (!Number.isSafeInteger(length) || length < 0) return null;

    const snapshots: T[] = [];
    for (let index = 0; index < length; index += 1) {
      const snapshot = snapshotRow(rows[index]);
      if (snapshot === null) return null;
      snapshots.push(snapshot);
    }
    return snapshots;
  } catch {
    // Includes throwing array accessors and revoked array proxies.
    return null;
  }
}

function snapshotStudentPortalAccountLink(value: unknown): StudentPortalAccountLink | null {
  if (!isRecord(value)) return null;

  const schoolId = value.schoolId;
  const studentId = value.studentId;
  const userId = value.userId;
  const status = value.status;

  if (!isCanonicalIdentifier(schoolId)
    || !isCanonicalIdentifier(studentId)
    || !isCanonicalIdentifier(userId)
    || !isOneOf(STUDENT_PORTAL_LINK_STATUSES, status)) return null;

  return { schoolId, studentId, userId, status };
}

function snapshotStudentGuardianRelationship(value: unknown): StudentGuardianRelationship | null {
  if (!isRecord(value)) return null;

  const schoolId = value.schoolId;
  const guardianUserId = value.guardianUserId;
  const studentId = value.studentId;
  const status = value.status;

  if (!isCanonicalIdentifier(schoolId)
    || !isCanonicalIdentifier(guardianUserId)
    || !isCanonicalIdentifier(studentId)
    || !isOneOf(STUDENT_GUARDIAN_LINK_STATUSES, status)) return null;

  return { schoolId, guardianUserId, studentId, status };
}

function snapshotTeacherClassAssignment(value: unknown): TeacherClassAssignment | null {
  if (!isRecord(value)) return null;

  const schoolId = value.schoolId;
  const teacherUserId = value.teacherUserId;
  const classId = value.classId;
  const subjectId = value.subjectId;
  const academicPeriodId = value.academicPeriodId;
  const status = value.status;

  if (!isCanonicalIdentifier(schoolId)
    || !isCanonicalIdentifier(teacherUserId)
    || !isCanonicalIdentifier(classId)
    || !isCanonicalIdentifier(subjectId)
    || !isCanonicalIdentifier(academicPeriodId)
    || !isOneOf(TEACHER_ASSIGNMENT_STATUSES, status)) return null;

  return { schoolId, teacherUserId, classId, subjectId, academicPeriodId, status };
}

function snapshotStudentEnrolment(value: unknown): StudentEnrolment | null {
  if (!isRecord(value)) return null;

  const schoolId = value.schoolId;
  const studentId = value.studentId;
  const classId = value.classId;
  const academicPeriodId = value.academicPeriodId;
  const status = value.status;

  if (!isCanonicalIdentifier(schoolId)
    || !isCanonicalIdentifier(studentId)
    || !isCanonicalIdentifier(classId)
    || !isCanonicalIdentifier(academicPeriodId)
    || !isOneOf(STUDENT_ENROLMENT_STATUSES, status)) return null;

  return { schoolId, studentId, classId, academicPeriodId, status };
}

/**
 * Resource-level gate for an individual student record.
 * Call after tenant membership and coarse permission checks. Every relationship
 * collection must come from trusted, school-scoped server-side queries.
 *
 * The input and every relevant relationship row are snapshotted once before
 * policy evaluation. Malformed collections, accessors and revoked proxies
 * fail closed instead of being allowed to change the decision mid-check.
 *
 * Student login is optional: self-access requires a separate active account
 * link. Guardian access uses a student-record link. Teacher access is derived
 * from an active class/subject/period assignment plus an active enrolment in
 * that same class and academic period.
 */
export function canAccessStudentRecord(input: StudentRecordAccessInput): boolean {
  try {
    if (!isRecord(input)) return false;

    const role = input.role;
    const actorUserId = input.actorUserId;
    const schoolId = input.schoolId;
    const studentId = input.studentId;
    const action = input.action;

    if (!isOneOf(SCHOOL_ROLES, role)
      || !isCanonicalIdentifier(actorUserId)
      || !isCanonicalIdentifier(schoolId)
      || !isCanonicalIdentifier(studentId)
      || (action !== "read" && action !== "write")) return false;

    if (role === "school_owner" || role === "school_admin" || role === "school_staff") {
      return hasSchoolPermission(role, action === "read" ? "students:read" : "students:write");
    }

    if (action !== "read") return false;

    if (role === "student") {
      const links = snapshotRelationshipRows(
        input.studentPortalAccountLinks,
        snapshotStudentPortalAccountLink,
      );
      if (!links) return false;

      return links.some((link) => link.status === "active"
        && link.schoolId === schoolId
        && link.userId === actorUserId
        && link.studentId === studentId);
    }

    if (role === "guardian") {
      const relationships = snapshotRelationshipRows(
        input.guardianRelationships,
        snapshotStudentGuardianRelationship,
      );
      if (!relationships) return false;

      return relationships.some((link) => link.status === "active"
        && link.schoolId === schoolId
        && link.guardianUserId === actorUserId
        && link.studentId === studentId);
    }

    if (role === "teacher") {
      const assignments = snapshotRelationshipRows(
        input.teacherAssignments,
        snapshotTeacherClassAssignment,
      );
      const enrolments = snapshotRelationshipRows(
        input.studentEnrolments,
        snapshotStudentEnrolment,
      );
      if (!assignments || !enrolments) return false;

      return assignments.some((assignment) => assignment.status === "active"
        && assignment.schoolId === schoolId
        && assignment.teacherUserId === actorUserId
        && enrolments.some((enrolment) => enrolment.status === "active"
          && enrolment.schoolId === schoolId
          && enrolment.studentId === studentId
          && enrolment.classId === assignment.classId
          && enrolment.academicPeriodId === assignment.academicPeriodId));
    }

    return false;
  } catch {
    // Runtime inputs originate at a persistence boundary and must fail closed.
    return false;
  }
}
