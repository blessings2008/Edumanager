/**
 * Provider-neutral startup contract for checking a tenant-data runtime role.
 *
 * A concrete database adapter must inspect the actual connection identity,
 * every role the connection can assume, and ownership/RLS metadata for every
 * required tenant table. This module validates that evidence; it does not
 * connect to a database or prove that RLS policies themselves are correct.
 */
export interface RuntimeDatabaseRoleInspector {
  inspect(): Promise<unknown>;
}

interface RoleCapability {
  name: string;
  isSuperuser: boolean;
  bypassesRowLevelSecurity: boolean;
}

interface TenantTableCapability {
  qualifiedName: string;
  rowLevelSecurityEnabled: boolean;
  ownerRole: string;
  /** True when a role the connection can SET ROLE to inherits this owner's privileges. */
  runtimeCanUseOwnerPrivileges: boolean;
}

interface RuntimeDatabaseRoleSnapshot {
  roleName: string;
  settableRoles: RoleCapability[];
  tenantTables: TenantTableCapability[];
}

export type RuntimeDatabaseRoleSafetyCode =
  | "inspection_failed"
  | "invalid_requirements"
  | "invalid_snapshot"
  | "privileged_runtime_role"
  | "assumable_privileged_role"
  | "missing_tenant_table"
  | "tenant_rls_disabled"
  | "runtime_role_can_assume_table_owner"
  | "runtime_role_inherits_table_owner";

/** Safe, stable failure code for startup diagnostics; never includes DB details. */
export class RuntimeDatabaseRoleSafetyError extends Error {
  constructor(readonly code: RuntimeDatabaseRoleSafetyCode) {
    super("Database runtime role failed tenant-isolation safety checks.");
    this.name = "RuntimeDatabaseRoleSafetyError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function readRoleCapability(value: unknown): RoleCapability | null {
  if (!isRecord(value)) return null;

  try {
    const name = value.name;
    const isSuperuser = value.isSuperuser;
    const bypassesRowLevelSecurity = value.bypassesRowLevelSecurity;

    if (!isNonBlankString(name)
      || typeof isSuperuser !== "boolean"
      || typeof bypassesRowLevelSecurity !== "boolean") {
      return null;
    }

    return { name, isSuperuser, bypassesRowLevelSecurity };
  } catch {
    return null;
  }
}

function readTenantTableCapability(value: unknown): TenantTableCapability | null {
  if (!isRecord(value)) return null;

  try {
    const qualifiedName = value.qualifiedName;
    const rowLevelSecurityEnabled = value.rowLevelSecurityEnabled;
    const ownerRole = value.ownerRole;
    const runtimeCanUseOwnerPrivileges = value.runtimeCanUseOwnerPrivileges;

    if (!isNonBlankString(qualifiedName)
      || typeof rowLevelSecurityEnabled !== "boolean"
      || !isNonBlankString(ownerRole)
      || typeof runtimeCanUseOwnerPrivileges !== "boolean") {
      return null;
    }

    return { qualifiedName, rowLevelSecurityEnabled, ownerRole, runtimeCanUseOwnerPrivileges };
  } catch {
    return null;
  }
}

function readSnapshot(value: unknown): RuntimeDatabaseRoleSnapshot | null {
  if (!isRecord(value)) return null;

  try {
    const roleName = value.roleName;
    const rawSettableRoles = value.settableRoles;
    const rawTenantTables = value.tenantTables;

    if (!isNonBlankString(roleName)
      || !Array.isArray(rawSettableRoles)
      || !Array.isArray(rawTenantTables)) {
      return null;
    }

    const settableRoles: RoleCapability[] = [];
    for (let index = 0; index < rawSettableRoles.length; index += 1) {
      const role = readRoleCapability(rawSettableRoles[index]);
      if (!role) return null;
      settableRoles.push(role);
    }

    const tenantTables: TenantTableCapability[] = [];
    for (let index = 0; index < rawTenantTables.length; index += 1) {
      const table = readTenantTableCapability(rawTenantTables[index]);
      if (!table) return null;
      tenantTables.push(table);
    }

    const roleNames = new Set(settableRoles.map((role) => role.name));
    const tableNames = new Set(tenantTables.map((table) => table.qualifiedName));

    if (roleNames.size !== settableRoles.length
      || tableNames.size !== tenantTables.length
      || !roleNames.has(roleName)) {
      return null;
    }

    return { roleName, settableRoles, tenantTables };
  } catch {
    // Accessor-backed objects and throwing proxies are invalid inspection data.
    return null;
  }
}

function readRequiredTenantTables(value: readonly string[]): string[] | null {
  try {
    if (!Array.isArray(value) || value.length === 0) return null;

    const names = Array.prototype.slice.call(value) as unknown[];
    if (!names.every(isNonBlankString)) return null;

    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) return null;

    return names as string[];
  } catch {
    return null;
  }
}

/**
 * Fails closed unless the inspected connection is non-privileged, cannot
 * assume a privileged role or a tenant-table owner, and every required tenant
 * table has row-level security enabled.
 *
 * settableRoles must be exhaustive and include the current role. A PostgreSQL
 * adapter can populate it from the roles the session may assume; another
 * database adapter can map its equivalent capability model.
 */
export async function assertSafeTenantDatabaseRole(
  inspector: RuntimeDatabaseRoleInspector,
  requiredTenantTables: readonly string[],
): Promise<void> {
  const requiredTables = readRequiredTenantTables(requiredTenantTables);
  if (!requiredTables) {
    throw new RuntimeDatabaseRoleSafetyError("invalid_requirements");
  }

  let inspect: unknown;
  try {
    inspect = (inspector as RuntimeDatabaseRoleInspector | null)?.inspect;
  } catch {
    throw new RuntimeDatabaseRoleSafetyError("inspection_failed");
  }

  if (typeof inspect !== "function") {
    throw new RuntimeDatabaseRoleSafetyError("inspection_failed");
  }

  let rawSnapshot: unknown;
  try {
    rawSnapshot = await inspect.call(inspector);
  } catch {
    throw new RuntimeDatabaseRoleSafetyError("inspection_failed");
  }

  const snapshot = readSnapshot(rawSnapshot);
  if (!snapshot) {
    throw new RuntimeDatabaseRoleSafetyError("invalid_snapshot");
  }

  const currentRole = snapshot.settableRoles.find((role) => role.name === snapshot.roleName);
  if (!currentRole) {
    throw new RuntimeDatabaseRoleSafetyError("invalid_snapshot");
  }

  if (currentRole.isSuperuser || currentRole.bypassesRowLevelSecurity) {
    throw new RuntimeDatabaseRoleSafetyError("privileged_runtime_role");
  }

  const settableRoleNames = new Set<string>();
  for (const role of snapshot.settableRoles) {
    if (role.isSuperuser || role.bypassesRowLevelSecurity) {
      throw new RuntimeDatabaseRoleSafetyError("assumable_privileged_role");
    }
    settableRoleNames.add(role.name);
  }

  const tablesByName = new Map(
    snapshot.tenantTables.map((table) => [table.qualifiedName, table]),
  );

  for (const requiredTable of requiredTables) {
    const table = tablesByName.get(requiredTable);
    if (!table) {
      throw new RuntimeDatabaseRoleSafetyError("missing_tenant_table");
    }
    if (!table.rowLevelSecurityEnabled) {
      throw new RuntimeDatabaseRoleSafetyError("tenant_rls_disabled");
    }
    if (settableRoleNames.has(table.ownerRole)) {
      throw new RuntimeDatabaseRoleSafetyError("runtime_role_can_assume_table_owner");
    }
    if (table.runtimeCanUseOwnerPrivileges) {
      throw new RuntimeDatabaseRoleSafetyError("runtime_role_inherits_table_owner");
    }
  }
}
