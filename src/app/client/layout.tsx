import { requireBilling } from '@/lib/rbac';
import ClientCallLayout from './ClientCallLayout';

export const dynamic = 'force-dynamic';

export default async function ClientLayout({
  children,
}: { children: React.ReactNode }) {
  await requireBilling('client');
  return <ClientCallLayout>{children}</ClientCallLayout>;
}
