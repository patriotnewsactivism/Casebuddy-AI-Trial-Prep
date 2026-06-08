import React, { useState, useContext, useCallback } from 'react';
import { AppContext } from '../App';
import {
  Globe, MapPin, Search, CheckCircle, Clock, DollarSign, FileText,
  AlertTriangle, ChevronDown, ChevronRight, Scale, BookOpen, Loader2,
  Building2, Gavel, Copy, ExternalLink
} from 'lucide-react';
import { toast } from 'react-toastify';
import { callGeminiProxy } from '../services/apiProxy';

interface JurisdictionData {
  state: string;
  stateCode: string;
  courtSystem: string;
  filingFees: { courtType: string; fee: string; notes: string }[];
  serviceRules: { method: string; timeframe: string; rule: string }[];
  discoveryRules: { type: string; deadline: string; rule: string; details: string }[];
  motionDeadlines: { motionType: string; deadline: string; rule: string }[];
  appealDeadlines: { type: string; deadline: string; rule: string }[];
  statutesOfLimitation: { claimType: string; period: string; statute: string; notes: string }[];
  localRules: string[];
  electronicFiling: { available: boolean; system: string; url: string; mandatory: boolean };
  keyDifferences: string[];
}

const STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri',
  'Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York',
  'North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington',
  'West Virginia','Wisconsin','Wyoming','Federal (FRCP)'
];

const COURT_TYPES = ['State Trial Court', 'State Appellate Court', 'State Supreme Court', 'Federal District Court', 'Federal Circuit Court', 'Bankruptcy Court', 'Family Court', 'Probate Court'];

const JurisdictionEngine = () => {
  const { activeCase, updateCase } = useContext(AppContext);
  const [selectedState, setSelectedState] = useState(activeCase?.jurisdiction as string || '');
  const [selectedCourt, setSelectedCourt] = useState('State Trial Court');
  const [caseType, setCaseType] = useState('Civil Rights (42 USC § 1983)');
  const [jurisdictionData, setJurisdictionData] = useState<JurisdictionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'deadlines' | 'discovery' | 'fees' | 'sol' | 'local'>('overview');
  const [compareState, setCompareState] = useState('');
  const [compareData, setCompareData] = useState<JurisdictionData | null>(null);

  const CASE_TYPES = [
    'Civil Rights (42 USC § 1983)', 'Personal Injury', 'Medical Malpractice', 'Employment Discrimination',
    'Contract Dispute', 'Real Estate / Property', 'Family Law / Divorce', 'Criminal Defense',
    'Workers Compensation', 'Products Liability', 'Intellectual Property', 'Bankruptcy',
    'Environmental Law', 'Securities Fraud', 'Insurance Bad Faith', 'Wrongful Death',
  ];

  const lookupJurisdiction = async (state: string, isCompare = false) => {
    if (!state) return;
    setIsLoading(true);

    try {
      const prompt = `You are an expert legal research assistant. Provide comprehensive civil procedure rules for ${state} courts (${selectedCourt}) for a ${caseType} case. Return a JSON object:
{
  "state": "${state}",
  "stateCode": "2-letter code or 'FED'",
  "courtSystem": "name of the court system",
  "filingFees": [{"courtType": "type", "fee": "$amount", "notes": "details"}],
  "serviceRules": [{"method": "personal/mail/etc", "timeframe": "X days", "rule": "Rule citation"}],
  "discoveryRules": [{"type": "Interrogatories/RFP/RFA/Depositions", "deadline": "timeline", "rule": "Rule citation", "details": "limits and specifics"}],
  "motionDeadlines": [{"motionType": "type", "deadline": "timeline", "rule": "Rule citation"}],
  "appealDeadlines": [{"type": "type", "deadline": "timeline", "rule": "Rule citation"}],
  "statutesOfLimitation": [{"claimType": "type", "period": "X years", "statute": "citation", "notes": "tolling or exceptions"}],
  "localRules": ["notable local rules or practices"],
  "electronicFiling": {"available": true/false, "system": "system name", "url": "URL", "mandatory": true/false},
  "keyDifferences": ["ways this jurisdiction differs from federal courts or neighboring states"]
}

Be specific with actual rule citations (e.g., "Rule 33(a), Miss. R. Civ. P." or "FRCP Rule 26(b)"). Include real filing fees and actual deadlines.`;

      const result = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      });

      const data: JurisdictionData = JSON.parse(result.text);

      if (isCompare) {
        setCompareData(data);
      } else {
        setJurisdictionData(data);
        if (activeCase) {
          await updateCase(activeCase.id, { jurisdiction: state });
        }
      }

      toast.success(`✅ ${state} jurisdiction data loaded`);
    } catch (error) {
      console.error('Jurisdiction lookup error:', error);
      toast.error('Failed to load jurisdiction data');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Globe },
    { id: 'deadlines', label: 'Motion Deadlines', icon: Clock },
    { id: 'discovery', label: 'Discovery Rules', icon: FileText },
    { id: 'fees', label: 'Filing Fees', icon: DollarSign },
    { id: 'sol', label: 'Statutes of Limitation', icon: AlertTriangle },
    { id: 'local', label: 'Local Rules', icon: Building2 },
  ] as const;

  return (
    <div className="space-y-6 animate-slideInUp">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <Globe size={24} className="text-cyan-400" />
          </div>
          Multi-Jurisdiction Rules Engine
        </h1>
        <p className="text-slate-400 mt-1">All 50 states + federal — deadlines, discovery limits, filing fees, and statutes of limitation</p>
      </div>

      {/* Selection Controls */}
      <div className="glass-card rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Jurisdiction</label>
            <select
              value={selectedState}
              onChange={e => setSelectedState(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
            >
              <option value="">Select state...</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Court Type</label>
            <select
              value={selectedCourt}
              onChange={e => setSelectedCourt(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
            >
              {COURT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Case Type</label>
            <select
              value={caseType}
              onChange={e => setCaseType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
            >
              {CASE_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => lookupJurisdiction(selectedState)}
              disabled={!selectedState || isLoading}
              className="w-full px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {isLoading ? 'Loading...' : 'Look Up Rules'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {jurisdictionData && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="glass-card rounded-xl p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <MapPin size={20} className="text-cyan-400" />
                  <h2 className="text-xl font-bold text-white">{jurisdictionData.state}</h2>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-400">{jurisdictionData.courtSystem}</span>
                </div>

                {/* E-Filing Info */}
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <ExternalLink size={14} className="text-cyan-400" /> Electronic Filing
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Available:</span>
                      <span className={`ml-2 ${jurisdictionData.electronicFiling.available ? 'text-green-400' : 'text-red-400'}`}>
                        {jurisdictionData.electronicFiling.available ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">System:</span>
                      <span className="ml-2 text-white">{jurisdictionData.electronicFiling.system}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Mandatory:</span>
                      <span className={`ml-2 ${jurisdictionData.electronicFiling.mandatory ? 'text-amber-400' : 'text-slate-300'}`}>
                        {jurisdictionData.electronicFiling.mandatory ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {jurisdictionData.electronicFiling.url && (
                      <a href={jurisdictionData.electronicFiling.url} target="_blank" rel="noopener noreferrer"
                         className="text-cyan-400 hover:underline truncate">
                        {jurisdictionData.electronicFiling.url}
                      </a>
                    )}
                  </div>
                </div>

                {/* Key Differences */}
                {jurisdictionData.keyDifferences.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-amber-400 mb-2">⚡ Key Differences</h3>
                    <ul className="space-y-1.5">
                      {jurisdictionData.keyDifferences.map((diff, i) => (
                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                          <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                          {diff}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Service Rules */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Service of Process</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-slate-700">
                          <th className="pb-2 text-slate-500 font-medium">Method</th>
                          <th className="pb-2 text-slate-500 font-medium">Timeframe</th>
                          <th className="pb-2 text-slate-500 font-medium">Rule</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jurisdictionData.serviceRules.map((r, i) => (
                          <tr key={i} className="border-b border-slate-800">
                            <td className="py-2 text-white">{r.method}</td>
                            <td className="py-2 text-amber-400 font-mono text-xs">{r.timeframe}</td>
                            <td className="py-2 text-slate-400 font-mono text-xs">{r.rule}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'deadlines' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock size={18} className="text-cyan-400" /> Motion Deadlines — {jurisdictionData.state}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-slate-700">
                        <th className="pb-2 text-slate-500 font-medium">Motion Type</th>
                        <th className="pb-2 text-slate-500 font-medium">Deadline</th>
                        <th className="pb-2 text-slate-500 font-medium">Rule</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jurisdictionData.motionDeadlines.map((m, i) => (
                        <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="py-3 text-white font-medium">{m.motionType}</td>
                          <td className="py-3 text-amber-400 font-mono">{m.deadline}</td>
                          <td className="py-3 text-slate-400 font-mono text-xs">{m.rule}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-white mb-2">Appeal Deadlines</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {jurisdictionData.appealDeadlines.map((a, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                        <p className="text-sm font-medium text-white">{a.type}</p>
                        <p className="text-lg font-bold text-red-400">{a.deadline}</p>
                        <p className="text-xs text-slate-500 font-mono">{a.rule}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'discovery' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText size={18} className="text-cyan-400" /> Discovery Rules — {jurisdictionData.state}
                </h2>
                <div className="grid gap-3">
                  {jurisdictionData.discoveryRules.map((d, i) => (
                    <div key={i} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-white">{d.type}</h3>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 font-mono">{d.deadline}</span>
                      </div>
                      <p className="text-sm text-slate-300">{d.details}</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">{d.rule}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'fees' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <DollarSign size={18} className="text-cyan-400" /> Filing Fees — {jurisdictionData.state}
                </h2>
                <div className="grid gap-3">
                  {jurisdictionData.filingFees.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <div>
                        <p className="text-sm font-medium text-white">{f.courtType}</p>
                        <p className="text-xs text-slate-400">{f.notes}</p>
                      </div>
                      <span className="text-lg font-bold text-green-400">{f.fee}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'sol' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-400" /> Statutes of Limitation — {jurisdictionData.state}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-slate-700">
                        <th className="pb-2 text-slate-500 font-medium">Claim Type</th>
                        <th className="pb-2 text-slate-500 font-medium">Period</th>
                        <th className="pb-2 text-slate-500 font-medium">Statute</th>
                        <th className="pb-2 text-slate-500 font-medium">Notes / Tolling</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jurisdictionData.statutesOfLimitation.map((s, i) => (
                        <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="py-3 text-white font-medium">{s.claimType}</td>
                          <td className="py-3 text-red-400 font-bold">{s.period}</td>
                          <td className="py-3 text-slate-400 font-mono text-xs">{s.statute}</td>
                          <td className="py-3 text-slate-400 text-xs">{s.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'local' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 size={18} className="text-cyan-400" /> Local Rules & Practices — {jurisdictionData.state}
                </h2>
                <ul className="space-y-2">
                  {jurisdictionData.localRules.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300 p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                      <Gavel size={14} className="text-cyan-400 mt-0.5 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Compare Tool */}
          <div className="glass-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Scale size={14} className="text-amber-400" /> Compare with another jurisdiction
            </h3>
            <div className="flex gap-3">
              <select
                value={compareState}
                onChange={e => setCompareState(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Select state to compare...</option>
                {STATES.filter(s => s !== selectedState).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                onClick={() => lookupJurisdiction(compareState, true)}
                disabled={!compareState || isLoading}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Scale size={14} /> Compare
              </button>
            </div>
            {compareData && (
              <div className="mt-4 p-4 rounded-lg bg-slate-800/50 border border-amber-500/20">
                <h4 className="text-sm font-semibold text-amber-400 mb-3">
                  {jurisdictionData.state} vs {compareData.state} — Key Differences
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 font-medium mb-2">{jurisdictionData.state}</p>
                    {jurisdictionData.keyDifferences.map((d, i) => (
                      <p key={i} className="text-slate-300 mb-1">• {d}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium mb-2">{compareData.state}</p>
                    {compareData.keyDifferences.map((d, i) => (
                      <p key={i} className="text-slate-300 mb-1">• {d}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default JurisdictionEngine;
