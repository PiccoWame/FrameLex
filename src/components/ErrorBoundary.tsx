import React from 'react';
import { FRAMELEX_LOGO_URL } from '../data/anatomyCatalog';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F5FA] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E2DFEE] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <img
                src={FRAMELEX_LOGO_URL}
                alt="FrameLex icon"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover border border-[#D8E0FC] shrink-0"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
                  FrameLex
                </p>
                <h1 className="font-display text-lg font-bold text-slate-900">
                  Something went wrong
                </h1>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              FrameLex encountered an unexpected error while syncing or rendering your workspace.
            </p>
            <div className="p-3 bg-[#F7F6FB] border border-[#E2DFEE] rounded-lg font-mono text-xs text-slate-700 break-words max-h-40 overflow-y-auto">
              {this.state.message}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Reload Studio
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
