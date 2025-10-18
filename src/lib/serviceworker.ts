// lib/serviceWorker.ts - FIXED: Proper service worker registration without redirects
export const isSupported = (): boolean => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isSupported()) {
    console.warn('Service workers are not supported in this browser');
    return null;
  }

  try {
    // Register service worker with explicit scope and no redirect
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // Ensure fresh service worker updates
    });

    console.log('Service Worker registered successfully:', registration);

    // Handle service worker updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        console.log('New service worker installing...');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New service worker is installed but waiting
              console.log('New service worker installed, waiting to activate');
              // Optionally notify user about update
              notifyUserAboutUpdate(registration);
            } else {
              // First time installation
              console.log('Service worker installed for the first time');
            }
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

export const unregisterServiceWorker = async (): Promise<boolean> => {
  if (!isSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const result = await registration.unregister();
      console.log('Service Worker unregistered:', result);
      return result;
    }
    return false;
  } catch (error) {
    console.error('Service Worker unregistration failed:', error);
    return false;
  }
};

// Helper function to notify user about updates
const notifyUserAboutUpdate = (registration: ServiceWorkerRegistration): void => {
  // You can customize this notification however you like
  if (confirm('A new version of the app is available. Reload to update?')) {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      registration.waiting.addEventListener('statechange', (e) => {
        const target = e.target as ServiceWorker;
        if (target.state === 'activated') {
          window.location.reload();
        }
      });
    }
  }
};

// Subscribe to push notifications
export const subscribeToPushNotifications = async (
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> => {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    console.log('Push subscription successful:', subscription);
    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
};

// Check if user is already subscribed
export const isSubscribedToPush = async (
  registration: ServiceWorkerRegistration
): Promise<boolean> => {
  try {
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('Error checking push subscription:', error);
    return false;
  }
};

// Initialize service worker when app loads
export const initServiceWorker = async (): Promise<void> => {
  if (typeof window !== 'undefined' && isSupported()) {
    try {
      // In development, only register if explicitly enabled
      if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_SW !== 'true') {
        console.warn('Service worker disabled in development. Set NEXT_PUBLIC_ENABLE_SW=true to enable.');
        return;
      }
      await registerServiceWorker();
    } catch (error) {
      console.error('Failed to initialize service worker:', error);
    }
  }
};