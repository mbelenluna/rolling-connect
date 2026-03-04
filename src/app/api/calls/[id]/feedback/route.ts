import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const clientSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().optional(),
});

const interpreterSchema = z.object({
  interpreterNotes: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const role = (session.user as { role?: string }).role;

  const call = await prisma.call.findFirst({
    where: { id },
    include: { job: { include: { request: true } } },
  });

  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userId = (session.user as { id?: string }).id;
  const isInterpreter = call.job.assignedInterpreterId === userId;
  const isClient = call.job.request.createdByUserId === userId;

  if (role === 'client' && isClient) {
    const parseResult = clientSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }
    const { rating, comments } = parseResult.data;
    await prisma.call.update({
      where: { id },
      data: { clientRating: rating, clientComments: comments },
    });
  } else if (role === 'interpreter' && isInterpreter) {
    const { interpreterNotes } = interpreterSchema.parse(body);
    await prisma.call.update({
      where: { id },
      data: { interpreterNotes },
    });
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
