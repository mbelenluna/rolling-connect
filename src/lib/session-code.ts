/**
 * Generates a unique 10-digit numeric phone session code for a Call.
 * Displayed on screen so callers can dial in and join a specific active session.
 */
import { prisma } from './prisma';

export async function generateUniquePhoneSessionCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    // Random 10-digit code: 1000000000 – 9999999999
    const code = String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000);
    const existing = await prisma.call.findUnique({ where: { phoneSessionCode: code } });
    if (!existing) return code;
  }
  throw new Error('[session-code] Failed to generate unique phone session code after 10 attempts');
}
