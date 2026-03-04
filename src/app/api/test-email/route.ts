import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';

/**
 * GET /api/test-email?to=your@email.com
 * Sends a test welcome email to verify SendGrid is configured.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get('to');
  if (!to || !to.includes('@')) {
    return NextResponse.json(
      { error: 'Add ?to=your@email.com to the URL to send a test email' },
      { status: 400 }
    );
  }

  const result = await sendWelcomeEmail(to, 'Test User');
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, message: `Test email sent to ${to}` });
}
