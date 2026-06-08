import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Wifi, Bell, Shield } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after a delay
      setTimeout(() => setShowPrompt(true), 5000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slideInUp">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl shadow-black/50">
        <button onClick={() => setShowPrompt(false)} className="absolute top-3 right-3 text-slate-500 hover:text-white">
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Smartphone size={24} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Install CaseBuddy</p>
            <p className="text-xs text-slate-400">Access your cases anywhere</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: Wifi, label: 'Works Offline' },
            { icon: Bell, label: 'Notifications' },
            { icon: Shield, label: 'Secure' },
          ].map((perk, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
              <perk.icon size={12} className="text-amber-400" />
              {perk.label}
            </div>
          ))}
        </div>
        <button
          onClick={handleInstall}
          className="w-full px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Download size={16} /> Install App
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
