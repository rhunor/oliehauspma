// components/ServiceWorkerProvider.tsx - FIXED: Proper service worker integration
'use client';

import { useEffect, useState } from 'react';
import { initServiceWorker, isSupported } from '@/lib/serviceworker';

interface ServiceWorkerProviderProps {
  children: React.ReactNode;
}

export default function ServiceWorkerProvider({ children }: ServiceWorkerProviderProps) {
  const [swStatus, setSwStatus] = useState<'loading' | 'supported' | 'unsupported' | 'registered' | 'error'>('loading');

  useEffect(() => {
    const initSW = async () => {
      if (!isSupported()) {
        setSwStatus('unsupported');
        return;
      }

      setSwStatus('supported');

      try {
        await initServiceWorker();
        setSwStatus('registered');
      } catch (error) {
        console.error('Service worker initialization failed:', error);
        setSwStatus('error');
      }
    };

    // Only run on client side
    if (typeof window !== 'undefined') {
      initSW();
    }
  }, []);

  // Optional: You can add a status indicator for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('Service Worker Status:', swStatus);
  }

  return <>{children}</>;
}