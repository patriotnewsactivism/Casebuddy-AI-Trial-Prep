import React, { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { AppContext } from '../App';
import {
  Mic, MicOff, RadioTower, Radio, Volume2, VolumeX,
  ChevronRight, Loader2, CheckCircle, User, Briefcase,
  FileText, Scale, Brain, Zap, RotateCcw, Copy, Share2,
  ClipboardList, AlertCircle, Building, Calendar, Phone,
  Mail, MapPin, DollarSign, Shield, Send
} from 'lucide-react';
import { toast } from 'react-toastify';

// ── Case type → question sets ─────────────────────────────────────────────────
const CASE_TYPES = [
  { id: 'personal-injury',  label: 'Personal Injury',       icon: '🚗' },
  { id: 'civil-rights',     label: 'Civil Rights / § 1983', icon: '⚖️' },
  { id: 'criminal-defense', label: 'Criminal Defense',      icon: '🔒' },
  { id: 'family-law',       label: 'Family Law / Divorce',  icon: '👨‍👩‍👧' },
  { id: 'employment',       label: 'Employment / Wrongful Termination', icon: '💼' },
  { id: 'contract',         label: 'Contract Dispute',      icon: '📄' },
  { id: 'real-estate',      label: 'Real Estate',           icon: '🏠' },
  { id: 'immigration',      label: 'Immigration',           icon: '🌎' },
];

interface Question {
  id: string;
  text: string;        // what Maya asks
  field: string;       // maps to case file field
  type: 'text' | 'date' | 'choice' | 'multiline';
  choices?: string[];
  required?: boolean;
}

const BASE_QUESTIONS: Question[] = [
  { id: 'client_name',  field: 'client',      type: 'text',      required: true,  text: "First, what's your full legal name?" },
  { id: 'client_phone', field: 'phone',       type: 'text',      required: false, text: "And the best phone number to reach you?" },
  { id: 'client_email', field: 'email',       type: 'text',      required: false, text: "Your email address?" },
  { id: 'client_city',  field: 'city',        type: 'text',      required: false, text: "What city and state are you located in?" },
  { id: 'incident_date',field: 'incidentDate',type: 'date',      required: true,  text: "When did this incident or situation occur? Give me the approximate date." },
  { id: 'summary',      field: 'summary',     type: 'multiline', required: true,  text: "Tell me in your own words what happened. Take your time — give me as much detail as you can." },
  { id: 'injuries',     field: 'injuries',    type: 'multiline', required: false, text: "Were there any injuries, damages, or losses? Describe them." },
  { id: 'witnesses',    field: 'witnessInfo', type: 'multiline', required: false, text: "Are there any witnesses who saw what happened? Who are they?" },
  { id: 'prior_counsel',field: 'priorCounsel',type: 'choice',    required: false, text: "Have you spoken with any other attorneys about this case?", choices: ['No', 'Yes — but not retained', 'Yes — previously represented'] },
  { id: 'urgency',      field: 'urgency',     type: 'choice',    required: false, text: "How urgent is this matter for you?", choices: ['There\'s an upcoming deadline', 'Moderately urgent', 'No immediate deadline'] },
  { id: 'outcome',      field: 'desiredOutcome', type: 'multiline', required: false, text: "What outcome are you hoping to achieve?" },
];

const TYPE_QUESTIONS: Record<string, Question[]> = {
  'personal-injury': [
    { id: 'at_fault',    field: 'opposingParty',   type: 'text',      text: "Who do you believe was at fault — a person, a company, a government entity?" },
    { id: 'insurance',   field: 'insurance',       type: 'choice',    text: "Has an insurance claim been filed?", choices: ['Not yet', 'Filed — pending', 'Filed — denied', 'Settled'] },
    { id: 'medical',     field: 'medicalTreatment',type: 'multiline', text: "Have you received any medical treatment? What doctors or hospitals?" },
    { id: 'lost_wages',  field: 'lostWages',       type: 'choice',    text: "Did you miss work or lose income as a result?", choices: ['No', 'Yes — partially', 'Yes — completely'] },
  ],
  'civil-rights': [
    { id: 'defendant',   field: 'opposingParty',   type: 'text',      text: "Who violated your rights — law enforcement, a government agency, a public official?" },
    { id: 'right_violated', field: 'legalTheory',  type: 'multiline', text: "Which rights do you believe were violated? For example: excessive force, unlawful search, discrimination?" },
    { id: 'documented',  field: 'evidence',        type: 'choice',    text: "Is there documentation — police reports, body cam footage, medical records?", choices: ['Yes — obtained', 'Yes — need to request', 'Unknown', 'No'] },
    { id: 'criminal_charges', field: 'charges',    type: 'choice',    text: "Were any criminal charges filed against you as part of this incident?", choices: ['No', 'Yes — pending', 'Yes — resolved', 'Yes — dismissed'] },
  ],
  'criminal-defense': [
    { id: 'charges',     field: 'charges',         type: 'multiline', text: "What charges are you facing?" },
    { id: 'court_date',  field: 'nextCourtDate',   type: 'date',      text: "Do you have an upcoming court date? If so, when?" },
    { id: 'detained',    field: 'detained',        type: 'choice',    text: "Are you currently detained or out on bail/bond?", choices: ['Out — no bail needed', 'Out on bail/bond', 'Currently detained'] },
    { id: 'plea',        field: 'plea',            type: 'choice',    text: "Have you entered a plea?", choices: ['Not yet', 'Not guilty', 'Guilty', 'No contest'] },
  ],
  'family-law': [
    { id: 'children',    field: 'children',        type: 'choice',    text: "Are there minor children involved?", choices: ['No', 'Yes — 1', 'Yes — 2 or more'] },
    { id: 'assets',      field: 'assets',          type: 'choice',    text: "Are there significant shared assets — property, retirement accounts, business?", choices: ['No', 'Yes — some', 'Yes — significant'] },
    { id: 'protective',  field: 'protectiveOrder', type: 'choice',    text: "Is there a protective or restraining order in place?", choices: ['No', 'Yes — against me', 'Yes — I obtained one', 'Needed'] },
  ],
  'employment': [
    { id: 'employer',    field: 'opposingParty',   type: 'text',      text: "Who is your employer or former employer?" },
    { id: 'termination', field: 'terminationType', type: 'choice',    text: "Were you terminated, or is this an ongoing situation?", choices: ['Terminated', 'Resigned under pressure', 'Still employed — hostile environment', 'Other'] },
    { id: 'hr_reported', field: 'hrReport',        type: 'choice',    text: "Did you report the issue to HR or management?", choices: ['No', 'Yes — no action taken', 'Yes — retaliated against after'] },
    { id: 'eeoc',        field: 'eeoc',            type: 'choice',    text: "Have you filed an EEOC charge or state agency complaint?", choices: ['No', 'Yes — pending', 'Yes — received right-to-sue letter'] },
  ],
  'contract': [
    { id: 'contract_party', field: 'opposingParty', type: 'text',     text: "Who is the other party in this contract dispute?" },
    { id: 'contract_value', field: 'contractValue', type: 'text',     text: "Approximately what is the value of the contract or disputed amount?" },
    { id: 'breach',      field: 'breachType',      type: 'multiline', text: "How was the contract breached? What was promised and what happened instead?" },
    { id: 'written',     field: 'writtenContract',  type: 'choice',   text: "Is the contract in writing?", choices: ['Yes — signed written contract', 'Partly written', 'Verbal agreement only'] },
  ],
  'real-estate': [
    { id: 're_party',    field: 'opposingParty',   type: 'text',      text: "Who is the other party — a landlord, tenant, seller, buyer, HOA?" },
    { id: 're_property', field: 'property',        type: 'text',      text: "What is the address or description of the property involved?" },
    { id: 're_issue',    field: 'legalTheory',     type: 'multiline', text: "What is the core issue — eviction, lease violation, title dispute, fraud?" },
  ],
  'immigration': [
    { id: 'status',      field: 'immigrationStatus', type: 'choice',  text: "What is your current immigration status?", choices: ['Undocumented', 'Visa holder', 'Green card holder', 'DACA recipient', 'Asylum seeker', 'Other'] },
    { id: 'imm_issue',   field: 'legalTheory',     type: 'multiline', text: "What is the immigration matter — deportation, visa denial, family petition, asylum?" },
    { id: 'removal',     field: 'removalOrder',    type: 'choice',    text: "Is there a removal or deportation order?", choices: ['No', 'Yes — pending hearing', 'Yes — ordered', 'Yes — appealing'] },
  ],
};

// ── ElevenLabs / browser TTS ─────────────────────────────────────────────────
const MAYA_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah

async function mayaSpeak(text: string, muted: boolean): Promise<void> {
  if (muted) return;
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${MAYA_VOICE_ID}/stream`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.55, similarity_boost: 0.80, style: 0.25, use_speaker_boost: true },
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    } catch {}
  }
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92; u.pitch = 1.05;
    u.onend = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// ── Gemini: clarify + extract answer ─────────────────────────────────────────
async function extractAndClarify(
  question: Question,
  userAnswer: string,
  caseType: string,
  transcript: { q: string; a: string }[],
): Promise<{ extracted: string; followUp: string | null }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const prompt = `You are Maya, a warm, professional AI legal intake specialist working for a law firm.

You just asked the client: "${question.text}"
The client responded: "${userAnswer}"
Case type: ${caseType}
Prior answers: ${JSON.stringify(transcript.slice(-4))}

1. Extract the key factual answer as clean text for the case file (1-3 sentences max, professional tone).
2. Decide if a brief follow-up is warranted (only if genuinely unclear or critically incomplete). If so, write it naturally and warmly. If the answer is sufficient, return null for followUp.

Respond in JSON only: {"extracted": "<clean extracted answer>", "followUp": "<follow-up question or null>"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) }
  );
  const data  = await res.json();
  const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(clean); }
  catch { return { extracted: userAnswer, followUp: null }; }
}

// ── Gemini: generate case file ────────────────────────────────────────────────
async function generateCaseFile(
  caseType: string,
  answers: Record<string, string>,
  transcript: { q: string; a: string }[],
): Promise<{ title: string; summary: string; legalTheory: string; keyIssues: string[]; urgentActions: string[]; nextSteps: string }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const prompt = `You are a senior attorney reviewing a new client intake for a ${caseType} case.

INTAKE ANSWERS:
${JSON.stringify(answers, null, 2)}

FULL TRANSCRIPT:
${transcript.map(t => `Q: ${t.q}\nA: ${t.a}`).join('\n\n')}

Generate a professional case file summary. Respond in JSON only:
{
  "title": "<descriptive case title, e.g. 'Smith v. City of Chicago — Excessive Force'>",
  "summary": "<3-5 sentence professional case summary for the attorney's file>",
  "legalTheory": "<primary legal theory and claims>",
  "keyIssues": ["<key issue 1>", "<key issue 2>", "<key issue 3>"],
  "urgentActions": ["<urgent action item 1 if any>", "<action 2 if any>"],
  "nextSteps": "<recommended immediate next steps for the attorney — 2-3 sentences>"
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) }
  );
  const data  = await res.json();
  const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// ── Wake words ────────────────────────────────────────────────────────────────
const WAKE_WORDS = ['done', 'finished', 'submit', 'that\'s it', 'that is it', 'nothing more', 'complete', 'next question', 'next', 'continue', 'move on'];

function hasWakeWord(text: string) {
  const lower = text.toLowerCase();
  return WAKE_WORDS.some(w => lower.includes(w));
}

type VoiceMode = 'push' | 'open';
type Phase     = 'select-type' | 'intake' | 'complete';

interface CaseFileResult {
  title: string; summary: string; legalTheory: string;
  keyIssues: string[]; urgentActions: string[]; nextSteps: string;
  answers: Record<string, string>;
  transcript: { q: string; a: string }[];
  caseType: string;
}

// ════════════════════════════════════════════════════════════════════════════
const AIClientOnboarding: React.FC = () => {
  const { addCase } = useContext(AppContext) as any;

  const [phase, setPhase]                 = useState<Phase>('select-type');
  const [selectedType, setSelectedType]   = useState<string>('');
  const [questions, setQuestions]         = useState<Question[]>([]);
  const [qIndex, setQIndex]               = useState(0);
  const [answers, setAnswers]             = useState<Record<string, string>>({});
  const [transcript, setTranscript]       = useState<{ q: string; a: string }[]>([]);
  const [currentInput, setCurrentInput]   = useState('');
  const [interimText, setInterimText]     = useState('');
  const [listening, setListening]         = useState(false);
  const [voiceMode, setVoiceMode]         = useState<VoiceMode>('open');
  const [openMicOn, setOpenMicOn]         = useState(false);
  const [muted, setMuted]                 = useState(false);
  const [mayaTalking, setMayaTalking]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const [caseFile, setCaseFile]           = useState<CaseFileResult | null>(null);
  const [followUpQ, setFollowUpQ]         = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);
  const [caseSaved, setCaseSaved]         = useState(false);

  const recognitionRef = useRef<any>(null);
  const silenceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef     = useRef(false);
  const bottomRef      = useRef<HTMLDivElement>(null);

  useEffect(() => { loadingRef.current = loading || mayaTalking; }, [loading, mayaTalking]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [qIndex, transcript, interimText]);
  useEffect(() => () => { recognitionRef.current?.stop(); if (silenceRef.current) clearTimeout(silenceRef.current); }, []);

  // ── Build question list ───────────────────────────────────────────────────
  const startIntake = useCallback(async (type: string) => {
    const typeQs = TYPE_QUESTIONS[type] || [];
    const all    = [...BASE_QUESTIONS, ...typeQs];
    setQuestions(all);
    setSelectedType(type);
    setQIndex(0);
    setAnswers({});
    setTranscript([]);
    setFollowUpQ(null);
    setPhase('intake');

    const label = CASE_TYPES.find(t => t.id === type)?.label || type;
    const intro = `Hi, I'm Maya, your AI legal intake specialist. I'm going to help get your ${label} case set up today. This will only take a few minutes, and everything you share is confidential. Let's get started — ${BASE_QUESTIONS[0].text}`;
    setMayaTalking(true);
    await mayaSpeak(intro, muted);
    setMayaTalking(false);
  }, [muted]);

  // ── Ask current question ──────────────────────────────────────────────────
  const askQuestion = useCallback(async (q: Question | string) => {
    const text = typeof q === 'string' ? q : q.text;
    setMayaTalking(true);
    await mayaSpeak(text, muted);
    setMayaTalking(false);
  }, [muted]);

  // ── Submit answer ─────────────────────────────────────────────────────────
  const submitAnswer = useCallback(async (answerText: string) => {
    if (!answerText.trim() || loadingRef.current) return;
    const currentQ = followUpQ ? { id: 'followup', field: questions[qIndex]?.field, type: 'multiline' as const, text: followUpQ } : questions[qIndex];
    if (!currentQ) return;

    stopOpenMic();
    setCurrentInput('');
    setInterimText('');
    setLoading(true);
    loadingRef.current = true;

    setTranscript(prev => [...prev, { q: currentQ.text, a: answerText }]);

    try {
      const { extracted, followUp } = await extractAndClarify(currentQ, answerText, selectedType, transcript);
      const newAnswers = { ...answers, [currentQ.field]: extracted };
      setAnswers(newAnswers);

      if (followUp && !followUpQ) {
        // Maya asks a clarifying follow-up
        setFollowUpQ(followUp);
        setLoading(false);
        loadingRef.current = false;
        await askQuestion(followUp);
        if (voiceMode === 'open') startOpenMic();
        return;
      }

      setFollowUpQ(null);
      const nextIndex = qIndex + 1;

      if (nextIndex >= questions.length) {
        // All done — generate case file
        setLoading(true);
        const label = CASE_TYPES.find(t => t.id === selectedType)?.label || selectedType;
        await mayaSpeak(`Perfect. I have everything I need. Give me just a moment to put together your case summary.`, muted);
        const result = await generateCaseFile(selectedType, newAnswers, [...transcript, { q: currentQ.text, a: answerText }]);
        setCaseFile({ ...result, answers: newAnswers, transcript: [...transcript, { q: currentQ.text, a: answerText }], caseType: label });
        setPhase('complete');
        setLoading(false);
        loadingRef.current = false;
        await mayaSpeak(`Your case file is ready. I've prepared a full summary and recommended next steps for your attorney. Thank you for sharing all of that with me today.`, muted);
        return;
      }

      setQIndex(nextIndex);
      setLoading(false);
      loadingRef.current = false;
      await askQuestion(questions[nextIndex]);
      if (voiceMode === 'open') startOpenMic();

    } catch {
      toast.error('Processing failed — please try again');
      setLoading(false);
      loadingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, questions, answers, transcript, selectedType, followUpQ, muted, voiceMode]);

  // ── Open mic ──────────────────────────────────────────────────────────────
  const startOpenMic = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    let buffer = '';
    const r    = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';

    r.onresult = (e: any) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { final += e.results[i][0].transcript + ' '; buffer += e.results[i][0].transcript + ' '; }
        else interim += e.results[i][0].transcript;
      }
      setInterimText(buffer + interim);
      if (silenceRef.current) clearTimeout(silenceRef.current);
      if (final && hasWakeWord(final)) {
        r.stop();
        const toSend = buffer.replace(/(done|finished|submit|that's it|that is it|nothing more|complete|next question|next|continue|move on)/gi, '').trim();
        buffer = '';
        setInterimText('');
        if (toSend && !loadingRef.current) submitAnswer(toSend);
        return;
      }
      silenceRef.current = setTimeout(() => {
        if (buffer.trim() && !loadingRef.current) {
          const toSend = buffer.trim(); buffer = ''; setInterimText('');
          submitAnswer(toSend);
        }
      }, 3000);
    };
    r.onend = () => {
      if (openMicOn && !loadingRef.current) {
        setTimeout(() => { try { r.start(); } catch {} }, 400);
      } else {
        setListening(false);
      }
    };
    r.onerror = (e: any) => { if (e.error !== 'no-speech') console.warn(e.error); };
    recognitionRef.current = r;
    r.start();
    setListening(true);
    setOpenMicOn(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitAnswer, openMicOn]);

  const stopOpenMic = useCallback(() => {
    setOpenMicOn(false);
    recognitionRef.current?.stop();
    setListening(false);
    setInterimText('');
    if (silenceRef.current) clearTimeout(silenceRef.current);
  }, []);

  // ── Push-to-talk ──────────────────────────────────────────────────────────
  const startPush = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    let buffer = '';
    const r    = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    r.onresult = (e: any) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { final += e.results[i][0].transcript + ' '; buffer += e.results[i][0].transcript + ' '; }
        else interim += e.results[i][0].transcript;
      }
      setInterimText(buffer + interim);
    };
    r.onend = () => {};
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
    // store buffer in ref for stopPush
    (recognitionRef as any).buffer = () => buffer;
  }, []);

  const stopPush = useCallback(() => {
    const captured = ((recognitionRef as any).buffer?.() || interimText).trim();
    recognitionRef.current?.stop();
    setListening(false);
    setInterimText('');
    if (captured) submitAnswer(captured);
  }, [interimText, submitAnswer]);

  // ── Save to case files ────────────────────────────────────────────────────
  const saveCase = useCallback(async () => {
    if (!caseFile || !addCase) return;
    try {
      await addCase({
        title:           caseFile.title,
        client:          caseFile.answers.client || 'New Client',
        status:          'Active',
        summary:         caseFile.summary,
        legalTheory:     caseFile.legalTheory,
        keyIssues:       caseFile.keyIssues,
        opposingCounsel: caseFile.answers.opposingParty || '',
        judge:           '',
        nextCourtDate:   caseFile.answers.nextCourtDate || '',
        winProbability:  50,
        tags:            [caseFile.caseType],
      });
      setCaseSaved(true);
      toast.success('Case added to your case files!');
    } catch {
      toast.error('Could not save — you can copy the summary manually');
    }
  }, [caseFile, addCase]);

  const copyTranscript = useCallback(() => {
    if (!caseFile) return;
    const text = [
      `CASE: ${caseFile.title}`,
      `TYPE: ${caseFile.caseType}`,
      `DATE: ${new Date().toLocaleDateString()}`,
      '',
      '=== INTAKE TRANSCRIPT ===',
      ...caseFile.transcript.map(t => `Q: ${t.q}\nA: ${t.a}`),
      '',
      '=== CASE SUMMARY ===',
      caseFile.summary,
      '',
      `LEGAL THEORY: ${caseFile.legalTheory}`,
      '',
      'KEY ISSUES:',
      ...caseFile.keyIssues.map(i => `• ${i}`),
      '',
      'NEXT STEPS:',
      caseFile.nextSteps,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [caseFile]);

  const progress = questions.length ? Math.round((qIndex / questions.length) * 100) : 0;

  // ════════════════════════════════════════════════════════════════════════
  // PHASE: SELECT TYPE
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'select-type') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <ClipboardList size={20} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Client Intake</h1>
              <p className="text-slate-400 text-sm">Maya will walk you through setup — voice or text, your choice</p>
            </div>
          </div>

          {/* Voice mode picker */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
            <p className="text-sm text-slate-400 mb-3">Choose your input mode:</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setVoiceMode('open')}
                className={`p-3 rounded-xl border text-left transition-all ${voiceMode === 'open' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                <div className="flex items-center gap-2 mb-1"><RadioTower size={14} className="text-emerald-400" /><span className="font-medium text-sm">Open Mic (Recommended)</span></div>
                <div className="text-xs text-slate-400">Always-on — just speak naturally, pause to send</div>
              </button>
              <button onClick={() => setVoiceMode('push')}
                className={`p-3 rounded-xl border text-left transition-all ${voiceMode === 'push' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                <div className="flex items-center gap-2 mb-1"><Mic size={14} className="text-blue-400" /><span className="font-medium text-sm">Push-to-Talk</span></div>
                <div className="text-xs text-slate-400">Hold mic button while speaking, release to send</div>
              </button>
            </div>
          </div>

          <p className="text-slate-300 font-medium mb-4">What type of case is this?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {CASE_TYPES.map(t => (
              <button key={t.id} onClick={() => startIntake(t.id)}
                className="p-4 bg-slate-900 border border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/5 rounded-2xl text-left transition-all group">
                <div className="text-2xl mb-2">{t.icon}</div>
                <div className="text-sm font-medium text-slate-200 group-hover:text-white">{t.label}</div>
              </button>
            ))}
          </div>

          {/* Shareable link info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Share2 size={16} className="text-blue-400" />
              <span className="text-blue-400 font-semibold text-sm">Shareable Client Link (Coming Soon)</span>
            </div>
            <p className="text-slate-300 text-sm">You'll be able to send a unique link to any client. They open it, Maya greets them by voice, collects their information, and the completed case file lands directly in your dashboard — no attorney time required.</p>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // PHASE: INTAKE
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'intake') {
    const currentQ = followUpQ
      ? { id: 'followup', text: followUpQ, field: questions[qIndex]?.field || '', type: 'multiline' as const }
      : questions[qIndex];
    const label = CASE_TYPES.find(t => t.id === selectedType)?.label || selectedType;

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">

        {/* Header */}
        <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-sm">👩‍⚖️</div>
            <div>
              <div className="text-white text-sm font-semibold">Maya — AI Intake Specialist</div>
              <div className="text-slate-400 text-xs">{label} intake</div>
            </div>
            {mayaTalking && <span className="text-xs text-emerald-400 animate-pulse">speaking…</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setVoiceMode(v => v === 'push' ? 'open' : 'push')}
              className={`p-2 rounded-lg text-sm transition-colors ${voiceMode === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-400'}`}>
              {voiceMode === 'open' ? <RadioTower size={15} /> : <Radio size={15} />}
            </button>
            <button onClick={() => setMuted(m => !m)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-4 py-2 border-b border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Question {Math.min(qIndex + 1, questions.length)} of {questions.length}</span>
            <span>{progress}% complete</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Open mic bar */}
        {voiceMode === 'open' && (
          <div className={`px-4 py-2 text-xs flex items-center gap-2 ${openMicOn && !mayaTalking ? 'bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300' : 'bg-slate-900 border-b border-slate-800 text-slate-500'}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${openMicOn && !mayaTalking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {openMicOn && !mayaTalking ? 'Listening — speak your answer, then pause 3 seconds to send' : 'Open mic paused while Maya speaks'}
          </div>
        )}

        {/* Chat transcript */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {transcript.map((t, i) => (
            <React.Fragment key={i}>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex-shrink-0 flex items-center justify-center text-xs">👩‍⚖️</div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
                  <p className="text-slate-200 text-sm">{questions.find((_, qi) => qi <= i)?.text || t.q}</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <div className="bg-emerald-600/20 border border-emerald-500/20 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                  <p className="text-slate-200 text-sm">{t.a}</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-xs">👤</div>
              </div>
            </React.Fragment>
          ))}

          {/* Current question */}
          {currentQ && !loading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex-shrink-0 flex items-center justify-center text-xs">👩‍⚖️</div>
              <div className={`bg-slate-800 border rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%] ${mayaTalking ? 'border-emerald-500/30' : 'border-slate-700'}`}>
                <p className="text-white text-sm">{followUpQ || currentQ.text}</p>
                {currentQ.type === 'choice' && currentQ.choices && !mayaTalking && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {currentQ.choices.map(c => (
                      <button key={c} onClick={() => submitAnswer(c)}
                        className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-emerald-600 border border-slate-600 hover:border-emerald-500 rounded-full text-slate-300 hover:text-white transition-all">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interim */}
          {interimText && (
            <div className="flex gap-2 justify-end opacity-70">
              <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                <p className="text-emerald-300 text-sm italic">{interimText}</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-xs">👤</div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 size={15} className="animate-spin text-emerald-400" />
              <span>Maya is processing…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            {voiceMode === 'push' ? (
              <button
                onMouseDown={startPush} onMouseUp={stopPush}
                onTouchStart={e => { e.preventDefault(); startPush(); }}
                onTouchEnd={e => { e.preventDefault(); stopPush(); }}
                disabled={mayaTalking || loading}
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all select-none ${listening ? 'bg-red-500 shadow-lg shadow-red-500/30 scale-110 ring-4 ring-red-500/20' : 'bg-slate-700 hover:bg-emerald-600'} text-white disabled:opacity-40`}>
                {listening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            ) : (
              <button onClick={openMicOn ? stopOpenMic : startOpenMic}
                disabled={mayaTalking || loading}
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${openMicOn && !mayaTalking ? 'bg-emerald-500 scale-110 ring-4 ring-emerald-500/20 animate-pulse' : 'bg-slate-700 hover:bg-emerald-600'} text-white disabled:opacity-40`}>
                {openMicOn ? <RadioTower size={20} /> : <Radio size={20} />}
              </button>
            )}

            <input
              value={currentInput}
              onChange={e => setCurrentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && currentInput.trim() && submitAnswer(currentInput)}
              disabled={mayaTalking || loading}
              placeholder={listening ? 'Listening…' : openMicOn ? 'Mic active — or type here…' : 'Type your answer…'}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
            <button onClick={() => currentInput.trim() && submitAnswer(currentInput)}
              disabled={!currentInput.trim() || mayaTalking || loading}
              className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white disabled:opacity-40 transition-colors">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          <p className="text-center text-slate-600 text-xs mt-2">
            {voiceMode === 'open' ? 'Pause 3 seconds to send • Say "done" or "next" to move on' : 'Hold mic to talk • Release to send'}
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // PHASE: COMPLETE — Case File
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'complete' && caseFile) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">

          {/* Success header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Intake Complete</h2>
              <p className="text-slate-400 text-sm">Maya has prepared your case file</p>
            </div>
          </div>

          {/* Case card */}
          <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-6 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <Scale size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-bold text-lg leading-tight">{caseFile.title}</h3>
                <span className="text-xs text-emerald-400 font-medium">{caseFile.caseType}</span>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Case Summary</div>
              <p className="text-slate-200 text-sm leading-relaxed">{caseFile.summary}</p>
            </div>

            <div className="mb-4">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Legal Theory</div>
              <p className="text-slate-200 text-sm">{caseFile.legalTheory}</p>
            </div>

            <div className="mb-4">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Key Issues</div>
              <ul className="space-y-1.5">
                {caseFile.keyIssues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                    <AlertCircle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />{issue}
                  </li>
                ))}
              </ul>
            </div>

            {caseFile.urgentActions?.filter(Boolean).length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                <div className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Zap size={12} /> Urgent Actions
                </div>
                {caseFile.urgentActions.filter(Boolean).map((a, i) => (
                  <p key={i} className="text-red-200 text-sm">⚡ {a}</p>
                ))}
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <div className="text-xs text-blue-400 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Brain size={12} /> Recommended Next Steps
              </div>
              <p className="text-slate-200 text-sm">{caseFile.nextSteps}</p>
            </div>
          </div>

          {/* Client info summary */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Client Info</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {caseFile.answers.client      && <div className="flex items-center gap-2 text-slate-300"><User size={13} className="text-slate-400" />{caseFile.answers.client}</div>}
              {caseFile.answers.phone       && <div className="flex items-center gap-2 text-slate-300"><Phone size={13} className="text-slate-400" />{caseFile.answers.phone}</div>}
              {caseFile.answers.email       && <div className="flex items-center gap-2 text-slate-300"><Mail size={13} className="text-slate-400" />{caseFile.answers.email}</div>}
              {caseFile.answers.city        && <div className="flex items-center gap-2 text-slate-300"><MapPin size={13} className="text-slate-400" />{caseFile.answers.city}</div>}
              {caseFile.answers.incidentDate && <div className="flex items-center gap-2 text-slate-300"><Calendar size={13} className="text-slate-400" />{caseFile.answers.incidentDate}</div>}
              {caseFile.answers.opposingParty && <div className="flex items-center gap-2 text-slate-300"><Building size={13} className="text-slate-400" />{caseFile.answers.opposingParty}</div>}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <button onClick={saveCase} disabled={caseSaved}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-colors ${caseSaved ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
              {caseSaved ? <><CheckCircle size={16} /> Saved!</> : <><FileText size={16} /> Save to Case Files</>}
            </button>
            <button onClick={copyTranscript}
              className="flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 font-medium text-sm transition-colors">
              {copied ? <><CheckCircle size={16} /> Copied!</> : <><Copy size={16} /> Copy Transcript</>}
            </button>
            <button onClick={() => { stopOpenMic(); setPhase('select-type'); setCaseFile(null); setCaseSaved(false); }}
              className="flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 font-medium text-sm transition-colors">
              <RotateCcw size={16} /> New Intake
            </button>
          </div>

          {/* Transcript collapsible */}
          <details className="bg-slate-900 border border-slate-700 rounded-2xl">
            <summary className="p-5 cursor-pointer text-sm font-medium text-slate-300 flex items-center gap-2 hover:text-white">
              <ClipboardList size={16} className="text-slate-400" /> View Full Intake Transcript ({caseFile.transcript.length} exchanges)
            </summary>
            <div className="px-5 pb-5 space-y-3 border-t border-slate-800 pt-4">
              {caseFile.transcript.map((t, i) => (
                <div key={i}>
                  <div className="text-xs text-emerald-400 font-medium mb-0.5">Maya:</div>
                  <p className="text-slate-400 text-xs mb-1">{t.q}</p>
                  <div className="text-xs text-slate-300 font-medium mb-0.5">Client:</div>
                  <p className="text-slate-200 text-xs">{t.a}</p>
                  {i < caseFile.transcript.length - 1 && <div className="border-b border-slate-800 mt-2" />}
                </div>
              ))}
            </div>
          </details>

        </div>
      </div>
    );
  }

  return null;
};

export default AIClientOnboarding;
