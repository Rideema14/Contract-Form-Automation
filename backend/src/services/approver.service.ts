import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

/**
 * Retrieves all active users with the APPROVER role.
 * Results are sorted alphabetically by fullName.
 */
export async function listActiveApprovers() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      role: UserRole.APPROVER,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
    orderBy: {
      fullName: 'asc',
    },
  });
}
