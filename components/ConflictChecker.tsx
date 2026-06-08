import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import {
  ShieldAlert, Search, CheckCircle, XCircle, AlertTriangle, Users,
  FileText, Building2, Loader2, Shield, Eye, Clock, Download
} from 'lucide-react';
import { toast } from 'react-toastify';
import { callGeminiProxy } from '../services/apiProxy';

interface ConflictResult {
  hasConflict: boolean;
  severity: 'none' | 'potential' | 'direct';
  conflicts: ConflictDetail[];
  clearances: string[];
  recommendations: string[];
  checkedAt: string;
}

interface ConflictDetail {
  type: 'opposing_party' | 'related_entity' | 'witness' | 'judge' | 'attorney' | 'business_relationship';
  description: string;
  matchedCase: string;
  matchedEntity: string;
  newEntity: string;
  severity: 'high' | 'medium' | 'low';
  waivable: boolean;
  ruleReference: string;
}

interface ConflictCheck {
  id: string;
  newClientName: string;
  opposingPartyName: string;
  matterDescription: string;
  checkedAt: string;
  result: ConflictResult;
}

const ConflictChecker = () => {
  const { cases } = useContext(AppContext);
  const [newClient, setNewClient] = useState('');
  const [opposingParty, setOpposingParty] = useState('');
  const [matterDescription, setMatterDescription] = useState('');
  const [relatedEntities, setRelatedEntities] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<ConflictResult | null>(null);
  const [checkHistory, setCheckHistory] = useState<ConflictCheck[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const existingParties = useMemo(() => {
    const parties = new Set<string>();
    cases.forEach(c => {
      if (c.client) parties.add(c.client);
      if (c.opposingParty) parties.add(c.opposingParty);
      if (c.opposingCounsel) parties.add(c.opposingCounsel);
      if (c.judge) parties.add(c.judge);
      c.witnesses?.forEach(w => parties.add(w.name));
      c.evidence?.forEach(e => e.keyEntities?.forEach(k => parties.add(k)));
    });
    return Array.from(parties).filter(Boolean);
  }, [cases]);

  const runConflictCheck = async () => {
    if (!newClient.trim()) {
      toast.error('Enter the new client name');
      return;
    }

    setIsChecking(true);

    try {
      const casesSummary = cases.map(c => ({
        title: c.title,
        client: c.client,
        opposingParty: c.opposingParty,
        opposingCounsel: c.opposingCounsel,
        judge: c.judge,
        status: c.status,
        witnesses: c.witnesses?.map(w => w.name) || [],
        keyEntities: c.evidence?.flatMap(e => e.keyEntities || []) || [],
        tags: c.tags || [],
      }));

      const prompt = `You are a legal conflict of interest checker. Analyze whether taking on a new client would create any conflicts with existing cases.

NEW MATTER:
- New Client: ${newClient}
- Opposing Party: ${opposingParty || 'Not specified'}
- Matter Description: ${matterDescription || 'Not specified'}
- Related Entities: ${relatedEntities || 'None specified'}

EXISTING CASES:
${JSON.stringify(casesSummary, null, 2)}

ALL KNOWN PARTIES/ENTITIES FROM EXISTING CASES:
${existingParties.join(', ')}

Check for ALL types of conflicts:
1. Direct conflicts — same person is both client and opposing party
2. Related entity conflicts — organizations/businesses connected to opposing parties
3. Witness conflicts — new client is a witness in existing case
4. Judge/attorney relationships
5. Business relationship conflicts
6. Former client conflicts (even closed cases)

Return JSON:
{
  "hasConflict": true/false,
  "severity": "none" | "potential" | "direct",
  "conflicts": [
    {
      "type": "opposing_party" | "related_entity" | "witness" | "judge" | "attorney" | "business_relationship",
      "description": "detailed explanation",
      "matchedCase": "existing case title",
      "matchedEntity": "entity in existing case",
      "newEntity": "entity in new matter",
      "severity": "high" | "medium" | "low",
      "waivable": true/false,
      "ruleReference": "ABA Model Rule or state rule reference"
    }
  ],
  "clearances": ["entities that were checked and found clear"],
  "recommendations": ["recommended actions"]
}`;

      const aiResult = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: 'application/json' },
      });

      const conflictResult: ConflictResult = {
        ...JSON.parse(aiResult.text),
        checkedAt: new Date().toISOString(),
      };

      setResult(conflictResult);

      const check: ConflictCheck = {
        id: crypto.randomUUID(),
        newClientName: newClient,
        opposingPartyName: opposingParty,
        matterDescription,
        checkedAt: new Date().toISOString(),
        result: conflictResult,
      };
      setCheckHistory(prev => [check, ...prev]);

      if (conflictResult.hasConflict) {
        toast.warn(`⚠️ ${conflictResult.conflicts.length} potential conflict(s) found!`);
      } else {
        toast.success('✅ No conflicts found — clear to proceed');
      }
    } catch (error) {
      console.error('Conflict check error:', error);
      toast.error('Failed to run conflict check');
    } finally {
      setIsChecking(false);
    }
  };

  const severityColor = (s: string) => {
    if (s === 'high' || s === 'direct') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (s === 'medium' || s === 'potential') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-green-400 bg-green-500/10 border-green-500/30';
  };

  const typeLabel = (t: string) => {
    const labels: Record<string, string> = {
      opposing_party: '⚔️ Opposing Party', related_entity: '🏢 Related Entity',
      witness: '👤 Witness', judge: '⚖️ Judge', attorney: '👨‍⚖️ Attorney',
      business_relationship: '🤝 Business Relationship',
    };
    return labels[t] || t;
  };

  return (
    <div className="space-y-6 animate-slideInUp">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/30">
            <ShieldAlert size={24} className="text-orange-400" />
          </div>
          Conflict of Interest Checker
        </h1>
        <p className="text-slate-400 mt-1">
          Cross-reference new clients against all existing cases — parties, witnesses, entities, and relationships
        </p>
      </div>

      {/* Input Form */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">New Matter Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">New Client Name *</label>
            <input
              type="text"
              value={newClient}
              onChange={e => setNewClient(e.target.value)}
              placeholder="Enter client name..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Opposing Party</label>
            <input
              type="text"
              value={opposingParty}
              onChange={e => setOpposingParty(e.target.value)}
              placeholder="Enter opposing party name..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Matter Description</label>
          <textarea
            value={matterDescription}
            onChange={e => setMatterDescription(e.target.value)}
            placeholder="Brief description of the legal matter..."
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Related Entities (comma-separated)</label>
          <input
            type="text"
            value={relatedEntities}
            onChange={e => setRelatedEntities(e.target.value)}
            placeholder="Companies, organizations, individuals..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Checking against <span className="text-amber-400 font-medium">{cases.length} existing cases</span> and{' '}
            <span className="text-amber-400 font-medium">{existingParties.length} known entities</span>
          </p>
          <button
            onClick={runConflictCheck}
            disabled={isChecking || !newClient.trim()}
            className="px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {isChecking ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {isChecking ? 'Checking...' : 'Run Conflict Check'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className={`glass-card rounded-xl overflow-hidden border-l-4 ${
          result.severity === 'direct' ? 'border-l-red-500' :
          result.severity === 'potential' ? 'border-l-amber-500' : 'border-l-green-500'
        }`}>
          {/* Result Header */}
          <div className={`p-6 ${
            result.severity === 'direct' ? 'bg-red-500/5' :
            result.severity === 'potential' ? 'bg-amber-500/5' : 'bg-green-500/5'
          }`}>
            <div className="flex items-center gap-3">
              {result.severity === 'none' ? (
                <CheckCircle size={32} className="text-green-400" />
              ) : result.severity === 'potential' ? (
                <AlertTriangle size={32} className="text-amber-400" />
              ) : (
                <XCircle size={32} className="text-red-400" />
              )}
              <div>
                <h2 className="text-xl font-bold text-white">
                  {result.severity === 'none' ? 'No Conflicts Found' :
                   result.severity === 'potential' ? `${result.conflicts.length} Potential Conflict(s)` :
                   `${result.conflicts.length} Direct Conflict(s) Found`}
                </h2>
                <p className="text-sm text-slate-400">
                  Checked: {newClient} {opposingParty ? `vs ${opposingParty}` : ''} • {new Date(result.checkedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Conflicts */}
          {result.conflicts.length > 0 && (
            <div className="p-6 space-y-3">
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Conflicts Identified</h3>
              {result.conflicts.map((conflict, i) => (
                <div key={i} className={`p-4 rounded-lg border ${severityColor(conflict.severity)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{typeLabel(conflict.type)}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColor(conflict.severity)}`}>
                        {conflict.severity.toUpperCase()}
                      </span>
                      {conflict.waivable && (
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400">Waivable</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">{conflict.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-800/50">
                      <span className="text-slate-500">Existing Case:</span>
                      <p className="text-white font-medium">{conflict.matchedCase}</p>
                      <p className="text-slate-400">Entity: {conflict.matchedEntity}</p>
                    </div>
                    <div className="p-2 rounded bg-slate-800/50">
                      <span className="text-slate-500">New Matter:</span>
                      <p className="text-white font-medium">{newClient}</p>
                      <p className="text-slate-400">Entity: {conflict.newEntity}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 font-mono">📜 {conflict.ruleReference}</p>
                </div>
              ))}
            </div>
          )}

          {/* Clearances */}
          {result.clearances.length > 0 && (
            <div className="px-6 pb-4">
              <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-2">✅ Cleared</h3>
              <div className="flex flex-wrap gap-1.5">
                {result.clearances.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 border border-green-500/30 text-green-400">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="px-6 pb-6">
              <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-2">📋 Recommendations</h3>
              <ul className="space-y-1.5">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <Shield size={12} className="text-amber-400 mt-0.5 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Check History */}
      {checkHistory.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-semibold text-white w-full"
          >
            <Clock size={14} className="text-slate-400" />
            Conflict Check History ({checkHistory.length})
            {showHistory ? <Eye size={14} className="ml-auto text-slate-400" /> : <Eye size={14} className="ml-auto text-slate-600" />}
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {checkHistory.map(ch => (
                <div key={ch.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 text-sm">
                  {ch.result.severity === 'none' ? <CheckCircle size={14} className="text-green-400" /> :
                   ch.result.severity === 'potential' ? <AlertTriangle size={14} className="text-amber-400" /> :
                   <XCircle size={14} className="text-red-400" />}
                  <span className="text-white font-medium">{ch.newClientName}</span>
                  {ch.opposingPartyName && <span className="text-slate-500">vs {ch.opposingPartyName}</span>}
                  <span className="text-xs text-slate-500 ml-auto">{new Date(ch.checkedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConflictChecker;
