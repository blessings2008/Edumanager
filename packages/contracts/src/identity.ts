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

/** A verified link between a guardian account and a student in one school. */
export interface StudentGuardianLinkIdentity {
  id: Identifier; schoolId: Identifier; guardianUserId: Identifier; studentUserId: Identifier;
  status: "pending" | "active" | "revoked";
}
/** A teacher's active teaching relationship with a student, derived from class/subject assignments. */
export interface TeacherStudentAssignmentIdentity {
  id: Identifier; schoolId: Identifier; teacherUserId: Identifier; studentUserId: Identifier;
  status: "pending" | "active" | "ended";
}
