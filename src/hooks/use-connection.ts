import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export type ConnectionState = 'online' | 'offline' | 'reconnecting';

export function useConnectionState(): ConnectionState {
  const { t } = useTranslation();
  const [state, setState] = useState<ConnectionState>('online');

  useEffect(() => {
    // In mock mode, always "online" (no real SSE)
    if (import.meta.env.VITE_API_MODE === 'mock') {
      setState('online');
      return;
    }
    // For real API: monitor online/offline
    const handleOnline = () => setState('online');
    const handleOffline = () => setState('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [t]);

  return state;
}
