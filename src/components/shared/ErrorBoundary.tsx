import * as React from 'react';
import { cn } from '../../lib/utils';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-4 rounded-2xl border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.05)] p-8 text-center',
            this.props.className
          )}
          role="alert"
          aria-live="assertive"
        >
          <svg
            className="h-10 w-10 text-[hsl(var(--destructive))]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Something went wrong</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              We encountered an unexpected issue. Your data is safe in browser storage. Try
              resetting the tool below.
            </p>
          </div>
          {this.state.error && (
            <details className="w-full max-w-sm rounded-lg border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.3)] p-3 text-left">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Error details
              </summary>
              <pre className="mt-2 overflow-x-auto text-xs text-destructive">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-lg transition-transform hover:-translate-y-0.5"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
              />
            </svg>
            Reset and retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
