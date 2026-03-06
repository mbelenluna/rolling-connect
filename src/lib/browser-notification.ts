/**
 * Browser notifications for new interpreter offers.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch {
    return false;
  }
}

export function showOfferNotification(offer: { languagePair: string; specialty: string }): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const n = new Notification('New interpretation request', {
      body: `${offer.languagePair} — ${offer.specialty}. Accept or decline now.`,
      icon: '/rolling-translations-logo.png',
      tag: 'rolling-connect-offer',
      requireInteraction: true,
    });

    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Ignore
  }
}
