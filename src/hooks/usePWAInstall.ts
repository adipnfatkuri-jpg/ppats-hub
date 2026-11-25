import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface RelatedApplication {
  platform?: string;
  url?: string;
  id?: string;
}

const PROMPT_SYNC_EVENT = 'simppats:pwa-prompt-ready';
const INSTALLED_SYNC_EVENT = 'simppats:pwa-installed';

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.__simPpatsAppInstalled === true
  );
}

function checkIsInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__simPpatsDeferredPrompt) {
      return window.__simPpatsDeferredPrompt as BeforeInstallPromptEvent;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsStandalone());
  const [isAlreadyInstalledRelated, setIsAlreadyInstalledRelated] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(() => checkIsInIframe());
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    setIsInstalled(checkIsStandalone());
    setIsInIframe(checkIsInIframe());

    if (window.__simPpatsDeferredPrompt) {
      setDeferredPrompt(window.__simPpatsDeferredPrompt as BeforeInstallPromptEvent);
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);
    setIsAndroid(/android/.test(userAgent));

    // Deteksi apakah WebAPK SIM-PPATS sudah terpasang di perangkat Android Chrome
    const navWithRelated = window.navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<RelatedApplication[]>;
    };
    if (typeof navWithRelated.getInstalledRelatedApps === 'function') {
      navWithRelated
        .getInstalledRelatedApps()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0) {
            setIsAlreadyInstalledRelated(true);
          }
        })
        .catch(() => {
          // Abaikan jika browser membatasi API ini
        });
    }

    const syncFromWindow = () => {
      setDeferredPrompt(
        (window.__simPpatsDeferredPrompt as BeforeInstallPromptEvent | null) ?? null
      );
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__simPpatsDeferredPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      window.dispatchEvent(new Event(PROMPT_SYNC_EVENT));
    };

    const handleAppInstalled = () => {
      window.__simPpatsAppInstalled = true;
      window.__simPpatsDeferredPrompt = null;
      setIsInstalled(true);
      setIsAlreadyInstalledRelated(true);
      setDeferredPrompt(null);
      setIsInstalling(false);
    };

    const displayModeMedia = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      setIsInstalled(checkIsStandalone());
    };

    window.addEventListener(PROMPT_SYNC_EVENT, syncFromWindow);
    window.addEventListener(INSTALLED_SYNC_EVENT, handleAppInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    displayModeMedia.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener(PROMPT_SYNC_EVENT, syncFromWindow);
      window.removeEventListener(INSTALLED_SYNC_EVENT, handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      displayModeMedia.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptEvent =
      (window.__simPpatsDeferredPrompt as BeforeInstallPromptEvent | null) || deferredPrompt;
    if (!promptEvent) return 'unavailable';

    setIsInstalling(true);
    window.__simPpatsDeferredPrompt = null;
    setDeferredPrompt(null);
    window.dispatchEvent(new Event(PROMPT_SYNC_EVENT));

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        window.__simPpatsAppInstalled = true;
        setIsInstalled(true);
        setIsAlreadyInstalledRelated(true);
        window.dispatchEvent(new Event(INSTALLED_SYNC_EVENT));
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    } finally {
      setIsInstalling(false);
    }
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isAlreadyInstalledRelated,
    isIOS,
    isAndroid,
    isInIframe,
    isInstalling,
    install,
  };
}
