import { useRef, useState, useCallback, useEffect } from 'react';

// Live two-way voice conversation engine.
// Flow: mic listens continuously → user pauses → utterance auto-sends (no
// send button) → agent reply is spoken aloud → mic resumes listening.
// Recognition is suspended while the agent speaks so it doesn't hear itself.

interface LiveVoiceOptions {
  onUtterance: (text: string) => void;
  silenceMs?: number; // pause length that counts as "done talking"
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '')                       // tagged blocks
    .replace(/```[\s\S]*?```/g, '')                                  // code blocks
    .replace(/[*_#`>|]/g, '')                                        // markdown
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '') // emoji
    .replace(/\s+/g, ' ')
    .trim();
}

export function useLiveVoice({ onUtterance, silenceMs = 1600 }: LiveVoiceOptions) {
  const [live, setLive] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');

  const recRef = useRef<any>(null);
  const liveRef = useRef(false);
  const speakingRef = useRef(false);
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const supported = typeof window !== 'undefined' &&
    (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition) &&
    'speechSynthesis' in window;

  const stopRecognition = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = null;
      try { rec.stop(); } catch { /* already stopped */ }
    }
    setListening(false);
    setInterim('');
  }, []);

  const startRecognition = useCallback(() => {
    if (!supported || !liveRef.current || speakingRef.current || recRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e: any) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) bufferRef.current += r[0].transcript + ' ';
        else interimText += r[0].transcript;
      }
      setInterim((bufferRef.current + interimText).trim());
      if (timerRef.current) clearTimeout(timerRef.current);
      // Auto-send once the user goes quiet
      timerRef.current = setTimeout(() => {
        const text = bufferRef.current.trim();
        if (!text) return;
        bufferRef.current = '';
        setInterim('');
        onUtteranceRef.current(text);
      }, silenceMs);
    };

    // Browsers kill recognition sessions randomly — keep it alive while live
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      if (liveRef.current && !speakingRef.current) setTimeout(startRecognition, 300);
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        liveRef.current = false;
        setLive(false);
      }
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch { /* start() throws if called too soon after stop */ }
  }, [supported, silenceMs]);

  const speak = useCallback((text: string) => {
    if (!liveRef.current || !('speechSynthesis' in window)) return;
    const clean = cleanForSpeech(text);
    if (!clean) return;
    stopRecognition();
    speakingRef.current = true;
    setSpeaking(true);

    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => /Google US English|Samantha|Aria|Jenny/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('en'));
    if (preferred) u.voice = preferred;

    const done = () => {
      speakingRef.current = false;
      setSpeaking(false);
      if (liveRef.current) setTimeout(startRecognition, 200);
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [startRecognition, stopRecognition]);

  const startLive = useCallback(() => {
    if (!supported) return;
    liveRef.current = true;
    setLive(true);
    // Prime the voice list (loads async in some browsers)
    window.speechSynthesis.getVoices();
    startRecognition();
  }, [supported, startRecognition]);

  const stopLive = useCallback(() => {
    liveRef.current = false;
    setLive(false);
    bufferRef.current = '';
    stopRecognition();
    speakingRef.current = false;
    setSpeaking(false);
    window.speechSynthesis?.cancel();
  }, [stopRecognition]);

  useEffect(() => () => {
    liveRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    try { recRef.current?.stop(); } catch { /* noop */ }
    window.speechSynthesis?.cancel();
  }, []);

  return { supported, live, listening, speaking, interim, startLive, stopLive, speak };
}
