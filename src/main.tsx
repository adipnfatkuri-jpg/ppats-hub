import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

declare global {
  interface Window {
    __simPpatsDeferredPrompt?: Event | null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__simPpatsDeferredPrompt = event;
  });

  if ('serviceWorker' in navigator) {
    let isInCrossOriginIframe = false;
    try {
      isInCrossOriginIframe = window.self !== window.top && window.top?.location.origin !== window.location.origin;
    } catch {
      isInCrossOriginIframe = true;
    }

    if (!isInCrossOriginIframe) {
      registerSW({
        immediate: true,
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
