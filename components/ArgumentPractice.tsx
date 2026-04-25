import React, {
  useState, useRef, useCallback, useContext, useEffect, useMemo,
} from 'react';
import { AppContext } from '../App';
import { Message, TrialPhase, SimulationMode } from '../types';
import {
  Mic, MicOff, ArrowLeft, GraduationCap, Sword, BookOpen,
  Volume2, VolumeX, Loader2, ChevronDown, ChevronUp,
  Lightbulb, AlertTriangle, ScrollText, Brain, Star,
  Clock, TrendingUp, Target, Award, HelpCircle, X,
  ChevronRight, Play, Pause, RotateCcw, Eye, EyeOff,
} from 'lucide-react';
import { getTrialSimSystemPrompt } from '../services/openAIService';
import { callGeminiProxy } from '../services/apiProxy';
import {
  ELEVENLABS_VOICES,
  isElevenLabsConfigured, synthesizeSpeech, ensureAudioUnlocked,
} from '../services/elevenLabsService';
import { isBrowserTTSAvailable, speakWithFallback } from '../services/browserTTSService';
import { toast } from 'react-toastify';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIResponse {
  speak: string;
  action: 'response' | 'objection' | 'ruling' | 'question' | 'sustain' | 'overrule';
  objectionGrounds?: string;
  objectionExplanation?: string;
  judgeRuling?: string;
  critique?: string;
  suggestion?: string;
  teleprompterScript?: string;
  rhetoricalScore?: number;
  legalError?: string;
  encouragement?: string;
  educationTip?: string;
  nextStep?: string;
}

interface CoachingNote {
  critique: string;
  suggestion: string;
  legalError?: string;
  encouragement?: string;
  educationTip?: string;
  nextStep?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES: { id: TrialPhase; label: string; icon: string; description: string; tips: string[] }[] = [
  {
    id: 'pre-trial-motions',
    label: 'Pre-Trial Motions',
    icon: '📋',
    description: 'Argue motions to suppress evidence, change venue, or exclude witnesses before trial begins.',
    tips: ['Cite specific case law', 'Focus on constitutional grounds', 'Be concise — judges are busy'],
  },
  {
    id: 'voir-dire',
    label: 'Voir Dire',
    icon: '👥',
    description: 'Question potential jurors to identify bias and select a fair jury.',
    tips: ['Ask open-ended questions', 'Watch for body language cues', 'Use challenges strategically'],
  },
  {
    id: 'opening-statement',
    label: 'Opening Statement',
    icon: '🎤',
    description: 'Tell your story to the jury — lay out the facts you will prove.',
    tips: ['Tell a compelling narrative', 'Preview key evidence', 'Keep it clear and organized'],
  },
  {
    id: 'direct-examination',
    label: 'Direct Examination',
    icon: '🔍',
    description: 'Question your own witnesses to build your case through their testimony.',
    tips: ['Use open-ended questions (who, what, where, when)', 'Let the witness tell the story', 'Avoid leading questions'],
  },
  {
    id: 'cross-examination',
    label: 'Cross-Examination',
    icon: '⚔️',
    description: 'Challenge opposing witnesses — control the narrative with leading questions.',
    tips: ['Use closed, leading questions', 'Never ask a question you don\'t know the answer to', 'Attack credibility with prior statements'],
  },
  {
    id: 'defendant-testimony',
    label: 'Defendant Testimony',
    icon: '🧍',
    description: 'Practice handling a defendant on the stand — both direct and cross.',
    tips: ['Prepare for the unexpected', 'Control emotional responses', 'Keep answers concise'],
  },
  {
    id: 'closing-argument',
    label: 'Closing Argument',
    icon: '🏛️',
    description: 'Summarize the evidence, apply the law, and persuade the jury to your side.',
    tips: ['Tie evidence to your theory', 'Address weaknesses head-on', 'End with a strong call to action'],
  },
  {
    id: 'sentencing',
    label: 'Sentencing',
    icon: '⚖️',
    description: 'Argue for or against a specific sentence after conviction.',
    tips: ['Humanize your client', 'Cite sentencing guidelines', 'Address mitigating/aggravating factors'],
  },
];

const MODES: { id: SimulationMode; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  {
    id: 'learn',
    label: 'Learn',
    icon: <GraduationCap size={22} />,
    desc: 'Step-by-step teaching with full explanations. Perfect for beginners.',
    color: 'emerald',
  },
  {
    id: 'practice',
    label: 'Practice',
    icon: <BookOpen size={22} />,
    desc: 'Guided coaching with hints. Feedback after each exchange.',
    color: 'blue',
  },
  {
    id: 'trial',
    label: 'Trial Mode',
    icon: <Sword size={22} />,
    desc: 'Full realism. No hints. Opposing counsel fights hard.',
    color: 'red',
  },
];

const EDUCATION_LIBRARY: Record<TrialPhase, { title: string; content: string }[]> = {
  'pre-trial-motions': [
    { title: 'Motion to Suppress (4th Amendment)', content: 'Evidence obtained in violation of the 4th Amendment must be excluded under the Exclusionary Rule (Mapp v. Ohio, 1961). You must show: (1) government action, (2) defendant has standing, (3) constitutional violation occurred, (4) evidence was obtained as a direct result.' },
    { title: 'Motion in Limine', content: 'A pre-trial motion asking the court to exclude or allow specific evidence before it is offered at trial. Filed to prevent prejudicial or irrelevant evidence from reaching the jury.' },
    { title: 'Brady Material', content: 'Under Brady v. Maryland (1963), the prosecution must disclose all exculpatory evidence material to guilt or punishment. Failure is a constitutional violation. File a Brady motion if you suspect suppression.' },
  ],
  'voir-dire': [
    { title: 'Cause vs. Peremptory Challenges', content: 'For-cause challenges are unlimited and require showing a juror cannot be impartial. Peremptory challenges are limited (number varies by case type) and require no reason — but cannot be based on race (Batson v. Kentucky) or gender (J.E.B. v. Alabama).' },
    { title: 'Identifying Hidden Bias', content: 'Ask questions like: "Can you commit to following the law even if you personally disagree with it?" and "Have you or a family member been involved in a similar situation?" Use follow-ups to dig deeper on concerning answers.' },
    { title: 'Building Rapport', content: 'Voir dire is your first impression on jurors. Be conversational, not interrogating. Learn names, make eye contact, and show genuine interest. Jurors who like you are more receptive to your arguments.' },
  ],
  'opening-statement': [
    { title: 'The Story Framework', content: 'Jurors understand stories, not legal arguments. Structure your opening as: (1) The conflict, (2) The characters, (3) What the evidence will show, (4) Why your side wins. Use the present tense to make events feel immediate.' },
    { title: 'Theme and Theory', content: 'Your theme is a memorable phrase that captures your case ("This case is about greed." / "The evidence was planted."). Your theory is how the facts fit your theme. Repeat your theme throughout trial.' },
    { title: 'What NOT to Do', content: 'Do NOT argue the case — opening is a preview, not a closing. Do NOT promise evidence you may not deliver. Do NOT use complex legal jargon. Do NOT undermine your credibility with overstatements.' },
  ],
  'direct-examination': [
    { title: 'Non-Leading Questions', content: 'On direct, you cannot lead your own witness. Use: Who, What, Where, When, How, Why, Describe, Explain, Tell the jury about... Bad: "The defendant threatened you, right?" Good: "What did the defendant say to you?"' },
    { title: 'Looping Technique', content: 'Reference a key phrase from the witness\'s last answer in your next question to build emphasis. "You said the defendant was angry. Describe that anger for the jury." This reinforces important facts without leading.' },
    { title: 'Handling the Reluctant Witness', content: 'If your witness becomes hostile or inconsistent, you may ask the court to declare them hostile. This allows you to use leading questions and impeach with prior inconsistent statements.' },
  ],
  'cross-examination': [
    { title: 'The 10 Commandments of Cross (Irving Younger)', content: '1) Be brief. 2) Short questions, plain words. 3) Never ask anything but a leading question. 4) Never ask a question to which you don\'t know the answer. 5) Listen. 6) Don\'t quarrel. 7) Don\'t allow the witness to explain. 8) Don\'t ask the witness to repeat testimony. 9) Limit cross to key points. 10) Save the best for last.' },
    { title: 'Impeachment by Prior Inconsistency', content: 'Step 1: Commit — get the witness to confirm the current testimony. Step 2: Credit — establish the prior statement was made. Step 3: Confront — present the inconsistency. "So you told the detective on March 5th that the car was blue. Today you\'re telling this jury it was red. Which is true?"' },
    { title: 'Controlling the Narrative', content: 'Never let the witness explain. Cut off rambling answers: "Thank you, that answers my question." If they won\'t stop, turn to the judge: "Your Honor, please instruct the witness to answer yes or no." Keep control at all times.' },
  ],
  'defendant-testimony': [
    { title: 'Preparing Your Client', content: 'Rehearse extensively. Run mock cross-examinations. Teach them: answer only what is asked, pause before answering, say "I don\'t recall" when genuinely uncertain (not as evasion), maintain composure under pressure.' },
    { title: 'Credibility Factors', content: 'Jurors judge: eye contact, tone of voice, body language, consistency, and whether the story makes sense. A defendant who looks away, fidgets, or over-explains can lose the jury even with strong facts.' },
    { title: 'Handling Impeachment', content: 'When the prosecutor confronts your client with a prior statement, prepare them to: acknowledge the statement, provide context if helpful, and never argue with the questioner. Let you handle the redirect.' },
  ],
  'closing-argument': [
    { title: 'Structure of a Winning Closing', content: '1) Hook — start with your theme. 2) Evidence summary — walk through key facts. 3) Apply the law — connect facts to jury instructions. 4) Address weaknesses — acknowledge and explain. 5) Call to action — tell jurors exactly what to do.' },
    { title: 'Rhetoric Techniques', content: 'Rule of Three (people remember things in threes). Rhetorical questions ("Was that justice?"). Repetition of your theme. Vivid imagery. Analogies that make complex facts simple. Emotional appeals tied to evidence — not manipulation.' },
    { title: 'Objections During Closing', content: 'You can be objected to in closing for: facts not in evidence, misstatements of law, or improper personal opinions ("I believe the defendant is innocent"). Stay within the record and you\'ll be fine.' },
  ],
  'sentencing': [
    { title: 'Federal Sentencing Guidelines', content: 'Federal sentences start with the Guidelines range (Offense Level + Criminal History Category). Argue for downward departures or variances under 18 U.S.C. § 3553(a) factors: nature of the offense, history of the defendant, need for deterrence, etc.' },
    { title: 'Mitigating Factors', content: 'Key mitigators: acceptance of responsibility, minimal role, mental health issues, substance abuse (with treatment), family obligations, community ties, employment history, lack of criminal history, cooperation with authorities.' },
    { title: 'Victim Impact & the State', content: 'The prosecution will present victim impact statements. You must respond with empathy — acknowledge the harm — then pivot to why your client deserves a measured sentence. Never minimize the victim\'s suffering.' },
  ],
};

// ─── Helper: Build the rich system prompt ────────────────────────────────────

function buildSystemPrompt(
  phase: TrialPhase,
  mode: SimulationMode,
  opponentName: string,
  caseSummary: string,
  role: 'opposing' | 'judge' | 'witness',
): string {
  const phaseInfo = PHASES.find(p => p.id === phase);
  const baseContext = `You are running a hyper-realistic AI trial simulation for "${phase}" phase.
Case: ${caseSummary}
Mode: ${mode} (${mode === 'learn' ? 'educational — explain everything' : mode === 'practice' ? 'guided coaching' : 'full realism, no hand-holding'})

CRITICAL INSTRUCTIONS:
- Always respond with valid JSON (no markdown fences)
- The "speak" field is what is said OUT LOUD in the courtroom — make it REALISTIC, NATURAL, and HUMAN
- Never break character in the "speak" field
- Coaching goes in "critique", "suggestion", "educationTip", "encouragement", "nextStep"
- If the user makes a legal error, note it in "legalError" AND explain it in your coaching fields

JSON SCHEMA:
{
  "speak": "In-character spoken dialogue — realistic courtroom language",
  "action": "response | objection | ruling | question | sustain | overrule",
  "objectionGrounds": "Hearsay | Relevance | Leading | Speculation | etc (only if action=objection)",
  "objectionExplanation": "Brief legal explanation of the objection",
  "judgeRuling": "Sustained | Overruled | with brief reason (only if judge is ruling)",
  "critique": "What the attorney did wrong or could improve (be specific)",
  "suggestion": "A better approach they should take next",
  "teleprompterScript": "Exact suggested words for the attorney to say next — natural spoken language",
  "rhetoricalScore": 0-100,
  "legalError": "If the attorney made a legal mistake, describe it concisely",
  "encouragement": "Positive reinforcement when they do something well (${mode === 'learn' ? 'always include' : mode === 'practice' ? 'include when warranted' : 'rarely'})",
  "educationTip": "A relevant legal tip or rule they should know for this phase (${mode === 'learn' ? 'always include' : 'include when relevant'})",
  "nextStep": "What they should do next in the ${phase} phase"
}

REALISM STANDARDS:
- Opposing counsel (${opponentName}) is sharp, aggressive, and uses real objections
- Judges are authoritative, impatient, and enforce procedure strictly  
- Witnesses have personalities and may be evasive, emotional, or inconsistent
- Objections must cite real legal grounds (hearsay, relevance, foundation, speculation, leading, asked and answered, etc.)
- Use actual courtroom language: "Objection, Your Honor", "May it please the court", "I'll rephrase", etc.
${mode === 'learn' ? '- In LEARN mode: after your in-character response, your coaching should be thorough and educational. Explain WHY the rule exists, not just what it is.' : ''}
${mode === 'trial' ? '- In TRIAL mode: be ruthless. Object frequently. Challenge every weakness. This is real combat.' : ''}`;

  return baseContext;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ArgumentPractice: React.FC = () => {
  const { activeCase } = useContext(AppContext);

  // ── Setup state ──
  const [view, setView] = useState<'setup' | 'active' | 'library'>('setup');
  const [phase, setPhase] = useState<TrialPhase | null>(null);
  const [mode, setMode] = useState<SimulationMode | null>(null);
  const [voiceKey, setVoiceKey] = useState<string>('josh');
  const [showPhaseDetail, setShowPhaseDetail] = useState<TrialPhase | null>(null);
  const [libraryPhase, setLibraryPhase] = useState<TrialPhase>('cross-examination');

  // ── Session state ──
  const [isLive, setIsLive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [teleprompter, setTeleprompter] = useState('');
  const [coaching, setCoaching] = useState<CoachingNote | null>(null);
  const [showCoaching, setShowCoaching] = useState(true);
  const [showTeleprompter, setShowTeleprompter] = useState(true);
  const [objection, setObjection] = useState<{ grounds: string; explanation: string } | null>(null);
  const [judgeRuling, setJudgeRuling] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [scoreCount, setScoreCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [showEducationTip, setShowEducationTip] = useState<string | null>(null);

  // ── Refs ──
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const isLiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationHistory = useRef<Array<{ role: string; parts: Array<{ text: string }> }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs in sync
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiTranscript, userTranscript]);

  // Session timer
  useEffect(() => {
    if (isLive && sessionStartTime) {
      timerRef.current = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isLive, sessionStartTime]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── TTS ──────────────────────────────────────────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    if (muted || !text.trim()) return;
    setIsSpeaking(true);

    try {
      if (isElevenLabsConfigured()) {
        const voice = ELEVENLABS_VOICES[voiceKey as keyof typeof ELEVENLABS_VOICES];
        const voiceId = voice?.id || ELEVENLABS_VOICES.josh.id;

        const audioData = await synthesizeSpeech(text, voiceId, {
          stability: 0.45,
          similarityBoost: 0.80,
          modelId: 'eleven_turbo_v2_5',
          style: 0.3,
          useSpeakerBoost: true,
        });

        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = 1.0;
        playbackRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Playback failed')); };
          audio.play().catch(reject);
        });
      } else if (isBrowserTTSAvailable()) {
        // Enhanced browser TTS — pick a deeper, authoritative voice
        await speakWithFallback(text, {
          rate: 0.95,
          pitch: 0.9,
          volume: 1.0,
          voiceURI: undefined, // let browserTTS pick best available
        });
      }
    } catch (e) {
      console.warn('[TrialSim] TTS error:', e);
    } finally {
      playbackRef.current = null;
      setIsSpeaking(false);
    }
  }, [voiceKey, muted]);

  // ── AI Response ───────────────────────────────────────────────────────────────
  const getAIResponse = useCallback(async (userText: string) => {
    if (!phase || !mode) return;
    setIsProcessing(true);
    setInterimTranscript('');

    const opponentName = activeCase?.opposingCounsel || 'Opposing Counsel';
    const caseSummary = activeCase
      ? `${activeCase.title} — ${activeCase.summary || 'No summary'} (Client type: ${activeCase.clientType || 'unspecified'})`
      : 'General trial practice scenario';

    const systemPrompt = buildSystemPrompt(phase, mode, opponentName, caseSummary, 'opposing');

    conversationHistory.current.push({ role: 'user', parts: [{ text: userText }] });

    try {
      const response = await callGeminiProxy({
        prompt: `Attorney said: "${userText}"

Respond in character as opposing counsel / judge / witness as appropriate for this phase.
Return ONLY valid JSON matching the schema. No markdown, no explanation outside the JSON.`,
        systemPrompt,
        model: 'gemini-2.5-flash',
        conversationHistory: conversationHistory.current.slice(-24),
        options: { temperature: 0.85 },
      });

      if (!response.success || !response.text) {
        throw new Error(response.error?.message || 'Empty AI response');
      }

      let raw = response.text.replace(/```json\n?|```/g, '').trim();
      // Handle cases where model wraps in object
      if (raw.startsWith('{') === false) {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) raw = match[0];
      }

      let parsed: AIResponse;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {
          speak: raw.slice(0, 500),
          action: 'response',
          critique: '',
          suggestion: '',
          teleprompterScript: '',
          rhetoricalScore: 0,
        };
      }

      const spokenText = parsed.speak || raw;
      conversationHistory.current.push({ role: 'model', parts: [{ text: spokenText }] });

      // Update messages
      const now = Date.now();
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), sender: 'user' as const, text: userText, timestamp: now - 100 },
        { id: crypto.randomUUID(), sender: 'opponent' as const, text: spokenText, timestamp: now },
      ]);

      setAiTranscript(spokenText);
      setTeleprompter(parsed.teleprompterScript || '');
      setCoaching({
        critique: parsed.critique || '',
        suggestion: parsed.suggestion || '',
        legalError: parsed.legalError,
        encouragement: parsed.encouragement,
        educationTip: parsed.educationTip,
        nextStep: parsed.nextStep,
      });

      // Show education tip as a popup if present
      if (parsed.educationTip) {
        setShowEducationTip(parsed.educationTip);
        setTimeout(() => setShowEducationTip(null), 8000);
      }

      // Score
      if (parsed.rhetoricalScore !== undefined && parsed.rhetoricalScore > 0) {
        setScoreCount(prev => {
          const newCount = prev + 1;
          setScore(s => Math.round((s * prev + (parsed.rhetoricalScore || 0)) / newCount));
          return newCount;
        });
      }

      // Handle objection
      if (parsed.action === 'objection' && parsed.objectionGrounds) {
        setObjection({ grounds: parsed.objectionGrounds, explanation: parsed.objectionExplanation || '' });
        setTimeout(() => setObjection(null), 7000);
      }

      // Handle judge ruling
      if (parsed.judgeRuling) {
        setJudgeRuling(parsed.judgeRuling);
        setTimeout(() => setJudgeRuling(null), 5000);
      }

      // Speak the response
      await speakText(spokenText);

    } catch (e: any) {
      console.error('[TrialSim] AI error:', e);
      toast.error('AI response failed. Try speaking again.');
    } finally {
      setIsProcessing(false);
    }
  }, [phase, mode, activeCase, speakText]);

  // ── Speech Recognition ────────────────────────────────────────────────────────
  const processTranscript = useCallback((text: string) => {
    if (!text.trim() || isProcessingRef.current || isSpeakingRef.current) return;
    setUserTranscript(text);
    getAIResponse(text);
  }, [getAIResponse]);

  const stopSession = useCallback(() => {
    setIsLive(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current = null;
    }
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    setView('setup');
  }, []);

  const startSession = useCallback(async () => {
    if (!phase || !mode) return;

    try {
      // Request mic first so browser prompts user before anything else
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionClass) {
        toast.error('Speech recognition requires Chrome or Edge. Firefox is not supported.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Try audio unlock (non-fatal if it fails)
      try { await ensureAudioUnlocked(); } catch { /* ignore unlock errors */ }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      let restartDelay = 200;
      let accumulatedFinal = '';

      recognition.onresult = (event: any) => {
        // Always show captions even while AI speaks
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }

        if (interim) setInterimTranscript(interim);
        if (final) {
          accumulatedFinal += ' ' + final;
          setUserTranscript(accumulatedFinal.trim());
          setInterimTranscript('');
        }

        // Only update listening indicator — do NOT process while AI is busy
        if (!isSpeakingRef.current && !isProcessingRef.current) {
          setIsListening(true);
        }

        // Clear previous silence timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // Wait for silence then send — but ONLY if AI is idle
        const textToSend = (accumulatedFinal + ' ' + (interim || '')).trim();
        if (textToSend.length > 2) {
          silenceTimerRef.current = setTimeout(() => {
            if (isSpeakingRef.current || isProcessingRef.current || !isLiveRef.current) return;
            const text = accumulatedFinal.trim() || interim.trim();
            if (text.length > 2) {
              accumulatedFinal = '';
              setUserTranscript('');
              setInterimTranscript('');
              getAIResponse(text);
            }
          }, 1800); // 1.8s silence = end of utterance
        }
      };

      recognition.onerror = (event: any) => {
        const err = event.error;
        console.warn('[TrialSim] Recognition error:', err);
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          toast.error('Microphone access denied. Check browser permissions.');
          stopSession();
        } else if (err === 'audio-capture') {
          toast.error('No microphone detected. Please connect a microphone.');
          stopSession();
        } else if (err === 'network') {
          // Network errors: recognition will auto-restart via onend
          console.warn('[TrialSim] Network error on recognition — will restart');
        } else if (err === 'no-speech') {
          // Normal — just no one spoke, will restart
        }
        // All other errors: let onend handle the restart
      };

      recognition.onstart = () => {
        console.log('[TrialSim] Recognition started');
        restartDelay = 200; // reset backoff on successful start
      };

      recognition.onend = () => {
        setIsListening(false);
        // Auto-restart as long as session is live
        if (isLiveRef.current) {
          setTimeout(() => {
            if (isLiveRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // Recognition may already be running — safe to ignore
              }
            }
          }, restartDelay);
          restartDelay = Math.min(restartDelay * 1.5, 3000); // exponential backoff
        }
      };

      // Reset all state
      setMessages([]);
      conversationHistory.current = [];
      setScore(0);
      setScoreCount(0);
      setTeleprompter('');
      setCoaching(null);
      setAiTranscript('');
      setUserTranscript('');
      setInterimTranscript('');
      setSessionDuration(0);
      setSessionStartTime(Date.now());
      setIsLive(true);
      setView('active');

      recognition.start();

      // Opening AI message — delay slightly so state settles
      const openingPrompt =
        mode === 'learn'
          ? `This is the start of the ${phase} phase. Welcome the attorney warmly. Explain what this phase is, their role, the key rules, and what they should say first. Be encouraging and educational. Then get into character and await their first statement.`
          : mode === 'practice'
          ? `The ${phase} phase is beginning. Set the scene in one sentence in character as opposing counsel or judge. Keep it brief — then wait for the attorney to speak.`
          : `Court is in session. ${phase.replace(/-/g, ' ')} phase. Set the scene in one crisp sentence. Wait for opposing counsel.`;

      // Small delay before opening message so recognition has started
      setTimeout(() => getAIResponse(openingPrompt), 800);

    } catch (e: any) {
      console.error('[TrialSim] Start failed:', e);
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        toast.error('Microphone permission denied. Click the lock icon in your browser address bar and allow microphone access.');
      } else if (e.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone and try again.');
      } else {
        toast.error(e.message || 'Failed to start session');
      }
    }
  }, [phase, mode, getAIResponse, stopSession]);

  // Cleanup on unmount
  useEffect(() => () => stopSession(), [stopSession]);

  // ── Score color ──
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';

  // ─── EDUCATION LIBRARY VIEW ───────────────────────────────────────────────────
  if (view === 'library') {
    const articles = EDUCATION_LIBRARY[libraryPhase] || [];
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setView('setup')}
            className="text-slate-400 hover:text-white flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-xl font-bold text-white">📚 Legal Education Library</h1>
        </div>

        {/* Phase selector */}
        <div className="flex flex-wrap gap-2">
          {PHASES.map(p => (
            <button
              key={p.id}
              onClick={() => setLibraryPhase(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                libraryPhase === p.id
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {/* Articles */}
        <div className="space-y-4">
          {articles.map((article, i) => (
            <div key={i} className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
              <h3 className="text-amber-400 font-bold mb-2">{article.title}</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{article.content}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mt-4">
          <p className="text-slate-400 text-sm text-center">
            💡 More educational content is delivered live during sessions based on your performance.
          </p>
        </div>
      </div>
    );
  }

  // ─── SETUP VIEW ───────────────────────────────────────────────────────────────
  if (view === 'setup') {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">⚖️ Trial Simulator</h1>
            <p className="text-slate-400 text-sm mt-0.5">Live voice. Real objections. AI coaching.</p>
          </div>
          <button
            onClick={() => setView('library')}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all"
          >
            <BookOpen size={15} />
            Learn
          </button>
        </div>

        {/* Active case info */}
        {activeCase && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex items-start gap-3">
            <div className="text-amber-400 mt-0.5"><Target size={16} /></div>
            <div>
              <div className="text-white text-sm font-semibold">{activeCase.title}</div>
              <div className="text-slate-400 text-xs">vs. {activeCase.opposingCounsel || 'Opposing Counsel'}</div>
            </div>
          </div>
        )}

        {/* Phase selection */}
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-3 block">
            1. Choose Trial Phase
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PHASES.map(p => (
              <div key={p.id} className="relative">
                <button
                  onClick={() => setPhase(p.id)}
                  className={`w-full p-3 rounded-xl text-sm font-medium transition-all text-left border ${
                    phase === p.id
                      ? 'bg-amber-500 text-slate-900 border-amber-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                  }`}
                >
                  <span className="mr-1.5">{p.icon}</span>{p.label}
                </button>
                <button
                  onClick={() => setShowPhaseDetail(showPhaseDetail === p.id ? null : p.id)}
                  className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
                >
                  <HelpCircle size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Phase detail popup */}
          {showPhaseDetail && (
            <div className="mt-3 bg-slate-800 border border-amber-500/30 rounded-xl p-4 space-y-2">
              {(() => {
                const p = PHASES.find(x => x.id === showPhaseDetail)!;
                return (
                  <>
                    <h3 className="text-amber-400 font-bold">{p.icon} {p.label}</h3>
                    <p className="text-slate-300 text-sm">{p.description}</p>
                    <div>
                      <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1">Key Tips</div>
                      {p.tips.map((tip, i) => (
                        <div key={i} className="text-slate-400 text-xs flex gap-2 mb-1">
                          <span className="text-amber-500">•</span> {tip}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Mode selection */}
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-3 block">
            2. Choose Difficulty
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-3 rounded-xl text-center transition-all border ${
                  mode === m.id
                    ? m.color === 'emerald'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : m.color === 'blue'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                      : 'bg-red-500/20 border-red-500 text-red-300'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                }`}
              >
                <div className="flex justify-center mb-1">{m.icon}</div>
                <div className="text-xs font-bold">{m.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Voice selection */}
        <div>
          <label className="text-sm font-semibold text-slate-300 mb-2 block">
            3. Opponent Voice
          </label>
          <select
            value={voiceKey}
            onChange={e => setVoiceKey(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm"
          >
            {Object.entries(ELEVENLABS_VOICES).map(([key, v]) => (
              <option key={key} value={key}>{(v as any).name} — {(v as any).description}</option>
            ))}
          </select>
          {!isElevenLabsConfigured() && (
            <p className="text-amber-500/80 text-xs mt-1.5 flex items-center gap-1">
              <AlertTriangle size={11} />
              ElevenLabs not configured — browser TTS will be used (less realistic)
            </p>
          )}
        </div>

        {/* Start button */}
        <button
          onClick={startSession}
          disabled={!phase || !mode}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 font-bold py-4 rounded-xl text-lg transition-all flex items-center justify-center gap-2"
        >
          <Play size={20} /> Enter Courtroom
        </button>

        <p className="text-slate-600 text-xs text-center">
          Requires microphone access • Works best in Chrome or Edge
        </p>
      </div>
    );
  }

  // ─── ACTIVE SESSION VIEW ──────────────────────────────────────────────────────
  const phaseInfo = PHASES.find(p => p.id === phase);

  return (
    <div className="flex flex-col h-full relative bg-slate-950">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
        <button
          onClick={stopSession}
          className="text-slate-400 hover:text-white flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft size={16} /> Exit
        </button>
        <div className="text-center">
          <div className="text-amber-400 font-semibold text-sm">
            {phaseInfo?.icon} {phaseInfo?.label}
          </div>
          <div className="text-slate-500 text-[10px]">{mode} mode</div>
        </div>
        <div className="flex items-center gap-3">
          {sessionDuration > 0 && (
            <span className="text-slate-500 text-xs flex items-center gap-1">
              <Clock size={11} /> {formatTime(sessionDuration)}
            </span>
          )}
          {score > 0 && (
            <span className={`font-bold text-sm flex items-center gap-1 ${scoreColor}`}>
              <TrendingUp size={13} /> {score}%
            </span>
          )}
          <button onClick={() => setMuted(!muted)} className="text-slate-400 hover:text-white transition-colors">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      {/* ── Objection Banner ── */}
      {objection && (
        <div className="bg-red-950 border-b border-red-800 text-white px-4 py-3 text-center shrink-0">
          <div className="text-red-300 text-xs font-bold uppercase tracking-widest mb-0.5">
            ⚡ Objection Raised
          </div>
          <div className="font-black text-xl text-red-400">{objection.grounds}</div>
          <div className="text-sm text-red-200/80 mt-0.5">{objection.explanation}</div>
          <div className="text-slate-400 text-xs mt-1">Respond: "Your Honor, I object" or "I'll rephrase"</div>
        </div>
      )}

      {/* ── Judge Ruling ── */}
      {judgeRuling && (
        <div className="bg-slate-800 border-b border-slate-700 text-white px-4 py-2.5 text-center shrink-0">
          <div className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-0.5">⚖️ Court Ruling</div>
          <div className="text-white font-bold">{judgeRuling}</div>
        </div>
      )}

      {/* ── Education Tip Popup ── */}
      {showEducationTip && (
        <div className="mx-4 mt-2 shrink-0 bg-blue-950/80 border border-blue-700 rounded-xl p-3 flex gap-3">
          <div className="text-blue-400 shrink-0 mt-0.5"><Lightbulb size={16} /></div>
          <div>
            <div className="text-blue-400 text-xs font-bold uppercase tracking-wide mb-1">Legal Tip</div>
            <p className="text-blue-100 text-xs leading-relaxed">{showEducationTip}</p>
          </div>
          <button
            onClick={() => setShowEducationTip(null)}
            className="text-blue-600 hover:text-blue-400 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Live Caption Bar ── */}
      <div className="shrink-0 px-4 py-2 bg-slate-900/80 border-b border-slate-800/50 min-h-[44px] flex items-center gap-2">
        {isSpeaking ? (
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="w-1 bg-amber-500 rounded-full animate-bounce"
                  style={{ height: `${12 + i * 4}px`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <span className="text-amber-400 text-xs font-semibold">SPEAKING</span>
            <span className="text-slate-300 text-sm leading-snug line-clamp-2">{aiTranscript}</span>
          </div>
        ) : isProcessing ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 size={14} className="animate-spin text-amber-500" />
            <span className="text-xs text-slate-500">Opposing counsel is thinking...</span>
          </div>
        ) : (isListening || interimTranscript) ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-slate-400 text-xs font-semibold mr-1">YOU:</span>
            <span className="text-white text-sm italic leading-snug">{interimTranscript || userTranscript}</span>
          </div>
        ) : (
          <span className="text-slate-600 text-xs">
            🎙 Listening... speak into your microphone
          </span>
        )}
      </div>

      {/* ── Message Transcript ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-600 text-sm mt-8 space-y-2">
            <div className="text-3xl">🎙</div>
            <p>Session starting...</p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-blue-900/60 border border-blue-700/50 text-blue-100 rounded-br-md'
                  : msg.sender === 'opponent'
                  ? 'bg-slate-800/90 border border-slate-700 text-slate-200 rounded-bl-md'
                  : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 italic text-xs'
              }`}
            >
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${
                msg.sender === 'user' ? 'text-blue-400' : 'text-amber-400'
              }`}>
                {msg.sender === 'user' ? 'You' : msg.sender === 'opponent' ? 'Opposing Counsel' : 'Court'}
              </div>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Teleprompter Panel ── */}
      {teleprompter && (
        <div className="shrink-0 border-t border-amber-800/30 bg-amber-950/30 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <ScrollText size={13} className="text-amber-400" />
              <span className="text-amber-400 text-xs font-bold uppercase tracking-wide">Say This</span>
            </div>
            <button
              onClick={() => setShowTeleprompter(!showTeleprompter)}
              className="text-slate-500 hover:text-slate-300"
            >
              {showTeleprompter ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {showTeleprompter && (
            <p className="text-white text-base leading-relaxed font-medium">
              "{teleprompter}"
            </p>
          )}
        </div>
      )}

      {/* ── Coaching Panel ── */}
      {coaching && (coaching.critique || coaching.suggestion || coaching.encouragement) && (
        <div className="shrink-0 border-t border-slate-700 bg-slate-900/95 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Brain size={13} className="text-purple-400" />
              <span className="text-purple-400 text-xs font-bold uppercase tracking-wide">Coach</span>
              {coaching.legalError && (
                <span className="bg-red-500/20 text-red-400 text-[9px] px-1.5 py-0.5 rounded-full font-semibold border border-red-500/30">
                  Legal Error
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCoaching(!showCoaching)}
              className="text-slate-500 hover:text-slate-300"
            >
              {showCoaching ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
          {showCoaching && (
            <div className="space-y-1.5">
              {coaching.legalError && (
                <div className="flex gap-2 bg-red-950/50 rounded-lg p-2">
                  <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-300 text-xs leading-relaxed">{coaching.legalError}</p>
                </div>
              )}
              {coaching.encouragement && (
                <div className="flex gap-2">
                  <Star size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-emerald-300 text-xs leading-relaxed">{coaching.encouragement}</p>
                </div>
              )}
              {coaching.critique && (
                <div className="flex gap-2">
                  <Target size={12} className="text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-yellow-200 text-xs leading-relaxed">{coaching.critique}</p>
                </div>
              )}
              {coaching.suggestion && (
                <div className="flex gap-2">
                  <ChevronRight size={12} className="text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-blue-200 text-xs leading-relaxed">{coaching.suggestion}</p>
                </div>
              )}
              {coaching.nextStep && (
                <div className="flex gap-2 pt-0.5 border-t border-slate-700/50 mt-1.5">
                  <Award size={12} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-slate-400 text-xs leading-relaxed italic">{coaching.nextStep}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Mic Control ── */}
      <div className="px-4 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
        <div className="text-slate-600 text-xs">
          {isListening ? (
            <span className="text-red-400 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Recording
            </span>
          ) : isSpeaking ? (
            <span className="text-amber-400">Playing response...</span>
          ) : isProcessing ? (
            <span className="text-slate-500">Processing...</span>
          ) : (
            <span>Ready to listen</span>
          )}
        </div>

        <button
          onClick={isSpeaking ? () => {
            playbackRef.current?.pause();
            setIsSpeaking(false);
          } : undefined}
          disabled={!isSpeaking && !isListening && !isProcessing}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isSpeaking
              ? 'bg-amber-500 hover:bg-amber-400 cursor-pointer'
              : isListening
              ? 'bg-red-600 shadow-red-900/50'
              : isProcessing
              ? 'bg-slate-700 cursor-not-allowed'
              : 'bg-slate-700 cursor-not-allowed'
          }`}
        >
          {isSpeaking ? (
            <Pause size={26} className="text-slate-900" />
          ) : isProcessing ? (
            <Loader2 size={24} className="text-slate-400 animate-spin" />
          ) : (
            <Mic size={26} className={isListening ? 'text-white' : 'text-slate-500'} />
          )}
        </button>

        <button
          onClick={() => {
            // Manual restart of recognition if it stalls
            if (recognitionRef.current && isLive) {
              try { recognitionRef.current.stop(); } catch { /* ignore */ }
              setTimeout(() => {
                if (isLiveRef.current && recognitionRef.current) {
                  try { recognitionRef.current.start(); } catch { /* ignore */ }
                }
              }, 300);
            }
          }}
          className="text-slate-600 hover:text-slate-400 text-xs flex items-center gap-1 transition-colors"
        >
          <RotateCcw size={12} /> Reset mic
        </button>
      </div>
    </div>
  );
};

export default ArgumentPractice;
