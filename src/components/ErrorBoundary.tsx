import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Arixon] Uncaught application error caught by ErrorBoundary:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div 
          className="min-h-screen flex items-center justify-center p-6 bg-white dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans" 
          dir="rtl"
        >
          <div className="max-w-md w-full bg-slate-50 dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                تحديث العرض على المتصفح
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                حدثت مشكلة طفيفة في معالجة واجهة المتصفح المحمول. جميع بيانات حسابك ونقاطك وتقدمك محفوظة بأمان تام.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/80 text-[11px] font-mono text-slate-600 dark:text-slate-400 text-left overflow-x-auto max-h-24 border border-slate-200 dark:border-slate-800">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة تشغيل المنصة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
