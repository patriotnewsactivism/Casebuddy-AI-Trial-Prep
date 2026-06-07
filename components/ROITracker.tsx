import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Clock, TrendingUp, Zap, BarChart3, ArrowUpRight,
  Calendar, Briefcase, Trash2, ChevronDown, ChevronUp, Award,
} from 'lucide-react';
import {
  getROIEntries, getROISummary, getTaskLabel, clearROIEntries,
  type ROIEntry,
} from '../services/roiTracker';

/* ─── helpers ──────────────────────────────────────────────── */

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toFixed(0)}`;

const fmtHours = (mins: number) => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const taskColors: Record<string, string> = {
  legal_research:    'bg-blue-500',
  document_drafting: 'bg-indigo-500',
  deposition_prep:   'bg-purple-500',
  discovery:         'bg-cyan-500',
  settlement_analysis: 'bg-amber-500',
  evidence_analysis: 'bg-emerald-500',
  trial_prep:        'bg-red-500',
  strategy:          'bg-gold-500',
  negotiation_prep:  'bg-orange-500',
  transcription:     'bg-teal-500',
  case_intake:       'bg-lime-500',
  timeline_creation: 'bg-pink-500',
  general:           'bg-slate-500',
};

/* ─── component ────────────────────────────────────────────── */

const ROITracker: React.FC = () => {
  const [entries, setEntries] = useState<ROIEntry[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [tab, setTab] = useState<'overview' | 'history' | 'projections'>('overview');

  /* live-reload on roi-update events */
  useEffect(() => {
    const load = () => setEntries(getROIEntries());
    load();
    window.addEventListener('roi-update', load);
    return () => window.removeEventListener('roi-update', load);
  }, []);

  const summary = useMemo(() => getROISummary(entries), [entries]);

  const topTools = useMemo(
    () =>
      Object.entries(summary.byTool)
        .sort(([, a], [, b]) => b.dollarsSaved - a.dollarsSaved)
        .slice(0, 8),
    [summary],
  );

  const topTasks = useMemo(
    () =>
      Object.entries(summary.byTaskType)
        .sort(([, a], [, b]) => b.dollarsSaved - a.dollarsSaved),
    [summary],
  );

  const recentEntries = useMemo(
    () => (showAll ? entries : entries.slice(0, 15)),
    [entries, showAll],
  );

  /* bar chart max for scaling */
  const maxToolSaved = topTools.length ? topTools[0][1].dollarsSaved : 1;

  /* sparkline data — last 14 days */
  const sparkDays = useMemo(() => {
    const days: { date: string; amount: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, amount: summary.byDay[key] || 0 });
    }
    return days;
  }, [summary]);

  const sparkMax = Math.max(...sparkDays.map((d) => d.amount), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-serif">
            ROI &amp; Billable Hours Tracker
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Real-time savings from every AI-assisted task
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Clear all ROI tracking data?')) {
                clearROIEntries();
                setEntries([]);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-red-400 border border-slate-700 rounded-lg transition-colors"
          >
            <Trash2 size={13} />
            Reset Data
          </button>
        )}
      </div>

      {/* ── Hero Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Saved"
          value={fmt(summary.totalDollarsSaved)}
          sub={`${summary.totalEntries} tasks`}
          color="text-emerald-400"
          bgColor="bg-emerald-500/10"
        />
        <StatCard
          icon={Clock}
          label="Hours Saved"
          value={fmtHours(summary.totalMinutesSaved)}
          sub={`vs ${Math.round(summary.totalAISeconds)}s AI time`}
          color="text-blue-400"
          bgColor="bg-blue-500/10"
        />
        <StatCard
          icon={Zap}
          label="Efficiency"
          value={`${Math.round(summary.efficiencyMultiplier)}×`}
          sub="faster than manual"
          color="text-amber-400"
          bgColor="bg-amber-500/10"
        />
        <StatCard
          icon={TrendingUp}
          label="Annual Projection"
          value={fmt(summary.annualProjection)}
          sub={`${fmt(summary.monthlyProjection)}/mo`}
          color="text-purple-400"
          bgColor="bg-purple-500/10"
        />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-lg w-fit">
        {(['overview', 'history', 'projections'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-gold-500 text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB: Overview ── */}
      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Savings by Tool */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
              <BarChart3 size={16} />
              Savings by Tool
            </h3>
            {topTools.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">
                No tasks tracked yet. Use any CaseBuddy tool to start tracking savings.
              </p>
            ) : (
              <div className="space-y-3">
                {topTools.map(([tool, data]) => (
                  <div key={tool}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white font-medium">{tool}</span>
                      <span className="text-sm text-emerald-400 font-semibold">
                        {fmt(data.dollarsSaved)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                        style={{
                          width: `${(data.dollarsSaved / maxToolSaved) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {data.count} uses · {fmtHours(data.minutesSaved)} saved
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Savings by Category */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
              <Briefcase size={16} />
              Savings by Category
            </h3>
            {topTasks.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">
                No data yet.
              </p>
            ) : (
              <div className="space-y-2">
                {topTasks.map(([taskType, data]) => {
                  const pct =
                    summary.totalDollarsSaved > 0
                      ? (data.dollarsSaved / summary.totalDollarsSaved) * 100
                      : 0;
                  return (
                    <div
                      key={taskType}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                      <div
                        className={`w-3 h-3 rounded-full ${
                          taskColors[taskType] || 'bg-slate-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {getTaskLabel(taskType as any)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {data.count} tasks · {fmtHours(data.minutesSaved)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-emerald-400 font-semibold">
                          {fmt(data.dollarsSaved)}
                        </p>
                        <p className="text-xs text-slate-500">{pct.toFixed(0)}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 14-Day Sparkline */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
              <Calendar size={16} />
              Daily Savings — Last 14 Days
            </h3>
            <div className="flex items-end gap-1 h-32">
              {sparkDays.map((day) => (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100">
                    {day.amount > 0 ? fmt(day.amount) : ''}
                  </span>
                  <div className="w-full flex items-end justify-center" style={{ height: 96 }}>
                    <div
                      className={`w-full max-w-[24px] rounded-t transition-all ${
                        day.amount > 0
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                          : 'bg-slate-700'
                      }`}
                      style={{
                        height: `${Math.max(
                          (day.amount / sparkMax) * 96,
                          day.amount > 0 ? 8 : 4
                        )}px`,
                      }}
                      title={`${day.date}: ${fmt(day.amount)}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {day.date.slice(5).replace('-', '/')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: History ── */}
      {tab === 'history' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-sm font-bold text-slate-400 uppercase">
              Task History ({entries.length} entries)
            </h3>
          </div>
          {entries.length === 0 ? (
            <p className="text-slate-500 text-sm p-8 text-center">
              No tasks tracked yet. Use any CaseBuddy tool to start tracking.
            </p>
          ) : (
            <>
              <div className="divide-y divide-slate-700/50">
                {recentEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 p-4 hover:bg-slate-700/30 transition-colors"
                  >
                    <div
                      className={`w-2 h-8 rounded-full ${
                        taskColors[entry.taskType] || 'bg-slate-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-medium truncate">
                          {entry.toolName}
                        </p>
                        <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">
                          {getTaskLabel(entry.taskType as any)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {entry.description}
                      </p>
                      {entry.caseName && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Case: {entry.caseName}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-emerald-400 font-semibold">
                        {fmt(entry.dollarsSaved)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {fmtHours(entry.estimatedMinutes)} → {entry.actualSeconds}s
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 shrink-0 w-16 text-right">
                      {new Date(entry.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {entries.length > 15 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full p-3 text-sm text-slate-400 hover:text-white border-t border-slate-700 flex items-center justify-center gap-1 transition-colors"
                >
                  {showAll ? (
                    <>
                      <ChevronUp size={14} /> Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> Show All ({entries.length})
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: Projections ── */}
      {tab === 'projections' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* ROI Calculator */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
              <TrendingUp size={16} />
              ROI Projections
            </h3>
            <div className="space-y-4">
              <ProjectionRow
                label="Monthly Savings"
                value={fmt(summary.monthlyProjection)}
                detail={`Based on ${summary.daysTracked} day(s) of tracking`}
              />
              <ProjectionRow
                label="Annual Savings"
                value={fmt(summary.annualProjection)}
                detail="Projected yearly value"
              />
              <ProjectionRow
                label="CaseBuddy Cost"
                value="$5,988"
                detail="$499/mo × 12 months"
              />
              <div className="border-t border-slate-700 pt-4">
                <ProjectionRow
                  label="Net Annual ROI"
                  value={fmt(summary.annualProjection - 5988)}
                  detail={`${((summary.annualProjection / 5988) * 100).toFixed(0)}% return on investment`}
                  highlight
                />
              </div>
            </div>
          </div>

          {/* Equivalent Headcount */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
              <Award size={16} />
              Equivalent Headcount Value
            </h3>
            <div className="space-y-4">
              <HeadcountRow
                role="Paralegal"
                annualSalary={55000}
                hoursEquiv={summary.totalHoursSaved * (150 / 250)} // rough paralegal portion
              />
              <HeadcountRow
                role="Associate Attorney"
                annualSalary={120000}
                hoursEquiv={summary.totalHoursSaved * (300 / 500)}
              />
              <HeadcountRow
                role="Partner"
                annualSalary={250000}
                hoursEquiv={summary.totalHoursSaved * (500 / 800)}
              />
              <div className="border-t border-slate-700 pt-4">
                <p className="text-sm text-slate-400">
                  CaseBuddy has done the equivalent of{' '}
                  <span className="text-white font-bold">
                    {fmtHours(summary.totalMinutesSaved)}
                  </span>{' '}
                  of billable work across all skill levels, saving{' '}
                  <span className="text-emerald-400 font-bold">
                    {fmt(summary.totalDollarsSaved)}
                  </span>{' '}
                  in {summary.daysTracked} day(s).
                </p>
              </div>
            </div>
          </div>

          {/* Sales Pitch Card */}
          <div className="md:col-span-2 bg-gradient-to-r from-gold-500/10 to-amber-500/10 border border-gold-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gold-500/20 flex items-center justify-center shrink-0">
                <ArrowUpRight className="text-gold-500" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Sales Demo Talking Point
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  "In just {summary.daysTracked} day(s) of use, CaseBuddy completed{' '}
                  <strong>{summary.totalEntries} tasks</strong> that would have taken{' '}
                  <strong>{fmtHours(summary.totalMinutesSaved)}</strong> of attorney
                  and paralegal time. That's{' '}
                  <strong className="text-emerald-400">
                    {fmt(summary.totalDollarsSaved)} in billable hours saved
                  </strong>
                  . At $499/month, CaseBuddy pays for itself{' '}
                  <strong>
                    {summary.monthlyProjection > 499
                      ? `${Math.round(summary.monthlyProjection / 499)}× over`
                      : 'within the first month'}
                  </strong>
                  . Every month."
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── sub-components ───────────────────────────────────────── */

const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  bgColor: string;
}> = ({ icon: Icon, label, value, sub, color, bgColor }) => (
  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center`}>
        <Icon className={color} size={16} />
      </div>
      <span className="text-xs text-slate-400 uppercase font-semibold">{label}</span>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
  </div>
);

const ProjectionRow: React.FC<{
  label: string;
  value: string;
  detail: string;
  highlight?: boolean;
}> = ({ label, value, detail, highlight }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className={`text-sm ${highlight ? 'text-emerald-400 font-bold' : 'text-white'}`}>
        {label}
      </p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
    <p
      className={`text-lg font-bold ${
        highlight ? 'text-emerald-400' : 'text-white'
      }`}
    >
      {value}
    </p>
  </div>
);

const HeadcountRow: React.FC<{
  role: string;
  annualSalary: number;
  hoursEquiv: number;
}> = ({ role, annualSalary, hoursEquiv }) => {
  const fteEquiv = hoursEquiv / 2080; // 2080 work hours/yr
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white">{role}</p>
        <p className="text-xs text-slate-500">
          ~{fmt(annualSalary)}/yr salary
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-white font-semibold">
          {fteEquiv.toFixed(2)} FTE
        </p>
        <p className="text-xs text-slate-500">{fmtHours(Math.round(hoursEquiv * 60))} equiv.</p>
      </div>
    </div>
  );
};

export default ROITracker;
