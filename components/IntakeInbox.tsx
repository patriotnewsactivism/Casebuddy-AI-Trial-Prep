/**
 * IntakeInbox.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Attorney-side inbox for incoming client intakes submitted via the public link.
 * Reads from Supabase `client_intakes` table.
 */

import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../App';
import {
  Inbox, User, Phone, Mail, Calendar, ChevronRight, ChevronDown,
  CheckCircle, Clock, AlertCircle, FileText, Copy, Share2,
  Loader2, Scale, RefreshCw, Plus, ExternalLink, Zap, ClipboardList
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'react-toastify';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

interface ClientIntake {
  id: string;
  created_at: string;
  case_type: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  summary: string;
  status: 'new' | 'reviewed' | 'converted' | 'declined';
  answers: Record<string, string>;
  transcript: { q: string; a: string }[];
  submitted_at: string;
}

const STATUS_STYLES = {
  new:       { bg: 'bg-blue-500/10 border-blue-500/20',   text: 'text-blue-400',   label: '🔵 New'       },
  reviewed:  { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400', label: '🟡 Reviewed'  },
  converted: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: '🟢 Converted' },
  declined:  { bg: 'bg-slate-700 border-slate-600',        text: 'text-slate-400',  label: '⚫ Declined'  },
};

const INTAKE_URL = `${window.location.origin}/intake`;

const IntakeInbox: React.FC = () => {
  const { addCase } = useContext(AppContext) as any;
  const [intakes, setIntakes]       = useState<ClientIntake[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);
  const [filter, setFilter]         = useState<string>('all');

  const fetchIntakes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('client_intakes')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (!error && data) setIntakes(data as ClientIntake[]);
    else if (error) toast.error('Could not load intakes — check Supabase connection');
    setLoading(false);
  };

  useEffect(() => { fetchIntakes(); }, []);

  const updateStatus = async (id: string, status: ClientIntake['status']) => {
    await supabase.from('client_intakes').update({ status }).eq('id', id);
    setIntakes(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const convertToCase = async (intake: ClientIntake) => {
    setConverting(intake.id);
    try {
      await addCase({
        title:           `${intake.client_name} — ${intake.case_type}`,
        client:          intake.client_name,
        status:          'Active',
        summary:         intake.summary || Object.values(intake.answers).join(' | '),
        opposingCounsel: intake.answers.at_fault || intake.answers.other_party || '',
        judge:           '',
        nextCourtDate:   intake.answers.court_date || '',
        winProbability:  50,
        tags:            [intake.case_type, 'intake'],
      });
      await updateStatus(intake.id, 'converted');
      toast.success(`Case created for ${intake.client_name}`);
    } catch {
      toast.error('Could not create case — try manually');
    } finally {
      setConverting(null);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(INTAKE_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const filtered = filter === 'all' ? intakes : intakes.filter(i => i.status === filter);
  const newCount = intakes.filter(i => i.status === 'new').length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center relative">
              <Inbox size={20} className="text-blue-400" />
              {newCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">{newCount}</span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold">Client Intake Inbox</h1>
              <p className="text-slate-400 text-sm">{intakes.length} total submissions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchIntakes} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Shareable link banner */}
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Share2 size={15} className="text-violet-400" />
                <span className="text-violet-400 font-semibold text-sm">Your Client Intake Link</span>
              </div>
              <p className="text-slate-300 text-sm mb-1">Send this link to any client — no login required. Maya will walk them through intake and their case lands here automatically.</p>
              <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2 mt-2 font-mono text-xs text-slate-300 border border-slate-700">
                <ExternalLink size={12} className="text-violet-400 flex-shrink-0" />
                <span className="truncate">{INTAKE_URL}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={copyLink}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${copied ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-violet-600 hover:bg-violet-500 text-white'}`}>
                {copied ? <><CheckCircle size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
              </button>
              <a href="/intake" target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors">
                <ExternalLink size={14} /> Preview
              </a>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['all', 'new', 'reviewed', 'converted', 'declined'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              {f === 'all' ? `All (${intakes.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${intakes.filter(i => i.status === f).length})`}
            </button>
          ))}
        </div>

        {/* Intakes list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={24} className="animate-spin mr-3" /> Loading intakes…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-12 text-center">
            <Inbox size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">No intakes yet</p>
            <p className="text-slate-600 text-sm">Share your intake link with clients to start receiving submissions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(intake => {
              const st   = STATUS_STYLES[intake.status];
              const open = expanded === intake.id;
              const date = new Date(intake.submitted_at || intake.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

              return (
                <div key={intake.id} className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all ${intake.status === 'new' ? 'border-blue-500/30' : 'border-slate-700'}`}>
                  {/* Card header */}
                  <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(open ? null : intake.id)}>
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">{intake.client_name || 'Unknown Client'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${st.bg} ${st.text}`}>{st.label}</span>
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{intake.case_type}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {intake.client_email && <span className="text-xs text-slate-400 flex items-center gap-1"><Mail size={10} />{intake.client_email}</span>}
                        {intake.client_phone && <span className="text-xs text-slate-400 flex items-center gap-1"><Phone size={10} />{intake.client_phone}</span>}
                        <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={10} />{date}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-slate-400">
                      {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>

                  {/* Expanded */}
                  {open && (
                    <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-4">

                      {/* Summary */}
                      {intake.summary && (
                        <div>
                          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Summary</div>
                          <p className="text-slate-300 text-sm leading-relaxed">{intake.summary}</p>
                        </div>
                      )}

                      {/* All answers */}
                      {intake.answers && Object.keys(intake.answers).length > 0 && (
                        <div>
                          <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">All Answers</div>
                          <div className="space-y-2">
                            {Object.entries(intake.answers).map(([k, v]) => v && (
                              <div key={k} className="bg-slate-800 rounded-xl px-3 py-2">
                                <div className="text-xs text-slate-500 mb-0.5">{k.replace(/_/g, ' ')}</div>
                                <p className="text-slate-200 text-sm">{v}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Transcript */}
                      {intake.transcript?.length > 0 && (
                        <details>
                          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 flex items-center gap-1">
                            <ClipboardList size={12} /> View full transcript ({intake.transcript.length} exchanges)
                          </summary>
                          <div className="mt-2 space-y-2 border-t border-slate-800 pt-3">
                            {intake.transcript.map((t, i) => (
                              <div key={i} className="text-xs">
                                <span className="text-emerald-400 font-medium">Maya: </span>
                                <span className="text-slate-400">{t.q}</span>
                                <br />
                                <span className="text-blue-400 font-medium">Client: </span>
                                <span className="text-slate-200">{t.a}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {intake.status === 'new' && (
                          <button onClick={() => updateStatus(intake.id, 'reviewed')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 text-yellow-400 rounded-xl text-xs font-medium transition-colors">
                            <Clock size={13} /> Mark Reviewed
                          </button>
                        )}
                        {intake.status !== 'converted' && (
                          <button onClick={() => convertToCase(intake)} disabled={converting === intake.id}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-50">
                            {converting === intake.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            Convert to Case
                          </button>
                        )}
                        {intake.status !== 'declined' && (
                          <button onClick={() => updateStatus(intake.id, 'declined')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 rounded-xl text-xs font-medium transition-colors">
                            Decline
                          </button>
                        )}
                        {intake.status === 'converted' && (
                          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                            <CheckCircle size={13} /> Case created
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntakeInbox;
