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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Image
              src="/rolling-translations-logo.png"
              alt="Rolling Translations"
              width={40}
              height={40}
              className="rounded-full shrink-0"
            />
            <span className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{t(locale, 'siteName')}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LanguageSwitcher />
            <div className="flex gap-2 sm:gap-3">
              <Link
                href="/login"
                className="px-3 sm:px-4 py-2 text-slate-700 font-medium hover:text-slate-900 transition text-sm sm:text-base"
              >
                {t(locale, 'signIn')}
              </Link>
              <Link
                href="/login?register=1"
                className="px-3 sm:px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition text-sm sm:text-base"
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
        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-600/8 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-brand-400/6 blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4 sm:mb-6">
            {t(locale, 'heroTitle')}
            <br />
            <span className="text-brand-600">{t(locale, 'heroTitleHighlight')}</span>
          </h1>
          <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto mb-4 px-2">
            {t(locale, 'heroSubtitle')}
          </p>
          <p className="text-base text-slate-600 max-w-2xl mx-auto mb-8 sm:mb-10 px-2 font-medium">
            {t(locale, 'heroPhoneOption')}
          </p>
          <div className="flex gap-3 sm:gap-4 justify-center flex-wrap px-2">
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
            <a
              href="tel:+16894007175"
              className="px-8 py-4 border-2 border-brand-600 text-brand-600 rounded-xl font-semibold hover:bg-brand-50 transition inline-flex items-center gap-2"
              aria-label={`Call ${t(locale, 'phoneNumber')} for phone interpretation`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {t(locale, 'callNow')}
            </a>
          </div>
        </div>
      </section>

      {/* OPI Section */}
      <section className="py-10 sm:py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
              <div className="mt-6 p-4 bg-brand-50 border border-brand-200 rounded-xl">
                <p className="text-slate-700 font-medium mb-2">{t(locale, 'opiPhoneAccess')}</p>
                <a
                  href="tel:+16894007175"
                  className="inline-flex items-center gap-2 text-brand-600 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded"
                  aria-label={`Call ${t(locale, 'phoneNumber')} for phone interpretation`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {t(locale, 'phoneNumber')}
                </a>
                <span className="mx-2 text-slate-500">·</span>
                <Link href="#how-it-works" className="text-brand-600 font-medium hover:underline">
                  {t(locale, 'learnPhoneAccess')}
                </Link>
              </div>
            </div>
            <div className="flex-1 flex justify-center">
              {/* OPI UI Mockup */}
              <div className="w-72 rounded-2xl bg-slate-900 shadow-2xl overflow-hidden select-none">
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                  <span className="text-xs text-slate-400 font-medium">Rolling Connect · OPI</span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400 font-semibold">Connected</span>
                  </span>
                </div>
                {/* Avatar + phone ring */}
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-brand-600/20 scale-150 animate-ping" />
                    <div className="absolute inset-0 rounded-full bg-brand-600/10 scale-125" />
                    <div className="relative w-20 h-20 rounded-full bg-brand-600/30 flex items-center justify-center">
                      <svg className="w-10 h-10 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm">Interpreter Assigned</p>
                    <p className="text-slate-400 text-xs mt-0.5">Spanish · Medical Specialty</p>
                  </div>
                  {/* Sound wave bars */}
                  <div className="flex items-end gap-1 h-8">
                    {[3,5,8,6,10,7,4,9,5,3,7,8,4,6,10].map((h, i) => (
                      <div key={i} className="w-1 rounded-full bg-brand-500 opacity-70" style={{ height: `${h * 2.5}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                </div>
                {/* Duration bar */}
                <div className="px-4 pb-4">
                  <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-2">
                    <span className="text-slate-400 text-xs">Duration</span>
                    <span className="text-white font-mono text-sm font-medium">04:32</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VRI Section */}
      <section className="py-10 sm:py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
              {/* VRI UI Mockup */}
              <div className="w-72 rounded-2xl bg-slate-900 shadow-2xl overflow-hidden select-none">
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                  <span className="text-xs text-slate-400 font-medium">Rolling Connect · VRI</span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-red-400 font-semibold">LIVE</span>
                  </span>
                </div>
                {/* Video grid */}
                <div className="grid grid-cols-2 gap-1.5 p-3">
                  <div className="aspect-video rounded-lg bg-gradient-to-br from-brand-600/40 to-brand-800/60 flex flex-col items-center justify-center gap-1.5">
                    <div className="w-10 h-10 rounded-full bg-brand-600/50 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                    </div>
                    <span className="text-white/70 text-xs">Client</span>
                  </div>
                  <div className="aspect-video rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex flex-col items-center justify-center gap-1.5">
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                    </div>
                    <span className="text-white/70 text-xs">Interpreter</span>
                  </div>
                </div>
                {/* Language chip */}
                <div className="px-3 pb-2">
                  <div className="bg-slate-800 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-slate-400 text-xs">Language pair</span>
                    <span className="text-white text-xs font-medium">English → Mandarin</span>
                  </div>
                </div>
                {/* Controls bar */}
                <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-slate-700">
                  {[
                    { icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', color: 'bg-slate-700' },
                    { icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', color: 'bg-slate-700' },
                    { icon: 'M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z', color: 'bg-red-600' },
                  ].map((btn, i) => (
                    <div key={i} className={`w-9 h-9 rounded-full ${btn.color} flex items-center justify-center`}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={btn.icon} />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-10 sm:py-16 bg-white scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">{t(locale, 'howItWorksTitle')}</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              {t(locale, 'howItWorksSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: '1',
                titleKey: 'step1Title' as const,
                descKey: 'step1Desc' as const,
                icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
                color: 'from-brand-500 to-brand-700',
              },
              {
                step: '2',
                titleKey: 'step2Title' as const,
                descKey: 'step2Desc' as const,
                icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
                color: 'from-violet-500 to-violet-700',
              },
              {
                step: '3',
                titleKey: 'step3Title' as const,
                descKey: 'step3Desc' as const,
                icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
                color: 'from-emerald-500 to-emerald-700',
              },
              {
                step: '4',
                titleKey: 'step4Title' as const,
                descKey: 'step4Desc' as const,
                icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
                color: 'from-amber-500 to-orange-600',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="group relative bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:-translate-y-2 hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Step number watermark */}
                <span className="absolute top-3 right-4 text-6xl font-black text-slate-100 select-none leading-none">{item.step}</span>
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-5 shadow-md`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{t(locale, item.titleKey)}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{t(locale, item.descKey)}</p>
                {/* Hover bottom bar */}
                <div className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-300" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / CTA */}
      <section className="py-10 sm:py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-slate-600 mb-2">{t(locale, 'trustLine')}</p>
          <p className="text-slate-500 text-sm mb-6">{t(locale, 'trustSubline')}</p>
          <Link
            href="/pricing"
            className="inline-block text-brand-600 font-semibold hover:underline mb-8"
          >
            {t(locale, 'transparentPricing')}
          </Link>
          <br />
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
