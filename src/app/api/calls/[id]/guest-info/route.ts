import { NextResponse } from 'next/server';

/**
 * GET /api/calls/[id]/guest-info
 * Public endpoint: returns call metadata for guest join page (no auth required).
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { prisma } = await import('@/lib/prisma');
  const { id: callId } = await params;

  const call = await prisma.call.findFirst({
    where: { id: callId },
    include: { job: { include: { request: true } } },
  });

  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (call.durationSeconds != null) return NextResponse.json({ error: 'Call has ended' }, { status: 410 });

  return NextResponse.json({
    serviceType: call.job.request.serviceType,
    sourceLanguage: call.job.request.sourceLanguage ?? 'en',
    targetLanguage: call.job.request.targetLanguage ?? 'es',
  });
}
