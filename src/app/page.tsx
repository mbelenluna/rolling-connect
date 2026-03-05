import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRoleRedirect } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import HomeContent from './HomeContent';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const role = (session.user as { role?: string }).role;
    const userId = (session.user as { id?: string }).id;
    // Only redirect to dashboard if user has full access (ACTIVE subscription for clients/interpreters)
    if (role === 'admin') redirect(getRoleRedirect(role));
    if (role === 'client' && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionStatus: true },
      });
      if (user?.subscriptionStatus === 'ACTIVE') redirect(getRoleRedirect(role));
    }
    if (role === 'interpreter' && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionStatus: true },
      });
      if (user?.subscriptionStatus === 'ACTIVE') redirect(getRoleRedirect(role));
    }
    // Clients/interpreters without ACTIVE subscription see the landing page
  }

  return <HomeContent />;
}
