'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { io } from 'socket.io-client';

/**
 * Listens for request_status=assigned and redirects client to call.
 * Ensures redirect works from any client page (dashboard, requests, etc).
 * Skip on /client/call/* - Socket.IO 404s in production; call page doesn't need request_status.
 */
export default function ClientSocketListener() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;
    if (pathname?.startsWith('/client/call/')) return;
    const socket = io({ path: '/api/socketio', reconnection: false });
    socket.on('connect', () => socket.emit('auth', { userId, role: 'client' }));
    socket.on('request_status', (payload: { status: string; requestId?: string }) => {
      if (payload.status === 'assigned' && payload.requestId) {
        router.replace(`/client/call/${payload.requestId}`);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [session?.user, router, pathname]);

  return null;
}
