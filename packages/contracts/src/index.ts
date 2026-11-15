/** Shared API contracts keep the web app and API aligned. */
export type ApiHealth = { status: "ok"; service: string; timestamp: string };
export type UserRole = "platform_owner" | "school_admin" | "school_staff" | "teacher" | "student" | "guardian";
export type SchoolMembership = { schoolId: string; userId: string; role: Exclude<UserRole, "platform_owner">; status: "invited" | "active" | "suspended" };
