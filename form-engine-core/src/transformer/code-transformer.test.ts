import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Babel from '@babel/standalone';
import { describe, expect, it } from 'vitest';
import { createComponentFromCode } from './code-transformer';
import type { FormCompileError } from './types';

const compile = (code: string, scope: Record<string, unknown>, onCompileError?: (error: FormCompileError) => void) =>
  createComponentFromCode(code, {
    babel: Babel,
    scopeBuilder: { buildScope: () => ({ React, ...scope }) } as any,
    onMissingSymbol: () => undefined,
    onCompileError,
  });

describe('createComponentFromCode scope resolution', () => {
  it('resolves a scope name at top level when a function also declares it', () => {
    // The MOIS export wraps native controls at top level and shadows them
    // inside FormComponent; real MOIS (scope as parameters) accepts this.
    const TextArea = ({ label }: { label: string }) => React.createElement('span', null, label);
    const Form = compile(`
      const wrapped = (() => ({ TextArea: props => <TextArea label={"wrapped " + props.label} /> }))();
      const FormComponent = () => {
        const { TextArea } = wrapped;
        return <TextArea label="note" />;
      };
    `, { TextArea });
    expect(renderToStaticMarkup(React.createElement(Form))).toBe('<span>wrapped note</span>');
  });

  it('still finds a form-local declaration that is not in scope', () => {
    const Form = compile(`
      function Local() { return <b>local</b>; }
      const FormComponent = () => <Local />;
    `, {});
    expect(renderToStaticMarkup(React.createElement(Form))).toBe('<b>local</b>');
  });
});

describe('createComponentFromCode compile errors', () => {
  it('reports where a top-level error was thrown in the transformed code', () => {
    const errors: FormCompileError[] = [];
    const Form = compile([
      'const ok = 1;',
      'const broken = notAFunction();',
      'const FormComponent = () => <b>never</b>;',
    ].join('\n'), { notAFunction: 42 }, error => errors.push(error));

    expect(renderToStaticMarkup(React.createElement(Form))).toContain('notAFunction is not a function');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ phase: 'evaluate', line: 2 });
    expect(errors[0].stack).toContain('notAFunction is not a function');
    expect(errors[0].snippet).toContain('> 2 | const broken = notAFunction();');
  });

  it('reports a syntax error at its line in the form code', () => {
    const errors: FormCompileError[] = [];
    compile('const a = 1;\nconst FormComponent = () => <b>;', {}, error => errors.push(error));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ phase: 'transform', line: 2 });
    expect(errors[0].snippet).toContain('> 2 |');
  });
});
