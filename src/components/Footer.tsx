'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

export default function Footer() {
  const pathname = usePathname() ?? '';
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);

  const linkClass = 'text-slate-600 hover:text-brand-600 transition text-sm';

  const clientLinks = [
    { href: '/client', label: t('dashboard') },
    { href: '/client/requests', label: t('requests') },
    { href: '/client/history', label: t('billing') },
  ];

  const interpreterLinks = [
    { href: '/interpreter', label: t('dashboard') },
    { href: '/interpreter/profile', label: t('profile') },
    { href: '/interpreter/history', label: t('billing') },
  ];

  const adminLinks = [
    { href: '/admin', label: t('dashboard') },
    { href: '/admin/jobs', label: t('jobs') },
    { href: '/admin/users', label: t('users') },
    { href: '/admin/reports', label: t('reports') },
  ];

  const publicLinks = [
    { href: '/', label: t('footerHome') },
    { href: '/login', label: t('signIn') },
    { href: '/login?register=1', label: t('register') },
  ];

  let links = publicLinks;
  if (pathname.startsWith('/client')) links = clientLinks;
  else if (pathname.startsWith('/interpreter')) links = interpreterLinks;
  else if (pathname.startsWith('/admin')) links = adminLinks;

  return (
    <footer className="py-8 bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/rolling-translations-logo.png"
              alt="Rolling Translations"
              width={28}
              height={28}
              className="rounded-full"
            />
            <span className="text-slate-600 text-sm font-medium">{t('footerCompany')}</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-4">
            {links.map(({ href, label }) => (
              <Link key={href} href={href} className={linkClass}>
                {label}
              </Link>
            ))}
          </nav>

          <div className="text-slate-600 text-sm text-center md:text-right">
            <p>{t('footerAddress')}</p>
            <p>
              <a href="mailto:info@rolling-translations.com" className="hover:text-brand-600 transition">
                {t('footerEmail')}
              </a>
            </p>
            <p>
              <a href="tel:+18663196739" className="hover:text-brand-600 transition">
                {t('footerPhone')}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
