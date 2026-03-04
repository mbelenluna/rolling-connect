import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import CompleteRegistrationClient from '@/app/client/complete-registration/CompleteRegistrationClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CompleteRegistrationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as { role?: string }).role;
  if (role !== 'client') redirect('/');

  return <CompleteRegistrationClient />;
}
