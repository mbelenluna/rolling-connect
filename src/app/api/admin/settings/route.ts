import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const banner = await prisma.systemSetting.findUnique({ where: { key: 'system_banner' } });
    return NextResponse.json({ banner: banner?.value ?? '' });
  } catch {
    return NextResponse.json({ banner: '' });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { banner } = await req.json();
  if (typeof banner !== 'string') return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  if (banner.trim() === '') {
    await prisma.systemSetting.deleteMany({ where: { key: 'system_banner' } });
  } else {
    await prisma.systemSetting.upsert({
      where: { key: 'system_banner' },
      update: { value: banner.trim() },
      create: { key: 'system_banner', value: banner.trim() },
    });
  }

  const { logAudit } = await import('@/lib/audit');
  logAudit({ userId: (session?.user as { id?: string })?.id, action: 'banner_changed', entityType: 'system', metadata: { action: banner.trim() === '' ? 'cleared' : 'set', preview: banner.trim().slice(0, 80) } });

  return NextResponse.json({ ok: true });
}
