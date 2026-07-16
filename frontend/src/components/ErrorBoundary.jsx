import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Catches render errors anywhere below it in the tree. Without this, a bug
 * on a single page (like the plan-value crash that motivated adding this)
 * unmounts React entirely and leaves a blank screen that even browser Back/
 * Forward can't recover from without a hard reload. This shows a real
 * recovery option instead.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Vyeta Business Hub crashed:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-midnight-950 px-4">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Something went wrong</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This page hit an unexpected error. Your data is safe — try heading back to your Dashboard.
            </p>
            <button onClick={this.handleReset} className="btn-gold w-full py-3 rounded-xl font-bold">
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
