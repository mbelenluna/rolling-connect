'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { io } from 'socket.io-client';

/**
 * Listens for request_status=assigned and redirects client to call.
 * Ensures redirect works from any client page (dashboard, requests, etc).
 */
export default function ClientSocketListener() {
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;
    const socket = io({ path: '/api/socketio' });
    socket.on('connect', () => socket.emit('auth', { userId, role: 'client' }));
    socket.on('request_status', (payload: { status: string; requestId?: string }) => {
      if (payload.status === 'assigned' && payload.requestId) {
        router.replace(`/client/call/${payload.requestId}`);
      }
    });
    return () => socket.disconnect();
  }, [session?.user, router]);

  return null;
}
