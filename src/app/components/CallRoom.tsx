'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Daily from '@daily-co/daily-js';
import { io } from 'socket.io-client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

type CallRoomProps = {
  tokenUrl: string | null;
  serviceType: string;
  backHref: string;
  backLabel: string;
  summaryHref: string;
  dailyError?: string | null;
  cancelEndpoint?: string | null;
  /** Client only: ends the call for everyone. */
  endCallEndpoint?: string | null;
  /** Interpreter only: leave without ending; call stays active. */
  leaveEndpoint?: string | null;
  /** Interpreter only: end call for everyone (with confirmation). */
  endForEveryoneEndpoint?: string | null;
  inviteLinkEndpoint?: string | null;
  /** For guests: use guest-leave instead of end. Requires inviteToken in body. */
  guestLeaveEndpoint?: string | null;
  inviteToken?: string | null;
  role?: 'client' | 'interpreter';
  /** Phone number callers should dial to join this session. */
  phoneNumber?: string | null;
  /** Unique 10-digit session code displayed so phone callers can join this session. */
  phoneSessionCode?: string | null;
};

export default function CallRoom({ tokenUrl, serviceType, backHref, backLabel, summaryHref, dailyError, cancelEndpoint, endCallEndpoint, leaveEndpoint, endForEveryoneEndpoint, inviteLinkEndpoint, guestLeaveEndpoint, inviteToken, role = 'interpreter', phoneNumber, phoneSessionCode }: CallRoomProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<ReturnType<typeof Daily.createFrame> | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [phoneCodeCopied, setPhoneCodeCopied] = useState(false);
  const timerStartRef = useRef<number | null>(null);
  const endedByUserRef = useRef(false);
  const endCallEndpointRef = useRef(endCallEndpoint);
  const leaveEndpointRef = useRef(leaveEndpoint);
  const guestLeaveEndpointRef = useRef(guestLeaveEndpoint);
  const inviteTokenRef = useRef(inviteToken);
  const dailyErrorRef = useRef(dailyError);
  endCallEndpointRef.current = endCallEndpoint;
  leaveEndpointRef.current = leaveEndpoint;
  guestLeaveEndpointRef.current = guestLeaveEndpoint;
  inviteTokenRef.current = inviteToken;
  dailyErrorRef.current = dailyError;

  const isInterpreterWithLeave = !!leaveEndpoint && !!endForEveryoneEndpoint;

  // When user leaves without clicking: client/guest -> end/guest-leave; interpreter -> leave only
  const endCallIfNotByUser = useCallback(() => {
    if (endedByUserRef.current) return;
    if (dailyErrorRef.current) return;
    const leaveUrl = leaveEndpointRef.current;
    const guestUrl = guestLeaveEndpointRef.current;
    const endUrl = endCallEndpointRef.current;
    const url = guestUrl || (isInterpreterWithLeave ? leaveUrl : endUrl);
    if (!url) return;
    const duration = timerStartRef.current
      ? Math.max(0, Math.floor((Date.now() - timerStartRef.current) / 1000))
      : 0;
    const body = guestUrl && inviteTokenRef.current
      ? JSON.stringify({ inviteToken: inviteTokenRef.current, durationSeconds: duration })
      : JSON.stringify({ durationSeconds: duration });
    if (leaveUrl && !guestUrl && isInterpreterWithLeave) {
      fetch(leaveUrl, { method: 'POST', keepalive: true, credentials: 'include' }).catch(() => {});
      if (navigator.sendBeacon) navigator.sendBeacon(leaveUrl, new Blob(['{}'], { type: 'application/json' }));
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'include',
      }).catch(() => {});
      if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    }
  }, [isInterpreterWithLeave]);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      try {
        window.focus();
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fallback
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;boxShadow:none;background:transparent;opacity:0;';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  };

  const handleInvite = async () => {
    if (!inviteLinkEndpoint) return;
    setInviteCopied(false);
    setInviteError(null);
    try {
      const res = await fetch(inviteLinkEndpoint, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get invite link');
      const url = data.url;
      if (!url) throw new Error('No URL returned');
      const copied = await copyToClipboard(url);
      if (!copied) throw new Error('Could not copy to clipboard');
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 3000);
    } catch (e) {
      console.error('Invite link error:', e);
      setInviteError(e instanceof Error ? e.message : 'Could not copy');
      setTimeout(() => setInviteError(null), 4000);
    }
  };

  // Listen for call_ended from other party - go to summary (destroy frame first to avoid Daily error UI)
  useEffect(() => {
    const userId = (session?.user as { id?: string })?.id;
    if (!userId || !tokenUrl || dailyError) return;
    const socket = io({ path: '/api/socketio' });
    socket.on('connect', () => socket.emit('auth', { userId, role: (session?.user as { role?: string })?.role || 'client' }));
    socket.on('call_ended', () => {
      if (containerRef.current) containerRef.current.style.display = 'none';
      if (callRef.current) {
        try {
          callRef.current.destroy();
        } catch {}
        callRef.current = null;
      }
      router.replace(summaryHref);
    });
    return () => {
      socket.disconnect();
    };
  }, [session?.user, tokenUrl, dailyError, summaryHref, router]);

  // Daily call frame + timer starts when both participants have joined
  useEffect(() => {
    if (!tokenUrl || dailyError || !containerRef.current) return;

    const container = containerRef.current;

    // Destroy any existing instance first (handles React Strict Mode double-mount)
    if (callRef.current) {
      try {
        callRef.current.leave().catch(() => {});
        callRef.current.destroy();
      } catch {
        // ignore
      }
      callRef.current = null;
    }
    container.innerHTML = '';

    const callFrame = Daily.createFrame(container, {
      showLeaveButton: false,
      iframeStyle: { width: '100%', height: '500px', border: 'none' },
      allowMultipleCallInstances: true,
    });
    callRef.current = callFrame;

    const checkAndStartTimer = () => {
      if (timerStartRef.current) return;
      const participants = callFrame.participants();
      const count = Object.keys(participants).length;
      if (count >= 2) {
        timerStartRef.current = Date.now();
        setTimerStarted(true);
      }
    };

    callFrame.on('joined-meeting', checkAndStartTimer);
    callFrame.on('participant-joined', checkAndStartTimer);
    callFrame.on('left-meeting', () => {
      endCallIfNotByUser();
      if (containerRef.current) containerRef.current.style.display = 'none';
      callRef.current = null;
      router.replace(isInterpreterWithLeave ? backHref : summaryHref);
    });

    callFrame.join({ url: tokenUrl });

    return () => {
      callFrame.leave();
      callFrame.destroy();
      callRef.current = null;
    };
  }, [tokenUrl, dailyError, summaryHref, backHref, isInterpreterWithLeave, router, endCallIfNotByUser]);

  // When user closes tab or navigates away: client/guest -> end; interpreter -> leave
  const unmountEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const hasLeaveOrEnd = guestLeaveEndpoint || endCallEndpoint || (leaveEndpoint && endForEveryoneEndpoint);
    if (!tokenUrl || dailyError || !hasLeaveOrEnd) return;

    if (unmountEndTimeoutRef.current) {
      clearTimeout(unmountEndTimeoutRef.current);
      unmountEndTimeoutRef.current = null;
    }

    const handler = () => endCallIfNotByUser();
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
      // Defer end-on-unmount so React Strict Mode's double-mount doesn't end the call immediately
      unmountEndTimeoutRef.current = setTimeout(() => {
        unmountEndTimeoutRef.current = null;
        endCallIfNotByUser();
      }, 1500);
    };
  }, [tokenUrl, dailyError, endCallEndpoint, leaveEndpoint, endForEveryoneEndpoint, guestLeaveEndpoint, endCallIfNotByUser]);

  // Timer tick when both have joined
  useEffect(() => {
    if (!timerStarted) return;
    const interval = setInterval(() => {
      if (timerStartRef.current) setElapsedSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStarted]);

  // Auto-cancel when call fails (e.g. Daily.co error) so interpreter is freed
  useEffect(() => {
    if (dailyError && cancelEndpoint) {
      fetch(cancelEndpoint, { method: 'POST' }).catch(() => {});
    }
  }, [dailyError, cancelEndpoint]);

  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const handleLeaveCall = async () => {
    if (leaveEndpoint && tokenUrl && !dailyError) {
      endedByUserRef.current = true;
      await fetch(leaveEndpoint, { method: 'POST', credentials: 'include' }).catch(() => {});
    }
    if (callRef.current) {
      try {
        callRef.current.leave();
        callRef.current.destroy();
      } catch {}
      callRef.current = null;
    }
    router.replace(backHref);
  };

  const handleEndForEveryone = async () => {
    setShowEndConfirm(false);
    if (endForEveryoneEndpoint && tokenUrl && !dailyError) {
      endedByUserRef.current = true;
      await fetch(endForEveryoneEndpoint, { method: 'POST', credentials: 'include' }).catch(() => {});
    }
    if (callRef.current) {
      try {
        callRef.current.destroy();
      } catch {}
      callRef.current = null;
    }
    router.replace(summaryHref);
  };

  const handleEndOrCancel = async () => {
    const endUrl = guestLeaveEndpoint || endCallEndpoint;
    const isEndingCall = endUrl && tokenUrl && !dailyError;
    if (isEndingCall) {
      endedByUserRef.current = true;
      const body = guestLeaveEndpoint && inviteToken
        ? JSON.stringify({ inviteToken, durationSeconds: elapsedSeconds })
        : JSON.stringify({ durationSeconds: elapsedSeconds });
      fetch(endUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }).catch(() => {});
    } else if (cancelEndpoint) {
      await fetch(cancelEndpoint, { method: 'POST' });
    }
    if (callRef.current) {
      try {
        callRef.current.destroy();
      } catch {}
      callRef.current = null;
    }
    router.replace(isEndingCall ? summaryHref : backHref);
  };

  if (!tokenUrl) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl border border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          {serviceType === 'VRI' ? 'Video' : 'Audio'} Call
        </h1>
        {dailyError ? (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="font-medium text-amber-800 mb-1">Daily.co error:</p>
            <p className="text-sm text-amber-700">{dailyError}</p>
            <p className="text-xs text-amber-600 mt-2">
              Fix the issue above, then restart the server with <code className="bg-amber-100 px-1 rounded">npm run dev</code>
            </p>
          </div>
        ) : (
          <p className="text-slate-600 mb-4">
            Call room is ready. To enable real video/audio:
          </p>
        )}
        <ol className="list-decimal list-inside text-sm text-slate-600 mb-6 space-y-2">
          <li>Get a free API key at <a href="https://dashboard.daily.co" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">dashboard.daily.co</a></li>
          <li>Add <code className="bg-slate-100 px-1 rounded">DAILY_API_KEY</code> and <code className="bg-slate-100 px-1 rounded">DAILY_DOMAIN</code> to your .env (domain = your subdomain only, e.g. &quot;mycompany&quot; for mycompany.daily.co)</li>
          <li><strong>Restart the server</strong> — env vars load at startup</li>
        </ol>
        <div className="flex gap-3">
          {cancelEndpoint && (
            <button
              onClick={handleEndOrCancel}
              className="px-6 py-2 border border-amber-600 text-amber-700 rounded-lg hover:bg-amber-50"
            >
              Cancel call & release interpreter
            </button>
          )}
          <Link href={backHref} className="px-6 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 inline-block">
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <h1 className="text-lg font-bold text-slate-900">
            {serviceType === 'VRI' ? 'Video' : 'Audio'} Call
          </h1>
          <div className="flex items-center gap-4">
            {inviteLinkEndpoint && !dailyError && (
              <div className="flex flex-col items-center">
                <button
                  onClick={handleInvite}
                  className={`px-4 py-2 rounded-lg font-medium border transition-colors ${
                    inviteCopied
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                  title="Copy meeting link to invite others"
                >
                  Invite Link
                </button>
                {inviteCopied && (
                  <span className="text-xs text-green-600 mt-1 font-medium">Link copied!</span>
                )}
                {inviteError && (
                  <span className="text-xs text-amber-600 mt-1">{inviteError}</span>
                )}
              </div>
            )}
            {/* Duration: shown next to End Call for both client and interpreter */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <span className="text-slate-600 text-sm font-medium">Duration</span>
              <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {formatDuration(elapsedSeconds)}
              </span>
            </div>
            {isInterpreterWithLeave ? (
              <div className="flex gap-2">
                <button
                  onClick={handleLeaveCall}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  {t('leaveCall')}
                </button>
                <button
                  onClick={() => setShowEndConfirm(true)}
                  className="px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 font-medium"
                >
                  {t('endCallForEveryone')}
                </button>
              </div>
            ) : (
              <button
                onClick={handleEndOrCancel}
                className="px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 font-medium"
              >
                {guestLeaveEndpoint ? t('leave') : t('endCall')}
              </button>
            )}
          </div>
        </div>
        {phoneSessionCode && (
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Join by phone</span>
            {phoneNumber && (
              <span className="text-sm text-slate-700 font-mono">{phoneNumber}</span>
            )}
            {phoneNumber && <span className="text-slate-300 hidden sm:inline">·</span>}
            <span className="text-xs text-slate-500">Session code:</span>
            <span className="text-sm font-mono font-semibold text-slate-800 tracking-widest">{phoneSessionCode}</span>
            <button
              onClick={async () => {
                const ok = await copyToClipboard(phoneSessionCode);
                if (ok) {
                  setPhoneCodeCopied(true);
                  setTimeout(() => setPhoneCodeCopied(false), 2500);
                }
              }}
              className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-white hover:border-slate-300 transition-colors"
              title="Copy session code"
            >
              {phoneCodeCopied ? '✓ Copied' : 'Copy code'}
            </button>
          </div>
        )}
        {showEndConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">{t('endCallForEveryone')}?</h2>
              <p className="text-slate-600 mb-4">
                This will disconnect the client and end the session for everyone. The call cannot be resumed.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndForEveryone}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  {t('endCallForEveryone')}
                </button>
              </div>
            </div>
          </div>
        )}
        <div ref={containerRef} className="min-h-[500px]" />
      </div>
    </div>
  );
}
