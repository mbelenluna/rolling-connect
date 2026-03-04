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
      select: { emailConfirmedAt: true, approvedAt: true, registrationPath: true },
    });
    if (user?.emailConfirmedAt && !user.approvedAt && !user.registrationPath) {
      redirect('/client/complete-registration');
    }
  }

  redirect(getRoleRedirect(role || ''));
}
