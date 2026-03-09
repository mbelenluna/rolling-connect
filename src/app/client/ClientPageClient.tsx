'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, getTranslatedLanguageName, type TranslationKeys } from '@/lib/translations';
import { CopyButton } from '@/components/CopyButton';
import { IVR_ORDER } from '@/lib/ivr-languages';

function TutorialsSection({ t }: { t: (k: TranslationKeys) => string }) {
  return (
    <section className="mt-12 pt-10 border-t border-slate-200">
      <h2 className="text-xl font-bold text-slate-900 mb-1">{t('tutorialsTitle')}</h2>
      <p className="text-slate-600 mb-6">{t('tutorialsSubtitle')}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">{t('guideRequestTitle')}</h3>
          <ol className="list-decimal list-inside space-y-2 text-slate-600 text-sm">
            <li>{t('guideRequestStep1')}</li>
            <li>{t('guideRequestStep2')}</li>
            <li>{t('guideRequestStep3')}</li>
            <li>{t('guideRequestStep4')}</li>
            <li>{t('guideRequestStep5')}</li>
          </ol>
        </div>

        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">{t('guideJoinTitle')}</h3>
          <ol className="list-decimal list-inside space-y-2 text-slate-600 text-sm">
            <li>{t('guideJoinStep1')}</li>
            <li>{t('guideJoinStep2')}</li>
            <li>{t('guideJoinStep3')}</li>
            <li>{t('guideJoinStep4')}</li>
          </ol>
        </div>

        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">{t('guideAiTitle')}</h3>
          <p className="text-slate-600 text-sm">{t('guideAiContent')}</p>
        </div>

        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">{t('guidePauseTitle')}</h3>
          <p className="text-slate-600 text-sm">{t('guidePauseContent')}</p>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="font-semibold text-slate-900 mb-4">{t('faqTitle')}</h3>
        <div className="space-y-3">
          <details className="group p-4 bg-slate-50 rounded-xl border border-slate-200">
            <summary className="font-medium text-slate-900 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              {t('faq1Q')}
            </summary>
            <p className="mt-2 text-slate-600 text-sm">{t('faq1A')}</p>
          </details>
          <details className="group p-4 bg-slate-50 rounded-xl border border-slate-200">
            <summary className="font-medium text-slate-900 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              {t('faq2Q')}
            </summary>
            <p className="mt-2 text-slate-600 text-sm">{t('faq2A')}</p>
          </details>
          <details className="group p-4 bg-slate-50 rounded-xl border border-slate-200">
            <summary className="font-medium text-slate-900 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              {t('faq3Q')}
            </summary>
            <p className="mt-2 text-slate-600 text-sm">{t('faq3A')}</p>
          </details>
          <details className="group p-4 bg-slate-50 rounded-xl border border-slate-200">
            <summary className="font-medium text-slate-900 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              {t('faq4Q')}
            </summary>
            <p className="mt-2 text-slate-600 text-sm">
              {t('faq4ABefore')}
              <Link href="/client/history" className="text-brand-600 hover:underline font-medium">
                {t('faq4ALink')}
              </Link>
              {t('faq4AAfter')}
            </p>
          </details>
          <details className="group p-4 bg-slate-50 rounded-xl border border-slate-200">
            <summary className="font-medium text-slate-900 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              {t('faq5Q')}
            </summary>
            <p className="mt-2 text-slate-600 text-sm">{t('faq5A')}</p>
          </details>
        </div>
      </div>
    </section>
  );
}

export default function ClientPageClient() {
  const { locale } = useLanguage();
  const searchParams = useSearchParams();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const billingSuccess = searchParams.get('billing') === 'success';
  const [approvalStatus, setApprovalStatus] = useState<{
    approved: boolean;
    rejected: boolean;
    pending: boolean;
  } | null>(null);
  const [orgs, setOrgs] = useState<{ id: string; name: string; phoneClientId?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client/approval-status')
      .then((r) => r.json())
      .then(setApprovalStatus)
      .catch(() => setApprovalStatus({ approved: false, rejected: false, pending: true }));
  }, []);

  useEffect(() => {
    fetch('/api/organizations')
      .then((r) => r.json())
      .then((data) => setOrgs(Array.isArray(data) ? data : []))
      .catch(() => setOrgs([]));
  }, []);

  useEffect(() => {
    if (approvalStatus !== null) setLoading(false);
  }, [approvalStatus]);

  if (loading) return <div className="text-slate-600">{t('loading')}</div>;

  if (approvalStatus?.pending || approvalStatus?.rejected) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('clientDashboard')}</h1>
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl max-w-2xl">
          <h2 className="font-semibold text-amber-900 mb-2">{t('accountPendingApproval')}</h2>
          <p className="text-amber-800">{t('accountPendingMessage')}</p>
        </div>
        <Link
          href="/client/requests"
          className="inline-block mt-6 text-slate-600 hover:text-slate-900 underline"
        >
          {t('viewYourRequests')}
        </Link>

        {/* Tutorials & How-to Guides (also shown when pending) */}
        <TutorialsSection t={t} />
      </div>
    );
  }

  return (
    <div>
      {billingSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-800 font-medium">{t('gocardlessCompleteTitle')}</p>
          <p className="text-green-700 text-sm mt-1">{t('gocardlessCompleteMessage')}</p>
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('clientDashboard')}</h1>
        <p className="text-slate-600 mt-1">{t('clientDashboardSubtitle')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/client/request"
          className="block p-8 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition shadow-lg"
        >
          <h2 className="text-xl font-bold mb-2">{t('requestInterpreterNow')}</h2>
          <p className="opacity-90">{t('getConnectedInSeconds')}</p>
        </Link>

        <Link
          href="/client/requests"
          className="block p-8 bg-white rounded-xl border border-slate-200 hover:border-brand-300 transition"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-2">{t('activeRequests')}</h2>
          <p className="text-slate-600">{t('viewStatusOfRequests')}</p>
        </Link>
      </div>

      {orgs.some((o) => o.phoneClientId) && (
        <div className="mt-8 p-6 bg-white rounded-xl border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-1">{t('phoneAccessTitle')}</h2>
          <p className="text-slate-600 text-sm mb-4">{t('phoneAccessSubtitle')}</p>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-700 font-medium">{t('phoneAccessCallLabel')}:</span>
              <a
                href="tel:+16894007175"
                className="text-brand-600 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded"
                aria-label={`Call ${t('phoneNumber')} for phone interpretation`}
              >
                {t('phoneNumber')}
              </a>
              <CopyButton
                text={t('phoneNumber')}
                label={t('phoneAccessCopyPhone')}
                copiedLabel={t('phoneAccessCopied')}
              />
            </div>
            {orgs[0]?.phoneClientId && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-700 font-medium">{t('phoneAccessClientIdLabel')}:</span>
                <span className="font-mono font-semibold text-slate-900">{orgs[0].phoneClientId}</span>
                <CopyButton
                  text={orgs[0].phoneClientId}
                  label={t('phoneAccessCopyId')}
                  copiedLabel={t('phoneAccessCopied')}
                />
              </div>
            )}
            <p className="text-slate-600 text-sm">{t('phoneAccessClientIdHint')}</p>
            <div className="mt-6 pt-4 border-t border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">{t('phoneAccessLangTableTitle')}</h3>
              <p className="text-slate-600 text-sm mb-3">{t('phoneAccessLangTableHint')}</p>
              <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-900">{t('phoneAccessLangTableLang')}</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-900 w-16">{t('phoneAccessLangTablePress')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {IVR_ORDER.map((lang) => (
                      <tr key={lang.code} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 text-slate-700">{getTranslatedLanguageName(locale, lang.code, lang.name)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-brand-600">{lang.digit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <TutorialsSection t={t} />
    </div>
  );
}
