/**
 * Generates a unique 6-digit numeric Client ID for phone IVR access.
 * Used to identify organizations when callers dial in.
 */
import { prisma } from './prisma';

const MIN_ID = 100000;
const MAX_ID = 999999;
const MAX_ATTEMPTS = 20;

function random6Digit(): string {
  const n = Math.floor(Math.random() * (MAX_ID - MIN_ID + 1)) + MIN_ID;
  return String(n);
}

/**
 * Generate a unique 6-digit Client ID. Retries on collision.
 */
export async function generateClientId(): Promise<string> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const id = random6Digit();
    const existing = await prisma.organization.findFirst({
      where: { phoneClientId: id },
    });
    if (!existing) return id;
  }
  throw new Error('Failed to generate unique Client ID after max attempts');
}
