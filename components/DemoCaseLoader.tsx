import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import { DEMO_SHUMPERT_CASE } from '../services/demoCaseData';
import { Scale, Loader2, CheckCircle, AlertTriangle, Gavel, Shield, FileText, Video, Users } from 'lucide-react';

const DemoCaseLoader: React.FC = () => {
  const { cases, addCase, setActiveCase } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyLoaded = cases.some(c => c.id === DEMO_SHUMPERT_CASE.id);

  const handleLoadCase = async () => {
    if (alreadyLoaded || loading) return;
    setLoading(true);
    setError(null);

    try {
      await addCase(DEMO_SHUMPERT_CASE);
      setLoaded(true);
      // Auto-navigate to the loaded case
      setTimeout(() => setActiveCase(DEMO_SHUMPERT_CASE), 500);
    } catch (err: any) {
      setError(err?.message || 'Failed to load demo case');
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { icon: <FileText size={16} />, label: 'Evidence Items', value: DEMO_SHUMPERT_CASE.evidence?.length || 0 },
    { icon: <Video size={16} />, label: 'Video Exhibits', value: 3 },
    { icon: <Users size={16} />, label: 'Witnesses', value: DEMO_SHUMPERT_CASE.witnesses?.length || 0 },
    { icon: <Gavel size={16} />, label: 'Federal Filings', value: 6 },
  ];

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-400/20 mb-4">
          <Scale size={28} className="text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">CaseBuddy Proof of Concept</h1>
        <p className="text-slate-400 max-w-lg mx-auto">
          Load a real case into CaseBuddy and walk through the complete pipeline — from intake to trial preparation.
        </p>
      </div>

      {/* Case Preview Card */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden mb-6">
        {/* Case Header */}
        <div className="bg-gradient-to-r from-red-900/30 via-red-800/20 to-slate-800/50 border-b border-red-500/20 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield size={18} className="text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-red-400/80 bg-red-500/10 px-2 py-0.5 rounded-full">42 U.S.C. § 1983</span>
                <span className="text-xs font-mono text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">CIVIL RIGHTS</span>
              </div>
              <h2 className="text-lg font-bold text-white">Reardon v. Shumpert et al.</h2>
              <p className="text-sm text-slate-400 mt-1">Federal Courthouse Arrest — Aberdeen, Mississippi</p>
            </div>
          </div>
        </div>

        {/* Case Summary */}
        <div className="p-5 border-b border-slate-700/50">
          <p className="text-sm text-slate-300 leading-relaxed">
            Journalist arrested at the federal courthouse parking lot while attempting to file an emergency civil rights lawsuit.
            Aberdeen Police Chief D. Shumpert arrested the plaintiff, searched his vehicle without a warrant, and had his car towed —
            preventing him from exercising his constitutional right to petition the courts.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['First Amendment', 'Fourth Amendment', 'Court Access', 'Press Freedom', 'Retaliation'].map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600/30">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 divide-x divide-slate-700/50">
          {stats.map(s => (
            <div key={s.label} className="p-4 text-center">
              <div className="flex items-center justify-center text-amber-400/70 mb-1">{s.icon}</div>
              <div className="text-lg font-bold text-white">{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Key Issues Preview */}
        <div className="p-5 border-t border-slate-700/50">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Key Legal Issues</h3>
          <div className="space-y-2">
            {(DEMO_SHUMPERT_CASE.keyIssues || []).slice(0, 4).map((issue, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400/70 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300">{issue}</span>
              </div>
            ))}
            {(DEMO_SHUMPERT_CASE.keyIssues || []).length > 4 && (
              <p className="text-xs text-slate-500 ml-5">+{(DEMO_SHUMPERT_CASE.keyIssues || []).length - 4} more issues</p>
            )}
          </div>
        </div>
      </div>

      {/* Load Button */}
      <div className="text-center">
        {alreadyLoaded || loaded ? (
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle size={18} />
            <span className="font-medium">Case Loaded — Open Case Manager to begin</span>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
            <br />
            <button
              onClick={handleLoadCase}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all"
            >
              Retry
            </button>
          </div>
        ) : (
          <button
            onClick={handleLoadCase}
            disabled={loading}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-base transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Loading Case...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Scale size={18} /> Load Real Case into CaseBuddy
              </span>
            )}
          </button>
        )}

        <p className="text-xs text-slate-500 mt-3">
          This loads a fully populated case with evidence, witnesses, tasks, and timeline events into your CaseBuddy workspace.
        </p>
      </div>
    </div>
  );
};

export default DemoCaseLoader;
