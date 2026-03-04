import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendContractDetailsToAdmin } from '@/lib/email';
import { z } from 'zod';

const schema = z.object({ contractDetails: z.string().min(1) });

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { contractDetails } = schema.parse(body);

  const userId = (session.user as { id?: string }).id;
  const email = session.user.email;
  const name = session.user.name;
  if (!userId || !email || !name) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.user.update({
    where: { id: userId },
    data: { registrationPath: 'contract' },
  });

  await sendContractDetailsToAdmin(email, name, contractDetails);

  return NextResponse.json({ ok: true });
}
