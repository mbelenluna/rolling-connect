import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateClientId } from '@/lib/client-id';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id;
  const email = (session.user as { email?: string })?.email ?? '';
  const name = (session.user as { name?: string })?.name ?? 'User';

  let memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true },
  });

  // Clients must have at least one organization to place requests. Auto-create if missing.
  if (role === 'client' && memberships.length === 0) {
    const phoneClientId = await generateClientId();
    const org = await prisma.organization.create({
      data: {
        name: `${name}'s Organization`,
        billingEmail: email || undefined,
        phoneClientId,
      },
    });
    await prisma.organizationMember.create({
      data: { organizationId: org.id, userId: userId!, role: 'owner' },
    });
    return NextResponse.json([org]);
  }

  return NextResponse.json(memberships.map((m) => m.organization));
}
