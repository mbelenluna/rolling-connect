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
  leaveEndpoint: string;
  endForEveryoneEndpoint: string;
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
}: TwilioCallRoomProps) {
  const router = useRouter();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const timerStartRef = useRef<number | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    if (!twilioToken || !conferenceName) return;

    // Diagnostic: token length (do not log full token)
    if (typeof window !== 'undefined') {
      console.log('[TwilioCallRoom] token received', { tokenLength: twilioToken?.length ?? 0, conferenceName });
    }

    const device = new Device(twilioToken, {
      logLevel: 0,
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
    });

    deviceRef.current = device;

    device.on('registered', () => {
      if (typeof window !== 'undefined') console.log('[TwilioCallRoom] device registered, connecting to conference');
      setStatus('connecting');
      device
        .connect({ params: { conferenceName } })
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
      setError(err.message || 'Connection failed');
      setStatus('error');
    });

    device.register();

    return () => {
      if (callRef.current) {
        callRef.current.disconnect();
      }
      device.destroy();
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

  const handleLeaveCall = () => {
    if (callRef.current) {
      callRef.current.disconnect();
    }
    router.replace(backHref);
  };

  const handleEndForEveryone = async () => {
    setShowEndConfirm(false);
    await fetch(endForEveryoneEndpoint, { method: 'POST', credentials: 'include' }).catch(() => {});
    if (callRef.current) {
      callRef.current.disconnect();
    }
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
              <button
                onClick={handleLeaveCall}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                Leave Call
              </button>
              <button
                onClick={() => setShowEndConfirm(true)}
                className="px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 font-medium"
              >
                End Call for Everyone
              </button>
            </div>
          </div>
        </div>
        <div className="p-8 min-h-[200px] flex flex-col items-center justify-center bg-slate-50 gap-4">
          {status === 'connecting' && (
            <p className="text-slate-600">Connecting you to the caller on the phone...</p>
          )}
          {status === 'connected' && (
            <>
              <p className="text-slate-600">You are connected. The caller is on the phone — speak normally.</p>
              <p className="text-sm text-slate-500">
                Leave Call = you leave only (client stays, you can rejoin). End Call for Everyone = disconnect client and end session.
              </p>
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
