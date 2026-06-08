import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import {
  MessageCircle, Send, Bot, User, Clock, Calendar, CheckCircle,
  Phone, Mail, FileText, Loader2, Settings, Copy, Code, ExternalLink,
  Eye, Sparkles, Plus, ChevronDown, Download, Building2
} from 'lucide-react';
import { toast } from 'react-toastify';
import { callGeminiProxy } from '../services/apiProxy';

interface ChatMessage {
  id: string;
  role: 'bot' | 'client';
  text: string;
  timestamp: Date;
}

interface LeadData {
  name?: string;
  email?: string;
  phone?: string;
  caseType?: string;
  jurisdiction?: string;
  incidentDate?: string;
  description?: string;
  urgency?: 'low' | 'medium' | 'high' | 'emergency';
  qualified?: boolean;
  qualificationReason?: string;
  suggestedNextStep?: string;
}

interface Lead {
  id: string;
  data: LeadData;
  chatHistory: ChatMessage[];
  createdAt: string;
  status: 'new' | 'qualified' | 'disqualified' | 'scheduled' | 'converted';
}

const LegalSecretary = () => {
  const { addCase } = useContext(AppContext);
  const [activeView, setActiveView] = useState<'demo' | 'leads' | 'config' | 'embed'>('demo');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'bot', text: "Hi! I'm CaseBuddy's AI Legal Secretary. I help screen potential clients and gather case details before your consultation. How can I help you today?", timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentLead, setCurrentLead] = useState<LeadData>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Config
  const [firmName, setFirmName] = useState('Your Law Firm');
  const [practiceAreas, setPracticeAreas] = useState('Civil Rights, Personal Injury, Employment Law, Criminal Defense');
  const [jurisdiction, setJurisdiction] = useState('Mississippi');
  const [consultationUrl, setConsultationUrl] = useState('');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'client',
      text: input.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role === 'bot' ? 'model' as const : 'user' as const,
        parts: [{ text: m.text }],
      }));

      const systemPrompt = `You are an AI legal intake secretary for ${firmName}. Your job is to:
1. Warmly greet potential clients
2. Ask about their legal issue (what happened, when, where)
3. Gather their contact info (name, email, phone)
4. Determine the type of case (${practiceAreas})
5. Assess urgency (upcoming deadlines, statute of limitations concerns)
6. Qualify the lead (does it match the firm's practice areas?)
7. If qualified, suggest scheduling a consultation

Be empathetic, professional, and thorough. Ask ONE question at a time. Don't overwhelm them.
If they describe their situation, follow up with clarifying questions.
The firm is located in ${jurisdiction}.

Current lead data collected so far: ${JSON.stringify(currentLead)}

After gathering sufficient info (name, case type, basic facts), include a JSON block in your response like:
<LEAD_DATA>{"name":"...","email":"...","phone":"...","caseType":"...","jurisdiction":"...","incidentDate":"...","description":"...","urgency":"low/medium/high/emergency","qualified":true/false,"qualificationReason":"...","suggestedNextStep":"..."}</LEAD_DATA>

Only include LEAD_DATA when you have enough info to assess. Continue the conversation naturally.`;

      const result = await callGeminiProxy({
        prompt: input.trim(),
        systemPrompt,
        model: 'gemini-2.5-flash',
        conversationHistory,
        options: { temperature: 0.7, maxOutputTokens: 1024 },
      });

      let responseText = result.text;

      // Extract lead data if present
      const leadMatch = responseText.match(/<LEAD_DATA>([\s\S]*?)<\/LEAD_DATA>/);
      if (leadMatch) {
        try {
          const leadData = JSON.parse(leadMatch[1]);
          setCurrentLead(prev => ({ ...prev, ...leadData }));
        } catch {}
        responseText = responseText.replace(/<LEAD_DATA>[\s\S]*?<\/LEAD_DATA>/, '').trim();
      }

      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'bot',
        text: responseText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to get response');
    } finally {
      setIsTyping(false);
    }
  };

  const saveLead = () => {
    if (!currentLead.name) {
      toast.error('No lead data to save yet — continue the conversation');
      return;
    }

    const lead: Lead = {
      id: crypto.randomUUID(),
      data: currentLead,
      chatHistory: [...messages],
      createdAt: new Date().toISOString(),
      status: currentLead.qualified ? 'qualified' : 'new',
    };
    setLeads(prev => [lead, ...prev]);
    toast.success(`✅ Lead saved: ${currentLead.name}`);

    // Reset chat
    setMessages([
      { id: '1', role: 'bot', text: "Hi! I'm CaseBuddy's AI Legal Secretary. I help screen potential clients and gather case details before your consultation. How can I help you today?", timestamp: new Date() },
    ]);
    setCurrentLead({});
  };

  const convertToCase = async (lead: Lead) => {
    const newCase = {
      id: crypto.randomUUID(),
      title: `${lead.data.name} - ${lead.data.caseType || 'New Case'}`,
      client: lead.data.name || 'Unknown',
      status: 'Pre-Trial' as any,
      opposingCounsel: 'TBD',
      judge: 'TBD',
      nextCourtDate: '',
      summary: lead.data.description || '',
      winProbability: 50,
      tags: [lead.data.caseType || 'Intake'],
    };
    await addCase(newCase as any);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'converted' as const } : l));
    toast.success(`✅ Case created for ${lead.data.name}`);
  };

  const embedCode = `<!-- CaseBuddy AI Legal Secretary Widget -->
<script>
(function() {
  var w = document.createElement('div');
  w.id = 'casebuddy-widget';
  w.innerHTML = '<iframe src="https://casebuddy.live/widget/intake?firm=${encodeURIComponent(firmName)}&areas=${encodeURIComponent(practiceAreas)}" style="position:fixed;bottom:20px;right:20px;width:380px;height:520px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:9999;" allow="microphone"></iframe>';
  document.body.appendChild(w);
})();
</script>`;

  const urgencyColor = (u?: string) => {
    if (u === 'emergency') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (u === 'high') return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    if (u === 'medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-green-400 bg-green-500/10 border-green-500/30';
  };

  return (
    <div className="space-y-6 animate-slideInUp">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30">
              <MessageCircle size={24} className="text-teal-400" />
            </div>
            AI Legal Secretary
          </h1>
          <p className="text-slate-400 mt-1">Embeddable chat widget that qualifies leads, gathers case details, and books consultations</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1">
        {[
          { id: 'demo', label: 'Live Demo', icon: MessageCircle },
          { id: 'leads', label: `Leads (${leads.length})`, icon: User },
          { id: 'config', label: 'Configure', icon: Settings },
          { id: 'embed', label: 'Embed Code', icon: Code },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm ${
              activeView === tab.id ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Demo View */}
      {activeView === 'demo' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Chat Window */}
          <div className="md:col-span-2 glass-card rounded-xl overflow-hidden flex flex-col" style={{ height: '600px' }}>
            <div className="p-4 bg-teal-500/10 border-b border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                <Bot size={20} className="text-teal-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{firmName} - AI Legal Secretary</p>
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'client' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'client'
                      ? 'bg-teal-600 text-white rounded-br-md'
                      : 'bg-slate-800 text-slate-200 rounded-bl-md'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={isTyping || !input.trim()}
                  className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Lead Data Panel */}
          <div className="glass-card rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" /> Extracted Lead Data
            </h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Name', value: currentLead.name, icon: User },
                { label: 'Email', value: currentLead.email, icon: Mail },
                { label: 'Phone', value: currentLead.phone, icon: Phone },
                { label: 'Case Type', value: currentLead.caseType, icon: FileText },
                { label: 'Jurisdiction', value: currentLead.jurisdiction, icon: Building2 },
                { label: 'Incident Date', value: currentLead.incidentDate, icon: Calendar },
              ].map((field, i) => (
                <div key={i} className="flex items-center gap-2">
                  <field.icon size={12} className="text-slate-500" />
                  <span className="text-slate-500 w-24">{field.label}:</span>
                  <span className={field.value ? 'text-white' : 'text-slate-600'}>{field.value || '—'}</span>
                </div>
              ))}

              {currentLead.urgency && (
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-slate-500" />
                  <span className="text-slate-500 w-24">Urgency:</span>
                  <span className={`px-2 py-0.5 rounded text-xs border ${urgencyColor(currentLead.urgency)}`}>
                    {currentLead.urgency}
                  </span>
                </div>
              )}

              {currentLead.qualified !== undefined && (
                <div className="flex items-center gap-2">
                  {currentLead.qualified ? <CheckCircle size={12} className="text-green-400" /> : <Eye size={12} className="text-red-400" />}
                  <span className="text-slate-500 w-24">Qualified:</span>
                  <span className={currentLead.qualified ? 'text-green-400' : 'text-red-400'}>
                    {currentLead.qualified ? 'Yes' : 'No'}
                  </span>
                </div>
              )}

              {currentLead.description && (
                <div className="mt-3 p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <p className="text-xs text-slate-300">{currentLead.description}</p>
                </div>
              )}
            </div>

            <button
              onClick={saveLead}
              disabled={!currentLead.name}
              className="w-full px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Save Lead & Start New Chat
            </button>
          </div>
        </div>
      )}

      {/* Leads View */}
      {activeView === 'leads' && (
        <div className="space-y-3">
          {leads.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <User size={48} className="mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Leads Yet</h3>
              <p className="text-sm text-slate-400">Try the live demo to see how the AI secretary captures leads.</p>
            </div>
          ) : (
            leads.map(lead => (
              <div key={lead.id} className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{lead.data.name || 'Unknown'}</h3>
                    <p className="text-xs text-slate-400">{lead.data.email} • {lead.data.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs border ${urgencyColor(lead.data.urgency)}`}>
                      {lead.data.urgency || 'unknown'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      lead.status === 'converted' ? 'bg-green-500/10 text-green-400' :
                      lead.status === 'qualified' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {lead.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-3">{lead.data.caseType} • {lead.data.description?.substring(0, 100)}...</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => convertToCase(lead)}
                    disabled={lead.status === 'converted'}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-xs text-white disabled:opacity-50 flex items-center gap-1"
                  >
                    <Plus size={12} /> Create Case
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Config View */}
      {activeView === 'config' && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Widget Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 uppercase mb-1 block">Firm Name</label>
              <input type="text" value={firmName} onChange={e => setFirmName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase mb-1 block">Jurisdiction</label>
              <input type="text" value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase mb-1 block">Practice Areas (comma-separated)</label>
            <input type="text" value={practiceAreas} onChange={e => setPracticeAreas(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase mb-1 block">Consultation Booking URL (optional)</label>
            <input type="text" value={consultationUrl} onChange={e => setConsultationUrl(e.target.value)} placeholder="https://calendly.com/your-firm" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none" />
          </div>
          <button onClick={() => toast.success('Configuration saved!')} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium">
            Save Configuration
          </button>
        </div>
      )}

      {/* Embed View */}
      {activeView === 'embed' && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Embed on Your Website</h2>
          <p className="text-sm text-slate-400">
            Add this code snippet to your law firm's website. The AI Legal Secretary will appear as a chat widget in the bottom-right corner, qualifying leads 24/7.
          </p>
          <div className="relative">
            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap font-mono">
              {embedCode}
            </pre>
            <button
              onClick={() => { navigator.clipboard.writeText(embedCode); toast.success('Copied!'); }}
              className="absolute top-2 right-2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-xs text-amber-400 font-medium">💡 Pro Tip</p>
            <p className="text-xs text-slate-400 mt-1">
              Add the widget to your firm's contact page, homepage, and practice area pages for maximum lead capture.
              The AI adapts its questions based on the page context.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegalSecretary;
