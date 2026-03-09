import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    const { prisma } = await import('@/lib/prisma');
    const { completeRedirectFlow } = await import('@/lib/gocardless');

    const url = new URL(req.url);
    const redirectFlowId = url.searchParams.get('redirect_flow_id') || url.searchParams.get('redirectFlowId');
    if (!redirectFlowId) {
      redirect('/subscribe?error=missing_flow_id');
    }

    // Look up by redirectFlowId only - session may be lost when redirecting from GoCardless (cross-domain)
    const redirectSession = await prisma.goCardlessRedirectSession.findFirst({
      where: { redirectFlowId, completedAt: null },
    });

    if (!redirectSession) {
      // Flow may already be completed - check if user has ACTIVE subscription
      const completed = await prisma.goCardlessRedirectSession.findFirst({
        where: { redirectFlowId },
      });
      if (completed) {
        const user = await prisma.user.findUnique({
          where: { id: completed.userId },
          select: { subscriptionStatus: true, role: true },
        });
        if (user?.subscriptionStatus === 'ACTIVE') {
          const target = user.role === 'client' ? '/client' : user.role === 'interpreter' ? '/interpreter' : '/dashboard';
          redirect(`${target}?billing=success`);
        }
      }
      redirect('/subscribe?error=invalid_flow');
    }

    const userId = redirectSession.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const role = user?.role;

    let customerId: string;
    let mandateId: string;
    let bankAccountId: string;

    try {
      const result = await completeRedirectFlow({
        redirectFlowId,
        sessionToken: redirectSession.sessionToken,
      });
      customerId = result.customerId;
      mandateId = result.mandateId;
      bankAccountId = result.bankAccountId;
    } catch (apiErr) {
      const apiMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      const alreadyCompleted = /already completed|already_completed/i.test(apiMsg);
      if (alreadyCompleted) {
        const activeUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { subscriptionStatus: true, role: true },
        });
        if (activeUser?.subscriptionStatus === 'ACTIVE') {
          const target = activeUser.role === 'client' ? '/client' : activeUser.role === 'interpreter' ? '/interpreter' : '/dashboard';
          redirect(`${target}?billing=success`);
        }
      }
      console.error('Billing confirm completeRedirectFlow error:', apiMsg, apiErr);
      redirect(`/subscribe?error=confirm_failed&errorDetail=${encodeURIComponent(apiMsg.slice(0, 100))}`);
    }
    // Billing state transition: reauthorization complete → active, clear disabled fields
    await prisma.user.update({
      where: { id: userId },
      data: {
        goCardlessCustomerId: customerId,
        goCardlessMandateId: mandateId,
        goCardlessBankAccountId: bankAccountId,
        subscriptionStatus: 'ACTIVE',
        billingDisabledAt: null,
        billingDisabledReason: null,
        ...(role === 'client' && { approvedAt: new Date(), registrationPath: 'gocardless' }),
      },
    });

    await prisma.goCardlessRedirectSession.update({
      where: { id: redirectSession.id },
      data: { completedAt: new Date() },
    });

    const target = role === 'client' ? '/client' : role === 'interpreter' ? '/interpreter' : '/dashboard';
    const session = await getServerSession(authOptions);
    const hasSession = session?.user && (session.user as { id?: string }).id === userId;

    if (hasSession) {
      redirect(`${target}?billing=success`);
    }
    // Session lost (e.g. different device) - redirect to login; user can sign in to access
    redirect(`/login?message=payment_setup_complete&callbackUrl=${encodeURIComponent(target)}`);
  } catch (err) {
    const e = err as { digest?: string; message?: string };
    if (e?.digest?.startsWith('NEXT_REDIRECT') || e?.message === 'NEXT_REDIRECT') throw err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Billing confirm error:', msg, err);
    redirect(`/subscribe?error=confirm_failed&errorDetail=${encodeURIComponent(msg.slice(0, 100))}`);
  }
}
