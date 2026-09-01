import { BaseScopeBuilder, createComponentFromCode } from "@mois/form-engine-core";
import { buildScope, initFormData, setInitialData } from "@mois/form-components";
import nhformsComponents from "@mois/form-components/nhforms/next";
import React, { useEffect, useMemo, useState } from "react";

import { createPlayerRequireShim } from "./require-shim";

export interface FormIdentityLike {
  name?: string;
  title?: string;
  [key: string]: unknown;
}

interface FormHostProps {
  /** Raw contents of the form's index.jsx. */
  source: string;
  identity: FormIdentityLike;
  initialData?: Record<string, unknown>;
}

function buildPlayerScope(identity: FormIdentityLike): Record<string, unknown> {
  const fullScope = buildScope() as Record<string, unknown>;
  return {
    ...fullScope,
    CommonSchemaDefn: fullScope.CommonSchemaDefn ?? nhformsComponents.CommonSchemaDefn,
    FormSessionRuntime: fullScope.FormSessionRuntime ?? nhformsComponents.FormSessionRuntime,
    UseChangeWatch: fullScope.UseChangeWatch ?? nhformsComponents.UseChangeWatch,
    require: fullScope.require ?? createPlayerRequireShim(),
    Identity: identity,
  };
}

/**
 * Compiles a form's JSX source with the engine and renders it. Must be
 * mounted inside FormStateProvider (and the Fluent ThemeProvider).
 */
export const FormHost: React.FC<FormHostProps> = ({ source, identity, initialData }) => {
  const [Component, setComponent] = useState<React.FC | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scope = useMemo(() => buildPlayerScope(identity), [identity]);

  useEffect(() => {
    let cancelled = false;
    import("@babel/standalone").then(
      (Babel) => {
        if (cancelled) return;
        initFormData();
        try {
          const scopeBuilder = new BaseScopeBuilder();
          scopeBuilder.buildScope = () => scope;
          const compiled = createComponentFromCode(source, {
            babel: Babel,
            scopeBuilder,
            onInitialData: (data: Record<string, unknown>) => {
              setInitialData({ ...data, ...initialData });
            },
          });
          setComponent(() => compiled);
          setError(null);
        } catch (e) {
          console.error("cerner-player form compilation failed:", e);
          setError(e instanceof Error ? e.message : String(e));
          setComponent(null);
        }
      },
      (e) => {
        if (!cancelled) setError("Failed to load compiler: " + String(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, scope, initialData]);

  if (error) {
    return (
      <div style={{ color: "#a4262c", padding: "1rem", fontFamily: "monospace" }}>
        Form failed to compile: {error}
      </div>
    );
  }
  if (!Component) {
    return <div style={{ padding: "1rem" }}>Preparing form…</div>;
  }
  return <Component />;
};
