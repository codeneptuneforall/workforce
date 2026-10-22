import type * as React from 'react';
import { Component } from 'react';
import { AlertTriangleIcon, RotateCcwIcon } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a single broken page cannot leave a blank screen.
 *
 * The failure is reported instead of being swallowed: the message is kept in the state
 * so it can be shown, and the user gets a way out (retry, or go back to the start).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error('[ui] render failed', error);
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md rounded-xl border border-line bg-white p-6 text-center">
          <AlertTriangleIcon className="mx-auto h-8 w-8 text-bad" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-ink">This page could not be displayed</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Something went wrong while drawing the screen. Reloading usually fixes it.
          </p>
          <p className="mt-3 break-words rounded-lg bg-canvas px-3 py-2 text-left text-xs text-ink-muted">
            {error.message}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" icon={RotateCcwIcon} onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button onClick={() => window.location.assign('/')}>Go to the start page</Button>
          </div>
        </div>
      </div>
    );
  }
}
