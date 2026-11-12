import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTenantRequestContext, canAccessStudentRecord, hasSchoolPermission, isActiveSchoolMember,
} from "../../../packages/contracts/src/authorization.js";
import type { StudentRecordIdentity } from "../../../packages/contracts/src/identity.js";

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

const studentRecord: StudentRecordIdentity = {
  id: "student-a",
  schoolId: "school-a",
  status: "active",
};
const accessBase = {
  schoolId: studentRecord.schoolId,
  studentId: studentRecord.id,
  action: "read" as const,
  studentPortalAccountLinks: [],
  guardianRelationships: [],
  teacherAssignments: [],
  studentEnrolments: [],
};

test("student records do not require or embed a login user", () => {
  assert.equal("userId" in studentRecord, false);
  assert.equal(canAccessStudentRecord({
    ...accessBase, role: "student", actorUserId: "student-a",
  }), false, "a student portal login must have an explicit active account link");
});

test("student self-access requires an active, exact, school-scoped optional account link", () => {
  const link = { schoolId: "school-a", studentId: "student-a", userId: "student-login-a", status: "active" as const };
  const base = { ...accessBase, role: "student" as const, actorUserId: "student-login-a" };
  assert.equal(canAccessStudentRecord({ ...base, studentPortalAccountLinks: [link] }), true);
  assert.equal(canAccessStudentRecord({ ...base, studentPortalAccountLinks: [{ ...link, userId: "another-user" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, studentPortalAccountLinks: [{ ...link, schoolId: "school-b" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, studentPortalAccountLinks: [{ ...link, status: "revoked" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, studentPortalAccountLinks: [{ ...link, status: "pending" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, action: "write", studentPortalAccountLinks: [link] }), false);
});

test("guardian relationship must match actor, student record, school and active status", () => {
  const link = { schoolId: "school-a", guardianUserId: "guardian-a", studentId: "student-a", status: "active" as const };
  const base = { ...accessBase, role: "guardian" as const, actorUserId: "guardian-a" };
  assert.equal(canAccessStudentRecord({ ...base, guardianRelationships: [link] }), true);
  assert.equal(canAccessStudentRecord({ ...base, guardianRelationships: [{ ...link, schoolId: "school-b" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, guardianRelationships: [{ ...link, status: "revoked" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, guardianRelationships: [{ ...link, guardianUserId: "other" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, guardianRelationships: [{ ...link, studentId: "student-b" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, action: "write", guardianRelationships: [link] }), false);
});

test("teacher access requires an active class/subject/period assignment and matching active enrolment", () => {
  const assignment = {
    schoolId: "school-a", teacherUserId: "teacher-a", classId: "class-a",
    subjectId: "maths", academicPeriodId: "term-1", status: "active" as const,
  };
  const enrolment = {
    schoolId: "school-a", studentId: "student-a", classId: "class-a",
    academicPeriodId: "term-1", status: "active" as const,
  };
  const base = {
    ...accessBase, role: "teacher" as const, actorUserId: "teacher-a",
    teacherAssignments: [assignment], studentEnrolments: [enrolment],
  };
  assert.equal(canAccessStudentRecord(base), true);
  assert.equal(canAccessStudentRecord({ ...base, teacherAssignments: [{ ...assignment, teacherUserId: "another-teacher" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, teacherAssignments: [{ ...assignment, schoolId: "school-b" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, teacherAssignments: [{ ...assignment, status: "ended" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, teacherAssignments: [{ ...assignment, classId: "" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, teacherAssignments: [{ ...assignment, academicPeriodId: "" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, studentEnrolments: [{ ...enrolment, classId: "class-b" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, studentEnrolments: [{ ...enrolment, classId: "" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, studentEnrolments: [{ ...enrolment, academicPeriodId: "term-2" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, studentEnrolments: [{ ...enrolment, schoolId: "school-b" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, studentEnrolments: [{ ...enrolment, status: "withdrawn" }] }), false);
  assert.equal(canAccessStudentRecord({ ...base, action: "write" }), false);
});

test("school administrators and staff follow their explicit student permissions", () => {
  const base = {
    actorUserId: "staff-a", schoolId: "school-a", studentId: "student-a",
    studentPortalAccountLinks: [], guardianRelationships: [], teacherAssignments: [], studentEnrolments: [],
  };
  assert.equal(canAccessStudentRecord({ ...base, role: "school_admin", action: "write" }), true);
  assert.equal(canAccessStudentRecord({ ...base, role: "school_staff", action: "write" }), true);
});
