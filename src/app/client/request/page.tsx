import { Suspense } from 'react';
import RequestPageClient from './RequestPageClient';

export const dynamic = 'force-dynamic';

export default function RequestPage() {
  return (
    <Suspense fallback={<div className="text-slate-600 p-8">Loading…</div>}>
      <RequestPageClient />
    </Suspense>
  );
}
