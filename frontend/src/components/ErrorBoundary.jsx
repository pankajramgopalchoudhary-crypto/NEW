import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Surface to console for debugging; never to the user.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught:', error, info);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] grid place-items-center px-6 py-20 bg-[#FFFCF5]" data-testid="error-boundary">
          <div className="max-w-md text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-50 grid place-items-center mb-5">
              <span className="brand-emerald font-display text-xl font-bold">S</span>
            </div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">
              We are currently updating this information
            </h1>
            <p className="mt-3 text-slate-600">
              Please request a quotation and our team will share the latest verified pricing and options with you right away.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <a
                href="/consultation"
                data-testid="error-request-quote"
                className="btn-primary rounded-full px-6 h-11 inline-flex items-center"
              >
                Request a Quotation
              </a>
              <button
                onClick={this.handleReset}
                data-testid="error-go-home"
                className="rounded-full px-6 h-11 border border-slate-200 text-slate-700 hover:border-emerald-700/30"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
