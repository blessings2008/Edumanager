/** Identity and tenancy contracts shared by the API and web application. */
export type Identifier = string;
export type PlatformRole = "platform_owner";
export type SchoolRole = "school_admin" | "school_staff" | "teacher" | "student" | "guardian";
export type MembershipStatus = "invited" | "active" | "suspended";

export interface SchoolIdentity {
  id: Identifier; name: string; slug: string;
  status: "provisioning" | "active" | "suspended" | "archived";
}
export interface UserIdentity {
  id: Identifier; email: string; emailVerifiedAt: string | null;
  status: "pending" | "active" | "disabled";
}
export interface SchoolMembershipIdentity {
  id: Identifier; schoolId: Identifier; userId: Identifier;
  role: SchoolRole; status: MembershipStatus;
}
export interface SchoolDomainIdentity {
  id: Identifier; schoolId: Identifier; hostname: string;
  kind: "platform_subdomain" | "custom";
  status: "pending_verification" | "active" | "disabled";
}
/** Created only from trusted server-side authentication and tenant resolution. */
export interface TenantRequestContext {
  userId: Identifier; schoolId: Identifier; membershipId: Identifier; role: SchoolRole;
}

/**
 * A student is a school-owned record. It does not contain or require a login
 * identity; a portal account is an optional, separately verified relationship.
 */
export interface StudentRecordIdentity {
  id: Identifier;
  schoolId: Identifier;
  status: "active" | "inactive" | "withdrawn" | "graduated";
}

/** Optional link that permits a login account to access one student's portal. */
export interface StudentPortalAccountLinkIdentity {
  id: Identifier;
  schoolId: Identifier;
  studentId: Identifier;
  userId: Identifier;
  status: "pending" | "active" | "revoked";
}

/** A guardian may have active links to multiple student records. */
export interface StudentGuardianLinkIdentity {
  id: Identifier;
  schoolId: Identifier;
  guardianUserId: Identifier;
  studentId: Identifier;
  status: "pending" | "active" | "revoked";
}

/**
 * Teacher access is scoped through a class, subject and academic period.
 * Student access is derived by matching this assignment to an active enrolment.
 */
export interface TeacherClassAssignmentIdentity {
  id: Identifier;
  schoolId: Identifier;
  teacherUserId: Identifier;
  classId: Identifier;
  subjectId: Identifier;
  academicPeriodId: Identifier;
  status: "pending" | "active" | "ended";
}

/** Historical school enrolment; the student record remains independent of login. */
export interface StudentEnrolmentIdentity {
  id: Identifier;
  schoolId: Identifier;
  studentId: Identifier;
  classId: Identifier;
  academicPeriodId: Identifier;
  status: "pending" | "active" | "completed" | "withdrawn";
}
