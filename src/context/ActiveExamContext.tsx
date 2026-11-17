import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  AlertTriangle,
  Clock,
  Loader2,
  ArrowRight,
  LogOut,
  Send,
} from 'lucide-react';

export interface ActiveExamSession {
  attemptId: string;
  examId: string;
  examTitle: string;
  expectedEndAt: string;
  flushAndSaveBeforeExit: () => Promise<void>;
  submitNow: (isAutoExpire?: boolean) => Promise<void>;
}

interface ActiveExamContextValue {
  isExamActive: boolean;
  activeSession: ActiveExamSession | null;
  isLeaveModalOpen: boolean;
  registerActiveExam: (
    session: ActiveExamSession,
    onExitToList?: () => void
  ) => void;
  unregisterActiveExam: (attemptId: string) => void;
  guardNavigation: (action: () => void) => void;
  closeLeaveModal: () => void;
  confirmSaveAndExit: () => Promise<void>;
  confirmSubmitFromLeaveModal: () => Promise<void>;
}

const ActiveExamContext = createContext<ActiveExamContextValue | undefined>(
  undefined
);

function formatRemainingTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const ActiveExamProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeSession, setActiveSession] = useState<ActiveExamSession | null>(
    null
  );
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
  const [isSavingAndExiting, setIsSavingAndExiting] = useState<boolean>(false);
  const [modalSecondsRemaining, setModalSecondsRemaining] = useState<number>(0);

  const activeSessionRef = useRef<ActiveExamSession | null>(null);
  const onExitToListRef = useRef<(() => void) | undefined>(undefined);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const isLeaveModalOpenRef = useRef<boolean>(false);
  const bypassGuardRef = useRef<boolean>(false);
  const autoExpiredSubmitTriggeredRef = useRef<boolean>(false);

  activeSessionRef.current = activeSession;
  isLeaveModalOpenRef.current = isLeaveModalOpen;

  const clearHistorySentinel = useCallback((attemptId?: string) => {
    if (typeof window === 'undefined') return;
    try {
      const state = window.history.state;
      if (
        state &&
        typeof state === 'object' &&
        'arixonExamGuard' in state &&
        (!attemptId || state.arixonExamGuard === attemptId)
      ) {
        const nextState = { ...state };
        delete nextState.arixonExamGuard;
        window.history.replaceState(
          Object.keys(nextState).length > 0 ? nextState : null,
          '',
          window.location.href
        );
      }
    } catch {}
  }, []);

  const pushHistorySentinel = useCallback((attemptId: string) => {
    if (typeof window === 'undefined') return;
    try {
      const currentState = window.history.state;
      if (currentState?.arixonExamGuard !== attemptId) {
        window.history.pushState(
          { ...(currentState && typeof currentState === 'object' ? currentState : {}), arixonExamGuard: attemptId },
          '',
          window.location.href
        );
      }
    } catch {}
  }, []);

  const registerActiveExam = useCallback(
    (session: ActiveExamSession, onExitToList?: () => void) => {
      bypassGuardRef.current = false;
      autoExpiredSubmitTriggeredRef.current = false;
      onExitToListRef.current = onExitToList;
      setActiveSession(session);
      activeSessionRef.current = session;
      pushHistorySentinel(session.attemptId);
    },
    [pushHistorySentinel]
  );

  const unregisterActiveExam = useCallback(
    (attemptId: string) => {
      if (activeSessionRef.current?.attemptId !== attemptId) return;
      activeSessionRef.current = null;
      setActiveSession(null);
      setIsLeaveModalOpen(false);
      isLeaveModalOpenRef.current = false;
      pendingActionRef.current = null;
      onExitToListRef.current = undefined;
      clearHistorySentinel(attemptId);
    },
    [clearHistorySentinel]
  );

  const closeLeaveModal = useCallback(() => {
    if (isSavingAndExiting) return;
    pendingActionRef.current = null;
    isLeaveModalOpenRef.current = false;
    setIsLeaveModalOpen(false);
  }, [isSavingAndExiting]);

  const guardNavigation = useCallback((action: () => void) => {
    if (!activeSessionRef.current || bypassGuardRef.current) {
      action();
      return;
    }
    pendingActionRef.current = action;
    isLeaveModalOpenRef.current = true;
    setIsLeaveModalOpen(true);
  }, []);

  const confirmSaveAndExit = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!session || isSavingAndExiting) return;

    setIsSavingAndExiting(true);
    try {
      await session.flushAndSaveBeforeExit();
    } catch (err) {
      console.warn('Flush before exit warning:', err);
    } finally {
      const pending = pendingActionRef.current;
      const exitToList = onExitToListRef.current;
      pendingActionRef.current = null;
      bypassGuardRef.current = true;
      activeSessionRef.current = null;
      setActiveSession(null);
      isLeaveModalOpenRef.current = false;
      setIsLeaveModalOpen(false);
      setIsSavingAndExiting(false);
      clearHistorySentinel(session.attemptId);

      // Reset ExamsView back to 'list' and run requested navigation target
      try {
        if (exitToList) exitToList();
      } catch {}
      try {
        if (pending) pending();
      } catch {}

      // Release temporary bypass on next tick
      setTimeout(() => {
        bypassGuardRef.current = false;
      }, 150);
    }
  }, [isSavingAndExiting, clearHistorySentinel]);

  const confirmSubmitFromLeaveModal = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!session || isSavingAndExiting) return;

    pendingActionRef.current = null;
    isLeaveModalOpenRef.current = false;
    setIsLeaveModalOpen(false);
    try {
      await session.submitNow(false);
    } catch (err) {
      console.warn('Submit from leave modal warning:', err);
    }
  }, [isSavingAndExiting]);

  // Global browser/Android Back button interception via capture-phase popstate
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const session = activeSessionRef.current;
      if (!session || bypassGuardRef.current) return;

      e.stopImmediatePropagation();
      pushHistorySentinel(session.attemptId);

      if (isLeaveModalOpenRef.current) {
        // Back button while Leave Modal is open = "متابعة الامتحان"
        pendingActionRef.current = null;
        isLeaveModalOpenRef.current = false;
        setIsLeaveModalOpen(false);
        return;
      }

      pendingActionRef.current = () => {
        onExitToListRef.current?.();
      };
      isLeaveModalOpenRef.current = true;
      setIsLeaveModalOpen(true);
    };

    window.addEventListener('popstate', handlePopState, true);
    return () => {
      window.removeEventListener('popstate', handlePopState, true);
    };
  }, [pushHistorySentinel]);

  // Global internal <a> link interception in capture phase
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const session = activeSessionRef.current;
      if (!session || bypassGuardRef.current) return;
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href') || '';
      if (
        !rawHref ||
        rawHref.startsWith('#') ||
        rawHref.startsWith('mailto:') ||
        rawHref.startsWith('tel:') ||
        anchor.hasAttribute('download') ||
        anchor.target === '_blank'
      ) {
        return;
      }

      let parsed: URL;
      try {
        parsed = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (parsed.origin !== window.location.origin) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      guardNavigation(() => {
        window.history.pushState(
          null,
          '',
          parsed.pathname + parsed.search + parsed.hash
        );
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [guardNavigation]);

  // Keep live countdown running in Leave Modal; auto-submit immediately if time expires while modal is open
  useEffect(() => {
    if (!isLeaveModalOpen || !activeSession) return;

    const tick = () => {
      const endMs = new Date(activeSession.expectedEndAt).getTime();
      const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setModalSecondsRemaining(remaining);

      if (remaining <= 0 && !autoExpiredSubmitTriggeredRef.current) {
        autoExpiredSubmitTriggeredRef.current = true;
        pendingActionRef.current = null;
        isLeaveModalOpenRef.current = false;
        setIsLeaveModalOpen(false);
        activeSession.submitNow(true).catch(() => {});
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isLeaveModalOpen, activeSession]);

  const value: ActiveExamContextValue = {
    isExamActive: Boolean(activeSession),
    activeSession,
    isLeaveModalOpen,
    registerActiveExam,
    unregisterActiveExam,
    guardNavigation,
    closeLeaveModal,
    confirmSaveAndExit,
    confirmSubmitFromLeaveModal,
  };

  return (
    <ActiveExamContext.Provider value={value}>
      {children}

      {/* Central Exam Leave Confirmation Modal */}
      {isLeaveModalOpen && activeSession && (
        <div
          id="exam-leave-confirm-backdrop"
          dir="rtl"
          onClick={closeLeaveModal}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exam-leave-modal-title"
        >
          <div
            id="exam-leave-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-[#0c101c] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-2xl space-y-5 text-center"
          >
            {/* Header Icon */}
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            {/* Title & Copy */}
            <div className="space-y-2">
              <h3
                id="exam-leave-modal-title"
                className="text-lg sm:text-xl font-black text-slate-900 dark:text-white"
              >
                هل تريد مغادرة الامتحان؟
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                إجاباتك محفوظة. الوقت يستمر بالعدّ ويمكنك الاستكمال لاحقًا من قائمة الامتحانات.
              </p>
            </div>

            {/* Live Ongoing Timer Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
              <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>الوقت المتبقي يستمر:</span>
              <span dir="ltr" className="font-mono text-amber-600 dark:text-amber-400">
                {formatRemainingTime(modalSecondsRemaining)}
              </span>
            </div>

            {/* 3 Mobile-Friendly Stacked Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                id="exam-leave-continue-btn"
                type="button"
                onClick={closeLeaveModal}
                disabled={isSavingAndExiting}
                className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-60"
              >
                <ArrowRight className="w-4 h-4" />
                <span>متابعة الامتحان</span>
              </button>

              <button
                id="exam-leave-save-exit-btn"
                type="button"
                onClick={confirmSaveAndExit}
                disabled={isSavingAndExiting}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
              >
                {isSavingAndExiting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ حفظ إجاباتك والخروج...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>حفظ والخروج</span>
                  </>
                )}
              </button>

              <button
                id="exam-leave-submit-btn"
                type="button"
                onClick={confirmSubmitFromLeaveModal}
                disabled={isSavingAndExiting}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>تسليم الامتحان</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ActiveExamContext.Provider>
  );
};

export function useActiveExam(): ActiveExamContextValue {
  const ctx = useContext(ActiveExamContext);
  if (!ctx) {
    throw new Error('useActiveExam must be used inside ActiveExamProvider');
  }
  return ctx;
}
