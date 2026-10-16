import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken } from '@/lib/api';

export type ConnectionState = 'online' | 'offline' | 'reconnecting';

export function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>('online');
  const queryClient = useQueryClient();

  useEffect(() => {
    // 1. Browser offline check
    const handleBrowserOffline = () => setState('offline');
    const handleBrowserOnline = () => setState('reconnecting');
    window.addEventListener('offline', handleBrowserOffline);
    window.addEventListener('online', handleBrowserOnline);

    if (!navigator.onLine) {
      setState('offline');
      return () => {
        window.removeEventListener('offline', handleBrowserOffline);
        window.removeEventListener('online', handleBrowserOnline);
      };
    }

    // 2. If token exists, connect to real SSE stream
    const token = getToken();
    if (!token) {
      setState('online');
      return () => {
        window.removeEventListener('offline', handleBrowserOffline);
        window.removeEventListener('online', handleBrowserOnline);
      };
    }

    const disconnect = api.connectSSE({
      onOpen: () => {
        setState('online');
      },
      onMessage: (event) => {
        setState('online');
        // Live cache invalidation on backend events
        if (event.includes('attendance') || event.includes('event')) {
          queryClient.invalidateQueries({ queryKey: ['todayStats'] });
          queryClient.invalidateQueries({ queryKey: ['todayEmployees'] });
        }
        if (event.includes('camera')) {
          queryClient.invalidateQueries({ queryKey: ['cameras'] });
        }
        if (event.includes('unknown') || event.includes('face')) {
          queryClient.invalidateQueries({ queryKey: ['unknownFaces'] });
        }
      },
      onError: () => {
        setState('reconnecting');
      },
      onClose: () => {
        setState('reconnecting');
      },
    });

    return () => {
      window.removeEventListener('offline', handleBrowserOffline);
      window.removeEventListener('online', handleBrowserOnline);
      disconnect();
    };
  }, [queryClient]);

  return state;
}
