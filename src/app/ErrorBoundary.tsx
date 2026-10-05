import { Component, type ReactNode } from 'react';

// If a screen fails, show a way out instead of a blank page. Saved records are not affected.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card pad-lg stack" role="alert">
        <h2>Something went wrong on this screen</h2>
        <p className="text-2">Your saved records are safe. Reload to try again.</p>
        <p className="tiny muted">{this.state.error.message}</p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
          <a className="btn btn-secondary" href="#/">Home</a>
        </div>
      </div>
    );
  }
}
