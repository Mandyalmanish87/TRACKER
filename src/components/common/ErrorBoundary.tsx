import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndRecover = () => {
    try {
      localStorage.removeItem('tracker_active_nav_tab');
      sessionStorage.clear();
    } catch {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1c1917] text-[#fafaf9] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#292524] border border-[#44403c] rounded-2xl p-6 sm:p-8 text-center shadow-2xl space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold tracking-tight text-[#fafaf9]">
                Something went wrong
              </h2>
              <p className="text-xs text-[#a8a29e] mt-2 leading-relaxed">
                The application encountered an unexpected runtime error. Your stored local data is preserved and intact.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-[#1c1917] rounded-xl border border-[#44403c] text-left">
                <p className="text-[11px] font-mono text-rose-400 break-words">
                  {this.state.error.message || 'Unknown runtime error'}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#C45532] hover:bg-[#b04828] text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>
              <button
                onClick={this.handleResetAndRecover}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#3b3633] hover:bg-[#44403c] text-[#e7e5e4] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer border border-[#57534e]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

