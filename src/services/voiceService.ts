/**
 * Voice guidance (English; Arrow Mode cues also in Malay and Chinese) using the browser's built-in text-to-speech (Web Speech API).
 * Free, works offline once the voice is installed, no extra service needed.
 * Voice quality depends on the phone: Android uses Google voices, iPhone uses Siri voices.
 */

let chosenVoice: SpeechSynthesisVoice | null = null;

export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/** Prefer a Malaysian English voice, then British, then any English voice. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const byLang = (prefix: string) => voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix));
  return byLang('en-my') ?? byLang('en-gb') ?? byLang('en-sg') ?? byLang('en-au') ?? byLang('en') ?? null;
}

if (isVoiceSupported()) {
  // Voices load asynchronously in some browsers.
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    chosenVoice = pickVoice();
  });
}

/**
 * Phones only allow speech that starts from a tap. Call this from the "Start navigation"
 * tap so later instructions are allowed to speak.
 */
export function unlockVoice(): void {
  if (!isVoiceSupported()) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

/** Mapbox writes US spelling; display text uses Malaysian/British "metres". */
export function toMalaysianEnglish(text: string): string {
  return text.replace(/\bmeters\b/g, 'metres').replace(/\bmeter\b/g, 'metre');
}

/**
 * A voice for another language (Arrow Mode: 'ms-MY' Bahasa Melayu, 'zh-CN' Chinese).
 * Falls back to any voice of that language, e.g. Indonesian for Malay if no Malay voice is installed.
 */
function pickVoiceFor(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  const want = lang.toLowerCase();
  const base = want.split('-')[0];
  return (
    voices.find((v) => norm(v) === want) ??
    voices.find((v) => norm(v).startsWith(base)) ??
    (base === 'ms' ? voices.find((v) => norm(v).startsWith('id')) : undefined) ?? // Malay and Indonesian are close
    null
  );
}

export type SpeakOptions = {
  interrupt?: boolean;
  lang?: string;
  /** Voice personality tone (default 1) */
  pitch?: number;
  rate?: number;
};

export function speak(text: string, options: SpeakOptions = {}): void {
  if (!isVoiceSupported()) return;
  const synth = window.speechSynthesis;
  if (options.interrupt) synth.cancel(); // a newer, more urgent instruction replaces the old one
  if (options.lang && !options.lang.startsWith('en')) {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoiceFor(options.lang);
    if (v) u.voice = v;
    u.lang = v?.lang ?? options.lang; // without an installed voice the browser may still try
    u.pitch = options.pitch ?? 1;
    u.rate = options.rate ?? 1;
    synth.speak(u);
    return;
  }
  const u = new SpeechSynthesisUtterance(toMalaysianEnglish(text));
  chosenVoice ??= pickVoice();
  if (chosenVoice) u.voice = chosenVoice;
  u.lang = chosenVoice?.lang ?? 'en-GB';
  u.rate = options.rate ?? 1;
  u.pitch = options.pitch ?? 1;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (isVoiceSupported()) window.speechSynthesis.cancel();
}
