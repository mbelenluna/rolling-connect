'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { formatCents } from '@/lib/billing';
import { jsPDF } from 'jspdf';

type CallRow = {
  id: string;
  requestId: string;
  date: string;
  clientName: string;
  clientEmail: string;
  interpreterName: string;
  interpreterEmail: string;
  languagePair: string;
  durationSeconds: number;
  durationMin: number;
  clientChargeCents: number;
  interpreterPayCents: number;
  monthKey: string;
};

type MonthData = {
  month: string;
  monthLabel: string;
  calls: CallRow[];
  totalClientChargeCents: number;
  totalInterpreterPayCents: number;
};

type FilterOption = { id: string; name: string; email: string };

function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 12; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

export default function AdminReportsPage() {
  const [data, setData] = useState<{
    byMonth: MonthData[];
    clients?: FilterOption[];
    interpreters?: FilterOption[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [interpreterId, setInterpreterId] = useState('');
  const [month, setMonth] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  // Preload logo when page loads so PDF generation is fast (avoids blocking on slow networks/ngrok)
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { logoImageRef.current = img; };
    img.src = '/rolling-translations-logo.png';
    return () => { logoImageRef.current = null; };
  }, []);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (interpreterId) params.set('interpreterId', interpreterId);
    if (month) params.set('month', month);
    setLoading(true);
    fetch(`/api/admin/reports?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clientId, interpreterId, month]);

  const allCalls = useMemo(() => data?.byMonth.flatMap((m) => m.calls) ?? [], [data]);
  const totalClientCharge = useMemo(() => allCalls.reduce((s, c) => s + c.clientChargeCents, 0), [allCalls]);
  const totalInterpreterPay = useMemo(() => allCalls.reduce((s, c) => s + c.interpreterPayCents, 0), [allCalls]);

  const downloadPdf = useCallback(async () => {
    if (!data || allCalls.length === 0) return;
    setPdfLoading(true);
    try {
      const doc = new jsPDF();
      let y = 20;

      // Logo - use preloaded image if ready, otherwise try load with 2s timeout (avoids long waits on slow networks/ngrok)
      try {
        let img: HTMLImageElement | null = logoImageRef.current;
        if (!img?.complete || img.naturalWidth === 0) {
          const loadImg = new Image();
          loadImg.crossOrigin = 'anonymous';
          await Promise.race([
            new Promise<void>((resolve, reject) => {
              loadImg.onload = () => resolve();
              loadImg.onerror = reject;
              loadImg.src = '/rolling-translations-logo.png';
            }),
            new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
          ]);
          img = loadImg;
        }
        if (img?.complete && img.naturalWidth > 0) {
          doc.addImage(img, 'PNG', 14, 10, 24, 24);
        }
      } catch {
        // Logo failed or timed out, continue without
      }

      // Company info
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Rolling Translations LLC', 45, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('1317 Edgewater Dr Suite 1064, Orlando, FL 32804', 45, y);
      y += 5;
      doc.text('(866) 319-6739', 45, y);
      y += 15;

      // Report title with filter context
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const periodLabel = month
        ? new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'All months';
      doc.text(`Billing Report — ${periodLabel}`, 14, y);
      y += 10;

      // Table header
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Date', 14, y);
      doc.text('Client', 38, y);
      doc.text('Interpreter', 78, y);
      doc.text('Language', 118, y);
      doc.text('Dur', 148, y);
      doc.text('Charge', 158, y);
      doc.text('Pay', 178, y);
      y += 6;

      doc.setDrawColor(200, 200, 200);
      doc.line(14, y, 196, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      for (const c of allCalls) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const dateStr = new Date(c.date).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const langStr = c.languagePair.replace(/\s*→\s*/g, ' to ');
        doc.text(dateStr, 14, y);
        doc.text(c.clientName.slice(0, 14), 38, y);
        doc.text(c.interpreterName.slice(0, 14), 78, y);
        doc.text(langStr.slice(0, 12), 118, y);
        doc.text(`${c.durationMin}m`, 148, y);
        doc.text(formatCents(c.clientChargeCents), 158, y);
        doc.text(formatCents(c.interpreterPayCents), 178, y);
        y += 6;
      }

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('Total Client Charges:', 100, y);
      doc.text(formatCents(totalClientCharge), 158, y);
      y += 6;
      doc.text('Total Interpreter Pay:', 100, y);
      doc.text(formatCents(totalInterpreterPay), 178, y);

      const filename = month
        ? `billing-report-${month}.pdf`
        : `billing-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  }, [data, allCalls, totalClientCharge, totalInterpreterPay, month]);

  if (loading && !data) return <div className="text-slate-600">Loading…</div>;
  if (!data) return <div className="text-slate-600">Failed to load reports</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Billing Reports</h1>
      <div className="flex flex-wrap gap-4 mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Client</span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 min-w-[180px]"
          >
            <option value="">All clients</option>
            {(data.clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Interpreter</span>
          <select
            value={interpreterId}
            onChange={(e) => setInterpreterId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 min-w-[180px]"
          >
            <option value="">All interpreters</option>
            {(data.interpreters ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 min-w-[180px]"
          >
            <option value="">All months</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            onClick={downloadPdf}
            disabled={pdfLoading || data.byMonth.length === 0}
            className="px-4 py-2 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pdfLoading ? 'Generating…' : 'Download Report'}
          </button>
        </div>
      </div>
      <p className="text-slate-600 mb-8">
        Client charges: $0.50/min Spanish, $0.90/min other (min $5). Interpreter pay: $0.25/min Spanish, $0.45/min other (min $2.50).
      </p>

      {data.byMonth.length === 0 ? (
        <p className="text-slate-500">No completed calls yet.</p>
      ) : (
        data.byMonth.map((monthData) => (
          <div key={monthData.month} className="mb-12">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">{monthData.monthLabel}</h2>
              <div className="flex gap-6">
                <div className="text-right">
                  <p className="text-sm text-slate-500">Client charges</p>
                  <p className="font-semibold text-slate-900">{formatCents(monthData.totalClientChargeCents)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Interpreter pay</p>
                  <p className="font-semibold text-slate-900">{formatCents(monthData.totalInterpreterPayCents)}</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Client</th>
                    <th className="py-2 pr-4">Interpreter</th>
                    <th className="py-2 pr-4">Language</th>
                    <th className="py-2 pr-4 text-right">Duration</th>
                    <th className="py-2 pr-4 text-right">Charge</th>
                    <th className="py-2 text-right">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {monthData.calls.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4">{new Date(c.date).toLocaleString()}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{c.clientName}</p>
                        <p className="text-xs text-slate-500">{c.clientEmail}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{c.interpreterName}</p>
                        <p className="text-xs text-slate-500">{c.interpreterEmail}</p>
                      </td>
                      <td className="py-3 pr-4">{c.languagePair}</td>
                      <td className="py-3 pr-4 text-right">{c.durationMin} min</td>
                      <td className="py-3 pr-4 text-right">{formatCents(c.clientChargeCents)}</td>
                      <td className="py-3 text-right">{formatCents(c.interpreterPayCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
