import { requireRole } from '@/lib/rbac';
import ClientCallLayout from './ClientCallLayout';

export default async function ClientLayout({
  children,
}: { children: React.ReactNode }) {
  await requireRole('client');
  return <ClientCallLayout>{children}</ClientCallLayout>;
}
