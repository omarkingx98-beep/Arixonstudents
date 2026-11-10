import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PWADiagnosticInfo {
  isManifestLinked: boolean;
  manifestHref: string | null;
  hasSwSupport: boolean;
  isSwActive: boolean;
  isPromptCaptured: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  isInAppBrowser: boolean;
  promptTimestamp: number | null;
  userAgent: string;
}

export function usePWAInstall() {
  const getInitialPrompt = (): BeforeInstallPromptEvent | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).__arixonPwaState?.deferredPrompt || null;
  };

  const getInitialInstalled = (): boolean => {
    if (typeof window === 'undefined') return false;
    if ((window as any).__arixonPwaState?.isInstalled) return true;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  };

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(getInitialPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(getInitialInstalled);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'accepted' | 'dismissed'>('idle');
  const [diagnostic, setDiagnostic] = useState<PWADiagnosticInfo | null>(null);

  const evaluateDiagnostics = useCallback(() => {
    if (typeof window === 'undefined') return;

    const manifestEl = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const ua = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(ua);
    const inApp = /fban|fbav|instagram|tiktok|micromessenger|snapchat|line\//i.test(ua);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    const promptObj = deferredPrompt || (window as any).__arixonPwaState?.deferredPrompt || null;
    const timestamp = (window as any).__arixonPwaState?.promptTimestamp || null;

    setDiagnostic({
      isManifestLinked: Boolean(manifestEl),
      manifestHref: manifestEl ? manifestEl.href : null,
      hasSwSupport: 'serviceWorker' in navigator,
      isSwActive: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
      isPromptCaptured: Boolean(promptObj),
      isStandalone: standalone,
      isIOS: isApple,
      isInAppBrowser: inApp,
      promptTimestamp: timestamp,
      userAgent: window.navigator.userAgent,
    });
  }, [deferredPrompt]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect environment
    const ua = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isApple);

    const inApp = /fban|fbav|instagram|tiktok|micromessenger|snapchat|line\//i.test(ua);
    setIsInAppBrowser(inApp);

    // Sync from global store if already captured
    const globalState = (window as any).__arixonPwaState;
    if (globalState?.deferredPrompt) {
      setDeferredPrompt(globalState.deferredPrompt);
    }
    if (globalState?.isInstalled) {
      setIsInstalled(true);
    }

    // Custom Event Listener from early boot script
    const onPromptReady = (e: any) => {
      const promptEvent = e.detail || (window as any).__arixonPwaState?.deferredPrompt;
      if (promptEvent) {
        setDeferredPrompt(promptEvent);
      }
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstallStatus('accepted');
    };

    // Standard DOM event fallback in case fired after component mount
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (globalState) {
        globalState.deferredPrompt = e as BeforeInstallPromptEvent;
        globalState.promptTimestamp = Date.now();
      }
    };

    window.addEventListener('arixon:pwa-prompt-ready', onPromptReady);
    window.addEventListener('arixon:pwa-app-installed', onAppInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    evaluateDiagnostics();

    return () => {
      window.removeEventListener('arixon:pwa-prompt-ready', onPromptReady);
      window.removeEventListener('arixon:pwa-app-installed', onAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [evaluateDiagnostics]);

  const triggerInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? (window as any).__arixonPwaState?.deferredPrompt : null);
    if (!promptEvent) {
      return 'unsupported';
    }

    setInstallStatus('installing');

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setInstallStatus('accepted');
        if (typeof window !== 'undefined' && (window as any).__arixonPwaState) {
          (window as any).__arixonPwaState.isInstalled = true;
          (window as any).__arixonPwaState.deferredPrompt = null;
        }
        setDeferredPrompt(null);
      } else {
        setInstallStatus('dismissed');
      }
      return choice.outcome;
    } catch (err) {
      console.warn('[PWA] Error executing prompt():', err);
      setInstallStatus('idle');
      return 'unsupported';
    }
  }, [deferredPrompt]);

  const refreshCheck = useCallback(() => {
    evaluateDiagnostics();
    const globalState = typeof window !== 'undefined' ? (window as any).__arixonPwaState : null;
    if (globalState?.deferredPrompt) {
      setDeferredPrompt(globalState.deferredPrompt);
    }
    if (globalState?.isInstalled) {
      setIsInstalled(true);
    }
  }, [evaluateDiagnostics]);

  return {
    isInstallable: Boolean(deferredPrompt || (typeof window !== 'undefined' && (window as any).__arixonPwaState?.deferredPrompt)),
    isInstalled,
    isIOS,
    isInAppBrowser,
    installStatus,
    diagnostic,
    triggerInstall,
    refreshCheck,
  };
}
