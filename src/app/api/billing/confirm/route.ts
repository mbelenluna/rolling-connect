import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    const { prisma } = await import('@/lib/prisma');
    const { completeRedirectFlow } = await import('@/lib/gocardless');

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      redirect('/login?message=billing_confirm');
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) redirect('/login');

    const url = new URL(req.url);
    const redirectFlowId = url.searchParams.get('redirect_flow_id');
    if (!redirectFlowId) {
      redirect('/subscribe?error=missing_flow_id');
    }

    const redirectSession = await prisma.goCardlessRedirectSession.findFirst({
      where: {
        redirectFlowId,
        userId,
        completedAt: null,
      },
    });

    if (!redirectSession) {
      redirect('/subscribe?error=invalid_flow');
    }

    const { customerId, mandateId, bankAccountId } = await completeRedirectFlow({
      redirectFlowId,
      sessionToken: redirectSession.sessionToken,
    });

    const role = (session.user as { role?: string }).role;
    await prisma.user.update({
      where: { id: userId },
      data: {
        goCardlessCustomerId: customerId,
        goCardlessMandateId: mandateId,
        goCardlessBankAccountId: bankAccountId,
        subscriptionStatus: 'ACTIVE',
        ...(role === 'client' && { approvedAt: new Date(), registrationPath: 'gocardless' }),
      },
    });

    await prisma.goCardlessRedirectSession.update({
      where: { id: redirectSession.id },
      data: { completedAt: new Date() },
    });

    const target = role === 'client' ? '/client' : role === 'interpreter' ? '/interpreter' : '/dashboard';
    redirect(`${target}?billing=success`);
  } catch (err) {
    console.error('Billing confirm error:', err);
    redirect('/subscribe?error=confirm_failed');
  }
}
