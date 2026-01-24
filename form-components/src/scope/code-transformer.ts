/**
 * Code Transformer
 *
 * Transforms JSX/TSX code strings into React components using Babel.
 * Handles both simple JSX snippets and full MOIS form code with FormComponent.
 */

import React from 'react';
import { buildScope } from './build-scope';
import { setInitialData } from '../hooks/form-state';

/**
 * Creates a React component from a code string using Babel transformation.
 * Shared by CodePreview and Playground.
 *
 * @param code - The JSX/TSX code string to transform
 * @param Babel - The Babel standalone instance
 * @returns A React functional component
 */
export const createComponentFromCode = (code: string, Babel: any): React.FC => {
  let cleanCode = code
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // Skip empty code
  if (!cleanCode) {
    return () => React.createElement('div', { style: { color: '#797775', fontStyle: 'italic' } }, 'No code to display');
  }

  // Check if this is a full MOIS form that defines FormComponent
  const definesFormComponent = /\bFormComponent\s*=/.test(cleanCode) ||
                               /\bconst\s+FormComponent\b/.test(cleanCode) ||
                               /\bfunction\s+FormComponent\b/.test(cleanCode);

  if (definesFormComponent) {
    return createFormComponent(cleanCode, Babel);
  }

  return createSimpleComponent(cleanCode, Babel);
};

/**
 * Creates a component from full MOIS form code that defines FormComponent
 */
const createFormComponent = (cleanCode: string, Babel: any): React.FC => {
  try {
    const transformed = Babel.transform(cleanCode, {
      presets: ['react', 'typescript'],
      filename: 'form.tsx'
    }).code;

    const scope = buildScope();

    // Create a proxy that returns placeholders for undefined properties
    const createPlaceholder = (name: string): any => {
      const PlaceholderComponent: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
        React.createElement('div', { 'data-missing': name, style: { display: 'contents' } }, children);
      PlaceholderComponent.displayName = `Placeholder_${name}`;
      return PlaceholderComponent;
    };

    const scopeProxy = new Proxy(scope, {
      get(target, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (prop in target) return target[prop as string];
        // Return placeholder for missing components
        console.warn(`[Form] Missing: ${String(prop)}`);
        return createPlaceholder(String(prop));
      },
      set(target, prop, value) {
        // Capture assignments like InitialData = {...}, Schema = {...}, Query = {...}
        if (typeof prop === 'string') {
          (target as any)[prop] = value;
        }
        return true;
      },
      has(_target, prop) {
        if (typeof prop === 'symbol') return false;
        return true; // Pretend all properties exist
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

    // Store InitialData for use by MoisContext
    setInitialData(InitialData || {});

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
const createSimpleComponent = (cleanCode: string, Babel: any): React.FC => {
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
  // Scan through code tracking brace depth, check if 'return' appears at depth 0
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
        // Check it's actually the word 'return' (not part of another word)
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

  const scope = buildScope();
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

  // Strategy: Find where JSX starts by tracking brace depth
  // This handles multi-line function definitions properly
  const lines = cleanCode.split('\n');
  let jsxStartLineIndex = -1;
  let braceDepth = 0;
  let parenDepth = 0;
  let foundStatements = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Check if this line starts JSX with explicit semicolon separator
    if (trimmed.startsWith(';<') || trimmed.startsWith(';  <') || trimmed.startsWith('; <')) {
      // Only accept this as JSX start if we're at depth 0 (not inside a function/object)
      if (braceDepth === 0 && parenDepth === 0) {
        jsxStartLineIndex = i;
        break;
      }
    }

    // Track brace and paren depth to know when we're outside function definitions
    for (const char of trimmed) {
      if (char === '{') braceDepth++;
      else if (char === '}') braceDepth--;
      else if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
    }

    // If we've seen statements and now see a line starting with < at depth 0, this is JSX start
    if (foundStatements && braceDepth === 0 && parenDepth === 0 && trimmed.startsWith('<')) {
      jsxStartLineIndex = i;
      break;
    }

    // This looks like a statement line
    foundStatements = true;
  }

  if (jsxStartLineIndex > 0) {
    // Split at the JSX start
    statementsPart = lines.slice(0, jsxStartLineIndex).join('\n').trim();
    jsxPart = lines.slice(jsxStartLineIndex).join('\n').trim();

    // Remove leading semicolon from jsxPart if present
    if (jsxPart.startsWith(';')) {
      jsxPart = jsxPart.slice(1).trim();
    }
  }

  // Fallback: use regex to find ;< pattern at the end
  if (!jsxPart) {
    const jsxStartMatch = cleanCode.match(/;\s*(<[\s\S]+)$/);
    if (jsxStartMatch) {
      const jsxStartIndex = cleanCode.lastIndexOf(jsxStartMatch[0]);
      statementsPart = cleanCode.slice(0, jsxStartIndex).trim();
      jsxPart = jsxStartMatch[1].trim();
    }
  }

  if (statementsPart && jsxPart) {
    // Process statements - add semicolons where needed but preserve structure
    // Track brace/paren/template literal depth to avoid adding semicolons inside literals
    let braceDepth = 0;
    let parenDepth = 0;
    let templateLiteralDepth = 0;
    const processedStatements = statementsPart
      .split('\n')
      .map(line => {
        const trimmed = line.trim();

        // Update depths based on this line's content
        // Need to track backticks for template literals, handling escaped backticks
        for (let i = 0; i < trimmed.length; i++) {
          const char = trimmed[i];
          const prevChar = i > 0 ? trimmed[i - 1] : '';

          if (char === '`' && prevChar !== '\\') {
            // Toggle template literal - backtick starts or ends a template literal
            if (templateLiteralDepth > 0) {
              templateLiteralDepth--;
            } else {
              templateLiteralDepth++;
            }
          } else if (templateLiteralDepth === 0) {
            // Only track braces/parens outside of template literals
            if (char === '{') braceDepth++;
            else if (char === '}') braceDepth--;
            else if (char === '(') parenDepth++;
            else if (char === ')') parenDepth--;
          }
        }

        // Only add semicolon to lines that look like complete statements at depth 0
        // Don't add to lines inside template literals, or ending with {, }, (, ), or ,
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

    // IMPORTANT: Use newlines to properly separate statements from return
    // This prevents "} return" syntax errors
    if (usesHooks) {
      return `function ExampleComponent() {\n${processedStatements}\nreturn (\n${jsxPart}\n);\n}`;
    } else {
      return `(function() {\n${processedStatements}\nreturn (\n${jsxPart}\n);\n})()`;
    }
  } else {
    // No clear separation found - wrap the whole thing
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

  // Strip leading single-line and multi-line comments
  // This is necessary because when we do `return ${transformed}`,
  // a leading comment would cause JavaScript's ASI to interpret it as `return;`
  // followed by the comment, making the return value undefined.
  let strippedCode = jsxCode;
  while (strippedCode.length > 0) {
    const trimmed = strippedCode.trimStart();
    if (trimmed.startsWith('//')) {
      // Remove single-line comment
      const newlineIndex = trimmed.indexOf('\n');
      if (newlineIndex === -1) {
        strippedCode = '';
      } else {
        strippedCode = trimmed.slice(newlineIndex + 1);
      }
    } else if (trimmed.startsWith('/*')) {
      // Remove multi-line comment
      const endIndex = trimmed.indexOf('*/');
      if (endIndex === -1) {
        strippedCode = '';
      } else {
        strippedCode = trimmed.slice(endIndex + 2);
      }
    } else {
      // No more leading comments
      strippedCode = trimmed;
      break;
    }
  }

  // Use the stripped code for transformation (but keep original for analysis)
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
