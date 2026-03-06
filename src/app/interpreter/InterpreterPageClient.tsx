'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import Link from 'next/link';
import { playNotificationSound } from '@/lib/notification-sound';
import { requestNotificationPermission, showOfferNotification } from '@/lib/browser-notification';

type Offer = {
  jobId: string;
  requestId: string;
  languagePair: string;
  specialty: string;
  estimatedDurationMinutes: number;
  notes?: string;
  urgency: string;
  expiresAt: string;
};

type AssignedJob = {
  jobId: string;
  joinToken: string;
  roomId: string;
};

export default function InterpreterPageClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [approvalStatus, setApprovalStatus] = useState<{ approved: boolean; rejected: boolean; pending: boolean } | null>(null);
  const [availability, setAvailability] = useState<'online' | 'offline' | 'busy'>('offline');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [assignedJob, setAssignedJob] = useState<AssignedJob | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const knownOfferIds = useRef<Set<string>>(new Set());
  const hasInitialLoad = useRef(false);

  useEffect(() => {
    fetch('/api/interpreter/approval-status')
      .then((r) => r.json())
      .then(setApprovalStatus)
      .catch(() => setApprovalStatus({ approved: false, rejected: false, pending: true }));
  }, []);

  useEffect(() => {
    fetch('/api/interpreter/availability')
      .then((r) => r.json())
      .then((a) => {
        const status = a.status || 'offline';
        setAvailability(status);
        if (status === 'online') requestNotificationPermission();
      })
      .catch(console.error);
  }, []);

  // Poll for offers (runs regardless of availability - API only returns offers you're matched to)
  useEffect(() => {
    if (status !== 'authenticated') return;
    const poll = () =>
      fetch('/api/interpreter/offers')
        .then((r) => r.json())
        .then((list: Offer[]) => setOffers((prev) => {
          const ids = new Set(list.map((o) => o.jobId));
          const fromSocket = prev.filter((o) => !ids.has(o.jobId));
          const merged = [...list, ...fromSocket];

          // Seed known IDs on first load (don't notify for offers already on screen)
          if (!hasInitialLoad.current) {
            hasInitialLoad.current = true;
            list.forEach((o) => knownOfferIds.current.add(o.jobId));
          } else {
            const newOffers = list.filter((o) => !knownOfferIds.current.has(o.jobId));
            if (newOffers.length > 0) {
              list.forEach((o) => knownOfferIds.current.add(o.jobId));
              playNotificationSound();
              const first = newOffers[0];
              showOfferNotification({ languagePair: first.languagePair, specialty: first.specialty });
            }
          }

          return merged;
        }))
        .catch(() => {});
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    const userId = (session.user as { id?: string }).id;
    const role = (session.user as { role?: string }).role;
    if (!userId || role !== 'interpreter') return;

    const socket = io({
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });
    socket.on('connect', () => socket.emit('auth', { userId, role }));

    socket.on('offer_created', (offer: Offer) => {
      setOffers((prev) => {
        if (prev.some((o) => o.jobId === offer.jobId)) return prev;
        knownOfferIds.current.add(offer.jobId);
        playNotificationSound();
        showOfferNotification({ languagePair: offer.languagePair, specialty: offer.specialty });
        return [...prev, offer];
      });
    });

    socket.on('job_assigned', (data: AssignedJob) => {
      setAssignedJob(data);
      setOffers((prev) => prev.filter((o) => o.jobId !== data.jobId));
      router.push(`/interpreter/call/${data.jobId}`);
    });

    socket.on('offer_revoked', (data: { jobId: string }) => {
      setOffers((prev) => prev.filter((o) => o.jobId !== data.jobId));
    });

    return () => {
      socket.disconnect();
    };
  }, [session, status]);

  const setStatus = async (status: 'online' | 'offline' | 'busy') => {
    await fetch('/api/interpreter/availability', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setAvailability(status);
    if (status === 'online') {
      requestNotificationPermission();
    }
  };

  const acceptOffer = async (jobId: string) => {
    setAccepting(jobId);
    try {
      const res = await fetch(`/api/offers/${jobId}/accept`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.job) {
        setAssignedJob({ jobId, joinToken: data.job.joinToken, roomId: data.job.roomId });
        setOffers((prev) => prev.filter((o) => o.jobId !== jobId));
        router.push(`/interpreter/call/${jobId}`);
      } else if (data.error === 'ALREADY_ASSIGNED') {
        setOffers((prev) => prev.filter((o) => o.jobId !== jobId));
        alert('This job was already assigned to another interpreter.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAccepting(null);
    }
  };

  const declineOffer = async (jobId: string) => {
    await fetch(`/api/offers/${jobId}/decline`, { method: 'POST' });
    setOffers((prev) => prev.filter((o) => o.jobId !== jobId));
  };

  if (approvalStatus === null) return <div className="text-slate-600">Loading…</div>;

  if (approvalStatus.pending || approvalStatus.rejected) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Interpreter Dashboard</h1>
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl max-w-2xl">
          <h2 className="font-semibold text-amber-900 mb-2">
            {approvalStatus?.rejected ? 'Your account was not approved.' : 'Your account is pending approval.'}
          </h2>
          <p className="text-amber-800">
            {approvalStatus?.rejected
              ? 'Please contact info@rolling-translations.com if you believe this was an error.'
              : 'Please look for an email from info@rolling-translations.com and follow the instructions. An admin will review your documentation and approve your account. You will receive an email once approved.'}
          </p>
        </div>
        <Link href="/interpreter/profile" className="inline-block mt-6 text-slate-600 hover:text-slate-900 font-medium">
          View your profile
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Interpreter Dashboard</h1>
        <p className="text-slate-600 mt-1">Set your availability and receive job offers</p>
      </div>

      <div className="mb-8 p-4 bg-white rounded-xl border border-slate-200">
        <h2 className="font-semibold text-slate-900 mb-3">Availability</h2>
        <div className="flex gap-2">
          {(['online', 'offline', 'busy'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                availability === s
                  ? s === 'online'
                    ? 'bg-green-600 text-white'
                    : s === 'busy'
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {assignedJob && (
        <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-xl">
          <h2 className="font-semibold text-green-900 mb-2">You're assigned!</h2>
          <Link
            href={`/interpreter/call/${assignedJob.jobId}`}
            className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
          >
            Join Call
          </Link>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-slate-900 mb-4">Active Offers</h2>
        {availability !== 'online' && (
          <p className="text-amber-700 bg-amber-50 p-3 rounded-lg mb-4 text-sm">
            Set your status to <strong>Online</strong> to receive offers. Complete your <a href="/interpreter/profile" className="underline">Profile</a> (languages + specialties) so you match incoming requests.
          </p>
        )}
        {offers.length === 0 ? (
          <p className="text-slate-500">
            No active offers. Stay online and ensure your profile matches the request (language pair + specialty).
          </p>
        ) : (
          <div className="space-y-4">
            {offers.map((o) => (
              <div
                key={o.jobId}
                className="p-4 bg-white rounded-xl border-2 border-brand-200 shadow-sm"
              >
                <p className="font-medium text-slate-900">{o.languagePair} — {o.specialty}</p>
                <p className="text-sm text-slate-600 mt-1">
                  ~{o.estimatedDurationMinutes} min • {o.urgency}
                </p>
                {o.notes && <p className="text-sm text-slate-500 mt-1">{o.notes}</p>}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => acceptOffer(o.jobId)}
                    disabled={!!accepting}
                    className="px-4 py-2 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50"
                  >
                    {accepting === o.jobId ? 'Accepting…' : 'Accept'}
                  </button>
                  <button
                    onClick={() => declineOffer(o.jobId)}
                    className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 font-medium"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
