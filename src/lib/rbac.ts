import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';

export type Role = 'client' | 'interpreter' | 'admin';

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  return session;
}

export async function requireRole(allowed: Role | Role[]) {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role;
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];
  if (!role || !allowedRoles.includes(role as Role)) {
    redirect('/unauthorized');
  }
  return session;
}

/**
 * Require auth + role + active subscription (admin bypasses billing).
 * Redirects to /subscribe if subscription not ACTIVE.
 */
export async function requireBilling(allowed: Role | Role[]) {
  const session = await requireRole(allowed);
  const role = (session.user as { role?: string }).role;
  if (role === 'admin') return session;

  const userId = (session.user as { id?: string }).id;
  if (!userId) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true },
  });

  if (!user || user.subscriptionStatus !== 'ACTIVE') {
    redirect('/subscribe');
  }
  return session;
}

export function getRoleRedirect(role: string): string {
  switch (role) {
    case 'admin': return '/admin';
    case 'interpreter': return '/interpreter';
    case 'client': return '/client';
    default: return '/login';
  }
}
