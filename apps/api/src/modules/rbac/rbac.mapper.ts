import { RoleDto, PermissionDto } from './dto/rbac.dto.js';

export class RbacMapper {
  public static toRoleDto(role: any): RoleDto {
    const permissions = (role.rolePermissions || []).map((rp: any) => rp.permission.code);
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions,
    };
  }

  public static toPermissionDto(perm: any): PermissionDto {
    return {
      id: perm.id,
      code: perm.code,
      module: perm.module,
      action: perm.action,
      description: perm.description,
    };
  }
}
