'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 Error Boundary caught an error:', error);
    console.error('📍 Error Info:', errorInfo);
    
    // Log error details for geographic debugging
    const userAgent = navigator?.userAgent || 'unknown';
    const language = navigator?.language || 'unknown';
    const platform = navigator?.platform || 'unknown';
    
    console.error('🌍 User Environment:', {
      userAgent,
      language,
      platform,
      timestamp: new Date().toISOString(),
      url: window?.location?.href || 'unknown'
    });
    
    this.setState({
      hasError: true,
      error,
      errorInfo: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-900 rounded-lg p-8 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
            <p className="text-gray-300 mb-6">
              We're sorry, but there was an error loading this page. This might be due to 
              connectivity issues or script loading problems.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors"
              >
                🔄 Reload Page
              </button>
              
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.history.back();
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded transition-colors"
              >
                ← Go Back
              </button>
            </div>
            
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-gray-400 hover:text-white">
                Technical Details
              </summary>
              <div className="mt-2 p-3 bg-gray-800 rounded text-xs text-gray-300 overflow-auto max-h-32">
                <div><strong>Error:</strong> {this.state.error?.message}</div>
                {this.state.errorInfo && (
                  <div className="mt-2">
                    <strong>Stack:</strong>
                    <pre className="whitespace-pre-wrap">{this.state.errorInfo}</pre>
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const withErrorBoundary = (Component: any, fallback?: ReactNode) => {
  return function WithErrorBoundaryComponent(props: any) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};
