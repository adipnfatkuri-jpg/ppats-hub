import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

declare global {
  interface Window {
    __simPpatsDeferredPrompt?: Event | null;
    __simPpatsAppInstalled?: boolean;
  }
}

declare const __APP_BUILD_TIMESTAMP__: string;

const BUILD_TS_STORAGE_KEY = 'sim_ppats_last_build_ts';

async function purgeStaleCachesOnBuildChange(): Promise<void> {
  if (typeof window === 'undefined' || typeof __APP_BUILD_TIMESTAMP__ !== 'string') return;
  try {
    const prevTs = window.localStorage.getItem(BUILD_TS_STORAGE_KEY);
    if (prevTs && prevTs !== __APP_BUILD_TIMESTAMP__ && 'caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.includes(__APP_BUILD_TIMESTAMP__) && !key.includes('fonts-cache'))
          .map((key) => window.caches.delete(key))
      );
    }
    window.localStorage.setItem(BUILD_TS_STORAGE_KEY, __APP_BUILD_TIMESTAMP__);
  } catch {
    // Abaikan jika storage/caches dibatasi oleh browser
  }
}

if (typeof window !== 'undefined') {
  // Bersihkan parameter ?v= sisa refresh agar URL selalu bersih sesuai start_url '/'
  try {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has('v')) {
      currentUrl.searchParams.delete('v');
      const cleanPath =
        currentUrl.pathname +
        (currentUrl.searchParams.toString() ? `?${currentUrl.searchParams.toString()}` : '') +
        currentUrl.hash;
      window.history.replaceState(null, '', cleanPath);
    }
  } catch {
    // Abaikan jika history API dibatasi
  }

  void purgeStaleCachesOnBuildChange();

  if ('serviceWorker' in navigator) {
    let isInCrossOriginIframe = false;
    try {
      isInCrossOriginIframe =
        window.self !== window.top && window.top?.location.origin !== window.location.origin;
    } catch {
      isInCrossOriginIframe = true;
    }

    if (!isInCrossOriginIframe) {
      const hadExistingController = Boolean(navigator.serviceWorker.controller);
      let hasReloadedForUpdate = false;

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadExistingController || hasReloadedForUpdate) return;
        hasReloadedForUpdate = true;
        window.location.reload();
      });

      registerSW({
        immediate: true,
        onRegisteredSW(swUrl, registration) {
          if (!registration) return;

          const checkForSwUpdate = async () => {
            if (!navigator.onLine) return;
            try {
              const resp = await fetch(`${swUrl}?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                  'cache-control': 'no-cache',
                },
              });
              if (resp.status === 200) {
                await registration.update();
              }
            } catch {
              // Offline atau jaringan sementara tidak tersedia
            }
          };

          void checkForSwUpdate();

          window.addEventListener('focus', () => {
            void checkForSwUpdate();
          });

          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              void checkForSwUpdate();
            }
          });

          window.setInterval(() => {
            void checkForSwUpdate();
          }, 5 * 60 * 1000);
        },
        onRegisterError() {
          // Abaikan error registrasi SW pada lingkungan browser terbatas
        },
      });
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
