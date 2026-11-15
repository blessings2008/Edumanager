import assert from "node:assert/strict";
import test from "node:test";
import { hasSchoolPermission, isActiveSchoolMember } from "../../../packages/contracts/src/authorization.js";

const activeMembership = {
  authenticatedUserId: "user-a",
  requestedSchoolId: "school-a",
  membership: { userId: "user-a", schoolId: "school-a", role: "teacher" as const, status: "active" as const },
  userStatus: "active" as const,
  schoolStatus: "active" as const,
};

test("active membership is accepted only when all identity records agree", () => {
  assert.equal(isActiveSchoolMember(activeMembership), true);
});

test("rejects a membership belonging to another user or school", () => {
  assert.equal(isActiveSchoolMember({
    ...activeMembership,
    membership: { ...activeMembership.membership, userId: "user-b" },
  }), false);
  assert.equal(isActiveSchoolMember({
    ...activeMembership,
    membership: { ...activeMembership.membership, schoolId: "school-b" },
  }), false);
});

test("fails closed for missing, invited or suspended memberships", () => {
  assert.equal(isActiveSchoolMember({ ...activeMembership, membership: null }), false);
  assert.equal(isActiveSchoolMember({
    ...activeMembership,
    membership: { ...activeMembership.membership, status: "invited" },
  }), false);
  assert.equal(isActiveSchoolMember({
    ...activeMembership,
    membership: { ...activeMembership.membership, status: "suspended" },
  }), false);
});

test("fails closed when the user or school is not active", () => {
  assert.equal(isActiveSchoolMember({ ...activeMembership, userStatus: "disabled" }), false);
  assert.equal(isActiveSchoolMember({ ...activeMembership, userStatus: "pending" }), false);
  assert.equal(isActiveSchoolMember({ ...activeMembership, schoolStatus: "suspended" }), false);
  assert.equal(isActiveSchoolMember({ ...activeMembership, schoolStatus: "provisioning" }), false);
});

test("school admin receives administrative permissions", () => {
  assert.equal(hasSchoolPermission("school_admin", "users:manage"), true);
  assert.equal(hasSchoolPermission("school_admin", "finance:write"), true);
});

test("teachers cannot manage users or school finance", () => {
  assert.equal(hasSchoolPermission("teacher", "academics:write"), true);
  assert.equal(hasSchoolPermission("teacher", "users:manage"), false);
  assert.equal(hasSchoolPermission("teacher", "finance:write"), false);
});

test("students and guardians receive only the generic self-portal grant", () => {
  assert.equal(hasSchoolPermission("student", "portal:self:read"), true);
  assert.equal(hasSchoolPermission("guardian", "portal:self:read"), true);
  assert.equal(hasSchoolPermission("guardian", "students:read"), false);
  assert.equal(hasSchoolPermission("student", "finance:read"), false);
});


test("students can read only their own student record", async () => {
  const { canAccessStudentRecord } = await import("../../../packages/contracts/src/authorization.js");
  assert.equal(canAccessStudentRecord({
    role: "student", actorUserId: "student-a", studentUserId: "student-a",
    action: "read", isGuardianOfStudent: false, isTeacherAssignedToStudent: false,
  }), true);
  assert.equal(canAccessStudentRecord({
    role: "student", actorUserId: "student-a", studentUserId: "student-b",
    action: "read", isGuardianOfStudent: false, isTeacherAssignedToStudent: false,
  }), false);
});

test("guardians can read only records linked through a verified relationship", async () => {
  const { canAccessStudentRecord } = await import("../../../packages/contracts/src/authorization.js");
  const base = {
    role: "guardian" as const, actorUserId: "guardian-a", studentUserId: "student-a",
    action: "read" as const, isTeacherAssignedToStudent: false,
  };
  assert.equal(canAccessStudentRecord({ ...base, isGuardianOfStudent: true }), true);
  assert.equal(canAccessStudentRecord({ ...base, isGuardianOfStudent: false }), false);
});

test("teachers can read only assigned students and cannot write student records", async () => {
  const { canAccessStudentRecord } = await import("../../../packages/contracts/src/authorization.js");
  const base = {
    role: "teacher" as const, actorUserId: "teacher-a", studentUserId: "student-a",
    isGuardianOfStudent: false, isTeacherAssignedToStudent: true,
  };
  assert.equal(canAccessStudentRecord({ ...base, action: "read" }), true);
  assert.equal(canAccessStudentRecord({ ...base, action: "write" }), false);
  assert.equal(canAccessStudentRecord({ ...base, isTeacherAssignedToStudent: false, action: "read" }), false);
});

test("school administrators and staff follow their explicit student permissions", async () => {
  const { canAccessStudentRecord } = await import("../../../packages/contracts/src/authorization.js");
  const base = {
    actorUserId: "staff-a", studentUserId: "student-a",
    isGuardianOfStudent: false, isTeacherAssignedToStudent: false,
  };
  assert.equal(canAccessStudentRecord({ ...base, role: "school_admin", action: "write" }), true);
  assert.equal(canAccessStudentRecord({ ...base, role: "school_staff", action: "write" }), true);
});
