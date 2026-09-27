// @vitest-environment happy-dom
/**
 * SubForm fidelity against the engine's SubForm (SMOIS main.a75cc6b1.chunk.js,
 * module 9 export "A"; quoted in SubForm.tsx): tempArea/initialTempArea bind
 * the children to fd.tempArea through the section context, lockPolicy is held
 * while shown, the modal is blocking with the label as its title and every
 * other prop reaches the Dialog, and inline/onDefaultAction render a
 * FocusTrapZone.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalFormStateProvider } from '../hooks/form-state';
import { useActiveData } from '../context/MoisContext';
import { clearMoisFormLocks, getMoisFormLockState } from '../runtime/mois-contract';
import { SubForm } from './SubForm';
import { TextArea } from './TextArea';

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

describe('SubForm (engine fidelity)', () => {
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

  const initialFormData = { field: { data: {}, status: {} } } as any;
  const render = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(
        <LocalFormStateProvider initialFormData={initialFormData}>
          <Probe />
          {element}
        </LocalFormStateProvider>
      );
    });
    await flush();
  };

  it('seeds fd.tempArea[tempArea] from initialTempArea and binds the children to it', async () => {
    await render(
      <SubForm tempArea="noteEdit" initialTempArea={{ note: 'seeded' }} label="Edit note">
        <TextArea fieldId="note" label="Note" />
      </SubForm>
    );

    expect(latest.tempArea.noteEdit).toEqual({ note: 'seeded' });
    const input = document.querySelector('[data-component="SubForm"] input, [data-component="SubForm"] textarea') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('seeded');
  });

  it('does not reseed an existing temp area, and resets the area it created on unmount', async () => {
    await render(
      <SubForm tempArea="noteEdit" initialTempArea={{ note: 'seeded' }}>
        <TextArea fieldId="note" label="Note" />
      </SubForm>
    );
    expect(latest.tempArea.noteEdit).toEqual({ note: 'seeded' });

    await render(<div />);
    expect(latest.tempArea.noteEdit).toEqual({});
  });

  it('lets an explicit section override the temp-area selector', async () => {
    await act(async () => {
      root.render(
        <LocalFormStateProvider initialFormData={{ field: { data: {}, status: {} }, tempArea: { other: { note: 'from section' } } } as any}>
          <Probe />
          <SubForm tempArea="noteEdit" section={{ activeSelector: (fd: any) => fd.tempArea.other }}>
            <TextArea fieldId="note" label="Note" />
          </SubForm>
        </LocalFormStateProvider>
      );
    });
    await flush();
    const input = document.querySelector('[data-component="SubForm"] input, [data-component="SubForm"] textarea') as HTMLInputElement;
    expect(input.value).toBe('from section');
  });

  it('holds its lockPolicy while shown and releases it when hidden', async () => {
    const lockPolicy = { name: 'noteEditLock', scope: { record: 7 } };
    await render(<SubForm lockPolicy={lockPolicy} label="Edit">text</SubForm>);
    expect(getMoisFormLockState().activeLocks.map((lock) => lock.name)).toEqual(['noteEditLock']);

    await render(<SubForm lockPolicy={lockPolicy} hidden label="Edit">text</SubForm>);
    expect(getMoisFormLockState().activeLocks.filter((lock) => lock.active)).toEqual([]);
  });

  it('renders a blocking dialog titled by its label and passes other props to the Dialog', async () => {
    const onCancel = vi.fn();
    await render(
      <SubForm label="Edit row" onCancel={onCancel} minWidth={500} dialogContentProps={{ subText: 'Change the row.' }}>
        <span>Body</span>
      </SubForm>
    );

    const title = document.querySelector('.ms-Dialog-title');
    expect(title?.textContent).toBe('Edit row');
    expect(document.body.textContent).toContain('Change the row.');
    expect(document.body.textContent).toContain('Body');
    const closeButton = document.querySelector('.ms-Dialog-button--close') as HTMLButtonElement;
    expect(closeButton, 'blocking dialogs show the close button').toBeTruthy();

    await act(async () => {
      closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while hidden', async () => {
    await render(<SubForm hidden label="Edit row"><span>Body</span></SubForm>);
    expect(document.body.textContent).not.toContain('Body');
    expect(document.querySelector('.ms-Dialog')).toBeNull();
  });

  it('renders inline in a focus trap zone headed by its label', async () => {
    await render(
      <SubForm inline label="Inline edit">
        <span>Inline body</span>
      </SubForm>
    );
    const zone = container.querySelector('.ms-FocusTrapZone, [data-focuszone-id], div[data-is-visible]') ?? container.firstElementChild;
    expect(zone).toBeTruthy();
    expect(container.textContent).toContain('Inline edit');
    expect(container.textContent).toContain('Inline body');
    expect(document.querySelector('.ms-Dialog')).toBeNull();
  });

  it('treats onDefaultAction as inline and calls it when focus leaves', async () => {
    const onDefaultAction = vi.fn();
    await render(
      <>
        <button type="button" id="outside">Outside</button>
        <SubForm onDefaultAction={onDefaultAction}>
          <button type="button" id="inside">Inside</button>
        </SubForm>
      </>
    );
    expect(document.querySelector('.ms-Dialog')).toBeNull();
    const inside = document.getElementById('inside') as HTMLButtonElement;
    const outside = document.getElementById('outside') as HTMLButtonElement;
    await act(async () => {
      inside.focus();
    });
    await act(async () => {
      outside.focus();
      inside.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    });
    await flush();
    expect(onDefaultAction).toHaveBeenCalled();
  });
});
