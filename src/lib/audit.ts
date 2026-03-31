import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

export async function logAudit(opts: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId ?? null,
        metadata: opts.metadata ? (opts.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: opts.ipAddress ?? null,
      },
    });
  } catch (e) {
    // Never let audit logging break the main flow
    console.error('Audit log error:', e);
  }
}
