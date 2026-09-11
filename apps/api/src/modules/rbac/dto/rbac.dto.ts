export interface RoleDto {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description?: string | null;
  readonly isSystem: boolean;
  readonly permissions: string[];
}

export interface PermissionDto {
  readonly id: string;
  readonly code: string;
  readonly module: string;
  readonly action: string;
  readonly description?: string | null;
}

export interface AssignRoleDto {
  readonly userId: string;
  readonly roleCode: string;
}

export interface UserRoleAssignmentDto {
  readonly userId: string;
  readonly roleId: string;
  readonly roleCode: string;
  readonly coachingId: string;
  readonly assignedAt: Date;
}
