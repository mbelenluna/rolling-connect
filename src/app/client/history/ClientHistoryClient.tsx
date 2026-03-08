'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { clientChargeCents, formatCents } from '@/lib/billing';
import { jsPDF } from 'jspdf';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';
import DateRangePicker from '@/components/DateRangePicker';

type Request = {
  id: string;
  status: string;
  serviceType: string;
  interpretationType?: 'human' | 'ai';
  sourceLanguage: string;
  targetLanguage: string;
  specialty: string;
  createdAt: string;
  jobs: {
    assignedInterpreter?: { name: string };
    call?: {
      id?: string;
      durationSeconds?: number;
      billableDurationSeconds?: number;
      startedAt?: string | null;
      endedAt?: string | null;
      clientRating?: number | null;
      clientComments?: string | null;
    };
  }[];
};

function formatDateLabel(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ClientHistoryClient() {
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
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

  const fetchRequests = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ status: 'completed' });
    if (startDate) {
      params.set('startDate', startDate);
      params.set('endDate', endDate || startDate);
    }
    fetch(`/api/requests?${params}`)
      .then((r) => r.json())
      .then(setRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  useEffect(() => {
    fetchRequests();
  }, []); // Initial load only; Apply filter button triggers refetch

  const totalCents = requests.reduce((sum, r) => {
    const job = r.jobs?.find((j) => j.call) ?? r.jobs?.[0];
    const duration = job?.call?.billableDurationSeconds ?? job?.call?.durationSeconds ?? 0;
    return sum + (duration > 0 ? clientChargeCents(duration, r.targetLanguage, r.interpretationType ?? 'human') : 0);
  }, 0);

  const downloadPdf = async () => {
    if (requests.length === 0) return;
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

      // Report period
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const periodLabel = startDate && endDate
        ? startDate === endDate
          ? formatDateLabel(startDate)
          : `${formatDateLabel(startDate)} – ${formatDateLabel(endDate)}`
        : 'All time';
      doc.text(`Call History Report — ${periodLabel}`, 14, y);
      y += 12;

      // Table header (use ASCII-only for Service to avoid jsPDF encoding issues)
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Call ID', 14, y);
      doc.text('Date', 38, y);
      doc.text('Started', 58, y);
      doc.text('Service', 88, y);
      doc.text('Dur', 118, y);
      doc.text('Interpreter', 128, y);
      doc.text('Charge', 168, y);
      y += 6;

      doc.setDrawColor(200, 200, 200);
      doc.line(14, y, 196, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      for (const r of requests) {
        const job = r.jobs?.find((j) => j.call) ?? r.jobs?.[0];
        const call = job?.call;
        const duration = call?.billableDurationSeconds ?? call?.durationSeconds ?? 0;
        const mins = duration ? Math.ceil(duration / 60) : 0;
        const charge = duration > 0 ? clientChargeCents(duration, r.targetLanguage, r.interpretationType ?? 'human') : 0;
        const dateStr = call?.endedAt
          ? new Date(call.endedAt).toLocaleDateString()
          : new Date(r.createdAt).toLocaleDateString();
        const startedAt = call?.startedAt
          ? new Date(call.startedAt)
          : call?.endedAt && duration
            ? new Date(new Date(call.endedAt).getTime() - duration * 1000)
            : null;
        const startedStr = startedAt
          ? startedAt.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '-';
        const callId = call?.id ? call.id.slice(0, 8) : '—';
        // Use "to" instead of arrow - jsPDF has issues with Unicode arrow
        const serviceStr = `${r.serviceType} ${r.sourceLanguage} to ${r.targetLanguage}`;

        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.text(callId, 14, y);
        doc.text(dateStr, 38, y);
        doc.text(startedStr, 58, y);
        doc.text(serviceStr, 88, y);
        doc.text(`${mins}m`, 118, y);
        doc.text((job?.assignedInterpreter?.name ?? '-').slice(0, 12), 128, y);
        doc.text(charge > 0 ? formatCents(charge) : '-', 168, y);
        y += 6;
      }

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('Total:', 140, y);
      doc.text(formatCents(totalCents), 168, y);

      const filename = startDate && endDate
        ? `rolling-translations-report-${startDate}-${endDate}.pdf`
        : 'rolling-translations-report.pdf';
      doc.save(filename);
    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('billingPageTitle')}</h1>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onRangeChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
          startLabel={t('startDate')}
          endLabel={t('endDate')}
          selectHint={t('dateRangeHint')}
        />
        <button
          onClick={fetchRequests}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium"
        >
          {t('applyFilter')}
        </button>
        {(startDate || endDate) && (
          <button
            onClick={() => {
              setStartDate(null);
              setEndDate(null);
              setLoading(true);
              fetch(`/api/requests?status=completed`)
                .then((r) => r.json())
                .then(setRequests)
                .catch(console.error)
                .finally(() => setLoading(false));
            }}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm"
          >
            {t('clearDates')}
          </button>
        )}
        <button
          onClick={downloadPdf}
          disabled={pdfLoading || requests.length === 0}
          className="px-4 py-2 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {pdfLoading ? t('generating') : t('downloadPdfReport')}
        </button>
      </div>

      {totalCents > 0 && (
        <p className="text-slate-600 mb-4">
          {t('totalForPeriod')} <strong>{formatCents(totalCents)}</strong>
        </p>
      )}

      <div className="space-y-4">
        {loading ? (
          <p className="text-slate-600">{t('loading')}</p>
        ) : requests.length === 0 ? (
          <p className="text-slate-500">{t('noCompletedCalls')}</p>
        ) : (
          requests.map((r) => {
            const job = r.jobs?.find((j) => j.call) ?? r.jobs?.[0];
            const duration = job?.call?.billableDurationSeconds ?? job?.call?.durationSeconds ?? 0;
            const mins = duration ? Math.ceil(duration / 60) : 0;
            const charge = duration > 0 ? clientChargeCents(duration, r.targetLanguage, r.interpretationType ?? 'human') : 0;
            const rating = job?.call?.clientRating;
            const comments = job?.call?.clientComments;
            return (
              <div key={r.id} className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {r.serviceType} — {r.sourceLanguage} → {r.targetLanguage} ({r.specialty})
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {job?.assignedInterpreter?.name ?? '—'} • {mins} min • {new Date(r.createdAt).toLocaleString()}
                    </p>
                    {(rating != null || comments) && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        {rating != null && (
                          <p className="text-sm text-slate-700">
                            <span className="text-amber-500">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
                            {rating}/5
                          </p>
                        )}
                        {comments && <p className="text-sm text-slate-600 mt-1">{comments}</p>}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">{charge > 0 ? formatCents(charge) : '—'}</p>
                    <p className="text-xs text-slate-500">{t('charge')}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
