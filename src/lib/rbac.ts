import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { redirect } from 'next/navigation';

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

export function getRoleRedirect(role: string): string {
  switch (role) {
    case 'admin': return '/admin';
    case 'interpreter': return '/interpreter';
    case 'client': return '/client';
    default: return '/login';
  }
}
