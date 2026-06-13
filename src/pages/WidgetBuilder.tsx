import React, { useState } from 'react';
import { MessageSquare, Code, Copy, Check, ExternalLink, Sliders } from 'lucide-react';

const ACCENT_COLORS = [
  { id: 'blue',    label: 'Blue',    cls: 'bg-blue-600',    hex: '#2563eb' },
  { id: 'violet',  label: 'Violet',  cls: 'bg-violet-600',  hex: '#7c3aed' },
  { id: 'emerald', label: 'Emerald', cls: 'bg-emerald-600', hex: '#059669' },
  { id: 'orange',  label: 'Orange',  cls: 'bg-orange-600',  hex: '#ea580c' },
  { id: 'slate',   label: 'Gray',    cls: 'bg-slate-600',   hex: '#475569' },
];

export default function WidgetBuilder() {
  const [firmName, setFirmName] = useState('');
  const [color, setColor] = useState('blue');
  const [greeting, setGreeting] = useState("Hello! I'm your AI Legal Secretary. How can I help you today?");
  const [embedType, setEmbedType] = useState<'floating' | 'inline'>('floating');
  const [copiedFloating, setCopiedFloating] = useState(false);
  const [copiedInline, setCopiedInline] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const origin = window.location.origin;
  const displayFirm = firmName || 'Your Law Firm';
  const widgetUrl = `${origin}/widget?firm=${encodeURIComponent(displayFirm)}&color=${color}&greeting=${encodeURIComponent(greeting)}`;

  const accentHex = ACCENT_COLORS.find(c => c.id === color)?.hex || '#2563eb';

  const inlineCode = `<!-- CaseBuddy AI Legal Secretary Widget -->
<iframe
  src="${widgetUrl}"
  width="380" height="580"
  frameborder="0"
  style="border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.18);border:none;"
  title="AI Legal Secretary"
></iframe>`;

  const floatingCode = `<!-- CaseBuddy AI Legal Secretary — Floating Widget -->
<style>
  #cb-widget-btn{position:fixed;bottom:24px;right:24px;z-index:9999;background:${accentHex};width:56px;height:56px;border-radius:50%;cursor:pointer;border:none;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.25);transition:transform .2s}
  #cb-widget-btn:hover{transform:scale(1.08)}
  #cb-widget-frame{position:fixed;bottom:96px;right:24px;z-index:9998;width:380px;height:580px;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.3);border:none;display:none}
</style>
<button id="cb-widget-btn" onclick="var f=document.getElementById('cb-widget-frame');f.style.display=f.style.display==='block'?'none':'block'" aria-label="Open AI Legal Secretary">
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
</button>
<iframe id="cb-widget-frame" src="${widgetUrl}" frameborder="0" title="AI Legal Secretary"></iframe>`;

  const copyCode = (code: string, which: 'floating' | 'inline') => {
    navigator.clipboard.writeText(code);
    if (which === 'floating') {
      setCopiedFloating(true);
      setTimeout(() => setCopiedFloating(false), 2000);
    } else {
      setCopiedInline(true);
      setTimeout(() => setCopiedInline(false), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="text-cyan-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Widget Builder</h1>
          <p className="text-slate-400 text-sm">Generate embed code to put an AI Legal Secretary on your law firm’s website</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column: config + embed code */}
        <div className="space-y-5">
          {/* Configuration */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Sliders size={16} className="text-cyan-400" /> Configuration
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Firm / Practice Name</label>
              <input
                value={firmName}
                onChange={e => setFirmName(e.target.value)}
                placeholder="e.g. Smith &amp; Associates Law Firm"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Accent Color</label>
              <div className="flex gap-3">
                {ACCENT_COLORS.map(c => (
                  <button key={c.id} onClick={() => setColor(c.id)} title={c.label}
                    className={`w-8 h-8 rounded-full ${c.cls} transition-all ${
                      color === c.id
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Opening Greeting</label>
              <textarea
                value={greeting}
                onChange={e => setGreeting(e.target.value)}
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>
            <button
              onClick={() => setPreviewKey(k => k + 1)}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Update Preview
            </button>
          </div>

          {/* Embed Code */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Code size={16} className="text-cyan-400" /> Embed Code
            </div>

            <div className="flex gap-1 bg-slate-700 rounded-lg p-1">
              {(['floating', 'inline'] as const).map(type => (
                <button key={type} onClick={() => setEmbedType(type)}
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                    embedType === type ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}>
                  {type === 'floating' ? '\u{1F4AC} Floating Button' : '\u{1F4CB} Inline Embed'}
                </button>
              ))}
            </div>

            {embedType === 'floating' ? (
              <div className="space-y-2">
                <p className="text-slate-500 text-xs">Adds a floating chat bubble in the bottom-right corner of your website.</p>
                <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                  {floatingCode}
                </div>
                <button
                  onClick={() => copyCode(floatingCode, 'floating')}
                  className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {copiedFloating
                    ? <><Check size={14} className="text-green-400" /> Copied!</>
                    : <><Copy size={14} /> Copy Floating Code</>
                  }
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-slate-500 text-xs">Paste anywhere in your HTML to embed the widget inline on the page.</p>
                <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre leading-relaxed">
                  {inlineCode}
                </div>
                <button
                  onClick={() => copyCode(inlineCode, 'inline')}
                  className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {copiedInline
                    ? <><Check size={14} className="text-green-400" /> Copied!</>
                    : <><Copy size={14} /> Copy Inline Code</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column: live preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-white font-semibold text-sm">Live Preview</div>
            <a
              href={widgetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 text-xs transition-colors"
            >
              <ExternalLink size={12} /> Open in new tab
            </a>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden" style={{ height: 600 }}>
            <iframe
              key={previewKey}
              src={widgetUrl}
              className="w-full h-full border-0"
              title="Widget Preview"
            />
          </div>
          <p className="text-slate-600 text-xs text-center">
            Paste the embed code into your website’s HTML — no developer needed
          </p>
        </div>
      </div>
    </div>
  );
}
