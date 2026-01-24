/**
 * Code Scope Components
 *
 * React components used for live code preview rendering.
 */

import React from 'react';
import * as Babel from '@babel/standalone';
import { MoisProvider } from '../context/MoisContext';
import { Linear } from '../index';
import { createComponentFromCode } from './code-transformer';
import { resetPageSelection } from '../components/PageSelect';
import { initFormData } from '../hooks/form-state';

/**
 * Error boundary for catching render errors in live previews
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey?: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; resetKey?: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: { resetKey?: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', { className: 'error-message' },
        `Error: ${this.state.error?.message || 'Something went wrong'}`
      );
    }
    return this.props.children;
  }
}

export interface LivePreviewProps {
  /** The JSX/TSX code to render */
  code: string;
  /**
   * Whether to wrap content in Linear layout (labels on left).
   * Default: true
   */
  linearLayout?: boolean;
}

/**
 * LivePreview - Shared component for rendering compiled JSX with error handling
 * Used by both CodePreview and Playground
 */
export const LivePreview: React.FC<LivePreviewProps> = ({ code, linearLayout = true }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [Component, setComponent] = React.useState<React.FC | null>(null);

  React.useEffect(() => {
    // Reset state when loading new code
    resetPageSelection();
    initFormData();

    try {
      const comp = createComponentFromCode(code, Babel);
      setComponent(() => comp);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      setComponent(null);
    }
  }, [code]);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!Component) {
    return <div style={{ color: '#797775' }}>Loading...</div>;
  }

  // Render content with optional Linear wrapper
  const content = linearLayout ? (
    <Linear>
      <Component />
    </Linear>
  ) : (
    <Component />
  );

  return (
    <ErrorBoundary resetKey={code}>
      <MoisProvider>
        {content}
      </MoisProvider>
    </ErrorBoundary>
  );
};
