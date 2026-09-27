// @vitest-environment happy-dom
/**
 * The preview-adaptation layer against the engine (AGENTS.md, "Preview-
 * adaptation hooks"): a control's write through a section with its own
 * selector lands in that target only, never in `field.data` (so a SubForm
 * `tempArea` is not saved with the form), and the form-scope `useTempData`
 * is the engine's `useTempData(tempArea, initialTempArea)` (hooks/temp-data.ts).
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { produce } from 'immer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFormStateProvider } from '../hooks/form-state';
import { useActiveData } from '../context/MoisContext';
import { useTempData } from '../hooks/mock-hooks';
import { SubForm } from '../controls/SubForm';
import { TextArea } from '../controls/TextArea';
import { clearMoisFormLocks, writeSectionActiveFieldValue } from './mois-contract';

type State = Record<string, any>;

describe('writeSectionActiveFieldValue', () => {
  it('writes field.data and its preview formData mirror when the section has no selector of its own', () => {
    const base: State = { field: { data: {}, status: {} }, formData: {} };
    const next: State = produce(base, (draft: State) => {
      writeSectionActiveFieldValue(draft, undefined, 'note', 'typed', ['noteCopy']);
    });
    expect(next.field.data).toEqual({ note: 'typed', noteCopy: 'typed' });
    expect(next.formData).toEqual({ note: 'typed', noteCopy: 'typed' });
  });

  it('writes only the section target when the section has its own selector, as the engine does', () => {
    const section = { activeSelector: (fd: any) => fd.tempArea.noteEdit };
    const base: State = { field: { data: { other: 1 }, status: {} }, formData: { other: 1 }, tempArea: { noteEdit: {} } };
    const next: State = produce(base, (draft: State) => {
      writeSectionActiveFieldValue(draft, section, 'note', 'typed', ['noteCopy']);
    });
    expect(next.tempArea.noteEdit).toEqual({ note: 'typed', noteCopy: 'typed' });
    expect(next.field.data).toEqual({ other: 1 });
    expect(next.formData).toEqual({ other: 1 });
  });
});

let latest: any = null;
const Probe = () => {
  const [fd] = useActiveData();
  latest = fd;
  return null;
};

const flush = async () => {
  await act(async () => {});
  await act(async () => {});
};

describe('SubForm tempArea and useTempData in preview', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    latest = null;
    clearMoisFormLocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    clearMoisFormLocks();
  });

  const render = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(
        <LocalFormStateProvider initialFormData={{ field: { data: {}, status: {} } } as any}>
          <Probe />
          {element}
        </LocalFormStateProvider>
      );
    });
    await flush();
  };

  it('keeps an answer typed into a SubForm temp area out of field.data', async () => {
    await render(
      <SubForm tempArea="noteEdit" initialTempArea={{ note: '' }} label="Edit note">
        <TextArea fieldId="note" label="Note" />
      </SubForm>
    );
    const input = document.querySelector('[data-component="SubForm"] input, [data-component="SubForm"] textarea') as
      | HTMLInputElement
      | HTMLTextAreaElement;
    expect(input).toBeTruthy();
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!;
    await act(async () => {
      setter.call(input, 'typed');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();

    expect(latest.tempArea.noteEdit.note).toBe('typed');
    expect(latest.field.data.note).toBeUndefined();
    expect(latest.formData?.note).toBeUndefined();
  });

  it('gives a form the engine contract: [section override, temp data], seeded once', async () => {
    let result: ReturnType<typeof useTempData> | null = null;
    const Form = () => {
      result = useTempData('draft', { count: 1 });
      return null;
    };
    await render(<Form />);

    expect(latest.tempArea.draft).toEqual({ count: 1 });
    const [section, data] = result!;
    expect(data).toEqual({ count: 1 });
    expect(section?.activeSelector(latest)).toBe(latest.tempArea.draft);
  });

  it('returns [null, null] without an area name', async () => {
    let result: ReturnType<typeof useTempData> | null = null;
    const Form = () => {
      result = useTempData(null, { count: 1 });
      return null;
    };
    await render(<Form />);
    expect(result).toEqual([null, null]);
    expect(latest.tempArea ?? {}).toEqual({});
  });
});
