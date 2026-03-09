import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Permanently delete a user. Their account is removed; they must re-register to use the system again. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: userId } = await params;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Prevent deleting admins
    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Cannot delete admin users' }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // Unassign interpreter from any jobs (Job has no onDelete for assignedInterpreter)
      await tx.job.updateMany({
        where: { assignedInterpreterId: userId },
        data: { assignedInterpreterId: null },
      });

      // Clear audit log user reference (AuditLog has optional userId, no cascade)
      await tx.auditLog.updateMany({
        where: { userId },
        data: { userId: null },
      });

      // GoCardlessRedirectSession has userId without User relation - delete manually
      try {
        await tx.goCardlessRedirectSession.deleteMany({ where: { userId } });
      } catch {
        // Model may not exist in some setups
      }

      // Delete user (cascades: OrganizationMember, InterpreterProfile, InterpreterAvailability,
      // InterpretationRequest via createdBy, EmailConfirmationToken, PasswordResetToken)
      await tx.user.delete({ where: { id: userId } });
    });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.error('Admin delete user error:', e);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
