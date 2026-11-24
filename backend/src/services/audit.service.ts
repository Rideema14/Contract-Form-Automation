import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type AuditLogClient = Pick<Prisma.TransactionClient, 'auditLog'>;

export interface AuditEventInput {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  contractFormId?: string;
  details?: Prisma.InputJsonValue;
}

export function recordAuditEvent(client: AuditLogClient, event: AuditEventInput) {
  return client.auditLog.create({ data: event });
}

export interface AuditHistoryQuery {
  page: number;
  pageSize: number;
  q?: string;
}

export async function listAuditHistory(query: AuditHistoryQuery) {
  const where: Prisma.AuditLogWhereInput = query.q
    ? {
        OR: [
          { action: { contains: query.q, mode: 'insensitive' } },
          { entityType: { contains: query.q, mode: 'insensitive' } },
          { entityId: { contains: query.q, mode: 'insensitive' } },
          { actor: { is: { fullName: { contains: query.q, mode: 'insensitive' } } } },
          { actor: { is: { email: { contains: query.q, mode: 'insensitive' } } } },
          { contractForm: { is: { title: { contains: query.q, mode: 'insensitive' } } } },
          { contractForm: { is: { referenceNo: { contains: query.q, mode: 'insensitive' } } } },
        ],
      }
    : {};

  const [items, totalItems] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        actorId: true,
        action: true,
        entityType: true,
        entityId: true,
        contractFormId: true,
        details: true,
        createdAt: true,
        actor: { select: { fullName: true, email: true } },
        contractForm: { select: { title: true, referenceNo: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    },
  };
}
