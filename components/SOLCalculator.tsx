import React, { useState } from 'react';
import {
  Calculator, Clock, AlertTriangle, CheckCircle, MapPin, Scale,
  Calendar, Loader2, Download, Share2, Sparkles, Info, Shield,
  ChevronDown, ChevronRight, ExternalLink, FileText, Zap
} from 'lucide-react';
import { toast } from 'react-toastify';
import { callGeminiProxy } from '../services/apiProxy';

interface SOLResult {
  claimType: string;
  state: string;
  standardPeriod: string;
  statuteCitation: string;
  deadline: string;
  daysRemaining: number;
  status: 'safe' | 'warning' | 'urgent' | 'expired';
  tollingExceptions: { exception: string; description: string; applicable: boolean }[];
  relatedClaims: { claim: string; period: string; statute: string }[];
  importantNotes: string[];
  nextSteps: string[];
}

const STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri',
  'Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York',
  'North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington',
  'West Virginia','Wisconsin','Wyoming'
];

const CLAIM_TYPES = [
  'Civil Rights (42 USC § 1983)', 'Personal Injury', 'Medical Malpractice',
  'Wrongful Death', 'Employment Discrimination (Title VII)', 'ADA Violation',
  'Age Discrimination (ADEA)', 'FMLA Violation', 'Workers Compensation',
  'Products Liability', 'Professional Malpractice', 'Breach of Contract (Written)',
  'Breach of Contract (Oral)', 'Fraud / Misrepresentation', 'Property Damage',
  'Defamation / Libel / Slander', 'Assault & Battery', 'False Imprisonment',
  'RICO', 'FLSA Wage Violation', 'Insurance Bad Faith', 'Legal Malpractice',
];

const SOLCalculator = () => {
  const [state, setState] = useState('Mississippi');
  const [claimType, setClaimType] = useState('Civil Rights (42 USC § 1983)');
  const [incidentDate, setIncidentDate] = useState('');
  const [discoveryDate, setDiscoveryDate] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [isMentallyIncapacitated, setIsMentallyIncapacitated] = useState(false);
  const [defendantAbsent, setDefendantAbsent] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<SOLResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [leadEmail, setLeadEmail] = useState('');

  const calculateSOL = async () => {
    if (!state || !claimType || !incidentDate) {
      toast.error('Please fill in state, claim type, and incident date');
      return;
    }

    setIsCalculating(true);

    try {
      const prompt = `You are an expert legal research tool. Calculate the statute of limitations for:

State: ${state}
Claim Type: ${claimType}
Incident Date: ${incidentDate}
Discovery Date: ${discoveryDate || 'Same as incident date'}
Special Circumstances:
- Plaintiff is a minor: ${isMinor}
- Plaintiff is mentally incapacitated: ${isMentallyIncapacitated}
- Defendant left the state: ${defendantAbsent}

Today's date: ${new Date().toISOString().split('T')[0]}

Return JSON:
{
  "claimType": "${claimType}",
  "state": "${state}",
  "standardPeriod": "X years" or "X days" for the standard SOL,
  "statuteCitation": "exact statute citation (e.g., Miss. Code Ann. § XX-X-XX)",
  "deadline": "YYYY-MM-DD calculated deadline considering all factors",
  "daysRemaining": number of days from today to deadline (negative if expired),
  "status": "safe" (>180 days) / "warning" (60-180 days) / "urgent" (<60 days) / "expired",
  "tollingExceptions": [
    {"exception": "name", "description": "explanation", "applicable": true/false based on the provided circumstances}
  ],
  "relatedClaims": [
    {"claim": "related claim type that may also apply", "period": "SOL period", "statute": "citation"}
  ],
  "importantNotes": ["critical things to know about this SOL in this state"],
  "nextSteps": ["recommended actions based on the timeline"]
}

Include ALL relevant tolling exceptions for ${state}: minority, mental incapacity, absence from state, discovery rule, equitable tolling, government claims, continuing violation, etc.
Also include related claims the plaintiff might not know about.
Be accurate with the actual statute citations and SOL periods for ${state}.`;

      const aiResult = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: 'application/json' },
      });

      setResult(JSON.parse(aiResult.text));
      toast.success('✅ Statute of limitations calculated');
    } catch (error) {
      console.error('SOL calculation error:', error);
      toast.error('Failed to calculate — please try again');
    } finally {
      setIsCalculating(false);
    }
  };

  const statusConfig = {
    safe: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Within Limits', icon: CheckCircle },
    warning: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Approaching Deadline', icon: AlertTriangle },
    urgent: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'URGENT — File Soon', icon: AlertTriangle },
    expired: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'EXPIRED', icon: AlertTriangle },
  };

  const handleLeadCapture = () => {
    if (!leadEmail.trim()) return;
    toast.success(`Thank you! We'll send your SOL report to ${leadEmail}`);
    setLeadEmail('');
  };

  return (
    <div className="space-y-6 animate-slideInUp">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <Calculator size={24} className="text-amber-400" />
          </div>
          Statute of Limitations Calculator
        </h1>
        <p className="text-slate-400 mt-1">Free tool — calculate deadlines, tolling exceptions, and related claims for any state</p>
      </div>

      {/* Free Tool Badge */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
        <Zap size={16} className="text-green-400" />
        <span className="text-sm text-green-400 font-medium">Free Lead Generation Tool</span>
        <span className="text-xs text-slate-400 ml-2">— No account required. Captures leads when they want a full report emailed.</span>
      </div>

      {/* Calculator Form */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Calculate Your Deadline</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500 uppercase mb-1 block">State *</label>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500 outline-none"
            >
              <option value="">Select state...</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase mb-1 block">Claim Type *</label>
            <select
              value={claimType}
              onChange={e => setClaimType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500 outline-none"
            >
              <option value="">Select claim type...</option>
              {CLAIM_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase mb-1 block">Incident Date *</label>
            <input
              type="date"
              value={incidentDate}
              onChange={e => setIncidentDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500 outline-none"
            />
          </div>
        </div>

        {/* Advanced Options */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
        >
          {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Advanced Options (tolling factors)
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-800/30 border border-slate-800">
            <div>
              <label className="text-xs text-slate-500 uppercase mb-1 block">Discovery Date (if different)</label>
              <input
                type="date"
                value={discoveryDate}
                onChange={e => setDiscoveryDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div className="space-y-2 pt-5">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={isMinor} onChange={e => setIsMinor(e.target.checked)} className="accent-amber-500" />
                Plaintiff was a minor at time of incident
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={isMentallyIncapacitated} onChange={e => setIsMentallyIncapacitated(e.target.checked)} className="accent-amber-500" />
                Plaintiff was mentally incapacitated
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={defendantAbsent} onChange={e => setDefendantAbsent(e.target.checked)} className="accent-amber-500" />
                Defendant left the state
              </label>
            </div>
          </div>
        )}

        <button
          onClick={calculateSOL}
          disabled={isCalculating || !state || !claimType || !incidentDate}
          className="w-full md:w-auto px-8 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {isCalculating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
          {isCalculating ? 'Calculating...' : 'Calculate Deadline'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Main Result Card */}
          <div className={`glass-card rounded-xl overflow-hidden border-l-4 ${
            result.status === 'expired' ? 'border-l-red-500' :
            result.status === 'urgent' ? 'border-l-red-400' :
            result.status === 'warning' ? 'border-l-amber-400' : 'border-l-green-400'
          }`}>
            <div className={`p-6 ${statusConfig[result.status].bg}`}>
              <div className="flex items-center gap-4">
                {React.createElement(statusConfig[result.status].icon, { size: 40, className: statusConfig[result.status].color })}
                <div>
                  <p className={`text-sm font-semibold uppercase ${statusConfig[result.status].color}`}>
                    {statusConfig[result.status].label}
                  </p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {result.daysRemaining > 0 ? `${result.daysRemaining} days remaining` : `Expired ${Math.abs(result.daysRemaining)} days ago`}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Deadline: <span className="text-white font-mono">{result.deadline}</span> • SOL Period: {result.standardPeriod}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-slate-500">Claim Type</p>
                  <p className="text-sm text-white font-medium">{result.claimType}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-slate-500">State</p>
                  <p className="text-sm text-white font-medium">{result.state}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-slate-500">SOL Period</p>
                  <p className="text-sm text-white font-medium">{result.standardPeriod}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-slate-500">Statute</p>
                  <p className="text-sm text-amber-400 font-mono text-xs">{result.statuteCitation}</p>
                </div>
              </div>

              {/* Tolling Exceptions */}
              {result.tollingExceptions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Tolling Exceptions</h3>
                  <div className="space-y-2">
                    {result.tollingExceptions.map((te, i) => (
                      <div key={i} className={`p-3 rounded-lg flex items-start gap-3 ${te.applicable ? 'bg-green-500/5 border border-green-500/20' : 'bg-slate-800/30'}`}>
                        {te.applicable ? <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" /> : <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />}
                        <div>
                          <p className={`text-sm font-medium ${te.applicable ? 'text-green-400' : 'text-slate-400'}`}>{te.exception}</p>
                          <p className="text-xs text-slate-400">{te.description}</p>
                        </div>
                        {te.applicable && <span className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400 shrink-0">Applies</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Claims */}
              {result.relatedClaims.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-400 mb-2">💡 Related Claims You May Also Have</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left">
                          <th className="pb-2 text-slate-500 font-medium">Claim</th>
                          <th className="pb-2 text-slate-500 font-medium">SOL Period</th>
                          <th className="pb-2 text-slate-500 font-medium">Statute</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.relatedClaims.map((rc, i) => (
                          <tr key={i} className="border-b border-slate-800">
                            <td className="py-2 text-white">{rc.claim}</td>
                            <td className="py-2 text-amber-400">{rc.period}</td>
                            <td className="py-2 text-slate-400 font-mono text-xs">{rc.statute}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Important Notes */}
              {result.importantNotes.length > 0 && (
                <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <h3 className="text-sm font-semibold text-amber-400 mb-2">⚠️ Important Notes</h3>
                  <ul className="space-y-1">
                    {result.importantNotes.map((note, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" /> {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              {result.nextSteps.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-400 mb-2">✅ Recommended Next Steps</h3>
                  <ol className="space-y-1.5">
                    {result.nextSteps.map((step, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-green-500/10 text-green-400 text-xs flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* Lead Capture CTA */}
          <div className="glass-card rounded-xl p-6 text-center">
            <h3 className="text-lg font-bold text-white mb-2">Need Help With Your Case?</h3>
            <p className="text-sm text-slate-400 mb-4">Get a free case evaluation from CaseBuddy AI. Enter your email to receive a detailed SOL report and case analysis.</p>
            <div className="flex gap-2 max-w-md mx-auto">
              <input
                type="email"
                value={leadEmail}
                onChange={e => setLeadEmail(e.target.value)}
                placeholder="Enter your email..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 outline-none"
              />
              <button
                onClick={handleLeadCapture}
                className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm whitespace-nowrap"
              >
                Get Free Report
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-2">We'll also show you how CaseBuddy can help with your specific case.</p>
          </div>

          {/* Disclaimer */}
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800">
            <p className="text-xs text-slate-500">
              <strong>⚖️ Disclaimer:</strong> This calculator provides general legal information only and does not constitute legal advice.
              Statutes of limitation can be complex with many exceptions. Consult a licensed attorney in your jurisdiction before
              relying on these calculations. Time limits may vary based on specific facts and circumstances not captured here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SOLCalculator;
