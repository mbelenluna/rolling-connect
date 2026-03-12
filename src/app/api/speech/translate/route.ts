import { NextResponse } from 'next/server';
import { toGoogleLanguage } from '@/lib/speech-languages';

export const dynamic = 'force-dynamic';

/**
 * POST /api/speech/translate
 * Translates text using Google Cloud Translation API.
 * Body: { text: string, sourceLang: string, targetLang: string }
 */
export async function POST(req: Request) {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: 'GOOGLE_TRANSLATE_API_KEY must be set in .env' },
      { status: 500 }
    );
  }

  let body: { text?: string; sourceLang?: string; targetLang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'Missing or empty text' }, { status: 400 });
  }

  const source = toGoogleLanguage(body.sourceLang ?? 'en');
  const target = toGoogleLanguage(body.targetLang ?? 'es');

  try {
    const url = new URL('https://translation.googleapis.com/language/translate/v2');
    url.searchParams.set('key', key);
    url.searchParams.set('q', text);
    url.searchParams.set('source', source);
    url.searchParams.set('target', target);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
      const err = data?.error?.message ?? `Translation failed: ${res.status}`;
      console.error('Google Translate error:', err);
      return NextResponse.json({ error: err }, { status: res.status >= 500 ? 502 : 400 });
    }

    const translated = data?.data?.translations?.[0]?.translatedText ?? '';
    return NextResponse.json({ translated });
  } catch (e) {
    console.error('Translation error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Translation failed' },
      { status: 500 }
    );
  }
}
