'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

function t(locale: 'en' | 'es' | 'zh', key: TranslationKeys) {
  return getTranslation(locale, key);
}

function LoginContent() {
  const { locale } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState<'client' | 'interpreter'>('client');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegister = searchParams.get('register') === '1';

  useEffect(() => {
    fetch('/api/auth/google-enabled')
      .then(async (r) => {
        const text = await r.text();
        if (!text) return { enabled: false };
        try {
          return JSON.parse(text);
        } catch {
          return { enabled: false };
        }
      })
      .then((data) => setGoogleEnabled(data.enabled === true))
      .catch(() => setGoogleEnabled(false));
  }, []);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'GoogleSignInClientOnly') {
      setError('Google sign-in is available for clients and interpreters only. Admins must use email and password.');
    } else if (err === 'expired_token') {
      setError(''); // Handled separately in UI
    } else if (err) {
      const msg = searchParams.get('errorDescription') || err;
      setError(msg);
    } else {
      setError('');
    }
  }, [searchParams]);

  useEffect(() => {
    const confirmed = searchParams.get('confirmed') === '1';
    const em = searchParams.get('email');
    if ((confirmed || searchParams.get('error') === 'expired_token') && em) setEmail(em);
  }, [searchParams]);

  const registeredClient = searchParams.get('registered') === 'client';
  const emailConfirmed = searchParams.get('confirmed') === '1';
  const expiredToken = searchParams.get('error') === 'expired_token';
  const paymentSetupComplete = searchParams.get('message') === 'payment_setup_complete';
  const confirmedEmail = searchParams.get('email') || '';

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return t(locale, 'passwordTooWeak');
    if (!/[A-Z]/.test(pwd)) return t(locale, 'passwordTooWeak');
    if (!/[a-z]/.test(pwd)) return t(locale, 'passwordTooWeak');
    if ((pwd.match(/\d/g) || []).length < 2) return t(locale, 'passwordTooWeak');
    if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(pwd)) return t(locale, 'passwordTooWeak');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegister) {
      if (password !== confirmPassword) {
        setError(t(locale, 'passwordMismatch'));
        return;
      }
      const pwdError = validatePassword(password);
      if (pwdError) {
        setError(pwdError);
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, role, organization: organization.trim() || undefined }),
        });
        const text = await res.text();
        let data: { ok?: boolean; error?: unknown } = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            setError(`Registration failed (${res.status}): ${text.slice(0, 100)}`);
            return;
          }
        } else {
          setError(`Registration failed (${res.status}): Empty response from server`);
          return;
        }
        if (!res.ok) {
          const errMsg = typeof data.error === 'object' ? JSON.stringify(data.error) : String(data.error ?? 'Registration failed');
          throw new Error(errMsg);
        }

        if (role === 'client') {
          setError('');
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          return;
        }
      }

      const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
      // Clear URL error params so they don't persist when retrying with credentials
      if (searchParams.get('error')) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('error');
        params.delete('errorDescription');
        router.replace(params.toString() ? `/login?${params}` : '/login');
      }
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        const msg = result.error === 'CredentialsSignin'
          ? t(locale, 'invalidCredentials')
          : result.error;
        throw new Error(msg);
      }

      router.push(callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Image
              src="/rolling-translations-logo.png"
              alt="Rolling Translations"
              width={40}
              height={40}
              className="rounded-full"
            />
            <span className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{t(locale, 'siteName')}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LanguageSwitcher />
            <Link href="/" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
              {t(locale, 'backToHome')}
            </Link>
          </div>
        </div>
      </header>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
            {registeredClient ? (
              <div className="text-center py-4">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">{t(locale, 'registrationSuccessTitle')}</h1>
                <p className="text-slate-600 mb-6">{t(locale, 'registrationSuccessMessage')}</p>
                <Link href="/login" className="text-brand-600 hover:underline font-medium">{t(locale, 'backToSignIn')}</Link>
              </div>
            ) : emailConfirmed ? (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">{t(locale, 'emailConfirmedMessage')}</p>
                {confirmedEmail && (
                  <p className="text-sm text-green-700 mt-1">{t(locale, 'signInToContinue')}</p>
                )}
              </div>
            ) : expiredToken ? (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 font-medium">{t(locale, 'expiredTokenMessage')}</p>
                {confirmedEmail && (
                  <Link
                    href={`/verify-email?email=${encodeURIComponent(confirmedEmail)}`}
                    className="inline-block mt-2 text-brand-600 hover:text-brand-700 font-medium"
                  >
                    {t(locale, 'resendVerificationLink')}
                  </Link>
                )}
              </div>
            ) : paymentSetupComplete ? (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">{t(locale, 'paymentSetupCompleteMessage')}</p>
              </div>
            ) : null}
            <h1 className="text-2xl font-bold text-slate-900 mb-6">
              {isRegister ? t(locale, 'createAccount') : t(locale, 'signIn')}
            </h1>
          <form onSubmit={handleSubmit} className="space-y-4" style={{ display: registeredClient ? 'none' : undefined }}>
            {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t(locale, 'name')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t(locale, 'role')}</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'client' | 'interpreter')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                  >
                    <option value="client">{t(locale, 'client')}</option>
                    <option value="interpreter">{t(locale, 'interpreter')}</option>
                  </select>
                </div>
                {role === 'client' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t(locale, 'organization')} <span className="text-slate-400 font-normal">({t(locale, 'optional')})</span>
                    </label>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder={t(locale, 'organizationPlaceholder')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                    />
                  </div>
                )}
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t(locale, 'email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">{t(locale, 'password')}</label>
                {!isRegister && (
                  <Link href="/forgot-password" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                    {t(locale, 'forgotPassword')}
                  </Link>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                required
                minLength={isRegister ? 8 : undefined}
              />
              {isRegister && (
                <p className="mt-1.5 text-xs text-slate-500">{t(locale, 'passwordRequirements')}</p>
              )}
            </div>
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t(locale, 'confirmPassword')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                  required
                />
              </div>
            )}
            <div role="alert" aria-live="assertive" aria-atomic="true" className="min-h-[1.25rem]">
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition"
            >
              {loading ? t(locale, 'pleaseWait') : isRegister ? t(locale, 'register') : t(locale, 'signIn')}
            </button>
            {googleEnabled && (
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">{t(locale, 'or')}</span>
                </div>
              </div>
            )}
            {googleEnabled && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const provider = isRegister
                      ? role === 'interpreter'
                        ? 'google-interpreter'
                        : 'google-client'
                      : 'google-client';
                    signIn(provider, { callbackUrl: '/dashboard' });
                  }}
                  className="w-full py-2.5 border border-slate-200 rounded-xl font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {isRegister ? t(locale, 'registerWithGoogle') : t(locale, 'signInWithGoogle')}
                </button>
              </>
            )}
            {googleEnabled === false && (
              <p className="text-sm text-slate-500 mt-2">
                {t(locale, 'googleSignInNotConfigured')}
              </p>
            )}
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            {isRegister ? (
              <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">{t(locale, 'alreadyHaveAccount')}</Link>
            ) : (
              <Link href="/login?register=1" className="text-brand-600 hover:text-brand-700 font-medium">{t(locale, 'createAnAccount')}</Link>
            )}
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
