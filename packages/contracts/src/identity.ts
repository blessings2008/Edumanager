/** Identity and tenancy contracts shared by the API and web application. */
export type Identifier = string;
export type PlatformRole = "platform_owner";

export const SCHOOL_ROLES = [
  "school_owner", "school_admin", "school_staff", "teacher", "student", "guardian",
] as const;
export type SchoolRole = typeof SCHOOL_ROLES[number];

export const USER_STATUSES = ["pending", "active", "disabled"] as const;
export type UserStatus = typeof USER_STATUSES[number];

export const SCHOOL_STATUSES = ["provisioning", "active", "suspended", "archived"] as const;
export type SchoolStatus = typeof SCHOOL_STATUSES[number];

export const MEMBERSHIP_STATUSES = ["invited", "active", "suspended", "revoked"] as const;
export type MembershipStatus = typeof MEMBERSHIP_STATUSES[number];

export const SCHOOL_DOMAIN_KINDS = ["platform_subdomain", "custom"] as const;
export type SchoolDomainKind = typeof SCHOOL_DOMAIN_KINDS[number];

export const SCHOOL_DOMAIN_VERIFICATION_STATUSES = ["pending", "verified", "revoked"] as const;
export type SchoolDomainVerificationStatus = typeof SCHOOL_DOMAIN_VERIFICATION_STATUSES[number];

export interface SchoolIdentity {
  id: Identifier;
  name: string;
  slug: string;
  countryCode: string;
  timezone: string;
  status: SchoolStatus;
}

export interface UserIdentity {
  id: Identifier;
  email: string;
  fullName: string;
  emailVerifiedAt: string | null;
  status: UserStatus;
}

export interface SchoolMembershipIdentity {
  id: Identifier;
  schoolId: Identifier;
  userId: Identifier;
  role: SchoolRole;
  status: MembershipStatus;
}

export interface SchoolDomainIdentity {
  id: Identifier;
  schoolId: Identifier;
  hostname: string;
  kind: SchoolDomainKind;
  verificationStatus: SchoolDomainVerificationStatus;
  isPrimary: boolean;
  verifiedAt: string | null;
}

/** Created only from trusted server-side authentication and tenant resolution. */
export interface TenantRequestContext {
  userId: Identifier;
  schoolId: Identifier;
  membershipId: Identifier;
  role: SchoolRole;
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
