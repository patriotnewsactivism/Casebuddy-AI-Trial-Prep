/**
 * PublicIntake.tsx  —  Public client intake page
 * ─────────────────────────────────────────────────────────────────────────────
 * Route:  /intake          (general — no firm config)
 *         /intake/:firmId  (firm-specific — loads firm name/logo/rules)
 *
 * Flow:
 *   Welcome → Maya greets → Type select → Q&A (voice or text) → AI auto-routes
 *   → "Under Review" | "We'll Contact You" | "Not a Fit" screen
 *
 * Auto-routing rules (configurable in IntakeInbox settings):
 *   ACCEPT  → urgency = deadline + summary > 30 words
 *   REVIEW  → default
 *   DECLINE → case type in firm's decline list
 *
 * Everything saves to Supabase `client_intakes` table.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic, MicOff, RadioTower, Radio, Volume2, VolumeX,
  ChevronRight, Loader2, CheckCircle, Scale, Send,
  Shield, Lock, Clock, XCircle, ArrowRight
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL  || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BANK  —  fixed set Maya always asks, in order
// ─────────────────────────────────────────────────────────────────────────────
interface Q {
  id: string;
  field: string;
  maya: string;           // what Maya says / displays
  type: 'text' | 'choice' | 'multiline';
  choices?: string[];
  skipIf?: (a: Record<string,string>) => boolean;
}

// ── Acknowledgments Maya says BEFORE asking the next question ───────────────
// Keyed by the PREVIOUS question's id
const ACKNOWLEDGMENTS: Record<string, string[]> = {
  name:         ["Got it — nice to meet you.", "Great, thank you.", "Perfect."],
  phone:        ["Got it.", "Thanks — I have that.", "Perfect, noted."],
  email:        ["Great, I have your contact info.", "Got it, thank you."],
  case_type:    [
    "Understood — I want you to know you came to the right place.",
    "Okay, thank you for sharing that with me.",
    "I appreciate you trusting us with this.",
  ],
  what_happened:[
    "Thank you for sharing that — I know it's not always easy to talk about these things.",
    "I hear you. That sounds really difficult, and I appreciate you walking me through it.",
    "Got it. I want you to know everything you've told me stays completely confidential.",
  ],
  when:         ["Okay, I have that noted.", "Thank you — timing can be really important in these cases.", "Got it."],
  other_party:  ["Understood, I have that noted.", "Okay, good to know.", "Got it."],
  damages:      [
    "I'm sorry to hear that — those details are really important and I want to make sure the attorneys have the full picture.",
    "Thank you for being so thorough. That really helps our team understand what you've been through.",
    "Got it, I have all of that noted.",
  ],
  urgency:      ["Understood. I'll make sure that's flagged for the team.", "Got it — that's helpful context.", "Okay, noted."],
};

function pickAck(questionId: string): string {
  const opts = ACKNOWLEDGMENTS[questionId];
  if (!opts) return '';
  return opts[Math.floor(Math.random() * opts.length)];
}

const QUESTIONS: Q[] = [
  {
    id: 'name', field: 'client_name', type: 'text',
    maya: "First — what\'s your full legal name?",
  },
  {
    id: 'phone', field: 'client_phone', type: 'text',
    maya: "What\'s the best phone number to reach you?",
  },
  {
    id: 'email', field: 'client_email', type: 'text',
    maya: "And your email address? That\'s just so the team can follow up with you.",
  },
  {
    id: 'case_type', field: 'case_type', type: 'choice',
    maya: "Now — what type of legal matter brings you to us today? Go ahead and tap the one that fits best, or just tell me.",
    choices: [
      'Personal Injury',
      'Civil Rights / § 1983',
      'Criminal Defense',
      'Family Law / Divorce',
      'Employment / Wrongful Termination',
      'Contract Dispute',
      'Real Estate',
      'Immigration',
      'Other',
    ],
  },
  {
    id: 'what_happened', field: 'summary', type: 'multiline',
    maya: "I\'d like to hear what happened in your own words. There\'s no rush — take as much time as you need, and share as much detail as you\'re comfortable with.",
  },
  {
    id: 'when', field: 'incident_date', type: 'text',
    maya: "When did this happen? An approximate date is totally fine.",
  },
  {
    id: 'other_party', field: 'other_party', type: 'text',
    maya: "Who is the other party involved — is it a person, a company, a government agency, or someone else?",
  },
  {
    id: 'damages', field: 'damages', type: 'multiline',
    maya: "Were there any injuries, financial losses, or other damages as a result of this? Please describe anything you\'ve experienced.",
  },
  {
    id: 'urgency', field: 'urgency', type: 'choice',
    maya: "I want to make sure the team prioritizes appropriately — how urgent is this situation for you?",
    choices: [
      "There\'s an upcoming court date or legal deadline",
      "Moderately urgent — within the next few weeks",
      "No immediate deadline",
    ],
  },
  {
    id: 'outcome', field: 'desired_outcome', type: 'multiline',
    maya: "And the last question — what outcome are you hoping for? What would a good resolution look like to you?",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-ROUTING LOGIC
// ─────────────────────────────────────────────────────────────────────────────
type RouteResult = 'accept' | 'review' | 'decline';

// Firm config — in a real deployment this would load from Supabase firm_config
// For now: firm can set decline_types in the IntakeInbox settings page
const DEFAULT_DECLINE_TYPES: string[] = [];  // e.g. ['Immigration', 'Real Estate']
const DEFAULT_ACCEPT_URGENCY           = true; // auto-fast-track deadline cases

function autoRoute(answers: Record<string, string>): RouteResult {
  const caseType  = answers.case_type || '';
  const urgency   = answers.urgency   || '';
  const summary   = answers.summary   || '';

  // Firm decline list
  if (DEFAULT_DECLINE_TYPES.some(d => caseType.toLowerCase().includes(d.toLowerCase()))) {
    return 'decline';
  }

  // Fast-track: has deadline + substantive summary
  if (DEFAULT_ACCEPT_URGENCY &&
      urgency.toLowerCase().includes('court date') &&
      summary.split(' ').length > 20) {
    return 'accept';
  }

  return 'review';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAYA TTS
// ─────────────────────────────────────────────────────────────────────────────
const MAYA_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // ElevenLabs Sarah

async function mayaSpeak(text: string, muted: boolean): Promise<void> {
  if (muted) return;
  const key = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (key) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${MAYA_VOICE_ID}/stream`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.55, similarity_boost: 0.80, style: 0.2, use_speaker_boost: true },
        }),
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      return new Promise(r => {
        const a = new Audio(url);
        a.onended = () => { URL.revokeObjectURL(url); r(); };
        a.onerror = () => r();
        a.play().catch(() => r());
      });
    } catch { /* fall through */ }
  }
  return new Promise(r => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92; u.pitch = 1.05;
    u.onend = () => r();
    window.speechSynthesis.speak(u);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WAKE WORDS  (open-mic: pause 3s OR say one of these to submit answer)
// ─────────────────────────────────────────────────────────────────────────────
const WAKE = ['done','finished','submit','next','continue','move on',"that's it",'nothing more'];
const hasWake = (t: string) => WAKE.some(w => t.toLowerCase().includes(w));

type Phase     = 'welcome' | 'qa' | 'saving' | 'result';
type VoiceMode = 'open' | 'push';

// ─────────────────────────────────────────────────────────────────────────────
// RESULT SCREENS
// ─────────────────────────────────────────────────────────────────────────────
const ResultScreen: React.FC<{ route: RouteResult; name: string }> = ({ route, name }) => {
  const configs = {
    accept: {
      icon: '✅',
      color: 'border-emerald-500/30 bg-emerald-500/5',
      title: "We're On It",
      body: `You did the right thing reaching out, ${name ? name.split(' ')[0] : 'there'}. Given the urgency of your situation, your matter has been flagged for priority review. An attorney will be in touch with you very shortly — often within the same business day. We've got this.`,
      badge: 'text-emerald-400',
      badgeText: 'Priority Review',
    },
    review: {
      icon: '📋',
      color: 'border-blue-500/30 bg-blue-500/5',
      title: 'Intake Submitted',
      body: `Thank you, ${name ? name.split(' ')[0] : 'there'}. It takes courage to take this step, and we want you to know your situation will be reviewed carefully by our legal team. We'll be in touch within 1–2 business days. You don't have to navigate this alone.`,
      badge: 'text-blue-400',
      badgeText: 'Under Review',
    },
    decline: {
      icon: '🙏',
      color: 'border-slate-600 bg-slate-800/40',
      title: 'Thank You for Reaching Out',
      body: `Thank you, ${name ? name.split(' ')[0] : 'there'}, for sharing your situation with us. After careful review, we're unfortunately not able to take on this particular matter right now — but that doesn't mean you don't have options. We genuinely encourage you to consult with another attorney, and we wish you the very best.`,
      badge: 'text-slate-400',
      badgeText: 'Not a Current Fit',
    },
  };
  const c = configs[route];
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">{c.icon}</div>
        <div className={`inline-block px-3 py-1 rounded-full border text-xs font-semibold mb-4 ${c.badge} ${c.color}`}>
          {c.badgeText}
        </div>
        <h2 className="text-2xl font-bold mb-4">{c.title}</h2>
        <div className={`border rounded-2xl p-6 mb-6 ${c.color}`}>
          <p className="text-slate-300 leading-relaxed">{c.body}</p>
        </div>
        <div className="space-y-2 text-sm text-slate-500">
          <div className="flex items-center justify-center gap-2"><Lock size={12} /> Everything you shared is confidential</div>
          <div className="flex items-center justify-center gap-2"><Shield size={12} /> Secured by CaseBuddy</div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const PublicIntake: React.FC = () => {
  const [phase, setPhase]             = useState<Phase>('welcome');
  const [qIndex, setQIndex]           = useState(0);
  const [answers, setAnswers]         = useState<Record<string, string>>({});
  const [transcript, setTranscript]   = useState<{ q: string; a: string }[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [interimText, setInterimText] = useState('');
  const [listening, setListening]     = useState(false);
  const [openMicOn, setOpenMicOn]     = useState(false);
  const [voiceMode, setVoiceMode]     = useState<VoiceMode>('open');
  const [muted, setMuted]             = useState(false);
  const [mayaTalking, setMayaTalking] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult>('review');

  const recognitionRef = useRef<any>(null);
  const silenceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openMicRef     = useRef(false);
  const busyRef        = useRef(false);   // true while Maya speaking or processing
  const pushBufRef     = useRef('');
  const bottomRef      = useRef<HTMLDivElement>(null);

  useEffect(() => { openMicRef.current = openMicOn; }, [openMicOn]);
  useEffect(() => { busyRef.current = mayaTalking; }, [mayaTalking]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [qIndex, transcript, interimText]);
  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (silenceRef.current) clearTimeout(silenceRef.current);
  }, []);

  // ── Stop any active mic ────────────────────────────────────────────────
  const stopMic = useCallback(() => {
    openMicRef.current = false;
    setOpenMicOn(false);
    recognitionRef.current?.stop();
    setListening(false);
    setInterimText('');
    if (silenceRef.current) clearTimeout(silenceRef.current);
  }, []);

  // ── Submit one answer and advance ──────────────────────────────────────
  const submitAnswer = useCallback(async (raw: string) => {
    const value = raw.replace(/(done|finished|submit|next|continue|move on|that's it|nothing more)/gi, '').trim();
    if (!value || busyRef.current) return;
    stopMic();
    setCurrentInput('');
    setInterimText('');

    const q = QUESTIONS[qIndex];
    const newAnswers = { ...answers, [q.field]: value };
    setAnswers(newAnswers);
    setTranscript(prev => [...prev, { q: q.maya, a: value }]);

    const nextIdx = qIndex + 1;

    if (nextIdx >= QUESTIONS.length) {
      // All done — save and route
      setPhase('saving');
      busyRef.current = true;

      const route = autoRoute(newAnswers);
      setRouteResult(route);

      const sayings: Record<RouteResult, string> = {
        accept: `That's everything I need, and I want you to know — you did great. Given the urgency of your situation, I'm flagging this for priority review right now. An attorney will personally reach out to you very shortly. Hang tight — you're in good hands.`,
        review: `That's all I need — thank you so much for taking the time to walk me through everything. I know that's not always easy. Your intake is now with our legal team, and someone will be in touch within one to two business days. We genuinely appreciate you trusting us with this.`,
        decline: `Thank you for sharing all of that with me — I really mean it. I've passed everything along to our team. They'll review your information and if there's anything they can do to help, they'll reach out. Please don't hesitate to consult with another attorney as well — your situation matters.`,
      };

      setMayaTalking(true);
      await mayaSpeak(sayings[route], muted);
      setMayaTalking(false);
      busyRef.current = false;

      // Save to Supabase
      try {
        await supabase.from('client_intakes').insert({
          case_type:    newAnswers.case_type    || 'Unknown',
          client_name:  newAnswers.client_name  || '',
          client_email: newAnswers.client_email || '',
          client_phone: newAnswers.client_phone || '',
          summary:      newAnswers.summary      || '',
          status:       route === 'accept' ? 'new' : route === 'decline' ? 'declined' : 'new',
          answers:      newAnswers,
          transcript:   [...transcript, { q: q.maya, a: value }],
          submitted_at: new Date().toISOString(),
          auto_route:   route,
        });
      } catch (e) {
        console.warn('Supabase save failed:', e);
      }

      setPhase('result');
      return;
    }

    // Advance to next question — Maya acknowledges first
    setQIndex(nextIdx);
    const nextQ = QUESTIONS[nextIdx];
    busyRef.current = true;
    setMayaTalking(true);
    const ack = pickAck(q.id);
    const fullSpeech = ack ? `${ack} ${nextQ.maya}` : nextQ.maya;
    await mayaSpeak(fullSpeech, muted);
    setMayaTalking(false);
    busyRef.current = false;

    if (voiceMode === 'open') startOpenMic();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, answers, transcript, muted, voiceMode, stopMic]);

  // ── Open mic ───────────────────────────────────────────────────────────
  const startOpenMic = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || busyRef.current) return;
    let buf = '';
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';

    r.onresult = (e: any) => {
      if (busyRef.current) return;
      let fin = '', mid = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { fin += e.results[i][0].transcript + ' '; buf += e.results[i][0].transcript + ' '; }
        else mid += e.results[i][0].transcript;
      }
      setInterimText(buf + mid);
      if (silenceRef.current) clearTimeout(silenceRef.current);
      // Wake word → submit now
      if (fin && hasWake(fin)) {
        r.stop();
        const out = buf.trim(); buf = ''; setInterimText('');
        if (out) submitAnswer(out);
        return;
      }
      // Silence → submit after 3s
      silenceRef.current = setTimeout(() => {
        if (buf.trim() && !busyRef.current) {
          const out = buf.trim(); buf = ''; setInterimText('');
          submitAnswer(out);
        }
      }, 3000);
    };

    r.onend = () => {
      if (openMicRef.current && !busyRef.current) {
        setTimeout(() => { try { r.start(); } catch {} }, 300);
      } else {
        setListening(false);
      }
    };
    r.onerror = (e: any) => { if (e.error !== 'no-speech') console.warn(e.error); };

    recognitionRef.current = r;
    r.start();
    setListening(true);
    setOpenMicOn(true);
  }, [submitAnswer]);

  // ── Push-to-talk ───────────────────────────────────────────────────────
  const startPush = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || busyRef.current) return;
    pushBufRef.current = '';
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    r.onresult = (e: any) => {
      let mid = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) pushBufRef.current += e.results[i][0].transcript + ' ';
        else mid += e.results[i][0].transcript;
      }
      setInterimText(pushBufRef.current + mid);
    };
    r.onend = () => {};
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }, []);

  const stopPush = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    const out = (pushBufRef.current || interimText).trim();
    setInterimText(''); pushBufRef.current = '';
    if (out) submitAnswer(out);
  }, [interimText, submitAnswer]);

  // ── Start intake ───────────────────────────────────────────────────────
  const beginIntake = useCallback(async () => {
    setPhase('qa');
    setQIndex(0);
    setAnswers({});
    setTranscript([]);
    const greeting = `Hi there — I'm Maya, and I'm really glad you reached out today. I'm the AI intake specialist here, and my job is to make this process as easy as possible for you. I'll ask you about ten quick questions, and our legal team will take it from there. Everything you share with me stays completely confidential — that's my promise to you. Okay, let's get started. ${QUESTIONS[0].maya}`;
    busyRef.current = true;
    setMayaTalking(true);
    await mayaSpeak(greeting, muted);
    setMayaTalking(false);
    busyRef.current = false;
    if (voiceMode === 'open') startOpenMic();
  }, [muted, voiceMode, startOpenMic]);

  const progress = Math.round((qIndex / QUESTIONS.length) * 100);
  const currentQ = QUESTIONS[qIndex];

  // ════════════════════════════════════════════════════════════════════════
  // WELCOME
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'welcome') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">

          {/* Branding */}
          <div className="flex items-center justify-center gap-2 mb-8 text-slate-400">
            <Scale size={20} className="text-violet-400" />
            <span className="font-semibold text-white">CaseBuddy Legal</span>
          </div>

          {/* Maya avatar */}
          <div className="relative w-24 h-24 mx-auto mb-5">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/30 to-violet-500/30 border-2 border-emerald-500/40 flex items-center justify-center text-5xl">
              👩‍⚖️
            </div>
            <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </span>
          </div>

          <h1 className="text-2xl font-bold mb-1">Hi, I'm Maya</h1>
          <p className="text-slate-400 text-sm mb-6">
            I'm the AI intake specialist here. I know reaching out to a law firm can feel intimidating — so I'm here to make this as simple and comfortable as possible. A few questions, no judgment, completely confidential.
          </p>

          {/* Trust signals */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-6 text-left space-y-2.5">
            <div className="flex items-center gap-2.5 text-sm text-slate-300"><Clock size={14} className="text-emerald-400 flex-shrink-0" /> Takes about 3–5 minutes</div>
            <div className="flex items-center gap-2.5 text-sm text-slate-300"><Lock size={14} className="text-emerald-400 flex-shrink-0" /> Completely confidential</div>
            <div className="flex items-center gap-2.5 text-sm text-slate-300"><Mic size={14} className="text-emerald-400 flex-shrink-0" /> Speak or type — your choice</div>
            <div className="flex items-center gap-2.5 text-sm text-slate-300"><Shield size={14} className="text-emerald-400 flex-shrink-0" /> No account required</div>
          </div>

          {/* Voice mode choice */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <button onClick={() => setVoiceMode('open')}
              className={`p-3 rounded-xl border text-left transition-all ${voiceMode === 'open' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <RadioTower size={13} className="text-emerald-400" />
                <span className="font-medium text-sm text-white">Open Mic</span>
              </div>
              <p className="text-xs text-slate-400">Speak freely — auto-sends after a pause</p>
            </button>
            <button onClick={() => setVoiceMode('push')}
              className={`p-3 rounded-xl border text-left transition-all ${voiceMode === 'push' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Mic size={13} className="text-blue-400" />
                <span className="font-medium text-sm text-white">Push-to-Talk</span>
              </div>
              <p className="text-xs text-slate-400">Hold to speak, release to send</p>
            </button>
          </div>

          <button onClick={beginIntake}
            className="w-full py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-violet-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 text-white shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
            Start My Intake <ArrowRight size={20} />
          </button>

          <p className="text-slate-600 text-xs mt-4 flex items-center justify-center gap-1">
            <Lock size={10} /> Secured by CaseBuddy AI
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // SAVING (brief transition)
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'saving') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-emerald-400 mx-auto mb-4" />
          <p className="text-white font-semibold">Submitting your intake…</p>
          <p className="text-slate-400 text-sm mt-1">Just a moment</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // RESULT
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'result') {
    return <ResultScreen route={routeResult} name={answers.client_name || ''} />;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Q&A
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* Top bar */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Scale size={16} className="text-violet-400" />
          <span className="text-white text-sm font-semibold">CaseBuddy Intake</span>
          {mayaTalking && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Maya speaking…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Voice mode toggle */}
          <button
            onClick={() => { stopMic(); setVoiceMode(v => v === 'open' ? 'push' : 'open'); }}
            title={voiceMode === 'open' ? 'Switch to push-to-talk' : 'Switch to open mic'}
            className={`p-2 rounded-lg transition-colors text-sm ${voiceMode === 'open' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-800'}`}>
            {voiceMode === 'open' ? <RadioTower size={15} /> : <Radio size={15} />}
          </button>
          <button onClick={() => setMuted(m => !m)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Question {qIndex + 1} of {QUESTIONS.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Open mic indicator */}
      {voiceMode === 'open' && (
        <div className={`mx-4 mt-1 mb-2 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 ${
          openMicOn && !mayaTalking
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
            : 'bg-slate-900 border border-slate-800 text-slate-500'
        }`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${openMicOn && !mayaTalking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          {mayaTalking
            ? 'Maya is speaking — mic paused'
            : openMicOn
              ? 'Listening — speak your answer, then pause 3 seconds to send'
              : 'Tap the mic button to start listening'}
        </div>
      )}

      {/* Chat transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">

        {/* Past Q&A */}
        {transcript.map((t, i) => (
          <React.Fragment key={i}>
            {/* Maya bubble */}
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex-shrink-0 flex items-center justify-center text-sm">👩‍⚖️</div>
              <div className="bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[82%]">
                <p className="text-slate-200 text-sm leading-relaxed">{t.q}</p>
              </div>
            </div>
            {/* Client bubble */}
            <div className="flex items-end justify-end gap-2">
              <div className="bg-violet-600/25 border border-violet-500/20 rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[82%]">
                <p className="text-slate-100 text-sm leading-relaxed">{t.a}</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-sm">👤</div>
            </div>
          </React.Fragment>
        ))}

        {/* Current question */}
        {!mayaTalking || transcript.length < qIndex ? (
          <div className="flex items-end gap-2">
            <div className={`w-7 h-7 rounded-full bg-emerald-500/20 flex-shrink-0 flex items-center justify-center text-sm ${mayaTalking ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-950' : ''}`}>
              👩‍⚖️
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[82%]">
              <p className="text-white text-sm leading-relaxed">{currentQ.maya}</p>

              {/* Choice buttons */}
              {currentQ.type === 'choice' && currentQ.choices && !mayaTalking && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {currentQ.choices.map(c => (
                    <button key={c}
                      onClick={() => submitAnswer(c)}
                      className="text-xs px-3 py-2 bg-slate-700 hover:bg-violet-600 border border-slate-600 hover:border-violet-500 rounded-xl text-slate-300 hover:text-white transition-all leading-tight text-left">
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 ml-9">
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <span key={i} className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
              ))}
            </div>
            <span className="text-slate-400 text-xs">Maya is speaking…</span>
          </div>
        )}

        {/* Interim live speech */}
        {interimText && (
          <div className="flex items-end justify-end gap-2 opacity-70">
            <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[82%]">
              <p className="text-violet-300 text-sm italic leading-relaxed">{interimText}</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-sm">👤</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-800 p-4 pb-6">
        <div className="flex items-center gap-3 max-w-xl mx-auto">

          {/* Mic button */}
          {voiceMode === 'push' ? (
            <button
              onMouseDown={startPush}
              onMouseUp={stopPush}
              onTouchStart={e => { e.preventDefault(); startPush(); }}
              onTouchEnd={e => { e.preventDefault(); stopPush(); }}
              disabled={mayaTalking}
              className={`w-13 h-13 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 select-none transition-all
                ${listening
                  ? 'bg-red-500 shadow-lg shadow-red-500/40 scale-110 ring-4 ring-red-400/30'
                  : 'bg-slate-700 hover:bg-emerald-600 active:scale-95'}
                text-white disabled:opacity-40`}>
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          ) : (
            <button
              onClick={openMicOn ? stopMic : startOpenMic}
              disabled={mayaTalking}
              className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                ${openMicOn && !mayaTalking
                  ? 'bg-emerald-500 shadow-lg shadow-emerald-500/40 scale-110 ring-4 ring-emerald-400/30'
                  : 'bg-slate-700 hover:bg-emerald-600 active:scale-95'}
                text-white disabled:opacity-40`}>
              {openMicOn ? <RadioTower size={20} /> : <Radio size={20} />}
            </button>
          )}

          {/* Text input */}
          <input
            value={currentInput}
            onChange={e => setCurrentInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && currentInput.trim() && !mayaTalking) {
                submitAnswer(currentInput);
              }
            }}
            disabled={mayaTalking}
            placeholder={
              mayaTalking      ? 'Maya is speaking…'     :
              listening        ? 'Listening…'             :
              openMicOn        ? 'Mic on — or type here…' :
                                 'Type your answer…'
            }
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
          />

          {/* Send button */}
          <button
            onClick={() => { if (currentInput.trim() && !mayaTalking) submitAnswer(currentInput); }}
            disabled={!currentInput.trim() || mayaTalking}
            className="w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center flex-shrink-0 text-white disabled:opacity-40 transition-colors active:scale-95">
            <Send size={18} />
          </button>
        </div>

        <p className="text-center text-slate-600 text-xs mt-2">
          {voiceMode === 'open'
            ? 'Speak freely — pause 3 seconds to send · Say "done" or "next" to move on'
            : 'Hold the mic button while speaking · Release to send'}
        </p>
      </div>
    </div>
  );
};

export default PublicIntake;
