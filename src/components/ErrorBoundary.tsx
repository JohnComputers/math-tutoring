import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Last line of defence against a white screen.
 *
 * React unmounts the entire tree when a render throws, so without a boundary any
 * unexpected error leaves the visitor staring at a blank page with no idea what happened
 * and no way forward. This catches it, shows something human, and offers a reload.
 *
 * The developer detail goes to the console; the visitor gets a sentence and a button.
 */

interface Props {
  children: ReactNode;
  /** Shown instead of the default panel, for embedding in a smaller region. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="section section--light">
        <div className="container container--narrow text-center">
          <h1 className="section-title">Something went wrong</h1>
          <p className="section-subtitle">
            Sorry — this page ran into an unexpected problem. Reloading usually fixes it.
          </p>
          <div className="btn-row btn-row--center" style={{ marginTop: 'var(--space-8)' }}>
            <button type="button" className="btn btn--primary" onClick={this.handleReload}>
              Reload the page
            </button>
            <a className="btn btn--ghost-dark" href="#/">
              Back to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
