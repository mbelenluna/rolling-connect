'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Daily from '@daily-co/daily-js';
import { io } from 'socket.io-client';
import { toAzureLanguage, getLanguageDisplayName, toTranslationTarget, getTranslationLookupKeys } from '@/lib/azure-languages';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';
import type { TranslationRecognitionEventArgs } from 'microsoft-cognitiveservices-speech-sdk';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Infer default sourceLang from browser/UI language (returns Azure format) */
function inferDefaultSourceLang(sourceLanguage: string, targetLanguage: string): string {
  if (typeof navigator === 'undefined') return toAzureLanguage(sourceLanguage);
  const lang = (navigator.language || '').toLowerCase();
  const targetAzure = toAzureLanguage(targetLanguage);
  const targetBase = targetAzure.split('-')[0];
  if (lang.startsWith(targetBase)) return targetAzure;
  return toAzureLanguage(sourceLanguage);
}

type AICallRoomProps = {
  tokenUrl: string | null;
  serviceType: string;
  sourceLanguage: string;
  targetLanguage: string;
  backHref: string;
  backLabel: string;
  summaryHref: string;
  dailyError?: string | null;
  cancelEndpoint?: string | null;
  endCallEndpoint?: string | null;
  inviteLinkEndpoint?: string | null;
  /** For guests: inviteToken + callId to fetch Azure token without auth */
  inviteToken?: string | null;
  callId?: string | null;
};

export default function AICallRoom({
  tokenUrl,
  serviceType,
  sourceLanguage,
  targetLanguage,
  backHref,
  backLabel,
  summaryHref,
  dailyError,
  cancelEndpoint,
  endCallEndpoint,
  inviteLinkEndpoint,
  inviteToken,
  callId,
}: AICallRoomProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const containerRef = useRef<HTMLDivElement>(null);
  const dailyContainerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<ReturnType<typeof Daily.createFrame> | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const [accumulatedOut, setAccumulatedOut] = useState(''); // My speech: finalized segments
  const [interimOut, setInterimOut] = useState('');          // My speech: current partial (recognizing)
  const [accumulatedIn, setAccumulatedIn] = useState('');   // Other's speech: accumulated
  const [azureError, setAzureError] = useState<string | null>(null);
  const [azureReady, setAzureReady] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const timerStartRef = useRef<number | null>(null);
  const endedByUserRef = useRef(false);
  const hasJoinedCallRef = useRef(false);
  const endCallEndpointRef = useRef(endCallEndpoint);
  const guestLeaveEndpointRef = useRef<string | null>(null);
  const inviteTokenRef = useRef(inviteToken);
  const dailyErrorRef = useRef(dailyError);
  endCallEndpointRef.current = endCallEndpoint;
  guestLeaveEndpointRef.current = !endCallEndpoint && callId && inviteToken
    ? `/api/calls/${callId}/guest-leave`
    : null;
  inviteTokenRef.current = inviteToken;
  dailyErrorRef.current = dailyError;

  const sourceAzure = toAzureLanguage(sourceLanguage);
  const targetAzure = toAzureLanguage(targetLanguage);

  // Join modal: user must confirm sourceLang before joining
  const [showJoinModal, setShowJoinModal] = useState(true);
  const [joinSourceLang, setJoinSourceLang] = useState<string>(() => inferDefaultSourceLang(sourceLanguage, targetLanguage));
  const [hasJoined, setHasJoined] = useState(false);

  // In-call sourceLang for local user (toggle pill) - stored in Azure format
  const [mySourceLang, setMySourceLang] = useState<string>(sourceAzure);
  const mySourceLangRef = useRef<string>(sourceAzure);
  mySourceLangRef.current = mySourceLang;

  // Translation paused = we control this; when true, recognizer is stopped (independent of Daily mute)
  const [translationPaused, setTranslationPaused] = useState(false);
  const translationPausedRef = useRef(false);
  translationPausedRef.current = translationPaused;

  const recognizerRef = useRef<{ stopContinuousRecognitionAsync?: () => unknown; close?: () => void } | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const stopMicStream = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  }, []);

  const endCallIfNotByUser = useCallback(() => {
    if (endedByUserRef.current) return;
    if (dailyErrorRef.current) return;
    const authUrl = endCallEndpointRef.current;
    const guestUrl = guestLeaveEndpointRef.current;
    const url = authUrl || guestUrl;
    if (!url) return;
    const duration = timerStartRef.current
      ? Math.max(0, Math.floor((Date.now() - timerStartRef.current) / 1000))
      : 0;
    const body = guestUrl
      ? JSON.stringify({ inviteToken: inviteTokenRef.current, durationSeconds: duration })
      : JSON.stringify({ durationSeconds: duration });
    // Prefer fetch with keepalive + credentials so session cookie is sent reliably
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'include',
    }).catch(() => {});
    // Also send via beacon as backup (some browsers may complete beacon during unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    }
  }, []);

  useEffect(() => {
    const userId = (session?.user as { id?: string })?.id;
    if (!userId || !tokenUrl || dailyError) return;
    const socket = io({ path: '/api/socketio' });
    socket.on('connect', () => socket.emit('auth', { userId, role: 'client' }));
    socket.on('call_ended', () => {
      if (containerRef.current) containerRef.current.style.display = 'none';
      const r = recognizerRef.current;
      recognizerRef.current = null;
      if (r) {
        try {
          const p = r.stopContinuousRecognitionAsync?.();
          if (p && typeof (p as Promise<unknown>)?.catch === 'function') {
            (p as Promise<void>).catch(() => {}).finally(() => {
              r.close?.();
              stopMicStream();
            });
          } else {
            r.close?.();
            stopMicStream();
          }
        } catch {
          stopMicStream();
        }
      }
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
  }, [session?.user, tokenUrl, dailyError, summaryHref, router, stopMicStream]);

  // Daily call frame + Azure recognizer (single recognizer with explicit sourceLang)
  useEffect(() => {
    if (!tokenUrl || dailyError || !hasJoined || !dailyContainerRef.current) return;

    const container = dailyContainerRef.current;

    if (callRef.current) {
      try {
        callRef.current.leave().catch(() => {});
        callRef.current.destroy();
      } catch {}
      callRef.current = null;
    }
    container.innerHTML = '';

    const callFrame = Daily.createFrame(container, {
      showLeaveButton: false,
      iframeStyle: { width: '100%', height: '500px', border: 'none' },
      allowMultipleCallInstances: true,
      userData: { sourceLang: joinSourceLang },
    });
    callRef.current = callFrame;

    const checkAndStartTimer = () => {
      if (timerStartRef.current) return;
      const participants = callFrame.participants();
      const count = Object.keys(participants).length;
      if (count >= 1) {
        timerStartRef.current = Date.now();
        setTimerStarted(true);
      }
    };

    const joinedAtRef = { current: 0 };
    callFrame.on('joined-meeting', () => {
      hasJoinedCallRef.current = true;
      joinedAtRef.current = Date.now();
      checkAndStartTimer();
      callFrame.setUserData({ sourceLang: mySourceLangRef.current });
      // Only start recognizer if mic is not muted
      if (callFrame.localAudio() !== false) {
        // Delay ~500ms so Daily/browser can fully establish mic before we grab it
        setTimeout(() => {
          if (mounted && callFrame.localAudio() !== false) startRecognizer();
        }, 500);
      } else {
        if (mounted) setAzureReady(true); // UI ready, recognizer will start when unmuted
      }
    });
    callFrame.on('participant-joined', checkAndStartTimer);
    const stopRecognizerOnMute = () => {
      const r = recognizerRef.current;
      if (r) {
        recognizerRef.current = null;
        try {
          const p = r.stopContinuousRecognitionAsync?.();
          if (p && typeof (p as Promise<unknown>)?.catch === 'function') {
            (p as Promise<void>).catch(() => {}).finally(() => {
              r.close?.();
              stopMicStream();
            });
          } else {
            r.close?.();
            stopMicStream();
          }
        } catch {
          try { r.close?.(); } catch {}
          stopMicStream();
        }
        if (mounted) {
          setAccumulatedOut('');
          setInterimOut('');
          setTranslationPaused(true);
        }
      }
    };

    callFrame.on('participant-updated', (e: { participant?: { local?: boolean; session_id?: string } }) => {
      const local = callFrame.participants().local;
      const isLocal = e?.participant?.local || (local && e?.participant?.session_id === local.session_id);
      if (!isLocal) return;
      const audioOn = callFrame.localAudio();
      if (audioOn !== true) {
        // Muted: stop recognizer (treat anything other than explicit true as muted)
        if (Date.now() - joinedAtRef.current < 1000) return; // Brief grace for initial join
        stopRecognizerOnMute();
      } else {
        // Unmuted: delay before starting so rapid mute/unmute/mute doesn't leave recognizer running
        setTranslationPaused(false);
        const delayMs = 300;
        setTimeout(() => {
          if (!mounted || !callRef.current) return;
          if (callFrame.localAudio() !== true || translationPausedRef.current) return;
          startRecognizer();
        }, delayMs);
      }
    });

    // Poll for mute state as fallback (participant-updated may not fire reliably in all cases)
    const mutePollInterval = setInterval(() => {
      if (!mounted || !callFrame.participants().local) return;
      if (callFrame.localAudio() !== true && recognizerRef.current) {
        if (Date.now() - joinedAtRef.current < 1000) return;
        stopRecognizerOnMute();
      }
    }, 1500);

    callFrame.on('app-message', (e: { data?: { type?: string; translation?: string; fromSessionId?: string }; fromId?: string }) => {
      if (!mounted || !e?.data) return;
      const localId = callFrame.participants().local?.session_id;
      if (localId && (e.fromId === localId || e.data.fromSessionId === localId)) return; // Ignore our own messages
      if (e.data.type === 'translation' && e.data.translation) {
        setAccumulatedIn((prev) => (prev ? prev + ' ' + e.data!.translation : e.data!.translation));
      }
    });
    callFrame.on('left-meeting', () => {
      endCallIfNotByUser();
      if (containerRef.current) containerRef.current.style.display = 'none';
      callRef.current = null;
      router.replace(summaryHref);
    });

    callFrame.join({ url: tokenUrl, userData: { sourceLang: joinSourceLang } });

    let mounted = true;
    let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

    const azureTokenUrl = inviteToken && callId
      ? `/api/calls/${callId}/guest-azure-token?inviteToken=${encodeURIComponent(inviteToken)}`
      : '/api/azure-speech-token';

    async function startRecognizer() {
      if (!mounted || translationPausedRef.current) return;
      const r = recognizerRef.current;
      if (r) return; // Already running
      try {
        const [sdk, tokenRes] = await Promise.all([
          import('microsoft-cognitiveservices-speech-sdk'),
          fetch(azureTokenUrl, { credentials: 'include' }),
        ]);

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error || 'Failed to get Azure token');

        const { token, region } = tokenData;
        const source = mySourceLangRef.current;
        const target = source === sourceAzure ? targetAzure : sourceAzure;

        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        micStreamRef.current = micStream;
        const audioConfig = sdk.AudioConfig.fromStreamInput(micStream);

        const config = sdk.SpeechTranslationConfig.fromAuthorizationToken(token, region);
        config.speechRecognitionLanguage = source;
        config.addTargetLanguage(toTranslationTarget(target));

        const recognizer = new sdk.TranslationRecognizer(config, audioConfig);
        recognizerRef.current = recognizer;

        const validReasons = [sdk.ResultReason.TranslatingSpeech, sdk.ResultReason.TranslatedSpeech];
        const isValid = (r: { reason?: number }) => r.reason != null && validReasons.includes(r.reason);

        const getTranslation = (result: { text?: string; translations?: { get(key: string, def?: string): string } }) => {
          const trans = result.translations;
          if (!trans) return null;
          const sourceText = (result.text ?? '').trim();
          for (const k of getTranslationLookupKeys(target)) {
            const val = trans.get(k, '')?.trim();
            if (val && val !== sourceText) return val;
          }
          return null;
        };

        const broadcastTranslation = (t: string, isFinal: boolean) => {
          if (!t) return;
          if (isFinal) {
            setAccumulatedOut((prev) => (prev ? prev + ' ' + t : t));
            setInterimOut('');
            try {
              const localId = callFrame.participants().local?.session_id;
              callFrame.sendAppMessage({ type: 'translation', translation: t, fromSessionId: localId }, '*');
            } catch {}
          } else {
            setInterimOut(t);
          }
        };
        recognizer.recognizing = (_s: unknown, e: TranslationRecognitionEventArgs) => {
          if (!mounted || !isValid(e.result)) return;
          const t = getTranslation(e.result);
          if (t) broadcastTranslation(t, false);
        };
        recognizer.recognized = (_s: unknown, e: TranslationRecognitionEventArgs) => {
          if (!mounted || !isValid(e.result)) return;
          const t = getTranslation(e.result);
          if (t) broadcastTranslation(t, true);
        };

        const scheduleRestart = (reason: string) => {
          if (!mounted || translationPausedRef.current) return;
          if (recognizerRef.current !== recognizer) return;
          recognizerRef.current = null;
          try {
            const p = recognizer.stopContinuousRecognitionAsync?.() as Promise<void> | void | undefined;
            if (p != null && typeof (p as Promise<unknown>).catch === 'function') {
              (p as Promise<void>).catch(() => {}).finally(() => {
                recognizer.close?.();
                stopMicStream();
              });
            } else {
              recognizer.close?.();
              stopMicStream();
            }
          } catch {
            try { recognizer.close?.(); } catch {}
            stopMicStream();
          }
          console.warn(`Azure Speech ${reason}, restarting in 1s...`);
          setTimeout(() => {
            if (!mounted || translationPausedRef.current || callFrame.localAudio() !== true) return;
            startRecognizer();
          }, 1000);
        };

        recognizer.canceled = (_s: unknown, e: { reason?: number; errorDetails?: string }) => {
          console.warn('Azure Speech canceled:', e.reason, e.errorDetails);
          scheduleRestart(`canceled (${e.errorDetails || e.reason})`);
        };
        recognizer.sessionStopped = () => {
          scheduleRestart('session stopped');
        };

        await recognizer.startContinuousRecognitionAsync();
        if (mounted) setAzureReady(true);

        // Proactive token refresh every 8 min (token valid ~10 min) to prevent mid-call expiration
        tokenRefreshInterval = setInterval(() => {
          if (!mounted || translationPausedRef.current || callFrame.localAudio() !== true) return;
          if (recognizerRef.current !== recognizer) return;
          scheduleRestart('token refresh');
        }, 8 * 60 * 1000);
      } catch (e) {
        console.error('Azure Speech init error:', e);
        if (mounted) setAzureError(e instanceof Error ? e.message : 'Failed to start AI translation');
      }
    }
    startRecognizerRef.current = startRecognizer;

    // Recognizer starts only from joined-meeting or participant-updated (unmute), not before join

    return () => {
      hasJoinedCallRef.current = false;
      mounted = false;
      clearInterval(mutePollInterval);
      if (tokenRefreshInterval) clearInterval(tokenRefreshInterval);
      const r = recognizerRef.current;
      recognizerRef.current = null;
      if (r) {
        try {
          const p = r.stopContinuousRecognitionAsync?.();
          if (p && typeof (p as Promise<unknown>)?.catch === 'function') {
            (p as Promise<void>).catch(() => {}).finally(() => {
              r.close?.();
              stopMicStream();
            });
          } else {
            r.close?.();
            stopMicStream();
          }
        } catch {
          try { r.close?.(); } catch {}
          stopMicStream();
        }
      }
      const cf = callRef.current;
      if (cf) {
        callRef.current = null;
        try {
          cf.leave().catch(() => {});
        } catch {}
        try {
          cf.destroy();
        } catch {}
      }
    };
  }, [tokenUrl, dailyError, hasJoined, joinSourceLang, sourceLanguage, targetLanguage, summaryHref, router, endCallIfNotByUser, inviteToken, callId, stopMicStream]);

  // When user toggles sourceLang, restart recognizer (skip on initial mount)
  const prevSourceLangRef = useRef<string | null>(null);
  useEffect(() => {
    if (!azureReady || !hasJoined) return;
    if (prevSourceLangRef.current === null) {
      prevSourceLangRef.current = mySourceLang;
      return;
    }
    if (prevSourceLangRef.current === mySourceLang) return;
    prevSourceLangRef.current = mySourceLang;

    const r = recognizerRef.current;
    if (r) {
      recognizerRef.current = null;
      try {
        const p = r.stopContinuousRecognitionAsync?.();
        if (p && typeof (p as Promise<unknown>)?.catch === 'function') {
          (p as Promise<void>).catch(() => {}).finally(() => {
            r.close?.();
            stopMicStream();
          });
        } else {
          r.close?.();
          stopMicStream();
        }
      } catch {
        stopMicStream();
      }
    }
    setAccumulatedOut('');
    setInterimOut('');
    callRef.current?.setUserData({ sourceLang: mySourceLang });

    // Don't start recognizer if user is muted (participant-updated will start when they unmute)
    if (callRef.current?.localAudio() === false) return;

    // Reuse startRecognizer so it gets canceled/sessionStopped handlers and token refresh
    setTimeout(() => startRecognizerRef.current(), 100);
  }, [mySourceLang, azureReady, hasJoined, sourceLanguage, targetLanguage, inviteToken, callId, stopMicStream]);

  useEffect(() => {
    if (!timerStarted) return;
    const interval = setInterval(() => {
      if (timerStartRef.current)
        setElapsedSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStarted]);

  const hasEndCall = !!endCallEndpoint || (!!callId && !!inviteToken);
  useEffect(() => {
    if (!tokenUrl || dailyError || !hasEndCall) return;
    const handler = () => endCallIfNotByUser();
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
      // End call when component unmounts only if user actually joined (avoids React Strict Mode false unmount)
      if (hasJoinedCallRef.current) endCallIfNotByUser();
    };
  }, [tokenUrl, dailyError, hasEndCall, endCallIfNotByUser]);

  useEffect(() => {
    if (dailyError && cancelEndpoint) {
      fetch(cancelEndpoint, { method: 'POST' }).catch(() => {});
    }
  }, [dailyError, cancelEndpoint]);

  const handleJoin = () => {
    setShowJoinModal(false);
    setMySourceLang(joinSourceLang);
    setHasJoined(true);
  };

  const startRecognizerRef = useRef<() => void>(() => {});
  const toggleCooldownRef = useRef<number>(0);
  const [toggleDisabled, setToggleDisabled] = useState(false);
  const TOGGLE_COOLDOWN_MS = 500;

  const handleToggleTranslationPause = () => {
    const now = Date.now();
    if (now < toggleCooldownRef.current) return;
    toggleCooldownRef.current = now + TOGGLE_COOLDOWN_MS;
    setToggleDisabled(true);
    setTimeout(() => setToggleDisabled(false), TOGGLE_COOLDOWN_MS);

    const next = !translationPaused;
    setTranslationPaused(next);
    translationPausedRef.current = next;
    const cf = callRef.current;
    if (cf) {
      cf.setLocalAudio(!next); // false = mute, true = unmute
      if (next) {
        const r = recognizerRef.current;
        if (r) {
          recognizerRef.current = null;
          try {
            const p = r.stopContinuousRecognitionAsync?.();
            if (p && typeof (p as Promise<unknown>)?.catch === 'function') {
              (p as Promise<void>).catch(() => {}).finally(() => {
                r.close?.();
                stopMicStream();
              });
            } else {
              r.close?.();
              stopMicStream();
            }
          } catch {
            try { r.close?.(); } catch {}
            stopMicStream();
          }
        }
        setAccumulatedOut('');
        setInterimOut('');
      } else {
        // Resuming: start recognizer (participant-updated may not fire immediately)
        setTimeout(() => startRecognizerRef.current(), 150);
      }
    }
  };

  const handleEndOrCancel = async () => {
    const isEndingCall = (endCallEndpoint || guestLeaveEndpointRef.current) && tokenUrl && !dailyError;
    if (isEndingCall) endedByUserRef.current = true;

    const r = recognizerRef.current;
    recognizerRef.current = null;
    if (r) {
      try {
        const p = r.stopContinuousRecognitionAsync?.();
        if (p && typeof (p as Promise<unknown>)?.catch === 'function') {
          (p as Promise<void>).catch(() => {}).finally(() => {
            r.close?.();
            stopMicStream();
          });
        } else {
          r.close?.();
          stopMicStream();
        }
      } catch {
        stopMicStream();
      }
    }

    if (isEndingCall) {
      const url = endCallEndpoint || guestLeaveEndpointRef.current;
      const body = guestLeaveEndpointRef.current
        ? JSON.stringify({ inviteToken: inviteTokenRef.current, durationSeconds: elapsedSeconds })
        : JSON.stringify({ durationSeconds: elapsedSeconds });
      try {
        const res = await fetch(url!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error('End call failed:', res.status, data);
          alert(data.error || `Failed to end call (${res.status})`);
        }
      } catch (e) {
        console.error('End call error:', e);
        alert(e instanceof Error ? e.message : 'Failed to end call');
      }
    } else if (cancelEndpoint) {
      try {
        await fetch(cancelEndpoint, { method: 'POST' });
      } catch {}
    }

    const callFrame = callRef.current;
    if (callFrame) {
      try {
        await callFrame.leave();
      } catch {}
      try {
        callFrame.destroy();
      } catch {}
      callRef.current = null;
    }

    router.replace(isEndingCall ? summaryHref : backHref);
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      try {
        window.focus();
        await navigator.clipboard.writeText(text);
        return true;
      } catch {}
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

  // Join modal
  if (showJoinModal && tokenUrl && !dailyError) {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-xl border border-slate-200 shadow-lg">
        <h1 className="text-xl font-bold text-slate-900 mb-2">{t('joinAiCallTitle')}</h1>
        <p className="text-slate-600 mb-4">{t('requestInterpreterSubtitle')}</p>
        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() => setJoinSourceLang(sourceAzure)}
            className={`flex-1 py-3 px-4 rounded-xl font-medium border-2 transition-colors ${
              joinSourceLang === sourceAzure ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {getLanguageDisplayName(sourceLanguage)}
          </button>
          <button
            type="button"
            onClick={() => setJoinSourceLang(targetAzure)}
            className={`flex-1 py-3 px-4 rounded-xl font-medium border-2 transition-colors ${
              joinSourceLang === targetAzure ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {getLanguageDisplayName(targetLanguage)}
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">{t('joinCallLanguageToggleHint')}</p>
        <button type="button" onClick={handleJoin} className="w-full py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700">
          {t('joinCallButton')}
        </button>
      </div>
    );
  }

  if (!tokenUrl) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl border border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 mb-2">AI {serviceType === 'VRI' ? 'Video' : 'Audio'} Call</h1>
        {dailyError ? (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="font-medium text-amber-800 mb-1">Daily.co error:</p>
            <p className="text-sm text-amber-700">{dailyError}</p>
          </div>
        ) : (
          <p className="text-slate-600 mb-4">{t('loadingCallRoom')}</p>
        )}
        <div className="flex gap-3">
          {cancelEndpoint && (
            <button onClick={handleEndOrCancel} className="px-6 py-2 border border-amber-600 text-amber-700 rounded-lg hover:bg-amber-50">
              {t('cancelCall')}
            </button>
          )}
          <Link href={backHref} className="px-6 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 inline-block">
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  const mySourceLabel = mySourceLang === sourceAzure ? getLanguageDisplayName(sourceLanguage) : getLanguageDisplayName(targetLanguage);
  const otherLangLabel = mySourceLang === sourceAzure ? getLanguageDisplayName(targetLanguage) : getLanguageDisplayName(sourceLanguage);

  return (
    <div className="max-w-4xl mx-auto" ref={containerRef}>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white flex-wrap gap-2">
          <h1 className="text-lg font-bold text-slate-900">AI {serviceType === 'VRI' ? 'Video' : 'Audio'} Call</h1>
          <div className="flex items-center gap-4 flex-wrap">
            {azureReady && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">{t('iSpeak')}</span>
                  <div className="flex rounded-full border border-slate-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setMySourceLang(sourceAzure)}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                        mySourceLang === sourceAzure ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {getLanguageDisplayName(sourceLanguage)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMySourceLang(targetAzure)}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                        mySourceLang === targetAzure ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {getLanguageDisplayName(targetLanguage)}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleTranslationPause}
                  disabled={toggleDisabled}
                  className={`px-4 py-2 rounded-lg font-medium border transition-colors ${
                    toggleDisabled
                      ? 'opacity-60 cursor-not-allowed'
                      : translationPaused
                        ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                  title={translationPaused ? t('resumeTranslation') : `${t('pauseTranslation')} (mute mic & stop AI)`}
                >
                  {translationPaused ? t('resumeTranslation') : t('pauseTranslation')}
                </button>
              </>
            )}
            {inviteLinkEndpoint && !dailyError && (
              <div className="flex flex-col items-center">
                <button
                  onClick={handleInvite}
                  className={`px-4 py-2 rounded-lg font-medium border transition-colors ${
                    inviteCopied ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t('invite')}
                </button>
                {inviteCopied && <span className="text-xs text-green-600 mt-1 font-medium">{t('linkCopied')}</span>}
                {inviteError && <span className="text-xs text-amber-600 mt-1">{inviteError}</span>}
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <span className="text-slate-600 text-sm font-medium">{t('duration')}</span>
              <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">{formatDuration(elapsedSeconds)}</span>
            </div>
            <button onClick={handleEndOrCancel} className="px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 font-medium">
              {!endCallEndpoint && callId && inviteToken ? t('leave') : t('endCall')}
            </button>
          </div>
        </div>

        <div className="p-4 bg-brand-50 border-b border-brand-100 space-y-4">
          {azureError ? (
            <p className="text-amber-700 text-sm">{azureError}</p>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-semibold text-brand-900 mb-2">
                  {t('youSpeak')} ({mySourceLabel} → {otherLangLabel})
                </h2>
                {azureReady ? (
                  <div className="min-h-[56px] p-3 bg-white rounded-lg border border-brand-200 overflow-y-auto max-h-[200px]">
                    {translationPaused ? (
                      <p className="text-amber-700 text-sm italic">{t('mutedMessage')}</p>
                    ) : (accumulatedOut || interimOut) ? (
                      <p className="text-slate-800 whitespace-pre-wrap break-words">{accumulatedOut}{interimOut ? (accumulatedOut ? ' ' : '') + interimOut : ''}</p>
                    ) : (
                      <p className="text-slate-500 text-sm italic">{t('speakAndTranslate')}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-600 text-sm">{t('starting')}</p>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-brand-900 mb-2">
                  {t('otherPartySpeaks')} ({otherLangLabel} → {mySourceLabel})
                </h2>
                <div className="min-h-[56px] p-3 bg-white rounded-lg border border-brand-200 overflow-y-auto max-h-[200px]">
                  {accumulatedIn ? (
                    <p className="text-slate-800 whitespace-pre-wrap break-words">{accumulatedIn}</p>
                  ) : (
                    <p className="text-slate-500 text-sm italic">{t('whenOtherSpeaks')}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div ref={dailyContainerRef} className="min-h-[500px]" />
      </div>
    </div>
  );
}
