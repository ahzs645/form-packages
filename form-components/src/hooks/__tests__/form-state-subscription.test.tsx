// @vitest-environment happy-dom
/**
 * Regression tests for the form-state subscription store: slice consumers
 * (useActiveDataSlice) must re-render only when their selected slice changes,
 * while whole-state consumers (useActiveDataForForms) re-render on every
 * update as before.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { LocalFormStateProvider, useActiveDataSlice, useActiveDataForForms } from '../form-state';
import { wrapSandboxComponent } from '../../runtime/render-write-tripwire';

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

  // Legacy/eval'd MOIS components call setFormData during render. Consumers
  // re-render via the store subscription rather than the provider's render
  // pass, so these writes MUST be deferred unconditionally — a synchronous
  // setState here is setState-during-render of a foreign component and loops
  // (React #185, seen in production 2026-07-02).
  it('tolerates conditional render-phase writes and converges', async () => {
    const RenderPhaseWriter: React.FC = () => {
      const [fd, setFormData] = useActiveDataForForms();
      if (!fd.field?.data?.initialized) {
        setFormData((draft: any) => {
          draft.field.data.initialized = true;
        });
      }
      return React.createElement('span', { 'data-id': 'writer' }, String(fd.field?.data?.initialized ?? false));
    };

    await act(async () => {
      root.render(
        React.createElement(LocalFormStateProvider, null, React.createElement(RenderPhaseWriter, null))
      );
    });
    // Drain the deferred microtask flush + resulting re-render
    await act(async () => {});

    expect(container.querySelector('[data-id="writer"]')!.textContent).toBe('true');
  });

  it('reaches a fixed point for unconditional idempotent render-phase writes', async () => {
    let renders = 0;
    const UnconditionalWriter: React.FC = () => {
      renders += 1;
      const [fd, setFormData] = useActiveDataForForms();
      setFormData((draft: any) => {
        draft.field.data.always = 'same';
      });
      return React.createElement('span', { 'data-id': 'always' }, String(fd.field?.data?.always ?? ''));
    };

    await act(async () => {
      root.render(
        React.createElement(LocalFormStateProvider, null, React.createElement(UnconditionalWriter, null))
      );
    });
    await act(async () => {});

    expect(container.querySelector('[data-id="always"]')!.textContent).toBe('same');
    // The idempotent re-write must no-op (immer bails) instead of looping.
    expect(renders).toBeLessThan(10);
  });

  it('warns (once) when a wrapped sandbox component writes during render', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const SandboxWriter = wrapSandboxComponent('SandboxWriter', () => {
        const [fd, setFormData] = useActiveDataForForms();
        if (!fd.field?.data?.sandboxInit) {
          setFormData((draft: any) => {
            draft.field.data.sandboxInit = true;
          });
        }
        return React.createElement('span', { 'data-id': 'sandbox' }, String(fd.field?.data?.sandboxInit ?? false));
      });

      await act(async () => {
        root.render(
          React.createElement(LocalFormStateProvider, null, React.createElement(SandboxWriter, null))
        );
      });
      await act(async () => {});

      // Write still lands (deferred), and the tripwire warned exactly once
      expect(container.querySelector('[data-id="sandbox"]')!.textContent).toBe('true');
      const tripwireWarnings = warnSpy.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('SandboxWriter')
      );
      expect(tripwireWarnings.length).toBe(1);
    } finally {
      warnSpy.mockRestore();
    }
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
