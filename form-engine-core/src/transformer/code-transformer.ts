/**
 * Code Transformer
 *
 * Transforms JSX/TSX code strings into React components using Babel.
 * Handles both simple JSX snippets and full form code with FormComponent.
 */

import React from 'react';
import type { TransformOptions } from './types';

/**
 * HTML attribute to JSX attribute mapping
 * React uses camelCase for DOM attributes
 */
const HTML_TO_JSX_ATTRS: Record<string, string> = {
  'rowspan': 'rowSpan',
  'colspan': 'colSpan',
  'cellpadding': 'cellPadding',
  'cellspacing': 'cellSpacing',
  'tabindex': 'tabIndex',
  'readonly': 'readOnly',
  'maxlength': 'maxLength',
  'minlength': 'minLength',
  'autocomplete': 'autoComplete',
  'autofocus': 'autoFocus',
  'contenteditable': 'contentEditable',
  'crossorigin': 'crossOrigin',
  'datetime': 'dateTime',
  'enctype': 'encType',
  'formaction': 'formAction',
  'formenctype': 'formEncType',
  'formmethod': 'formMethod',
  'formnovalidate': 'formNoValidate',
  'formtarget': 'formTarget',
  'frameborder': 'frameBorder',
  'hreflang': 'hrefLang',
  'inputmode': 'inputMode',
  'srcdoc': 'srcDoc',
  'srcset': 'srcSet',
  'usemap': 'useMap',
  // Note: 'class' and 'for' are typically handled by Babel's React preset
};

/**
 * Preprocess code to fix common HTML-to-JSX issues
 * - Convert HTML attributes to JSX camelCase (rowspan → rowSpan)
 * - Wrap <tr> in <tbody> when direct child of <table>
 */
function preprocessHtmlToJsx(code: string): string {
  let result = code;

  // Fix HTML attributes to JSX camelCase
  for (const [htmlAttr, jsxAttr] of Object.entries(HTML_TO_JSX_ATTRS)) {
    // Match attribute in JSX context: attr= or attr={
    const attrRegex = new RegExp(`\\b${htmlAttr}(\\s*=)`, 'gi');
    result = result.replace(attrRegex, `${jsxAttr}$1`);
  }

  // Fix <table> with direct <tr> children - wrap in <tbody>
  // Match <table ...>followed by whitespace/newlines then <tr
  result = result.replace(
    /(<table[^>]*>)([\s\n]*)(<tr[\s>])/gi,
    '$1$2<tbody>$3'
  );

  // Add closing </tbody> before </table> if we added an opening <tbody>
  // This is a simple heuristic - match </tr> followed by whitespace then </table>
  result = result.replace(
    /(<\/tr>)([\s\n]*)(<\/table>)/gi,
    '$1$2</tbody>$3'
  );

  return result;
}

/**
 * Creates a React component from a code string using Babel transformation.
 *
 * @param code - The JSX/TSX code string to transform
 * @param options - Transform options including Babel instance and scope builder
 * @returns A React functional component
 */
export const createComponentFromCode = (code: string, options: TransformOptions): React.FC => {
  const { babel, scopeBuilder, onInitialData } = options;

  let cleanCode = code
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // Preprocess to fix common HTML-to-JSX issues
  cleanCode = preprocessHtmlToJsx(cleanCode);

  // Skip empty code
  if (!cleanCode) {
    return () => React.createElement('div', { style: { color: '#797775', fontStyle: 'italic' } }, 'No code to display');
  }

  // Check if this is a full form that defines FormComponent
  const definesFormComponent = /\bFormComponent\s*=/.test(cleanCode) ||
                               /\bconst\s+FormComponent\b/.test(cleanCode) ||
                               /\bfunction\s+FormComponent\b/.test(cleanCode);

  if (definesFormComponent) {
    return createFormComponent(cleanCode, babel, scopeBuilder, onInitialData);
  }

  return createSimpleComponent(cleanCode, babel, scopeBuilder);
};

/**
 * Check if code defines a FormComponent (full form vs simple JSX)
 */
export const isFormCode = (code: string): boolean => {
  return /\bFormComponent\s*=/.test(code) ||
         /\bconst\s+FormComponent\b/.test(code) ||
         /\bfunction\s+FormComponent\b/.test(code);
};

/**
 * Creates a component from full form code that defines FormComponent
 */
const createFormComponent = (
  cleanCode: string,
  Babel: any,
  scopeBuilder: TransformOptions['scopeBuilder'],
  onInitialData?: (data: Record<string, any>) => void
): React.FC => {
  try {
    const transformed = Babel.transform(cleanCode, {
      presets: ['react', 'typescript'],
      filename: 'form.tsx'
    }).code;

    const scope = scopeBuilder.buildScope();

    // Extract local variable declarations from transformed code FIRST
    // This is needed so the proxy's 'has' trap can exclude them,
    // allowing 'with' to fall back to lexical scope for local vars
    const localVarNames = new Set<string>();

    // Multiple patterns to catch different declaration formats
    const patterns = [
      /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g,  // const foo =
      /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;/g,  // const foo; (no initializer)
      /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,           // function foo(
      /class\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,                   // class Foo
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(transformed)) !== null) {
        localVarNames.add(match[1]);
      }
    }

    // Also capture destructured variables: const { Foo, Bar } = ... or const { Foo: RenamedFoo } = ...
    const destructurePattern = /(?:const|let|var)\s*\{([^}]+)\}/g;
    let destructMatch;
    while ((destructMatch = destructurePattern.exec(transformed)) !== null) {
      const inner = destructMatch[1];
      // Match identifiers, handling renaming like { Foo: Bar } -> captures Bar
      // and simple like { Foo } -> captures Foo
      const identPattern = /([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::|,|\}|$)/g;
      let identMatch;
      while ((identMatch = identPattern.exec(inner)) !== null) {
        // Check if this is a rename pattern like "Foo: Bar" - we want Bar
        const beforeIdent = inner.substring(0, identMatch.index);
        const lastColonPos = beforeIdent.lastIndexOf(':');
        const lastCommaPos = beforeIdent.lastIndexOf(',');
        const lastBracePos = beforeIdent.lastIndexOf('{');

        // If there's a colon after the last comma/brace, this is the renamed value
        if (lastColonPos > Math.max(lastCommaPos, lastBracePos)) {
          localVarNames.add(identMatch[1]);
        } else {
          // This is either a simple destructure or the key in a rename
          // Check if there's a colon after this identifier
          const afterIdent = inner.substring(identMatch.index + identMatch[0].length);
          if (!afterIdent.trimStart().startsWith(':')) {
            // No colon after, so this is the variable name
            localVarNames.add(identMatch[1]);
          }
        }
      }
    }

    // Debug logging (uncomment when troubleshooting variable resolution issues)
    // console.log('[Code Transformer] Captured local variables:', Array.from(localVarNames));

    // Create a proxy that returns placeholders for undefined properties
    const createPlaceholder = (name: string): any => {
      const PlaceholderComponent: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
        React.createElement('div', { 'data-missing': name, style: { display: 'contents' } }, children);
      PlaceholderComponent.displayName = `Placeholder_${name}`;
      return PlaceholderComponent;
    };

    // Known optional form variables that don't need warnings
    const optionalFormVars = new Set([
      'InitialData', 'Schema', 'Query', 'Identity',
      '__scope__', 'style', 'handleBeforeUnload', 'undefined',
      'FormComponent', 'arguments'  // FormComponent is always local, arguments is JS built-in
    ]);

    const scopeProxy = new Proxy(scope, {
      get(target, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (prop in target) return target[prop as string];
        // Return placeholder for missing components (suppress warnings for known optional vars)
        if (!optionalFormVars.has(String(prop))) {
          console.warn(`[Form] Missing: ${String(prop)}`);
        }
        return createPlaceholder(String(prop));
      },
      set(target, prop, value) {
        // Capture assignments like InitialData = {...}, Schema = {...}, Query = {...}
        if (typeof prop === 'string') {
          (target as any)[prop] = value;
        }
        return true;
      },
      has(target, prop) {
        if (typeof prop === 'symbol') return false;
        // For locally-defined variables, return false so 'with' falls back to lexical scope
        // This allows local variables like PHQ9Quest to be found in their defining scope
        if (localVarNames.has(String(prop))) {
          return false;
        }
        // For scope-provided components and hooks, return true
        if (prop in target) {
          return true;
        }
        // For unknown properties, return true so we can provide placeholders
        return true;
      }
    });

    // Use 'with' statement to inject scope (like form tester does)
    // eslint-disable-next-line no-new-func
    const fn = new Function('__scope__', `
      with (__scope__) {
        ${transformed}

        return {
          FormComponent: typeof FormComponent !== 'undefined' ? FormComponent : null,
          InitialData: typeof InitialData !== 'undefined' ? InitialData : null
        };
      }
    `);

    const result = fn(scopeProxy);
    const FormComponent = result.FormComponent;
    const InitialData = result.InitialData;

    // Notify about InitialData if callback provided
    if (onInitialData) {
      onInitialData(InitialData || {});
    }

    if (!FormComponent) {
      return () => React.createElement('div', { className: 'error-message' },
        'FormComponent not found in the form code');
    }

    return FormComponent;
  } catch (e: any) {
    return () => React.createElement('div', { className: 'error-message' }, e.message);
  }
};

/**
 * Creates a component from simple JSX code (not a full form)
 */
const createSimpleComponent = (
  cleanCode: string,
  Babel: any,
  scopeBuilder: TransformOptions['scopeBuilder']
): React.FC => {
  // Check if this looks like actual code (JSX/JavaScript) vs plain text
  const looksLikeCode = cleanCode.startsWith('<') ||
                        cleanCode.startsWith('//') ||
                        cleanCode.startsWith('/*') ||
                        cleanCode.startsWith('const ') ||
                        cleanCode.startsWith('let ') ||
                        cleanCode.startsWith('var ') ||
                        cleanCode.startsWith('function ') ||
                        cleanCode.startsWith('(') ||
                        cleanCode.startsWith('{') ||
                        cleanCode.startsWith(';<') ||
                        /^[A-Z][a-zA-Z]*\s*\(/.test(cleanCode) ||
                        cleanCode.includes('=>') ||
                        cleanCode.includes('return ');

  if (!looksLikeCode) {
    return () => React.createElement('div', { style: { fontStyle: 'italic', color: '#605e5c', padding: '8px' } }, cleanCode);
  }

  // Check for statements and hooks
  const hasStatements = /^(const|let|var|function)\s/.test(cleanCode) ||
                       /\n(const|let|var|function)\s/.test(cleanCode);
  const usesHooks = /\buseState\b|\buseEffect\b|\buseMemo\b|\buseCallback\b|\buseRef\b|\buseSourceData\b|\buseActiveData\b|\buseCodeList\b|\buseFormState\b|\buseFieldValue\b|\buseActivityOptions\b|\buseSection\b|\buseTheme\b/.test(cleanCode);

  let codeToTransform: string;

  // Check for top-level return (not inside nested functions)
  const hasTopLevelReturn = (() => {
    let braceDepth = 0;
    let i = 0;
    while (i < cleanCode.length) {
      const char = cleanCode[i];
      if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
      } else if (braceDepth === 0 && cleanCode.slice(i).match(/^return\s*[\s(]/)) {
        const prevChar = i > 0 ? cleanCode[i - 1] : ' ';
        if (!/[a-zA-Z0-9_]/.test(prevChar)) {
          return true;
        }
      }
      i++;
    }
    return false;
  })();
  const hasReturn = hasTopLevelReturn;
  const isIIFE = /^\s*\(\s*function\s*\(/.test(cleanCode) || /^\s*\(\s*\(\)\s*=>/.test(cleanCode);
  const isArrowFunctionComponent = /^\s*\(\s*\)\s*=>\s*\{/.test(cleanCode) && hasReturn;

  if (isArrowFunctionComponent) {
    if (usesHooks) {
      codeToTransform = `const ExampleComponent = ${cleanCode}`;
    } else {
      codeToTransform = `(${cleanCode})()`;
    }
  } else if (hasStatements) {
    if (hasReturn || isIIFE) {
      if (usesHooks) {
        codeToTransform = `function ExampleComponent() { ${cleanCode} }`;
      } else {
        if (isIIFE) {
          codeToTransform = cleanCode;
        } else {
          codeToTransform = `(function() { ${cleanCode} })()`;
        }
      }
    } else {
      codeToTransform = transformStatementsWithJsx(cleanCode, usesHooks);
    }
  } else {
    codeToTransform = transformPureJsx(cleanCode);
  }

  // Transform JSX to JavaScript using Babel
  const transformed = Babel.transform(codeToTransform, {
    presets: ['react'],
    filename: 'example.jsx'
  }).code;

  const scope = scopeBuilder.buildScope();
  const paramNames = Object.keys(scope);
  const paramValues = Object.values(scope);

  if ((hasStatements || isArrowFunctionComponent) && usesHooks) {
    const fn = new Function(
      ...paramNames,
      `"use strict"; ${transformed} return ExampleComponent;`
    );
    return fn(...paramValues);
  } else {
    const fn = new Function(
      ...paramNames,
      `"use strict"; try { return ${transformed}; } catch (e) { return React.createElement('div', { className: 'error-message' }, e.message); }`
    );
    const result = fn(...paramValues);
    return () => result;
  }
};

/**
 * Transform code that has statements followed by JSX
 */
const transformStatementsWithJsx = (cleanCode: string, usesHooks: boolean): string => {
  let statementsPart: string = '';
  let jsxPart: string = '';

  const lines = cleanCode.split('\n');
  let jsxStartLineIndex = -1;
  let braceDepth = 0;
  let parenDepth = 0;
  let foundStatements = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    if (trimmed.startsWith(';<') || trimmed.startsWith(';  <') || trimmed.startsWith('; <')) {
      if (braceDepth === 0 && parenDepth === 0) {
        jsxStartLineIndex = i;
        break;
      }
    }

    for (const char of trimmed) {
      if (char === '{') braceDepth++;
      else if (char === '}') braceDepth--;
      else if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
    }

    if (foundStatements && braceDepth === 0 && parenDepth === 0 && trimmed.startsWith('<')) {
      jsxStartLineIndex = i;
      break;
    }

    foundStatements = true;
  }

  if (jsxStartLineIndex > 0) {
    statementsPart = lines.slice(0, jsxStartLineIndex).join('\n').trim();
    jsxPart = lines.slice(jsxStartLineIndex).join('\n').trim();

    if (jsxPart.startsWith(';')) {
      jsxPart = jsxPart.slice(1).trim();
    }
  }

  if (!jsxPart) {
    const jsxStartMatch = cleanCode.match(/;\s*(<[\s\S]+)$/);
    if (jsxStartMatch) {
      const jsxStartIndex = cleanCode.lastIndexOf(jsxStartMatch[0]);
      statementsPart = cleanCode.slice(0, jsxStartIndex).trim();
      jsxPart = jsxStartMatch[1].trim();
    }
  }

  if (statementsPart && jsxPart) {
    let braceDepth = 0;
    let parenDepth = 0;
    let templateLiteralDepth = 0;
    const processedStatements = statementsPart
      .split('\n')
      .map(line => {
        const trimmed = line.trim();

        for (let i = 0; i < trimmed.length; i++) {
          const char = trimmed[i];
          const prevChar = i > 0 ? trimmed[i - 1] : '';

          if (char === '`' && prevChar !== '\\') {
            if (templateLiteralDepth > 0) {
              templateLiteralDepth--;
            } else {
              templateLiteralDepth++;
            }
          } else if (templateLiteralDepth === 0) {
            if (char === '{') braceDepth++;
            else if (char === '}') braceDepth--;
            else if (char === '(') parenDepth++;
            else if (char === ')') parenDepth--;
          }
        }

        if (trimmed &&
            braceDepth === 0 &&
            parenDepth === 0 &&
            templateLiteralDepth === 0 &&
            !trimmed.startsWith('//') &&
            !trimmed.startsWith('/*') &&
            !trimmed.startsWith('*') &&
            !trimmed.endsWith(';') &&
            !trimmed.endsWith('{') &&
            !trimmed.endsWith('}') &&
            !trimmed.endsWith('(') &&
            !trimmed.endsWith(')') &&
            !trimmed.endsWith('[') &&
            !trimmed.endsWith(']') &&
            !trimmed.endsWith(',') &&
            !trimmed.endsWith(':') &&
            !trimmed.endsWith('`')) {
          return line + ';';
        }
        return line;
      })
      .join('\n');

    if (usesHooks) {
      return `function ExampleComponent() {\n${processedStatements}\nreturn (\n${jsxPart}\n);\n}`;
    } else {
      return `(function() {\n${processedStatements}\nreturn (\n${jsxPart}\n);\n})()`;
    }
  } else {
    if (usesHooks) {
      return `function ExampleComponent() {\n${cleanCode}\n}`;
    } else {
      return `(function() {\n${cleanCode}\n})()`;
    }
  }
};

/**
 * Transform pure JSX code (no statements)
 */
const transformPureJsx = (cleanCode: string): string => {
  let jsxCode = cleanCode;
  if (jsxCode.startsWith(';<') || jsxCode.startsWith('; <')) {
    jsxCode = jsxCode.replace(/^;\s*/, '');
  }

  // Strip leading comments
  let strippedCode = jsxCode;
  while (strippedCode.length > 0) {
    const trimmed = strippedCode.trimStart();
    if (trimmed.startsWith('//')) {
      const newlineIndex = trimmed.indexOf('\n');
      if (newlineIndex === -1) {
        strippedCode = '';
      } else {
        strippedCode = trimmed.slice(newlineIndex + 1);
      }
    } else if (trimmed.startsWith('/*')) {
      const endIndex = trimmed.indexOf('*/');
      if (endIndex === -1) {
        strippedCode = '';
      } else {
        strippedCode = trimmed.slice(endIndex + 2);
      }
    } else {
      strippedCode = trimmed;
      break;
    }
  }

  jsxCode = strippedCode;

  const lines = jsxCode.split('\n');
  let rootElements = 0;
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }
    if (depth === 0 && trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<!')) {
      rootElements++;
    }
    const opens = (trimmed.match(/<[A-Z][^/>]*/g) || []).length;
    const closes = (trimmed.match(/<\/[A-Z]/g) || []).length;
    const selfClose = (trimmed.match(/\/>/g) || []).length;
    depth += opens - closes - selfClose;
  }

  if (rootElements > 1) {
    return `<>${jsxCode}</>`;
  } else {
    return jsxCode;
  }
};
