import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRoleRedirect } from '@/lib/rbac';
import HomeContent from './HomeContent';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const role = (session.user as { role?: string }).role;
    redirect(getRoleRedirect(role || ''));
  }

  return <HomeContent />;
}
