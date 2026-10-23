import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { t } from '../i18n/tr.js';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-rose-600 text-white py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2 shadow-lg animate-pulse">
      <WifiOff size={16} />
      <span>{t.app.offline}</span>
    </div>
  );
};
