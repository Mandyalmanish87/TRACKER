import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
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

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

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
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-6 text-espresso-950 dark:text-ivory-50">
          <div className="max-w-md w-full bg-white dark:bg-[#18151D] border border-ivory-300 dark:border-white/10 rounded-2xl p-6 sm:p-8 text-center shadow-xl space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h2 className="font-serif text-xl font-bold tracking-tight text-espresso-950 dark:text-ivory-50">
                Something went wrong
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-2 leading-relaxed">
                The application encountered an unexpected runtime error. Your stored local data is preserved and intact.
              </p>
            </div>

            <div className="p-3 bg-ivory-100/60 dark:bg-white/[0.03] rounded-xl border border-ivory-200 dark:border-white/10 text-left">
              <p className="text-[11px] font-mono text-rose-500 break-words">
                {this.state.error.message || 'Unknown runtime error'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-subtle hover:opacity-95"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetAndRecover}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-ivory-200/80 dark:bg-white/10 hover:bg-ivory-300 dark:hover:bg-white/15 text-espresso-800 dark:text-ivory-100 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
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
