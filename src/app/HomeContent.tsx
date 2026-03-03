'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

function t(locale: 'en' | 'es' | 'zh', key: TranslationKeys) {
  return getTranslation(locale, key);
}

export default function HomeContent() {
  const { locale } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/rolling-translations-logo.png"
              alt="Rolling Translations"
              width={44}
              height={44}
              className="rounded-full"
            />
            <span className="text-xl font-semibold text-slate-900">{t(locale, 'siteName')}</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <div className="flex gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-slate-700 font-medium hover:text-slate-900 transition"
              >
                {t(locale, 'signIn')}
              </Link>
              <Link
                href="/login?register=1"
                className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition"
              >
                {t(locale, 'register')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 via-white to-slate-50" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            {t(locale, 'heroTitle')}
            <br />
            <span className="text-brand-600">{t(locale, 'heroTitleHighlight')}</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
            {t(locale, 'heroSubtitle')}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/login?register=1"
              className="px-8 py-4 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/25"
            >
              {t(locale, 'getStarted')}
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:border-slate-300 hover:bg-white transition"
            >
              {t(locale, 'signIn')}
            </Link>
          </div>
        </div>
      </section>

      {/* OPI Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-600/10 text-brand-600 text-sm font-medium mb-4">
                {t(locale, 'opiBadge')}
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">{t(locale, 'opiTitle')}</h2>
              <p className="text-slate-600 mb-4">{t(locale, 'opiDesc')}</p>
              <ul className="space-y-2 text-slate-600 list-none">
                <li className="flex items-baseline gap-2">
                  <span className="text-brand-600 shrink-0">•</span>
                  <span>{t(locale, 'opiBullet1')}</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="text-brand-600 shrink-0">•</span>
                  <span>{t(locale, 'opiBullet2')}</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="text-brand-600 shrink-0">•</span>
                  <span>{t(locale, 'opiBullet3')}</span>
                </li>
              </ul>
            </div>
            <div className="flex-1 flex justify-center">
              <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-brand-600/20 to-brand-600/5 flex items-center justify-center">
                <svg className="w-20 h-20 text-brand-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VRI Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row-reverse items-center gap-12">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-600/10 text-brand-600 text-sm font-medium mb-4">
                {t(locale, 'vriBadge')}
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">{t(locale, 'vriTitle')}</h2>
              <p className="text-slate-600 mb-4">{t(locale, 'vriDesc')}</p>
              <ul className="space-y-2 text-slate-600 list-none">
                <li className="flex items-baseline gap-2">
                  <span className="text-brand-600 shrink-0">•</span>
                  <span>{t(locale, 'vriBullet1')}</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="text-brand-600 shrink-0">•</span>
                  <span>{t(locale, 'vriBullet2')}</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="text-brand-600 shrink-0">•</span>
                  <span>{t(locale, 'vriBullet3')}</span>
                </li>
              </ul>
            </div>
            <div className="flex-1 flex justify-center">
              <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-brand-600/20 to-brand-600/5 flex items-center justify-center">
                <svg className="w-20 h-20 text-brand-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">{t(locale, 'howItWorksTitle')}</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              {t(locale, 'howItWorksSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', titleKey: 'step1Title' as const, descKey: 'step1Desc' as const },
              { step: '2', titleKey: 'step2Title' as const, descKey: 'step2Desc' as const },
              { step: '3', titleKey: 'step3Title' as const, descKey: 'step3Desc' as const },
              { step: '4', titleKey: 'step4Title' as const, descKey: 'step4Desc' as const },
            ].map((item) => (
              <div key={item.step}>
                <div className="w-12 h-12 rounded-xl bg-brand-600 text-white font-bold flex items-center justify-center text-lg mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{t(locale, item.titleKey)}</h3>
                <p className="text-slate-600 text-sm">{t(locale, item.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / CTA */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-slate-600 mb-2">{t(locale, 'trustLine')}</p>
          <p className="text-slate-500 text-sm mb-10">{t(locale, 'trustSubline')}</p>
          <Link
            href="/login?register=1"
            className="inline-flex items-center gap-2 px-8 py-4 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/25"
          >
            {t(locale, 'getStartedToday')}
          </Link>
        </div>
      </section>
    </div>
  );
}
