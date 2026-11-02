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
