import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTenantRequestContext, canAccessStudentRecord, hasSchoolPermission, isActiveSchoolMember,
} from "../../../packages/contracts/src/authorization.js";

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
  assert.equal(isActiveSchoolMember({ ...activeMembership, membership: { ...activeMembership.membership, userId: "user-b" } }), false);
  assert.equal(isActiveSchoolMember({ ...activeMembership, membership: { ...activeMembership.membership, schoolId: "school-b" } }), false);
});
test("fails closed for missing, invited or suspended memberships", () => {
  assert.equal(isActiveSchoolMember({ ...activeMembership, membership: null }), false);
  assert.equal(isActiveSchoolMember({ ...activeMembership, membership: { ...activeMembership.membership, status: "invited" } }), false);
  assert.equal(isActiveSchoolMember({ ...activeMembership, membership: { ...activeMembership.membership, status: "suspended" } }), false);
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

test("tenant context is built only from matching active trusted records", () => {
  const base = {
    authenticatedUserId: "user-a", userStatus: "active" as const,
    schoolId: "school-a", schoolStatus: "active" as const,
    membership: { id: "membership-a", userId: "user-a", schoolId: "school-a", role: "teacher" as const, status: "active" as const },
  };
  assert.deepEqual(buildTenantRequestContext(base), {
    userId: "user-a", schoolId: "school-a", membershipId: "membership-a", role: "teacher",
  });
  assert.equal(buildTenantRequestContext({ ...base, membership: { ...base.membership, schoolId: "school-b" } }), null);
  assert.equal(buildTenantRequestContext({ ...base, schoolStatus: "suspended" }), null);
  assert.equal(buildTenantRequestContext({ ...base, membership: null }), null);
});

const accessBase = {
  actorUserId: "guardian-a", schoolId: "school-a", studentUserId: "student-a",
  action: "read" as const, teacherAssignments: [],
};
test("guardian relationship must match actor, student, school and active status", () => {
  const link = { schoolId: "school-a", guardianUserId: "guardian-a", studentUserId: "student-a", status: "active" as const };
  assert.equal(canAccessStudentRecord({ ...accessBase, role: "guardian", guardianRelationships: [link] }), true);
  assert.equal(canAccessStudentRecord({ ...accessBase, role: "guardian", guardianRelationships: [{ ...link, schoolId: "school-b" }] }), false);
  assert.equal(canAccessStudentRecord({ ...accessBase, role: "guardian", guardianRelationships: [{ ...link, status: "revoked" }] }), false);
  assert.equal(canAccessStudentRecord({ ...accessBase, role: "guardian", guardianRelationships: [{ ...link, guardianUserId: "other" }] }), false);
});
test("teacher assignment must match actor, student, school and active status", () => {
  const assignment = { schoolId: "school-a", teacherUserId: "teacher-a", studentUserId: "student-a", status: "active" as const };
  const base = { ...accessBase, role: "teacher" as const, actorUserId: "teacher-a", guardianRelationships: [] };
  assert.equal(canAccessStudentRecord({ ...base, teacherAssignments: [assignment] }), true);
  assert.equal(canAccessStudentRecord({ ...base, teacherAssignments: [{ ...assignment, schoolId: "school-b" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, teacherAssignments: [{ ...assignment, status: "ended" }] }), false);
});
test("students can read only their own record and teachers cannot write student records", () => {
  const base = { schoolId: "school-a", action: "read" as const, guardianRelationships: [], teacherAssignments: [] };
  assert.equal(canAccessStudentRecord({ ...base, role: "student", actorUserId: "student-a", studentUserId: "student-a" }), true);
  assert.equal(canAccessStudentRecord({ ...base, role: "student", actorUserId: "student-a", studentUserId: "student-b" }), false);
  assert.equal(canAccessStudentRecord({ ...base, role: "teacher", actorUserId: "teacher-a", studentUserId: "student-a", action: "write" }), false);
});
test("school administrators and staff follow their explicit student permissions", () => {
  const base = { actorUserId: "staff-a", schoolId: "school-a", studentUserId: "student-a", guardianRelationships: [], teacherAssignments: [] };
  assert.equal(canAccessStudentRecord({ ...base, role: "school_admin", action: "write" }), true);
  assert.equal(canAccessStudentRecord({ ...base, role: "school_staff", action: "write" }), true);
});
