// @vitest-environment happy-dom
/**
 * Regression tests for the form-state subscription store: slice consumers
 * (useActiveDataSlice) must re-render only when their selected slice changes,
 * while whole-state consumers (useActiveDataForForms) re-render on every
 * update as before.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { LocalFormStateProvider, useActiveDataSlice, useActiveDataForForms } from '../form-state';

const renderCounts: Record<string, number> = {};
let capturedSetter: ((updater: any) => void) | null = null;

const SliceConsumer: React.FC<{ id: string }> = ({ id }) => {
  renderCounts[id] = (renderCounts[id] ?? 0) + 1;
  const [slice] = useActiveDataSlice((data) => ({ value: data.field.data[id] }));
  return React.createElement('span', { 'data-id': id }, String(slice.value ?? ''));
};

const BroadConsumer: React.FC = () => {
  renderCounts.broad = (renderCounts.broad ?? 0) + 1;
  const [fd, setFormData] = useActiveDataForForms();
  capturedSetter = setFormData;
  return React.createElement('span', { 'data-id': 'broad' }, String(fd.field?.data?.a ?? ''));
};

describe('form-state subscription store', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    for (const key of Object.keys(renderCounts)) delete renderCounts[key];
    capturedSetter = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const mount = async () => {
    await act(async () => {
      root.render(
        React.createElement(
          LocalFormStateProvider,
          null,
          React.createElement(SliceConsumer, { id: 'a' }),
          React.createElement(SliceConsumer, { id: 'b' }),
          React.createElement(BroadConsumer, null),
        )
      );
    });
  };

  it('updates slice consumers whose slice changed and propagates the value', async () => {
    await mount();
    await act(async () => {
      capturedSetter!((draft: any) => {
        draft.field.data.a = 'hello';
      });
    });

    expect(container.querySelector('[data-id="a"]')!.textContent).toBe('hello');
    expect(container.querySelector('[data-id="broad"]')!.textContent).toBe('hello');
  });

  it('skips re-rendering slice consumers whose slice did not change', async () => {
    await mount();
    const before = { ...renderCounts };

    await act(async () => {
      capturedSetter!((draft: any) => {
        draft.field.data.a = 'hello';
      });
    });

    // Field "a" changed: its consumer and the whole-state consumer re-render.
    expect(renderCounts.a).toBeGreaterThan(before.a);
    expect(renderCounts.broad).toBeGreaterThan(before.broad);
    // Field "b" untouched: its consumer must NOT re-render.
    expect(renderCounts.b).toBe(before.b);
  });

  it('keeps whole-state consumers re-rendering on every update', async () => {
    await mount();
    const before = renderCounts.broad;

    await act(async () => {
      capturedSetter!((draft: any) => {
        draft.field.data.unrelated = 1;
      });
    });
    await act(async () => {
      capturedSetter!((draft: any) => {
        draft.field.data.unrelated = 2;
      });
    });

    expect(renderCounts.broad).toBeGreaterThanOrEqual(before + 2);
  });
});
