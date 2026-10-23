import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { t } from '../i18n/tr.js';

export const PwaPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt non-intrusively after 5 seconds on second or subsequent interaction
      setTimeout(() => {
        setShowPrompt(true);
      }, 4000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-poker-card border border-poker-gold/60 p-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs max-w-xs animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="flex-1">
        <p className="font-serif font-bold text-poker-gold">{t.app.title}</p>
        <p className="text-stone-300 text-[11px]">{t.app.installPwa}</p>
      </div>
      <button
        onClick={handleInstall}
        className="px-3 py-1.5 bg-poker-wine hover:bg-poker-wineHover text-poker-gold font-bold rounded-xl flex items-center gap-1 transition-colors"
      >
        <Download size={14} />
        <span>Yükle</span>
      </button>
      <button
        onClick={() => setShowPrompt(false)}
        className="text-stone-500 hover:text-stone-300 p-1"
      >
        <X size={14} />
      </button>
    </div>
  );
};
