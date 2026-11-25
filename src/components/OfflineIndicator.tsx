import React, { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const wasOfflineRef = useRef(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setShowReconnected(false);
      return;
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setShowReconnected(true);
      const timer = window.setTimeout(() => setShowReconnected(false), 3500);
      return () => window.clearTimeout(timer);
    }
  }, [isOnline]);

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="no-print fixed bottom-20 lg:bottom-4 left-3 right-3 sm:right-auto sm:left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg border border-amber-500"
      >
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>Mode Offline — Data lokal tetap dapat diakses.</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="no-print fixed bottom-20 lg:bottom-4 left-3 right-3 sm:right-auto sm:left-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg border border-emerald-500"
      >
        <Wifi className="w-4 h-4 shrink-0" />
        <span>Koneksi kembali online.</span>
      </div>
    );
  }

  return null;
};
