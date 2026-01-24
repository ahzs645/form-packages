/**
 * Live Preview
 *
 * Component for rendering compiled JSX with error handling.
 * This is a generic version that accepts a Provider wrapper.
 */

import React from 'react';
import { createComponentFromCode } from '../transformer/code-transformer';
import { initFormData, setInitialData } from '../state/form-state';
import { ErrorBoundary } from './error-boundary';
import type { ScopeBuilder } from '../scope/types';

interface LivePreviewProps {
  /** The JSX/TSX code to render */
  code: string;

  /** Babel standalone instance */
  babel: any;

  /** Scope builder for execution context */
  scopeBuilder: ScopeBuilder;

  /** Optional wrapper component (e.g., MoisProvider) */
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;

  /** Optional layout wrapper (e.g., Linear) */
  layout?: React.ComponentType<{ children: React.ReactNode }>;

  /** Callback when form is reset/loaded */
  onReset?: () => void;
}

/**
 * LivePreview - Shared component for rendering compiled JSX with error handling
 */
export const LivePreview: React.FC<LivePreviewProps> = ({
  code,
  babel,
  scopeBuilder,
  wrapper: Wrapper,
  layout: Layout,
  onReset,
}) => {
  const [error, setError] = React.useState<string | null>(null);
  const [Component, setComponent] = React.useState<React.FC | null>(null);

  React.useEffect(() => {
    // Reset state when loading new code
    if (onReset) {
      onReset();
    }
    initFormData();

    try {
      const comp = createComponentFromCode(code, {
        babel,
        scopeBuilder,
        onInitialData: setInitialData,
      });
      setComponent(() => comp);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      setComponent(null);
    }
  }, [code, babel, scopeBuilder, onReset]);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!Component) {
    return <div style={{ color: '#797775' }}>Loading...</div>;
  }

  // Build the render tree
  let content: React.ReactNode = <Component />;

  // Wrap with layout if provided
  if (Layout) {
    content = <Layout>{content}</Layout>;
  }

  // Wrap with provider if provided
  if (Wrapper) {
    content = <Wrapper>{content}</Wrapper>;
  }

  return (
    <ErrorBoundary resetKey={code}>
      {content}
    </ErrorBoundary>
  );
};
