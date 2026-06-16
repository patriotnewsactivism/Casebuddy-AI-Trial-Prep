import { useRef, useState, useCallback, useEffect } from 'react';
import { playRingback, Ringback } from '../lib/phoneSound';

// Live two-way voice conversation engine.
// Flow: mic listens continuously → user pauses → utterance auto-sends (no
// send button) → agent reply is spoken aloud → mic resumes listening.
//
// Two engines, picked automatically:
//  1. Deepgram (when REACT_APP_DEEPGRAM_API_KEY is set) — streaming
//     recognition + natural Aura voice. Far more accurate, works great on
//     phones where the browser's built-in recognition struggles.
//  2. Browser Web Speech API — zero-setup fallback.

const DG_KEY = process.env.REACT_APP_DEEPGRAM_API_KEY || '';

interface LiveVoiceOptions {
  onUtterance: (text: string) => void;
  silenceMs?: number; // pause length that counts as "done talking"
  voiceModel?: string; // Deepgram Aura voice, e.g. 'aura-asteria-en' — gives each agent a distinct voice
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

export function useLiveVoice({ onUtterance, silenceMs = 1600, voiceModel = 'aura-asteria-en' }: LiveVoiceOptions) {
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false); // "ringing" — Maya is picking up
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');

  const liveRef = useRef(false);
  const speakingRef = useRef(false);
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  // Engine handles
  const recRef = useRef<any>(null);                 // web speech recognition
  const wsRef = useRef<WebSocket | null>(null);     // deepgram socket
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dgFailedRef = useRef(false);                // fell back to web speech
  const ringbackRef = useRef<Ringback | null>(null);              // "ringing" tone while connecting
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasWebSpeech = typeof window !== 'undefined' &&
    (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition) &&
    'speechSynthesis' in window;
  const hasDeepgram = !!DG_KEY && typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia && 'MediaRecorder' in window;
  const supported = hasDeepgram || hasWebSpeech;

  const dgActive = () => hasDeepgram && !dgFailedRef.current;

  const flush = useCallback(() => {
    const text = bufferRef.current.trim();
    bufferRef.current = '';
    setInterim('');
    if (text) onUtteranceRef.current(text);
  }, []);

  const armSilenceTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (bufferRef.current.trim()) flush();
    }, silenceMs);
  }, [silenceMs, flush]);

  // ===== Deepgram streaming recognition =====

  const stopDgRecognition = useCallback(() => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    } catch { /* noop */ }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) { ws.onmessage = null; ws.onclose = null; try { ws.close(); } catch { /* noop */ } }
    setListening(false);
    setInterim('');
  }, []);

  const startDgRecognition = useCallback(async () => {
    if (!liveRef.current || speakingRef.current || wsRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!liveRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      const params = new URLSearchParams({
        model: 'nova-2',
        language: 'en-US',
        smart_format: 'true',
        interim_results: 'true',
        endpointing: '400',
        utterance_end_ms: String(Math.max(1000, silenceMs)),
        vad_events: 'true',
      });
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', DG_KEY]);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!liveRef.current || wsRef.current !== ws) return;
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
        const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = e => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
        };
        recorder.start(250);
        setListening(true);
      };

      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'Results') {
            const alt = msg.channel?.alternatives?.[0];
            const transcript: string = alt?.transcript || '';
            if (msg.is_final && transcript) bufferRef.current += transcript + ' ';
            setInterim((bufferRef.current + (msg.is_final ? '' : transcript)).trim());
            if (transcript || bufferRef.current) armSilenceTimer();
            if (msg.speech_final && bufferRef.current.trim()) flush();
          } else if (msg.type === 'UtteranceEnd' && bufferRef.current.trim()) {
            flush();
          }
        } catch { /* non-JSON frame */ }
      };

      ws.onerror = () => {
        // Deepgram unreachable (bad key, network) — fall back to web speech
        if (wsRef.current === ws) {
          dgFailedRef.current = true;
          stopDgRecognition();
          if (liveRef.current && hasWebSpeech && !speakingRef.current) startWebRecognition();
        }
      };
      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          setListening(false);
          if (liveRef.current && !speakingRef.current) setTimeout(() => dgActive() ? startDgRecognition() : startWebRecognition(), 400);
        }
      };
    } catch {
      // mic permission denied or unavailable
      dgFailedRef.current = true;
      if (liveRef.current && hasWebSpeech) startWebRecognition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silenceMs, armSilenceTimer, flush, stopDgRecognition]);

  // ===== Browser Web Speech recognition (fallback) =====

  const stopWebRecognition = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = null;
      try { rec.stop(); } catch { /* already stopped */ }
    }
    setListening(false);
    setInterim('');
  }, []);

  const startWebRecognition = useCallback(() => {
    if (!hasWebSpeech || !liveRef.current || speakingRef.current || recRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = 'en-US';

    rec.onresult = (e: any) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) bufferRef.current += r[0].transcript + ' ';
        else interimText += r[0].transcript;
      }
      setInterim((bufferRef.current + interimText).trim());
      armSilenceTimer();
    };

    // Mobile browsers end recognition sessions constantly — keep it alive
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      // On mobile, the session often ends right when the user stops talking:
      // flush promptly so the reply isn't stuck waiting on the silence timer.
      if (bufferRef.current.trim()) flush();
      if (liveRef.current && !speakingRef.current) setTimeout(startWebRecognition, 350);
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        liveRef.current = false;
        setLive(false);
      }
      // 'no-speech'/'aborted'/'network' fall through to onend → auto-restart
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch { /* start() throws if called too soon after stop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWebSpeech, armSilenceTimer, flush]);

  const startRecognition = useCallback(() => {
    if (dgActive()) startDgRecognition();
    else startWebRecognition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDgRecognition, startWebRecognition]);

  const stopRecognition = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopDgRecognition();
    stopWebRecognition();
  }, [stopDgRecognition, stopWebRecognition]);

  // ===== Speech output =====

  const speakBrowser = useCallback((clean: string, done: () => void) => {
    if (!('speechSynthesis' in window)) { done(); return; }
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => /Google US English|Samantha|Aria|Jenny/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('en'));
    if (preferred) u.voice = preferred;
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  const speakDeepgram = useCallback(async (clean: string, done: () => void) => {
    try {
      const res = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${DG_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean.slice(0, 1900) }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      const finish = () => { URL.revokeObjectURL(url); audioRef.current = null; done(); };
      audio.onended = finish;
      audio.onerror = finish;
      await audio.play();
    } catch {
      speakBrowser(clean, done); // fall back to browser voice
    }
  }, [speakBrowser, voiceModel]);

  const speak = useCallback((text: string) => {
    if (!liveRef.current) return;
    const clean = cleanForSpeech(text);
    if (!clean) return;
    stopRecognition(); // never hear ourselves
    speakingRef.current = true;
    setSpeaking(true);

    const done = () => {
      speakingRef.current = false;
      setSpeaking(false);
      if (liveRef.current) setTimeout(startRecognition, 250);
    };
    if (hasDeepgram) speakDeepgram(clean, done);
    else speakBrowser(clean, done);
  }, [stopRecognition, startRecognition, speakDeepgram, speakBrowser, hasDeepgram]);

  // ===== Session control =====

  // startLive can behave three ways:
  //  • startLive()                              → just open the mic (resume mid-call)
  //  • startLive({ greeting })                  → Maya speaks first, then the mic opens
  //  • startLive({ ring: true, greeting })      → ring like a phone, Maya "picks up",
  //                                               greets, then the mic opens
  // The mic is never opened until Maya has finished her greeting, so the
  // caller can't talk over her and her opener can't collide with the user.
  const startLive = useCallback((opts?: { greeting?: string; ring?: boolean; onConnect?: () => void }) => {
    if (!supported) return;
    liveRef.current = true;
    setLive(true);
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices(); // prime async voice list

    const greeting = opts?.greeting?.trim();

    const pickUp = () => {
      connectTimerRef.current = null;
      ringbackRef.current?.stop();
      ringbackRef.current = null;
      setConnecting(false);
      if (!liveRef.current) return;
      opts?.onConnect?.();
      if (greeting) speak(greeting); // Maya talks first; speak() opens the mic when she's done
      else startRecognition();
    };

    if (opts?.ring) {
      setConnecting(true);
      ringbackRef.current = playRingback();
      connectTimerRef.current = setTimeout(pickUp, 2200); // one ring, then she answers
    } else {
      pickUp();
    }
  }, [supported, startRecognition, speak]);

  const stopLive = useCallback(() => {
    liveRef.current = false;
    setLive(false);
    setConnecting(false);
    if (connectTimerRef.current) { clearTimeout(connectTimerRef.current); connectTimerRef.current = null; }
    ringbackRef.current?.stop();
    ringbackRef.current = null;
    bufferRef.current = '';
    stopRecognition();
    speakingRef.current = false;
    setSpeaking(false);
    audioRef.current?.pause();
    audioRef.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, [stopRecognition]);

  useEffect(() => () => {
    liveRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    ringbackRef.current?.stop();
    try { recRef.current?.stop(); } catch { /* noop */ }
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    } catch { /* noop */ }
    streamRef.current?.getTracks().forEach(t => t.stop());
    wsRef.current?.close();
    audioRef.current?.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { supported, live, connecting, listening, speaking, interim, startLive, stopLive, speak };
}
