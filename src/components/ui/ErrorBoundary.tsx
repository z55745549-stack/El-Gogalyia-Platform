import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Uncaught error in component tree:', error, errorInfo);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0D0D12] flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="bg-white dark:bg-[#181820] border border-slate-200 dark:border-[#2A2A35] shadow-xl rounded-3xl p-8 max-w-md w-full">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-[#F7F7FA] mb-2">حدث خطأ مؤقت في الواجهة</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
              تم حماية بياناتك وجلستك بنجاح. اضغط على الزر أدناه لإعادة التحميل والعودة فوراً للوحة التحكم.
            </p>
            <Button onClick={this.handleReset} variant="primary" className="w-full gap-2 py-3 font-bold text-xs">
              <RefreshCw className="h-4 w-4" /> إعادة التحميل والعودة للوحة التحكم
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
