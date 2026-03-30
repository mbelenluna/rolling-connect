import { prisma } from '@/lib/prisma';

export async function SystemBanner() {
  let bannerText = '';
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'system_banner' } });
    bannerText = setting?.value ?? '';
  } catch {
    bannerText = '';
  }

  if (!bannerText) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-sm text-amber-800 font-medium"
    >
      <span className="mr-2" aria-hidden="true">⚠️</span>
      {bannerText}
    </div>
  );
}
