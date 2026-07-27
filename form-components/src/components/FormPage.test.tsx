// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Form } from './Form';
import { Page } from './Page';
import { resetPageSelection } from './PageSelect';

describe('Form and Page width fidelity', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    resetPageSelection();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps the native 950px maximum on Form only', async () => {
    await act(async () => {
      root.render(
        <Form>
          <Page pageId={0}>
            <div data-testid="page-content">Page content</div>
          </Page>
        </Form>
      );
    });

    const formStack = container.querySelector('.ms-Stack') as HTMLElement;
    const pageContent = container.querySelector('[data-testid="page-content"]') as HTMLElement;

    expect(formStack.style.maxWidth).toBe('950px');
    expect(formStack.style.margin).toBe('auto');
    expect(pageContent.closest('[style*="max-width"]')).toBe(formStack);
    expect(container.querySelectorAll('[style*="max-width: 950px"]').length).toBe(1);
  });

  it('lets Form fill its container without a nested Page cap', async () => {
    await act(async () => {
      root.render(
        <Form maxWidth="100%">
          <Page pageId={0}>
            <div data-testid="page-content">Page content</div>
          </Page>
        </Form>
      );
    });

    const formStack = container.querySelector('.ms-Stack') as HTMLElement;
    const pageContent = container.querySelector('[data-testid="page-content"]') as HTMLElement;

    expect(formStack.style.maxWidth).toBe('100%');
    expect(pageContent.closest('[style*="max-width"]')).toBe(formStack);
    expect(container.querySelector('[style*="max-width: 950px"]')).toBeNull();
  });
});
