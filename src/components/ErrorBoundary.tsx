import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

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
    console.error('Workforce Vision Xatolik ushlandi:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mb-4 shadow-sm">
            <AlertOctagon size={28} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Kutilmagan xatolik yuz berdi
          </h1>
          <p className="mt-2 max-w-md text-xs sm:text-sm text-text2 leading-relaxed">
            Ilova ishlashida xatolik aniqlandi. Ma'lumotlaringiz xavfsiz holatda saqlanmoqda. Sahifani qayta yuklang yoki bosh sahifaga qayting.
          </p>
          {this.state.error && (
            <div className="mt-4 max-w-lg rounded-lg border border-line bg-white p-3 text-left font-mono text-[11px] text-rose-700 overflow-x-auto shadow-xs">
              {this.state.error.message}
            </div>
          )}
          <div className="mt-6">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink-hover shadow-sm transition-colors"
            >
              <RotateCcw size={14} />
              Bosh sahifaga qaytish
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
