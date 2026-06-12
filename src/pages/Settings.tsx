import React, { useState, useEffect } from 'react';
import { User, Bell, Shield, Palette, Key, Save, Check, Moon, Sun, Smartphone } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
interface UserProfile {
  name: string;
  email: string;
  phone: string;
  barNumber: string;
  firmName: string;
  jurisdiction: string;
  role: 'pro-se' | 'attorney' | 'paralegal' | 'firm-admin';
}

interface NotificationPrefs {
  emailDeadlines: boolean;
  smsDeadlines: boolean;
  emailNewLeads: boolean;
  smsNewLeads: boolean;
  emailWeeklyDigest: boolean;
  deadlineWarningHours: number;
}

interface AppPrefs {
  theme: 'dark' | 'light' | 'system';
  compactMode: boolean;
  showAgentPersonalities: boolean;
  defaultModule: string;
  aiVerbosity: 'concise' | 'balanced' | 'detailed';
  voiceEnabled: boolean;
}

const STORAGE_KEY = 'casebuddy_settings';

const defaultProfile: UserProfile = {
  name: '', email: '', phone: '', barNumber: '', firmName: '', jurisdiction: '', role: 'pro-se',
};
const defaultNotifications: NotificationPrefs = {
  emailDeadlines: true, smsDeadlines: false, emailNewLeads: true, smsNewLeads: false,
  emailWeeklyDigest: true, deadlineWarningHours: 48,
};
const defaultAppPrefs: AppPrefs = {
  theme: 'dark', compactMode: false, showAgentPersonalities: true, defaultModule: '/',
  aiVerbosity: 'balanced', voiceEnabled: false,
};

export default function Settings() {
  const [tab, setTab] = useState<'profile' | 'notifications' | 'appearance' | 'api'>('profile');
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [notifications, setNotifications] = useState<NotificationPrefs>(defaultNotifications);
  const [appPrefs, setAppPrefs] = useState<AppPrefs>(defaultAppPrefs);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (data.profile) setProfile(p => ({ ...p, ...data.profile }));
      if (data.notifications) setNotifications(n => ({ ...n, ...data.notifications }));
      if (data.appPrefs) setAppPrefs(a => ({ ...a, ...data.appPrefs }));
    } catch {}
  }, []);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, notifications, appPrefs }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const TABS = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'api' as const, label: 'API Keys', icon: Key },
  ];

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center justify-between py-2">
      <span className="text-slate-300 text-sm">{label}</span>
      <button onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-600'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-5.5' : 'left-0.5'}`} />
      </button>
    </label>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-slate-400 text-sm">Configure your CaseBuddy AI experience</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-base mb-2">Your Profile</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Full Name</label>
              <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                placeholder="John Doe" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email</label>
              <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                placeholder="john@example.com" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Phone</label>
              <input type="tel" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                placeholder="+1 (555) 000-0000" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Role</label>
              <select value={profile.role} onChange={e => setProfile(p => ({ ...p, role: e.target.value as any }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm">
                <option value="pro-se">Pro Se Litigant</option>
                <option value="attorney">Attorney</option>
                <option value="paralegal">Paralegal</option>
                <option value="firm-admin">Firm Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Firm Name (optional)</label>
              <input value={profile.firmName} onChange={e => setProfile(p => ({ ...p, firmName: e.target.value }))}
                placeholder="Law Office of..." className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Bar Number (optional)</label>
              <input value={profile.barNumber} onChange={e => setProfile(p => ({ ...p, barNumber: e.target.value }))}
                placeholder="TX12345" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400 block mb-1">Primary Jurisdiction</label>
              <input value={profile.jurisdiction} onChange={e => setProfile(p => ({ ...p, jurisdiction: e.target.value }))}
                placeholder="e.g. Southern District of Texas" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-white font-semibold text-base mb-3">Deadline Alerts</h2>
            <div className="space-y-1 border-b border-slate-700 pb-4">
              <Toggle checked={notifications.emailDeadlines} onChange={v => setNotifications(n => ({ ...n, emailDeadlines: v }))} label="Email me before deadlines" />
              <Toggle checked={notifications.smsDeadlines} onChange={v => setNotifications(n => ({ ...n, smsDeadlines: v }))} label="SMS me before deadlines" />
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-300 text-sm">Warning lead time</span>
                <select value={notifications.deadlineWarningHours} onChange={e => setNotifications(n => ({ ...n, deadlineWarningHours: +e.target.value }))}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-white text-sm">
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                  <option value="72">72 hours</option>
                  <option value="168">1 week</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-white font-semibold text-base mb-3">Lead Notifications</h2>
            <div className="space-y-1 border-b border-slate-700 pb-4">
              <Toggle checked={notifications.emailNewLeads} onChange={v => setNotifications(n => ({ ...n, emailNewLeads: v }))} label="Email me for new leads (Sierra)" />
              <Toggle checked={notifications.smsNewLeads} onChange={v => setNotifications(n => ({ ...n, smsNewLeads: v }))} label="SMS me for new leads" />
            </div>
          </div>
          <div>
            <h2 className="text-white font-semibold text-base mb-3">Digest</h2>
            <Toggle checked={notifications.emailWeeklyDigest} onChange={v => setNotifications(n => ({ ...n, emailWeeklyDigest: v }))} label="Weekly case status digest" />
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {tab === 'appearance' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-white font-semibold text-base mb-3">Theme</h2>
            <div className="flex gap-3">
              {[
                { id: 'dark' as const, label: 'Dark', icon: Moon },
                { id: 'light' as const, label: 'Light', icon: Sun },
                { id: 'system' as const, label: 'System', icon: Smartphone },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setAppPrefs(a => ({ ...a, theme: id }))}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${appPrefs.theme === id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500'}`}>
                  <Icon size={20} className={appPrefs.theme === id ? 'text-blue-400' : 'text-slate-400'} />
                  <span className={`text-xs font-medium ${appPrefs.theme === id ? 'text-blue-400' : 'text-slate-400'}`}>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-white font-semibold text-base mb-3">AI Behavior</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-300 text-sm">AI Response Style</span>
                <select value={appPrefs.aiVerbosity} onChange={e => setAppPrefs(a => ({ ...a, aiVerbosity: e.target.value as any }))}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-white text-sm">
                  <option value="concise">Concise — Just the essentials</option>
                  <option value="balanced">Balanced — Default</option>
                  <option value="detailed">Detailed — Full explanations</option>
                </select>
              </div>
              <Toggle checked={appPrefs.showAgentPersonalities} onChange={v => setAppPrefs(a => ({ ...a, showAgentPersonalities: v }))} label="Show agent personality quotes" />
              <Toggle checked={appPrefs.compactMode} onChange={v => setAppPrefs(a => ({ ...a, compactMode: v }))} label="Compact mode (smaller cards)" />
              <Toggle checked={appPrefs.voiceEnabled} onChange={v => setAppPrefs(a => ({ ...a, voiceEnabled: v }))} label="Voice input (requires Deepgram)" />
            </div>
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {tab === 'api' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mb-2">
            <Shield size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-300 text-sm font-medium">API keys are stored in Vercel environment variables</p>
              <p className="text-yellow-200/60 text-xs mt-1">For security, API keys should be set in your Vercel project settings, not in the browser. The fields below are read-only status indicators.</p>
            </div>
          </div>
          {[
            { label: 'Supabase', status: 'Connected', color: 'text-green-400' },
            { label: 'Gemini AI', status: 'Connected', color: 'text-green-400' },
            { label: 'Deepgram', status: 'Key Saved', color: 'text-yellow-400' },
            { label: 'CourtListener', status: 'Not Connected', color: 'text-slate-500' },
            { label: 'Stripe', status: 'Not Connected', color: 'text-slate-500' },
            { label: 'Twilio', status: 'Not Connected', color: 'text-slate-500' },
            { label: 'SendGrid', status: 'Not Connected', color: 'text-slate-500' },
            { label: 'DocuSign', status: 'Not Connected', color: 'text-slate-500' },
          ].map(({ label, status, color }) => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
              <div className="flex items-center gap-3">
                <Key size={14} className="text-slate-500" />
                <span className="text-white text-sm">{label}</span>
              </div>
              <span className={`text-xs font-medium ${color}`}>{status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={save}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
          {saved ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Save Settings</>}
        </button>
      </div>
    </div>
  );
}
