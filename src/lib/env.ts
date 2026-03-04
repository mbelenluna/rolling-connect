/**
 * Validates required environment variables at runtime.
 * Call before using Prisma or NextAuth to fail fast with clear errors.
 * Skips during Next.js build phase (no server execution).
 */
export function ensureRequiredEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.npm_lifecycle_event === 'build') return;

  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.NEXTAUTH_SECRET) missing.push('NEXTAUTH_SECRET');
  if (!process.env.NEXTAUTH_URL) missing.push('NEXTAUTH_URL');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Set them in your deployment environment (e.g. Vercel project settings). ' +
        'NEXTAUTH_SECRET: generate with "openssl rand -base64 32". ' +
        'NEXTAUTH_URL: your app URL (e.g. https://yourdomain.com).'
    );
  }
}
