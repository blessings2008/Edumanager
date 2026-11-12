/** Shared API contracts keep the web app and API aligned. */
export type ApiHealth = { status: "ok"; service: string; timestamp: string };

import type { MembershipStatus, PlatformRole, SchoolRole } from "./identity.js";

export type UserRole = PlatformRole | SchoolRole;
export type SchoolMembership = {
  schoolId: string;
  userId: string;
  role: SchoolRole;
  status: MembershipStatus;
};

export * from "./identity.js";
export * from "./authorization.js";
