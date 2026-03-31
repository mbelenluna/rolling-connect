import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** GET — return current MFA status for the logged-in user */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { mfaEnabled: true } });
  return NextResponse.json({ mfaEnabled: user?.mfaEnabled ?? false });
}

/** POST — enable or disable MFA for the logged-in user */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { enabled } = await req.json();
  if (typeof enabled !== 'boolean') return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: enabled } });
  if (!enabled) await prisma.mfaCode.deleteMany({ where: { userId } });

  return NextResponse.json({ ok: true, mfaEnabled: enabled });
}
