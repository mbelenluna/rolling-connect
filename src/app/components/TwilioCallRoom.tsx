'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Device, Call } from '@twilio/voice-sdk';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

type TwilioCallRoomProps = {
  twilioToken: string;
  conferenceName: string;
  callId: string;
  backHref: string;
  backLabel: string;
  summaryHref: string;
  leaveEndpoint?: string;
  endForEveryoneEndpoint?: string;
  role?: 'interpreter' | 'client';
  endCallEndpoint?: string;
  phoneSessionCode?: string | null;
  phoneNumber?: string | null;
};

export default function TwilioCallRoom({
  twilioToken,
  conferenceName,
  callId,
  backHref,
  backLabel,
  summaryHref,
  leaveEndpoint,
  endForEveryoneEndpoint,
  role,
  endCallEndpoint,
  phoneSessionCode,
  phoneNumber,
}: TwilioCallRoomProps) {
  const router = useRouter();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [phoneParticipants, setPhoneParticipants] = useState<Array<{ callSid: string; from: string }>>([]);
  const timerStartRef = useRef<number | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    if (!twilioToken || !conferenceName) return;

    let destroyed = false;

    (async () => {
      // Diagnostic: token length (do not log full token)
      console.log('[TwilioCallRoom] token received', { tokenLength: twilioToken?.length ?? 0, conferenceName });

      if (destroyed) return;

      const device = new Device(twilioToken, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

      deviceRef.current = device;

      device.on('registered', () => {
        console.log('[TwilioCallRoom] device registered, connecting to conference');
        setStatus('connecting');
        device
          .connect({ params: { conferenceName, role: role ?? 'interpreter' } })
          .then((call) => {
            callRef.current = call;
            call.on('accept', () => {
              setStatus('connected');
              timerStartRef.current = Date.now();
              setTimerStarted(true);
            });
            call.on('disconnect', () => {
              setStatus('disconnected');
              device.destroy();
              deviceRef.current = null;
              callRef.current = null;
              router.replace(backHref);
            });
            call.on('error', (err: { message?: string }) => {
              console.error('[TwilioCallRoom] call error:', err);
              setError(err?.message || 'Call failed');
              setStatus('error');
            });
          })
          .catch((err: { message?: string }) => {
            console.error('[TwilioCallRoom] connect error:', err);
            setError(err?.message || 'Failed to connect');
            setStatus('error');
          });
      });

      device.on('error', (err) => {
        console.error('[TwilioCallRoom] device error:', err?.message ?? err, err);
        // Twilio error 31208 = getUserMedia not successful (mic blocked/denied)
        const isMicError = err?.code === 31208 || err?.message?.toLowerCase().includes('getusermedia');
        setError(isMicError
          ? 'Microphone access was denied. Please allow microphone access in your browser settings and refresh the page.'
          : (err.message || 'Connection failed'));
        setStatus('error');
      });

      device.register();
    })();

    return () => {
      destroyed = true;
      if (callRef.current) {
        callRef.current.disconnect();
      }
      deviceRef.current?.destroy();
      deviceRef.current = null;
      callRef.current = null;
    };
  }, [twilioToken, conferenceName, backHref, router]);

  useEffect(() => {
    if (!timerStarted) return;
    const interval = setInterval(() => {
      if (timerStartRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStarted]);

  useEffect(() => {
    if (status !== 'connected') return;
    const poll = () => {
      fetch(`/api/calls/${callId}/phone-participants`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d.participants)) setPhoneParticipants(d.participants); })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 6000);
    return () => clearInterval(interval);
  }, [status, callId]);

  const handleCopyCode = () => {
    if (!phoneSessionCode) return;
    navigator.clipboard.writeText(phoneSessionCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleToggleMute = () => {
    if (!callRef.current) return;
    const next = !isMuted;
    callRef.current.mute(next);
    setIsMuted(next);
  };

  const handleLeaveCall = () => {
    if (callRef.current) {
      callRef.current.disconnect();
    }
    router.replace(backHref);
  };

  const handleEndForEveryone = async () => {
    setShowEndConfirm(false);
    if (endForEveryoneEndpoint) {
      await fetch(endForEveryoneEndpoint, { method: 'POST', credentials: 'include' }).catch(() => {});
    }
    if (callRef.current) {
      callRef.current.disconnect();
    }
    router.replace(summaryHref);
  };

  const handleEndCall = async () => {
    if (endCallEndpoint) {
      await fetch(endCallEndpoint, { method: 'POST', credentials: 'include' }).catch(() => {});
    }
    if (callRef.current) callRef.current.disconnect();
    router.replace(summaryHref);
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl border border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Audio Call</h1>
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="font-medium text-amber-800 mb-1">Connection error:</p>
          <p className="text-sm text-amber-700">{error}</p>
        </div>
        <Link href={backHref} className="px-6 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 inline-block">
          {backLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <h1 className="text-lg font-bold text-slate-900">Audio Call (Phone)</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">
                {status === 'connecting' && 'Connecting to caller...'}
                {status === 'connected' && 'Connected'}
                {status === 'disconnected' && 'Ended'}
              </span>
              {timerStarted && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                  <span className="text-slate-600 text-sm font-medium">Duration</span>
                  <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                    {formatDuration(elapsedSeconds)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {status === 'connected' && (
                <button
                  onClick={handleToggleMute}
                  className={`px-4 py-2 rounded-lg font-medium border ${isMuted ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
              )}
              {endCallEndpoint && (
                <button
                  onClick={handleEndCall}
                  className="px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 font-medium"
                >
                  End Call
                </button>
              )}
              {leaveEndpoint && (
                <button
                  onClick={handleLeaveCall}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Leave Call
                </button>
              )}
              {endForEveryoneEndpoint && (
                <button
                  onClick={() => setShowEndConfirm(true)}
                  className="px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 font-medium"
                >
                  End Call for Everyone
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="p-6 bg-slate-50 space-y-4">
          {status === 'connecting' && (
            <p className="text-slate-600 text-center py-8">Connecting to the session...</p>
          )}

          {status === 'connected' && (
            <>
              <p className="text-slate-700">
                You are connected.
                {isMuted && <span className="ml-2 font-medium text-amber-700">Your microphone is muted.</span>}
              </p>

              {/* Phone join instructions */}
              {phoneNumber && phoneSessionCode && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Join by phone</p>
                  <p className="text-sm text-slate-600">
                    Call <span className="font-mono font-medium text-slate-900">{phoneNumber}</span>, press <span className="font-medium">2</span>, then enter the session code:
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl font-bold tracking-widest text-slate-900">
                      {phoneSessionCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 font-medium"
                    >
                      {codeCopied ? '✓ Copied' : 'Copy code'}
                    </button>
                  </div>
                </div>
              )}

              {/* Phone participants */}
              {phoneParticipants.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">
                    Phone participant{phoneParticipants.length > 1 ? 's' : ''} connected
                  </p>
                  <ul className="space-y-1">
                    {phoneParticipants.map((p) => (
                      <li key={p.callSid} className="flex items-center gap-2 text-sm text-slate-800">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        <span className="font-mono">{p.from}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(leaveEndpoint || endForEveryoneEndpoint) && (
                <p className="text-xs text-slate-500">
                  Leave Call = you leave only (session continues). End Call for Everyone = ends the session for all participants.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">End Call for Everyone?</h2>
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
                End for Everyone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
