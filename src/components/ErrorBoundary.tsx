import React from 'react';

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
      message: error?.message || 'Unexpected simulator error.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Haryana Roadways Simulator ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B111A] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl bg-[#111A28] border border-slate-700 p-6">
            <h1 className="font-display text-xl font-bold text-white mb-2">
              Simulator Encountered an Error
            </h1>
            <p className="text-xs font-mono text-amber-300 bg-[#0B111A] p-3 rounded-lg overflow-x-auto mb-5">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-[#0B5ED7] hover:bg-[#094DB2] text-white text-sm font-semibold cursor-pointer"
            >
              Restart Simulator
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
