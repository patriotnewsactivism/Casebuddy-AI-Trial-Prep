import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Loader2, Settings, Copy, CheckCircle, Code, Globe, UserPlus, Calendar, Briefcase, Archive } from 'lucide-react';
import { aiParalegal } from '../lib/api';
import AgentHeader from '../components/AgentHeader';
import { AGENTS, NATURAL_CONVERSATION_DIRECTIVE } from '../agents/personas';
import { useLeads, addLead, promoteLead, archiveLead, parseLeadCapture, stripLeadCapture } from '../lib/leadStore';
import { getFirm } from '../lib/firmStore';

const sierra = AGENTS.sierra;

interface ChatMessage { role: 'bot' | 'user'; text: string; timestamp: string; leadCaptured?: boolean; }

export default function LegalSecretary() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'demo' | 'config' | 'leads' | 'embed'>('demo');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: "Hello! I'm the AI legal assistant for your firm. I can help you understand if you have a potential case and connect you with the right attorney. What's your situation?", timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const leads = useLeads().filter(l => l.status !== 'archived');
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState(() => {
    const firm = getFirm();
    return {
      firmName: firm.firmName || 'Your Law Firm',
      primaryColor: firm.accentColor || '#06b6d4',
      greeting: "Hello! I'm the AI legal assistant. How can I help you today?",
      practiceAreas: 'Civil Rights, Personal Injury, Criminal Defense, Family Law',
      bookingUrl: '',
      captureEmail: true,
      capturePhone: true,
    };
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg, timestamp: new Date().toISOString() }]);
    setLoading(true);

    try {
      const res = await aiParalegal({
        message: userMsg,
        context: `You are an AI legal intake assistant for ${config.firmName}. Practice areas: ${config.practiceAreas}. Your goals: 1) Understand the potential client's situation, 2) Determine the case type and jurisdiction, 3) Assess urgency and merit, 4) Collect contact info (name, email, phone), 5) Book a consultation. Be professional, empathetic, and clear. Ask qualifying questions. If they share contact info, acknowledge it.

Once you have at minimum the person's name plus their email or phone AND a sense of their legal issue, append a structured lead record to the END of your reply, wrapped exactly in <LEAD_CAPTURED></LEAD_CAPTURED> tags, as JSON with fields: name, email, phone, case_type, jurisdiction, summary (1-2 sentences), urgency (Low/Medium/High). Only emit it once per conversation. Never mention the tags to the client.
${NATURAL_CONVERSATION_DIRECTIVE}`,
        history: messages.map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text })),
      });
      const rawText = res.response || res.message || "I'd be happy to help. Could you tell me more about your situation?";
      const captured = parseLeadCapture(rawText);
      if (captured) addLead(captured);
      setMessages(prev => [...prev, { role: 'bot', text: stripLeadCapture(rawText), timestamp: new Date().toISOString(), leadCaptured: !!captured }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: "I appreciate you reaching out. Could you provide a bit more detail so I can better assist you?", timestamp: new Date().toISOString() }]);
    }
    setLoading(false);
  };

  const embedCode = `<!-- CaseBuddy AI Legal Secretary Widget -->
<div id="casebuddy-widget"></div>
<script>
  (function() {
    var w = document.createElement('div');
    w.id = 'cb-chat-widget';
    w.innerHTML = '<div style="position:fixed;bottom:20px;right:20px;z-index:9999;">' +
      '<button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\\'none\\'?\\'block\\':\\'none\\'" ' +
      'style="width:60px;height:60px;border-radius:50%;background:${config.primaryColor};border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="white" style="margin:auto;display:block;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></button>' +
      '<iframe src="https://casebuddy.live/widget?firm=${encodeURIComponent(config.firmName)}" ' +
      'style="display:none;width:380px;height:520px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);"></iframe></div>';
    document.body.appendChild(w);
  })();
</script>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { key: 'demo' as const, label: 'Live Demo', icon: MessageSquare },
    { key: 'leads' as const, label: `Leads (${leads.length})`, icon: UserPlus },
    { key: 'config' as const, label: 'Configuration', icon: Settings },
    { key: 'embed' as const, label: 'Embed Code', icon: Code },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">AI Legal Secretary</h1>
        <p className="text-slate-400 text-sm">Sierra qualifies leads, captures client info, and books consultations — your 24/7 AI front desk</p>
      </div>

      <AgentHeader agent={sierra} subtitle="I'm your firm's first impression. Professional, personable, and I never miss a lead — even at 3 AM." />

      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.key ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Live Demo */}
      {activeTab === 'demo' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex flex-col" style={{ height: '520px' }}>
            <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3" style={{ background: config.primaryColor }}>
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageSquare size={16} className="text-white" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{config.firmName}</div>
                <div className="text-white/70 text-xs">AI Legal Assistant • Online</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i}>
                  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.role === 'user' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-slate-700 text-slate-200 rounded-bl-md'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                  {m.leadCaptured && (
                    <div className="flex justify-start mt-1.5">
                      <button onClick={() => setActiveTab('leads')}
                        className="flex items-center gap-1.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs px-3 py-1.5 rounded-full hover:bg-cyan-500/25 transition-colors">
                        <UserPlus size={12} /> Lead captured — view in Leads tab
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-700 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-slate-700">
              <div className="flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Describe your legal situation..."
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
                <button onClick={sendMessage} disabled={loading || !input.trim()}
                  className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white p-2 rounded-xl transition-colors">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">How It Works</h3>
              <div className="space-y-3">
                {[
                  { icon: Globe, title: 'Embed on your website', desc: 'Copy-paste one snippet onto your firm website' },
                  { icon: MessageSquare, title: 'AI qualifies leads 24/7', desc: 'Asks about case type, jurisdiction, timeline, and merit' },
                  { icon: UserPlus, title: 'Captures contact info', desc: 'Collects name, email, phone, and case details' },
                  { icon: Calendar, title: 'Books consultations', desc: 'Schedules directly on your calendar' },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center shrink-0">
                      <step.icon size={16} className="text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">{step.title}</div>
                      <div className="text-slate-500 text-xs">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-4">
              <div className="text-cyan-400 font-semibold text-sm mb-1">💰 Revenue Impact</div>
              <div className="text-slate-300 text-sm">Law firms using AI intake chatbots see 2-3x more qualified leads. At $3,000 avg case value, even 5 extra leads/month = $15,000+ revenue.</div>
            </div>
          </div>
        </div>
      )}

      {/* Leads */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          {leads.length === 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
              <div className="text-4xl mb-3">📥</div>
              <p className="text-white font-medium mb-1">No leads yet</p>
              <p className="text-slate-400 text-sm">When Sierra captures a qualified lead in chat, it appears here automatically.</p>
            </div>
          )}
          {leads.map(lead => (
            <div key={lead.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-cyan-500/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-white font-semibold">{lead.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      lead.urgency === 'High' ? 'bg-red-500/20 text-red-400' :
                      lead.urgency === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>{lead.urgency} Priority</span>
                    <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">{lead.caseType}</span>
                    {lead.status === 'promoted' && (
                      <span className="bg-violet-500/20 text-violet-400 text-xs px-2 py-0.5 rounded-full">✓ Case Opened</span>
                    )}
                  </div>
                  <div className="text-slate-400 text-sm mb-2">{lead.summary}</div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>📧 {lead.email}</span>
                    <span>📱 {lead.phone}</span>
                    <span>📍 {lead.jurisdiction}</span>
                    <span>🕐 {new Date(lead.capturedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {lead.status === 'promoted' && lead.caseId ? (
                    <button onClick={() => navigate(`/cases/${lead.caseId}`)}
                      className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
                      <Briefcase size={13} /> View Case File
                    </button>
                  ) : (
                    <button onClick={() => { const c = promoteLead(lead.id); if (c) navigate(`/cases/${c.id}`); }}
                      className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-violet-600 hover:opacity-90 text-white px-3 py-2 rounded-lg text-xs font-medium transition-opacity">
                      <Briefcase size={13} /> Send to Maya →
                    </button>
                  )}
                  <button onClick={() => archiveLead(lead.id)}
                    className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 px-3 py-2 rounded-lg text-xs transition-colors">
                    <Archive size={13} /> Archive
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 text-cyan-400 text-xs">
            💡 "Send to Maya" opens an intake-ready case stub — the case file system automatically briefs Sol, Doc, Lex, Max, Rex &amp; Jules with their handoff assignments.
          </div>
        </div>
      )}

      {/* Configuration */}
      {activeTab === 'config' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5 max-w-2xl">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Firm Name</label>
            <input value={config.firmName} onChange={e => setConfig(prev => ({ ...prev, firmName: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Brand Color</label>
            <div className="flex gap-3 items-center">
              <input type="color" value={config.primaryColor} onChange={e => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                className="w-10 h-10 rounded cursor-pointer" />
              <input value={config.primaryColor} onChange={e => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm w-32" />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Greeting Message</label>
            <textarea value={config.greeting} onChange={e => setConfig(prev => ({ ...prev, greeting: e.target.value }))}
              rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 resize-none" />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Practice Areas (comma-separated)</label>
            <input value={config.practiceAreas} onChange={e => setConfig(prev => ({ ...prev, practiceAreas: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Booking URL (optional)</label>
            <input value={config.bookingUrl} onChange={e => setConfig(prev => ({ ...prev, bookingUrl: e.target.value }))}
              placeholder="https://calendly.com/yourfirm"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={config.captureEmail} onChange={e => setConfig(prev => ({ ...prev, captureEmail: e.target.checked }))}
                className="rounded border-slate-600" /> Capture email
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={config.capturePhone} onChange={e => setConfig(prev => ({ ...prev, capturePhone: e.target.checked }))}
                className="rounded border-slate-600" /> Capture phone
            </label>
          </div>
        </div>
      )}

      {/* Embed Code */}
      {activeTab === 'embed' && (
        <div className="space-y-4 max-w-3xl">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm">Embed Snippet</h3>
              <button onClick={copyEmbed}
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded text-xs transition-colors">
                {copied ? <><CheckCircle size={12} className="text-green-400" /> Copied!</> : <><Copy size={12} /> Copy Code</>}
              </button>
            </div>
            <pre className="bg-slate-900 rounded-lg p-4 text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-blue-400 text-sm">
            📋 Paste this code before the closing <code className="bg-slate-800 px-1 rounded">&lt;/body&gt;</code> tag on any page of your website.
          </div>
        </div>
      )}
    </div>
  );
}

