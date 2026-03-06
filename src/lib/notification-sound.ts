/**
 * Play a short notification sound for new interpreter offers.
 * Tries /sounds/notification.mp3 first, falls back to Web Audio API beep.
 *
 * Add your audio file to: public/sounds/notification.wav (or .mp3)
 */
const NOTIFICATION_SOUND_PATH = '/sounds/notification.wav';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

function playWebAudioBeep(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore
  }
}

/**
 * Call this after a user gesture (e.g. clicking "Online") to unlock audio playback.
 * Browsers block autoplay until the user has interacted with the page.
 */
export function primeAudioForNotifications(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (ctx?.state === 'suspended') ctx.resume();
    const audio = new Audio(NOTIFICATION_SOUND_PATH);
    audio.volume = 0;
    audio.play().then(() => audio.pause()).catch(() => {});
  } catch {
    // Ignore
  }
}

export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;

  const audio = new Audio(NOTIFICATION_SOUND_PATH);
  audio.volume = 0.8;

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      playWebAudioBeep();
    });
  } else {
    playWebAudioBeep();
  }
}
