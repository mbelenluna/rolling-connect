import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRoleRedirect } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id;

  if (role === 'client' && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailConfirmedAt: true,
        approvedAt: true,
        registrationPath: true,
        subscriptionStatus: true,
      },
    });
    if (!user?.emailConfirmedAt) redirect('/verify-email');
    if (user.emailConfirmedAt && !user.approvedAt && !user.registrationPath) {
      redirect('/complete-registration');
    }
    // Contract submitted, pending approval: show complete-registration (pending view), not /subscribe
    if (user.registrationPath === 'contract' && !user.approvedAt) {
      redirect('/complete-registration');
    }
    if (user.subscriptionStatus !== 'ACTIVE') redirect('/subscribe');
  }

  if (role === 'interpreter' && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { approvedAt: true },
    });
    if (user?.approvedAt == null) redirect('/subscribe');
  }

  redirect(getRoleRedirect(role || ''));
}
