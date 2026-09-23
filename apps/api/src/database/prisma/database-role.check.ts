import { envConfig } from '../../config/env.config.js';
import { logger } from '../../common/logger/logger.service.js';
import { ExtendedPrismaClient } from './tenant-prisma.extension.js';

/**
 * PostgreSQL skips row-level security entirely for superusers and BYPASSRLS roles, which
 * would silently disable the database half of tenant isolation. The API and workers must
 * connect as an ordinary role; migrations run separately as the schema owner.
 */
export async function assertDatabaseRoleEnforcesRls(prisma: ExtendedPrismaClient): Promise<void> {
  const rows = await (prisma as any).$queryRaw<Array<{ role: string; rolsuper: boolean; rolbypassrls: boolean }>>`
    SELECT current_user AS role, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  const role = rows[0];
  if (!role || (!role.rolsuper && !role.rolbypassrls)) return;

  const message =
    `Database role "${role.role}" is a superuser or has BYPASSRLS, so tenant row-level security is not enforced. ` +
    'Connect the API with a dedicated application role (see infra/docker/postgres/create-app-role.sql).';

  if (envConfig.get('NODE_ENV') === 'production') {
    throw new Error(message);
  }
  logger.warn(`[DatabaseRoleCheck] ${message}`);
}
