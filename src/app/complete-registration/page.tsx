import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import CompleteRegistrationClient from '@/app/client/complete-registration/CompleteRegistrationClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CompleteRegistrationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as { role?: string }).role;
  if (role !== 'client') redirect('/');

  const userId = (session.user as { id?: string }).id;
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { registrationPath: true },
      })
    : null;
  const hasSubmittedContract = user?.registrationPath === 'contract';

  return <CompleteRegistrationClient initialStep={hasSubmittedContract ? 'pending' : 'question'} />;
}
