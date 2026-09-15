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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center select-none" style={{ background: 'var(--app-bg)' }}>
          <div
            className="rounded-3xl p-8 max-w-md w-full"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E' }}>
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>حدث خطأ مؤقت في الواجهة</h2>
            <p className="text-xs sm:text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
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
