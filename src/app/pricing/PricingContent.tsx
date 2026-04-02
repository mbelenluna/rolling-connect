'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';
import { CLIENT_PRICING_TABLE, formatCents } from '@/lib/billing-rates';

export default function PricingContent() {
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="mb-8">
        <Link href="/" className="text-brand-600 hover:underline font-medium text-sm mb-4 inline-block">
          ← {t('backToHome')}
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{t('pricingTitle')}</h1>
        <p className="text-slate-600">{t('pricingSubtitle')}</p>
      </div>

      {/* Enterprise notice */}
      <div className="mb-6 flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800 mb-0.5">Enterprise or high-volume client?</p>
          <p className="text-sm text-amber-700">
            The rates below apply to standard pay-as-you-go accounts. If your organization requires a
            contract, volume pricing, or dedicated interpreter pools,{' '}
            <a
              href="mailto:info@rolling-translations.com"
              className="font-semibold underline underline-offset-2 hover:text-amber-900 transition"
            >
              contact us at info@rolling-translations.com
            </a>{' '}
            and we will work with you on a customized agreement with preferred rates.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('pricingLanguage')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('pricingInterpretation')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">{t('pricingOPI')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">{t('pricingVRI')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">{t('pricingMinimum')}</th>
              </tr>
            </thead>
            <tbody>
              {CLIENT_PRICING_TABLE.map((row) => (
                <tr
                  key={`${row.language}-${row.interpretationType}`}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition"
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.language}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{row.interpretationType}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 text-right">
                    ${(row.opiPerMin / 100).toFixed(2)}/min
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700 text-right">
                    ${(row.vriPerMin / 100).toFixed(2)}/min
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700 text-right">
                    {formatCents(row.minimumCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-6 text-slate-500 text-sm">{t('pricingNote')}</p>

      <div className="mt-10">
        <Link
          href="/login?register=1"
          className="inline-flex px-6 py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition"
        >
          {t('getStarted')}
        </Link>
      </div>
    </main>
  );
}
