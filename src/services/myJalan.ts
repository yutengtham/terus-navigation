// "Send to MyJalan": MyJalan KKR is the Works Ministry's official road complaint app.
// There is no public API, so Terus never submits anything itself: it copies the report text
// and opens the official app listing (or the government info page on a computer).

const IOS = 'https://apps.apple.com/my/app/myjalan-kkr/id1603797786';
const ANDROID = 'https://play.google.com/store/search?q=MyJalan%20KKR&c=apps';
const INFO = 'https://www.malaysia.gov.my/en/categories/safety-and-community/road-safety/myjalan-kkr-application';

export function myJalanUrl(userAgent = navigator.userAgent): string {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return IOS;
  if (/Android/i.test(userAgent)) return ANDROID;
  return INFO;
}

/** Copies the text (if allowed) and opens MyJalan in a new tab. Returns whether the copy worked. */
export async function sendToMyJalan(text: string): Promise<boolean> {
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    /* clipboard blocked - the user can still type it */
  }
  window.open(myJalanUrl(), '_blank', 'noopener');
  return copied;
}
