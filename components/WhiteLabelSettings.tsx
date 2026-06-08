import React, { useState, useEffect, useCallback } from 'react';
import {
  Palette, Globe, Key, Upload, Save, Eye, RotateCcw,
  Building, CheckCircle, AlertCircle, Lock, Sparkles, Scale,
  Image as ImageIcon, Type, Monitor,
} from 'lucide-react';
import { toast } from 'react-toastify';

/* ─── Types ──────────────────────────────────────────── */

export interface WhiteLabelConfig {
  // Branding
  firmName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  // Colors
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  // Custom domain
  customDomain: string;
  // BYOK
  geminiApiKey: string;
  openaiApiKey: string;
  elevenLabsApiKey: string;
  // Feature toggles
  showPoweredBy: boolean;
  enableClientPortal: boolean;
  enableBilling: boolean;
  maxUsers: number;
}

const DEFAULT_CONFIG: WhiteLabelConfig = {
  firmName: 'CaseBuddy',
  tagline: 'AI-Powered Trial Preparation',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#d4a843',
  accentColor: '#10b981',
  bgColor: '#0f172a',
  textColor: '#e2e8f0',
  customDomain: '',
  geminiApiKey: '',
  openaiApiKey: '',
  elevenLabsApiKey: '',
  showPoweredBy: true,
  enableClientPortal: true,
  enableBilling: false,
  maxUsers: 10,
};

const STORAGE_KEY = 'casebuddy_whitelabel';

/* ─── Component ──────────────────────────────────────── */

const WhiteLabelSettings: React.FC = () => {
  const [config, setConfig] = useState<WhiteLabelConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'api-keys' | 'domain' | 'preview'>('branding');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConfig(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const updateField = useCallback(<K extends keyof WhiteLabelConfig>(key: K, value: WhiteLabelConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setSaved(true);
      toast.success('White-label settings saved');
      // Dispatch event so other components can react
      window.dispatchEvent(new CustomEvent('whitelabel-update', { detail: config }));
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setSaved(false);
    toast.info('Reset to defaults — save to apply');
  };

  const maskKey = (key: string): string => {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-serif">
            White-Label &amp; BYOK
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Customize branding, bring your own API keys, configure custom domain
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              saved
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-gold-500 hover:bg-gold-600 text-slate-900'
            }`}
          >
            {saved ? <CheckCircle size={14} /> : <Save size={14} />}
            {saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Enterprise Badge */}
      <div className="bg-gradient-to-r from-amber-500/10 to-gold-500/10 border border-gold-500/30 rounded-xl p-4 flex items-center gap-3">
        <Sparkles className="text-gold-500" size={24} />
        <div>
          <p className="text-white font-semibold">Enterprise BYOK Tier</p>
          <p className="text-sm text-slate-400">
            $5,000 one-time setup + $199/mo maintenance — includes white-label, custom domain, and self-hosted option
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {([
          { id: 'branding' as const, label: 'Branding', icon: Palette },
          { id: 'api-keys' as const, label: 'API Keys (BYOK)', icon: Key },
          { id: 'domain' as const, label: 'Custom Domain', icon: Globe },
          { id: 'preview' as const, label: 'Preview', icon: Eye },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === t.id
                ? 'bg-slate-800 text-white border-b-2 border-gold-500'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Branding Tab ── */}
      {activeTab === 'branding' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Text Branding */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
              <Type size={16} />
              Firm Identity
            </h3>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Firm / Product Name</label>
              <input
                type="text"
                value={config.firmName}
                onChange={e => updateField('firmName', e.target.value)}
                placeholder="Your Firm Name"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tagline</label>
              <input
                type="text"
                value={config.tagline}
                onChange={e => updateField('tagline', e.target.value)}
                placeholder="Your tagline here"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Logo URL</label>
              <input
                type="text"
                value={config.logoUrl}
                onChange={e => updateField('logoUrl', e.target.value)}
                placeholder="https://yourfirm.com/logo.png"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
              <p className="text-xs text-slate-600 mt-1">Recommended: 200x50px transparent PNG</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Favicon URL</label>
              <input
                type="text"
                value={config.faviconUrl}
                onChange={e => updateField('faviconUrl', e.target.value)}
                placeholder="https://yourfirm.com/favicon.ico"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
              <div>
                <p className="text-sm text-white">Show "Powered by CaseBuddy"</p>
                <p className="text-xs text-slate-500">Small footer badge</p>
              </div>
              <button
                onClick={() => updateField('showPoweredBy', !config.showPoweredBy)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  config.showPoweredBy ? 'bg-gold-500' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  config.showPoweredBy ? 'left-6' : 'left-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Color Branding */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
              <Palette size={16} />
              Brand Colors
            </h3>
            {([
              { key: 'primaryColor' as const, label: 'Primary Color', desc: 'Buttons, links, active states' },
              { key: 'accentColor' as const, label: 'Accent Color', desc: 'Success states, highlights' },
              { key: 'bgColor' as const, label: 'Background Color', desc: 'Main app background' },
              { key: 'textColor' as const, label: 'Text Color', desc: 'Primary text color' },
            ]).map(c => (
              <div key={c.key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={config[c.key]}
                  onChange={e => updateField(c.key, e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-600 cursor-pointer bg-transparent"
                />
                <div className="flex-1">
                  <p className="text-sm text-white">{c.label}</p>
                  <p className="text-xs text-slate-500">{c.desc}</p>
                </div>
                <input
                  type="text"
                  value={config[c.key]}
                  onChange={e => updateField(c.key, e.target.value)}
                  className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white font-mono"
                />
              </div>
            ))}

            {/* Feature Toggles */}
            <div className="pt-4 border-t border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase">Feature Toggles</h4>
              {([
                { key: 'enableClientPortal' as const, label: 'Client Portal', desc: 'Allow clients to view case status' },
                { key: 'enableBilling' as const, label: 'Built-in Billing', desc: 'Enable payment collection' },
              ]).map(f => (
                <div key={f.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{f.label}</p>
                    <p className="text-xs text-slate-500">{f.desc}</p>
                  </div>
                  <button
                    onClick={() => updateField(f.key, !config[f.key])}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      config[f.key] ? 'bg-gold-500' : 'bg-slate-600'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      config[f.key] ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Max Team Members</p>
                  <p className="text-xs text-slate-500">Seat limit for this instance</p>
                </div>
                <input
                  type="number"
                  value={config.maxUsers}
                  onChange={e => updateField('maxUsers', parseInt(e.target.value) || 1)}
                  min={1}
                  max={999}
                  className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white text-center"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── API Keys Tab ── */}
      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
            <Lock size={20} className="text-amber-400" />
            <div>
              <p className="text-sm text-amber-300 font-medium">
                Bring Your Own Keys — Your API keys stay in your browser
              </p>
              <p className="text-xs text-slate-400">
                Keys are stored locally and sent directly to AI providers. We never see or store them on our servers.
              </p>
            </div>
          </div>

          {([
            {
              key: 'geminiApiKey' as const,
              label: 'Google Gemini API Key',
              desc: 'Powers AI analysis, document generation, case research, and more',
              link: 'https://aistudio.google.com/apikey',
              required: true,
            },
            {
              key: 'openaiApiKey' as const,
              label: 'OpenAI API Key',
              desc: 'Alternative AI model for document drafting (optional)',
              link: 'https://platform.openai.com/api-keys',
              required: false,
            },
            {
              key: 'elevenLabsApiKey' as const,
              label: 'ElevenLabs API Key',
              desc: 'Powers realistic voice for trial simulation',
              link: 'https://elevenlabs.io/app/settings/api-keys',
              required: false,
            },
          ]).map(apiKey => (
            <div key={apiKey.key} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Key size={16} className="text-gold-500" />
                  <h3 className="text-white font-semibold">{apiKey.label}</h3>
                  {apiKey.required && (
                    <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">Required</span>
                  )}
                </div>
                {config[apiKey.key] && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle size={12} />
                    Configured
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mb-3">{apiKey.desc}</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={config[apiKey.key]}
                  onChange={e => updateField(apiKey.key, e.target.value)}
                  placeholder={`Paste your ${apiKey.label}...`}
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono"
                />
                <a
                  href={apiKey.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors whitespace-nowrap"
                >
                  Get Key →
                </a>
              </div>
              {config[apiKey.key] && (
                <p className="text-xs text-slate-500 mt-2 font-mono">
                  Current: {maskKey(config[apiKey.key])}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Custom Domain Tab ── */}
      {activeTab === 'domain' && (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Globe size={18} className="text-gold-500" />
              Custom Domain Configuration
            </h3>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Your Domain</label>
              <input
                type="text"
                value={config.customDomain}
                onChange={e => updateField('customDomain', e.target.value)}
                placeholder="e.g. legal.yourfirm.com"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>

            {config.customDomain && (
              <div className="mt-4 bg-slate-900 rounded-lg p-4">
                <h4 className="text-sm font-bold text-slate-400 mb-3">DNS Setup Instructions</h4>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-300">Add these DNS records to your domain registrar:</p>
                  <div className="bg-slate-800 rounded p-3 font-mono text-xs">
                    <p className="text-slate-400">Type: CNAME</p>
                    <p className="text-white">Name: {config.customDomain.split('.')[0] || 'legal'}</p>
                    <p className="text-white">Value: cname.vercel-dns.com</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    After adding the record, it may take up to 48 hours for DNS to propagate.
                    We'll auto-provision an SSL certificate once the domain is verified.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Building size={18} className="text-gold-500" />
              Self-Hosted Option
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Enterprise BYOK customers can self-host CaseBuddy on their own infrastructure
              for maximum data control and compliance.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Docker Container', desc: 'Deploy to any Docker host' },
                { label: 'AWS / GCP / Azure', desc: 'Cloud deployment guides included' },
                { label: 'On-Premise Server', desc: 'Full air-gapped deployment' },
                { label: 'Kubernetes', desc: 'Helm charts for K8s clusters' },
              ].map(opt => (
                <div key={opt.label} className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                  <p className="text-sm text-white font-medium">{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Tab ── */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-400">
            Preview how CaseBuddy will look with your branding:
          </p>

          {/* Preview Frame */}
          <div
            className="rounded-xl border-2 border-slate-600 overflow-hidden"
            style={{ backgroundColor: config.bgColor }}
          >
            {/* Top Bar */}
            <div
              className="flex items-center justify-between px-6 py-3 border-b"
              style={{ borderColor: config.primaryColor + '30' }}
            >
              <div className="flex items-center gap-3">
                {config.logoUrl ? (
                  <img src={config.logoUrl} alt="Logo" className="h-8 object-contain" />
                ) : (
                  <div className="flex items-center gap-2">
                    <Scale size={24} style={{ color: config.primaryColor }} />
                    <span className="text-lg font-bold" style={{ color: config.textColor }}>
                      {config.firmName}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-sm" style={{ color: config.textColor + '80' }}>
                {config.tagline}
              </p>
            </div>

            {/* Content Preview */}
            <div className="p-6 grid md:grid-cols-3 gap-4">
              {['Active Cases', 'Deadlines', 'Documents'].map((item, i) => (
                <div
                  key={item}
                  className="rounded-lg p-4 border"
                  style={{
                    borderColor: config.primaryColor + '30',
                    backgroundColor: config.bgColor === '#0f172a' ? '#1e293b' : config.bgColor + 'dd',
                  }}
                >
                  <p className="text-xs uppercase" style={{ color: config.textColor + '60' }}>
                    {item}
                  </p>
                  <p className="text-2xl font-bold" style={{ color: config.primaryColor }}>
                    {[12, 3, 47][i]}
                  </p>
                </div>
              ))}
            </div>

            {/* Button Preview */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: config.primaryColor, color: config.bgColor }}
              >
                Primary Action
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: config.accentColor, color: '#fff' }}
              >
                Secondary
              </button>
            </div>

            {/* Footer */}
            {config.showPoweredBy && (
              <div className="px-6 py-2 text-center border-t" style={{ borderColor: config.primaryColor + '15' }}>
                <p className="text-xs" style={{ color: config.textColor + '40' }}>
                  Powered by CaseBuddy
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhiteLabelSettings;
