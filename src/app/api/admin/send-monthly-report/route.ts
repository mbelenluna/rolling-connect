import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sgMail from '@sendgrid/mail';

export const dynamic = 'force-dynamic';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { month, year } = await req.json(); // e.g. { month: 4, year: 2025 }
  if (!month || !year) return NextResponse.json({ error: 'month and year are required' }, { status: 400 });

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 1);

  // Fetch all completed calls in the period with billing info
  const calls = await prisma.call.findMany({
    where: {
      startedAt: { gte: periodStart, lt: periodEnd },
      endedAt: { not: null },
    },
    include: {
      job: {
        include: {
          request: {
            include: {
              organization: { select: { id: true, name: true, billingEmail: true } },
              createdBy: { select: { name: true } },
            },
          },
          assignedInterpreter: { select: { name: true } },
        },
      },
    },
    orderBy: { startedAt: 'asc' },
  });

  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });
  const reportTitle = `Rolling Connect – ${monthName} ${year} Usage Report`;

  // Group by organization
  const orgMap = new Map<string, { orgName: string; billingEmail: string; rows: typeof calls }>();
  for (const call of calls) {
    const org = call.job.request.organization;
    if (!orgMap.has(org.id)) {
      orgMap.set(org.id, { orgName: org.name, billingEmail: org.billingEmail ?? '', rows: [] });
    }
    orgMap.get(org.id)!.rows.push(call);
  }

  // Build PDF using jsPDF
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(18);
  doc.text(reportTitle, 40, 40);
  doc.setFontSize(11);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 40, 58);

  let yOffset = 80;

  const formatMins = (secs: number | null | undefined): string => {
    if (!secs) return '0m';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  type CallEntry = typeof calls[number];

  const orgEntries = Array.from(orgMap.entries());
  for (const [, { orgName, rows }] of orgEntries) {
    if (yOffset > 500) { doc.addPage(); yOffset = 40; }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(orgName, 40, yOffset);
    yOffset += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const totalBillableSecs = rows.reduce((sum: number, c: CallEntry) => sum + (c.billableDurationSeconds ?? c.durationSeconds ?? 0), 0);

    doc.text(`Sessions: ${rows.length}  |  Total Billable: ${formatMins(totalBillableSecs)}`, 40, yOffset);
    yOffset += 16;

    // Column headers
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 40, yOffset);
    doc.text('Service', 120, yOffset);
    doc.text('Language', 170, yOffset);
    doc.text('Specialty', 280, yOffset);
    doc.text('Interpreter', 390, yOffset);
    doc.text('Duration', 510, yOffset);
    yOffset += 4;
    doc.setDrawColor(180, 180, 180);
    doc.line(40, yOffset, 590, yOffset);
    yOffset += 10;
    doc.setFont('helvetica', 'normal');

    for (const c of rows as CallEntry[]) {
      if (yOffset > 560) { doc.addPage(); yOffset = 40; }
      doc.text(c.startedAt ? new Date(c.startedAt).toLocaleDateString('en-US') : '', 40, yOffset);
      doc.text(c.job.request.serviceType, 120, yOffset);
      doc.text(`${c.job.request.sourceLanguage}→${c.job.request.targetLanguage}`, 170, yOffset);
      doc.text((c.job.request.specialty ?? '').slice(0, 20), 280, yOffset);
      doc.text((c.job.assignedInterpreter?.name ?? '').slice(0, 22), 390, yOffset);
      doc.text(formatMins(c.billableDurationSeconds ?? c.durationSeconds), 510, yOffset);
      yOffset += 14;
    }
    yOffset += 12;
  }

  if (orgMap.size === 0) {
    doc.setFontSize(12);
    doc.text('No completed calls found for this period.', 40, yOffset);
  }

  const pdfBase64 = doc.output('datauristring').split(',')[1];
  const filename = `rolling-connect-report-${year}-${String(month).padStart(2, '0')}.pdf`;

  if (!process.env.SENDGRID_API_KEY) {
    return NextResponse.json({ ok: false, error: 'SENDGRID_API_KEY not configured' }, { status: 500 });
  }

  // Collect all unique billing emails
  const billingEmails = Array.from(
    new Set(
      Array.from(orgMap.values())
        .map((o) => o.billingEmail)
        .filter(Boolean)
    )
  );

  // Also always send to admin email
  const adminEmail = 'info@rolling-translations.com';
  const recipients = Array.from(new Set([adminEmail, ...billingEmails]));

  try {
    await sgMail.send({
      to: recipients,
      from: 'Rolling Translations <info@rolling-translations.com>',
      replyTo: 'info@rolling-translations.com',
      subject: reportTitle,
      html: `<p>Please find attached the Rolling Connect usage report for <strong>${monthName} ${year}</strong>.</p><p>This report covers all completed interpretation sessions during this period.</p><p>Kind regards,<br>Rolling Translations<br>Rolling Connect Team</p>`,
      attachments: [
        {
          content: pdfBase64,
          filename,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    });
    return NextResponse.json({ ok: true, sentTo: recipients.length, filename });
  } catch (err) {
    console.error('Send monthly report error:', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Failed to send' }, { status: 500 });
  }
}
